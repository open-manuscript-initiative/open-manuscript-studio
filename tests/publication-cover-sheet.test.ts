import assert from 'node:assert/strict';
import test from 'node:test';
import { createVersionedTestManuscript } from './testManuscriptFixture.ts';
import { createDocumentStructureProfile } from '../src/model/documentProfile.ts';
import { createPublicationMatter, getPublicationMatter, PUBLICATION_MATTER_EXTENSION, validatePublicationMatter } from '../src/model/publicationMatter.ts';
import { createCoverSheetFrame, getPublicationCoverSheet, publicationCoverPanels } from '../src/model/publicationCoverSheet.ts';
import { createPublicationMatterFrame } from '../src/model/publicationMatterFrames.ts';
import { calculatedSpineWidthMm, defaultSpineCalculation, PUBLICATION_PAPERS, publicationInsidePageCount, publicationSpineWidth, synchronizePublicationSpine, validateSpineCalculation, withPublicationSpineWidth } from '../src/model/publicationSpine.ts';
import { renderHtmlArticle } from '../src/services/exportHtml.ts';
import { serializeOmiJson } from '../src/services/exportOmi.ts';
import { parseOmiJson } from '../src/services/omiPortableFormat.ts';
import { buildPdfPrintDocument } from '../src/services/exportPdf.ts';

function fixture() {
  const manuscript = createVersionedTestManuscript();
  manuscript.documentStructure = createDocumentStructureProfile('volume');
  const model = createPublicationMatter(manuscript);
  manuscript.extensions = { [PUBLICATION_MATTER_EXTENSION]: model };
  return { manuscript, model };
}
const rich = (text: string) => JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text, marks: [{ type: 'italic' }] }] }] });

test('both cover faces share the same physical sheet, with mirrored front/back panels and a zero-width fold', () => {
  assert.deepEqual(publicationCoverPanels('cover-outside', 148, 12).map((p) => [p.kind, p.xMm, p.widthMm]), [['back-cover', 0, 148], ['spine', 148, 12], ['front-cover', 160, 148]]);
  assert.deepEqual(publicationCoverPanels('cover-inside', 148, 12).map((p) => [p.kind, p.xMm, p.widthMm]), [['inside-front-cover', 0, 148], ['inside-back-cover', 160, 148]]);
  const { manuscript, model } = fixture();
  model.spineWidthMm = 0;
  model.pages[0]!.enabled = true;
  const html = renderHtmlArticle(manuscript).html;
  assert.ok(html.includes('data-spine-width-mm="0" style="width:420mm;height:297mm"'));
  assert.equal((html.match(/data-cover-sheet=/g) ?? []).length, 1);
  assert.doesNotMatch(html, /omi-cover-fold/);
});

test('legacy cover projection retains formatted text, background, image fitting and independent transforms without mutating the document', () => {
  const { manuscript, model } = fixture();
  const front = model.pages[0]!;
  front.enabled = true; front.content = rich('Legacy front'); front.appearance.vertical = 'bottom'; front.appearance.background = '#abc123';
  front.image = { assetId: 'cover-art', alt: 'Art', fit: 'contain' };
  const originalFrame = createPublicationMatterFrame('graphic', 210, 297);
  originalFrame.graphicTransform = { offsetXMm: -4, offsetYMm: 3, widthMm: 100, heightMm: 70, intrinsicWidthMm: 100, intrinsicHeightMm: 70, rotation: -15, keepAspectRatio: false };
  front.frames = [originalFrame];
  const before = JSON.stringify(manuscript);
  const sheet = getPublicationCoverSheet(model, 'cover-outside', 210, 297);
  assert.equal(JSON.stringify(manuscript), before);
  assert.equal(sheet.enabled, true);
  assert.equal(sheet.frames!.find((f) => f.content === front.content)!.vertical, 'bottom');
  assert.equal(sheet.frames!.find((f) => f.image)!.image!.fit, 'contain');
  assert.equal(sheet.frames!.at(-1)!.xMm, originalFrame.xMm + 220);
  assert.deepEqual(sheet.frames!.at(-1)!.graphicTransform, originalFrame.graphicTransform);
  model.pages.push(sheet);
  validatePublicationMatter(model);
  assert.deepEqual(getPublicationMatter(parseOmiJson(serializeOmiJson(manuscript))), model);
  const html = renderHtmlArticle(manuscript).html;
  assert.ok(html.includes('<em>Legacy front</em>'));
  assert.ok(html.includes('justify-content:flex-end'));
  assert.ok(html.includes('#abc123'));
  sheet.enabled = false;
  assert.doesNotMatch(renderHtmlArticle(manuscript).html, /data-cover-sheet=/);
  assert.equal(front.enabled, true);
});

test('sheet frames span folds as a single object and use one global paint order in HTML/PDF and OMI', () => {
  const { manuscript, model } = fixture();
  const sheet = getPublicationCoverSheet(model, 'cover-outside', 210, 297);
  sheet.enabled = true;
  const frame = createCoverSheetFrame('text', 'cover-outside', 'cover-outside', 210, 297, 10);
  frame.xMm = 100; frame.widthMm = 300; frame.content = rich('Across both folds');
  sheet.frames = [frame]; model.pages.push(sheet);
  const html = renderHtmlArticle(manuscript).html;
  assert.equal((html.match(new RegExp(`data-matter-frame-id="${frame.id}"`, 'g')) ?? []).length, 1);
  assert.ok(html.includes('width:69.76744186046511%'));
  assert.ok(html.includes('<em>Across both folds</em>'));
  assert.ok(buildPdfPrintDocument(manuscript).includes('data-cover-sheet="cover-outside"'));
  assert.deepEqual(getPublicationMatter(parseOmiJson(serializeOmiJson(manuscript))), model);
});

test('page count is converted to leaves and each selected paper retains its manufacturer caliper', () => {
  for (const paper of PUBLICATION_PAPERS) {
    const settings = { ...defaultSpineCalculation(300), mode: 'automatic' as const, paperId: paper.id, grammageGsm: paper.grammageGsm, bulkCm3PerG: paper.thicknessMm * 1000 / paper.grammageGsm };
    validateSpineCalculation(settings);
    assert.ok(Math.abs(calculatedSpineWidthMm(settings) - 150 * paper.thicknessMm) < .000001);
  }
  const settings = { ...defaultSpineCalculation(301), allowanceMm: .8 };
  assert.equal(calculatedSpineWidthMm(settings), 15.749);
  assert.equal(calculatedSpineWidthMm({ ...settings, pageCount: 302 }), 15.749);
  assert.equal(calculatedSpineWidthMm({ ...settings, pageCount: 300 }), 15.65);
});

test('automatic pagination excludes cover faces, counts title pages and shifts anchored artwork without scaling it', () => {
  const { model: initialModel, manuscript } = fixture();
  let model = initialModel;
  model.pages[0]!.enabled = true;
  model.pages[4]!.enabled = true;
  const sheet = getPublicationCoverSheet(model, 'cover-outside', 210, 297);
  const right = createCoverSheetFrame('text', 'front-cover', 'cover-outside', 210, 297, 10);
  const spine = createCoverSheetFrame('text', 'spine', 'cover-outside', 210, 297, 10);
  const crossing = createCoverSheetFrame('graphic', 'cover-outside', 'cover-outside', 210, 297, 10);
  sheet.frames = [right, spine, crossing]; model.pages.push(sheet);
  model.spineCalculation = { ...defaultSpineCalculation(201), mode: 'automatic', pageCountSource: 'layout' };
  model.spineWidthMm = publicationSpineWidth(model);
  assert.equal(publicationInsidePageCount(model, 200), 201);
  const previousWidth = publicationSpineWidth(model);
  const next = synchronizePublicationSpine(model, 300);
  const delta = publicationSpineWidth(next) - previousWidth;
  const frames = next.pages.find((p) => p.kind === 'cover-outside')!.frames!;
  assert.equal(frames[0]!.xMm, right.xMm + delta);
  assert.equal(frames[1]!.xMm, spine.xMm + delta / 2);
  assert.equal(frames[0]!.widthMm, right.widthMm);
  assert.deepEqual(frames[2], crossing);
  assert.equal(synchronizePublicationSpine(next, 300), next);
  model = { ...withPublicationSpineWidth(next, 18), spineCalculation: { ...next.spineCalculation!, mode: 'manual' } };
  assert.equal(synchronizePublicationSpine(model, 500), model);
  manuscript.extensions![PUBLICATION_MATTER_EXTENSION] = next;
  assert.deepEqual(getPublicationMatter(parseOmiJson(serializeOmiJson(manuscript)))!.spineCalculation, next.spineCalculation);
  assert.ok(renderHtmlArticle(manuscript).html.includes(`data-spine-width-mm="${publicationSpineWidth(next)}"`));
});

test('spine validation rejects invalid calculations and excessive widths while keeping manual legacy files valid', () => {
  for (const patch of [{ pageCount: 0 }, { pageCount: 1.5 }, { grammageGsm: NaN }, { bulkCm3PerG: 0 }, { allowanceMm: -1 }, { paperId: 'unknown' }, { mode: 'automatic', pageCount: 100000 }]) {
    assert.throws(() => validateSpineCalculation({ ...defaultSpineCalculation(), ...patch }));
  }
  assert.throws(() => validateSpineCalculation(null));
  const { model } = fixture();
  validatePublicationMatter(model);
  model.spineCalculation = { ...defaultSpineCalculation(), mode: 'automatic', pageCountSource: 'layout' };
  assert.throws(() => synchronizePublicationSpine(model, 100000));
});
