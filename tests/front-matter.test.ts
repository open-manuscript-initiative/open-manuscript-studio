import assert from 'node:assert/strict';
import test from 'node:test';
import { createPublicationMatterFrame, fitPublicationMatterImage, matterFrameBoxStyle, matterImageStyle, reorderPublicationMatterFrame, resizePublicationMatterImage } from '../src/model/publicationMatterFrames.ts';
import { PUBLICATION_MEASUREMENT_UNITS, formatPublicationMeasurement, isPublicationMeasurementUnit, parsePublicationMeasurement, publicationMeasurementFromMm, publicationMeasurementToMm } from '../src/model/publicationMeasurementUnits.ts';
import { frameGraphicTransform } from '../src/model/publicationFramePages.ts';
import { createVersionedTestManuscript } from './testManuscriptFixture.ts';
import { createDocumentStructureProfile } from '../src/model/documentProfile.ts';
import { createPublicationMatter, getPublicationMatter, PUBLICATION_MATTER_EXTENSION, PUBLICATION_MATTER_PAGES, publicationMatterPages, validatePublicationMatter } from '../src/model/publicationMatter.ts';
import { renderHtmlArticle } from '../src/services/exportHtml.ts';
import { buildPdfPrintDocument, buildPdfArtifactDocument } from '../src/services/exportPdf.ts';
import { createAssetMetadata, collectReferencedManuscriptAssetIds } from '../src/model/assets.ts';
import { putAssetPayload } from '../src/services/assetRepository.ts';
import { buildOmiContainer } from '../src/services/omiContainer.ts';
import { inspectOmiContainer } from '../src/services/omiContainerImport.ts';
import { buildHtmlPackage } from '../src/services/exportHtmlPackage.ts';
import { serializeOmiJson } from '../src/services/exportOmi.ts';
import { parseOmiJson } from '../src/services/omiPortableFormat.ts';
import { createInitialVersioningEnvelope, extractManuscriptState } from '../src/model/versioning.ts';
import { clonePublicationStyleTemplate, clonePublicationPublisherTemplate, renderStyleBasedHtml } from '../src/services/publicationStyleExport.ts';

import {
  getPublicationFrontMatterRules,
  normalizeOptionalFrontMatterValue,
  serializePublicationProfileWithFrontMatter,
} from '../src/model/frontMatter.ts';
import {
  BUILTIN_PUBLICATION_PROFILES,
  resolvePublicationProfile,
} from '../src/model/publicationProfile.ts';


test('normalizes an intentionally empty optional front-matter field to absence', () => {
  assert.equal(normalizeOptionalFrontMatterValue(''), undefined);
  assert.equal(normalizeOptionalFrontMatterValue('A subtitle'), 'A subtitle');
  assert.equal(normalizeOptionalFrontMatterValue('Sapere aude'), 'Sapere aude');
});

test('every built-in publication profile supports optional subtitle and motto', () => {
  for (const profile of BUILTIN_PUBLICATION_PROFILES) {
    const rules = getPublicationFrontMatterRules(profile);
    assert.equal(rules.subtitle.mode, 'optional');
    assert.equal(rules.subtitle.position, 'below-title');
    assert.equal(rules.motto.mode, 'optional');
    assert.equal(rules.motto.position, 'below-subtitle');
  }
});

test('profile export carries explicit reproducible front-matter rules', () => {
  const profile = BUILTIN_PUBLICATION_PROFILES[0];
  assert.ok(profile);

  const exported = JSON.parse(
    serializePublicationProfileWithFrontMatter(profile),
  ) as {
    rules: {
      frontMatter: {
        subtitle: { mode: string };
        motto: { mode: string; style: string; alignment: string };
      };
    };
  };

  assert.equal(exported.rules.frontMatter.subtitle.mode, 'optional');
  assert.equal(exported.rules.frontMatter.motto.mode, 'optional');
  assert.equal(exported.rules.frontMatter.motto.style, 'italic');
  assert.equal(exported.rules.frontMatter.motto.alignment, 'right');
});

test('title pages remain independent while both cover faces precede the body', () => {
  const manuscript = createVersionedTestManuscript();
  manuscript.documentStructure = createDocumentStructureProfile('volume');
  manuscript.titleMatter = { halfTitle: 'Short title', publisherName: 'Example Press', colophon: 'Edited independently' };
  const model = createPublicationMatter(manuscript);
  assert.equal(model.pages.length, 9);
  assert.ok(model.pages.every((page) => !page.enabled));
  assert.match(model.pages.find((page) => page.kind === 'half-title')!.content, /Short title/);
  const sectionsBefore = JSON.stringify(manuscript.sections);
  model.pages.forEach((page) => { page.enabled = page.kind !== 'spine'; });
  model.pages.reverse();
  manuscript.extensions = { [PUBLICATION_MATTER_EXTENSION]: model };
  assert.deepEqual([...publicationMatterPages(manuscript, 'before'), ...publicationMatterPages(manuscript, 'after')].map((page) => page.kind), PUBLICATION_MATTER_PAGES.filter((kind) => kind !== 'spine' && !kind.startsWith('cover-')));
  const html = renderHtmlArticle(manuscript).html;
  assert.ok(html.indexOf('data-cover-sheet="cover-outside"') < html.indexOf('<article class="omi-scholarly-article"'));
  assert.ok(html.indexOf('data-cover-sheet="cover-inside"') < html.indexOf('<article class="omi-scholarly-article"'));
  assert.equal((html.match(/data-publication-matter=/g) ?? []).length, 6);
  assert.match(html, /@page omi_publication_matter/);
  assert.match(html, /counter-increment:page 0/);
  assert.equal(JSON.stringify(manuscript.sections), sectionsBefore);
  manuscript.documentStructure = createDocumentStructureProfile('study');
  assert.doesNotMatch(renderHtmlArticle(manuscript).html, /data-publication-matter=/);
});

test('publication pages preserve rich text in HTML/PDF and OMI while editorial PDF omits them', () => {
  const manuscript = createVersionedTestManuscript();
  manuscript.documentStructure = createDocumentStructureProfile('volume');
  const model = createPublicationMatter(manuscript);
  model.publicationKind = 'journal-issue';
  model.pages[0]!.enabled = true;
  model.pages[0]!.content = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{
    type: 'text', text: 'Independent cover <script>', marks: [{ type: 'bold' }, { type: 'omiUnderline' }, { type: 'omiSmallCaps' }],
  }] }] });
  manuscript.extensions = { [PUBLICATION_MATTER_EXTENSION]: model };
  const html = renderHtmlArticle(manuscript).html;
  assert.match(html, /<strong>Independent cover &lt;script&gt;<\/strong>/);
  assert.match(html, /font-variant:small-caps/);
  assert.match(html, /<u>/);
  assert.match(buildPdfPrintDocument(manuscript), /data-publication-matter="cover-outside"/);
  assert.doesNotMatch(buildPdfPrintDocument(manuscript, undefined, 'print', 'editorial'), /data-publication-matter=/);
  assert.deepEqual(getPublicationMatter(parseOmiJson(serializeOmiJson(manuscript))), model);
});

test('cover-only images survive OMI packaging, HTML packaging and self-contained PDF input', async () => {
  const manuscript = createVersionedTestManuscript();
  manuscript.documentStructure = createDocumentStructureProfile('volume');
  const bytes = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);
  const asset = await createAssetMetadata(bytes, { mediaType: 'image/png', fileName: 'cover.png' });
  await putAssetPayload(manuscript.id, asset.id, bytes);
  const model = createPublicationMatter(manuscript);
  model.pages[0]!.enabled = true;
  model.pages[0]!.image = { assetId: asset.id, alt: 'A cover image', fit: 'cover' };
  manuscript.assets = [asset];
  manuscript.extensions = { [PUBLICATION_MATTER_EXTENSION]: model };
  manuscript.updatedAt = '2026-11-19T08:00:00.000Z';
  Object.assign(manuscript, createInitialVersioningEnvelope(extractManuscriptState(manuscript), {
    summary: 'Prepared cover image', timestamp: '2026-11-19T08:00:00.000Z', completeness: 'complete',
  }));
  assert.ok(collectReferencedManuscriptAssetIds(manuscript).has(asset.id));
  const container = await buildOmiContainer(manuscript);
  assert.equal(container.validForExport, true, JSON.stringify(container.diagnostics));
  const imported = await inspectOmiContainer(container.bytes);
  assert.equal(imported.validForImport, true, JSON.stringify(imported.diagnostics));
  assert.deepEqual(imported.assets[0]?.bytes, bytes);
  assert.deepEqual(getPublicationMatter(imported.manuscript!), model);
  const htmlPackage = await buildHtmlPackage(manuscript);
  assert.equal(htmlPackage.validForExport, true, JSON.stringify(htmlPackage.diagnostics));
  assert.ok(htmlPackage.manifest.entries.some((entry) => entry.assetId === asset.id));
  assert.match(await buildPdfArtifactDocument(manuscript), /src="data:image\/png;base64,/);
  model.pages[0]!.enabled = false;
  assert.ok(collectReferencedManuscriptAssetIds(manuscript).has(asset.id));
});

test('publisher-styled covers follow the selected trim size', async () => {
  const manuscript = createVersionedTestManuscript();
  manuscript.documentStructure = createDocumentStructureProfile('volume');
  const model = createPublicationMatter(manuscript); model.pages[0]!.enabled = true;
  manuscript.extensions = { [PUBLICATION_MATTER_EXTENSION]: model };
  const style = clonePublicationStyleTemplate(); style.page.width = 148; style.page.height = 210;
  const html = await renderStyleBasedHtml(manuscript, resolvePublicationProfile(manuscript), 'html', {
    style, identity: clonePublicationPublisherTemplate(),
  });
  assert.match(html, /@page omi_publication_matter \{ size:148mm 210mm/);
  model.pages.find((page) => page.kind === 'spine')!.enabled = true;
  model.spineWidthMm = 12;
  const spreadHtml = await renderStyleBasedHtml(manuscript, resolvePublicationProfile(manuscript), 'html', { style, identity: clonePublicationPublisherTemplate() });
  assert.ok(spreadHtml.includes('@page omi_publication_cover { size:308mm 210mm'));

});

test('publication-page validation rejects duplicate slots, invalid styles and scholarly anchor nodes', () => {
  const manuscript = createVersionedTestManuscript();
  const model = createPublicationMatter(manuscript);
  const duplicate = structuredClone(model); duplicate.pages[1]!.kind = duplicate.pages[0]!.kind;
  assert.throws(() => validatePublicationMatter(duplicate));
  const style = structuredClone(model); style.pages[0]!.appearance.background = 'url(https://invalid.example)';
  assert.throws(() => validatePublicationMatter(style));
  const anchor = structuredClone(model); anchor.pages[0]!.content = JSON.stringify({ type: 'doc', content: [{ type: 'omiNote' }] });
  assert.throws(() => validatePublicationMatter(anchor));
  manuscript.extensions = { [PUBLICATION_MATTER_EXTENSION]: anchor };
  assert.throws(() => serializeOmiJson(manuscript));
});


test('page-frame and image transforms remain independent, with contain/cover and proportion controls', () => {
  const frame = createPublicationMatterFrame('graphic', 200, 300);
  frame.widthMm = 100; frame.heightMm = 80;
  frame.graphicTransform = frameGraphicTransform(frame, 2);
  const contained = fitPublicationMatterImage(frame, 'contain');
  assert.deepEqual([contained.widthMm, contained.heightMm, contained.offsetXMm, contained.offsetYMm], [100, 50, 0, 15]);
  const covered = fitPublicationMatterImage(frame, 'cover');
  assert.deepEqual([covered.widthMm, covered.heightMm, covered.offsetXMm, covered.offsetYMm], [160, 80, -30, 0]);
  const before = structuredClone(frame);
  frame.xMm = 40; frame.widthMm = 90; frame.rotation = 30;
  assert.deepEqual(frame.graphicTransform, before.graphicTransform);
  const box = matterFrameBoxStyle(frame, 200, 300);
  assert.equal(box.left, '20%'); assert.equal(box.width, '45%'); assert.equal(box.transform, 'rotate(30deg)');
  const geometry = [frame.xMm, frame.yMm, frame.widthMm, frame.heightMm, frame.rotation];
  frame.graphicTransform = { ...contained, offsetXMm: -12, rotation: -20 };
  assert.equal(matterImageStyle(frame).transform, 'rotate(-20deg)');
  assert.deepEqual([frame.xMm, frame.yMm, frame.widthMm, frame.heightMm, frame.rotation], geometry);
  const proportional = resizePublicationMatterImage(contained, 'widthMm', 200);
  assert.deepEqual([proportional.widthMm, proportional.heightMm], [200, 100]);
  const stretched = resizePublicationMatterImage({ ...contained, keepAspectRatio: false }, 'heightMm', 120);
  assert.deepEqual([stretched.widthMm, stretched.heightMm], [100, 120]);
  const bounded = resizePublicationMatterImage({ ...contained, widthMm: 100, heightMm: 1000 }, 'widthMm', 20000);
  assert.deepEqual([bounded.widthMm, bounded.heightMm], [2000, 20000]);
  assert.throws(() => resizePublicationMatterImage(contained, 'widthMm', NaN));
});

test('rich title-page frames render with shapes, independent transforms and ordered layers', () => {
  const manuscript = createVersionedTestManuscript();
  manuscript.documentStructure = createDocumentStructureProfile('volume');
  const model = createPublicationMatter(manuscript), page = model.pages[4]!;
  page.enabled = true;
  const text = createPublicationMatterFrame('text', 210, 297);
  Object.assign(text, { id: 'title-text', xMm: 21, yMm: 29.7, widthMm: 105, heightMm: 59.4, rotation: 15, shape: 'ellipse' });
  text.content = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A <Title> & author', marks: [{ type: 'italic' }, { type: 'omiSmallCaps' }] }] }] });
  const graphic = createPublicationMatterFrame('graphic', 210, 297);
  graphic.id = 'title-image'; graphic.image = { assetId: 'missing-artwork', alt: 'Logo' };
  graphic.shape = 'polygon'; graphic.points = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 100 }];
  graphic.graphicTransform = { ...frameGraphicTransform(graphic, 2), offsetXMm: -8, rotation: -25 };
  page.frames = [graphic, text];
  manuscript.extensions = { [PUBLICATION_MATTER_EXTENSION]: model };
  const sectionsBefore = JSON.stringify(manuscript.sections);
  const result = renderHtmlArticle(manuscript);
  assert.ok(result.html.includes('<em>A &lt;Title&gt; &amp; author</em>'));
  assert.ok(result.html.includes('font-variant:small-caps'));
  assert.ok(result.html.includes('left:10%;top:10%;width:50%;height:20%;transform:rotate(15deg)'));
  assert.ok(result.html.includes('clip-path:ellipse(50% 50% at 50% 50%)'));
  assert.ok(result.html.includes('clip-path:polygon(evenodd, 0% 0%, 100% 0%, 50% 100%)'));
  assert.ok(result.html.indexOf('data-matter-frame-id="title-image"') < result.html.indexOf('data-matter-frame-id="title-text"'));
  assert.ok(result.diagnostics.some((item) => item.code === 'publication-matter-frame-image-missing' && item.targetId === graphic.id));
  assert.equal(JSON.stringify(manuscript.sections), sectionsBefore);
  assert.deepEqual(getPublicationMatter(parseOmiJson(serializeOmiJson(manuscript))), model);
  assert.throws(() => buildPdfPrintDocument(manuscript), /missing or unsupported/);
  delete graphic.image;
  assert.ok(buildPdfPrintDocument(manuscript).includes('data-matter-frame-id="title-text"'));
  assert.equal(buildPdfPrintDocument(manuscript, undefined, 'print', 'editorial').includes('data-matter-frame-id='), false);
  page.enabled = false;
  assert.equal(renderHtmlArticle(manuscript).html.includes('data-matter-frame-id='), false);
});

test('frame-only images survive OMI/HTML packaging and self-contained PDF with their independent crop', async () => {
  const manuscript = createVersionedTestManuscript();
  manuscript.documentStructure = createDocumentStructureProfile('volume');
  const bytes = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);
  const asset = await createAssetMetadata(bytes, { mediaType: 'image/png', fileName: 'title-frame.png' });
  await putAssetPayload(manuscript.id, asset.id, bytes);
  const model = createPublicationMatter(manuscript), page = model.pages[4]!;
  page.enabled = true;
  const frame = createPublicationMatterFrame('graphic', 210, 297);
  frame.image = { assetId: asset.id, alt: 'Frame image & description' };
  frame.rotation = 10;
  frame.graphicTransform = { ...frameGraphicTransform(frame, 2), offsetXMm: -10, rotation: -30 };
  page.frames = [frame];
  manuscript.assets = [asset]; manuscript.extensions = { [PUBLICATION_MATTER_EXTENSION]: model };
  manuscript.updatedAt = '2026-11-19T08:00:00.000Z';
  Object.assign(manuscript, createInitialVersioningEnvelope(extractManuscriptState(manuscript), { summary: 'Title frame artwork', timestamp: manuscript.updatedAt, completeness: 'complete' }));
  assert.ok(collectReferencedManuscriptAssetIds(manuscript).has(asset.id));
  const container = await buildOmiContainer(manuscript);
  assert.equal(container.validForExport, true, JSON.stringify(container.diagnostics));
  const imported = await inspectOmiContainer(container.bytes);
  assert.equal(imported.validForImport, true, JSON.stringify(imported.diagnostics));
  assert.deepEqual(imported.assets[0]?.bytes, bytes);
  assert.deepEqual(getPublicationMatter(imported.manuscript!), model);
  const htmlPackage = await buildHtmlPackage(manuscript);
  assert.equal(htmlPackage.validForExport, true, JSON.stringify(htmlPackage.diagnostics));
  assert.ok(htmlPackage.manifest.entries.some((entry) => entry.assetId === asset.id));
  const pdf = await buildPdfArtifactDocument(manuscript);
  assert.ok(pdf.includes('src="data:image/png;base64,'));
  assert.ok(pdf.includes('transform:rotate(10deg)'));
  assert.ok(pdf.includes('transform:rotate(-30deg)'));
  assert.ok(pdf.includes('Frame image &amp; description'));
  page.enabled = false;
  assert.ok(collectReferencedManuscriptAssetIds(manuscript).has(asset.id));
});

test('page-frame validation accepts legacy pages and rejects malformed frames and scholarly atoms', () => {
  const model = createPublicationMatter(createVersionedTestManuscript());
  assert.doesNotThrow(() => validatePublicationMatter(model));
  const frame = createPublicationMatterFrame('text', 210, 297);
  model.pages[0]!.frames = [frame];
  assert.doesNotThrow(() => validatePublicationMatter(model));
  const invalid = [
    { widthMm: NaN }, { xMm: Infinity }, { heightMm: -1 }, { rotation: 361 },
    { shape: 'script' }, { points: [{ x: 101, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 1 }] },
    { style: { ...frame.style, fill: 'url(https://example.org)' } },
    { content: JSON.stringify({ type: 'doc', content: [{ type: 'omiNote' }] }) },
    { image: { assetId: 'image', alt: '' } },
  ];
  for (const patch of invalid) {
    const next = structuredClone(model);
    Object.assign(next.pages[0]!.frames![0]!, patch);
    assert.throws(() => validatePublicationMatter(next), JSON.stringify(patch));
  }
  const duplicate = structuredClone(model); duplicate.pages[0]!.frames!.push(structuredClone(frame));
  assert.throws(() => validatePublicationMatter(duplicate));
  const graphic = createPublicationMatterFrame('graphic', 210, 297);
  model.pages[0]!.frames = [graphic];
  for (const transform of [null, { ...frameGraphicTransform(graphic), rotation: Infinity }, { ...frameGraphicTransform(graphic), widthMm: 0 }]) {
    const next = structuredClone(model); Object.assign(next.pages[0]!.frames![0]!, { graphicTransform: transform });
    assert.throws(() => validatePublicationMatter(next));
  }
});


test('legacy exterior panels render on one sheet even when the spine content is disabled', () => {
  const manuscript = createVersionedTestManuscript();
  manuscript.documentStructure = createDocumentStructureProfile('volume');
  const model = createPublicationMatter(manuscript);
  model.spineWidthMm = 18;
  const front = model.pages.find((page) => page.kind === 'front-cover')!;
  const back = model.pages.find((page) => page.kind === 'back-cover')!;
  const spine = model.pages.find((page) => page.kind === 'spine')!;
  for (const page of [front, back, spine]) page.enabled = true;
  const frame = createPublicationMatterFrame('text', model.spineWidthMm, 297);
  frame.content = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A rotated spine title' }] }] });
  assert.equal(frame.rotation, 90);
  frame.rotation = -90;
  spine.frames = [frame];
  manuscript.extensions = { [PUBLICATION_MATTER_EXTENSION]: model };
  validatePublicationMatter(model);
  const result = renderHtmlArticle(manuscript).html;
  assert.ok(result.includes('@page omi_publication_cover { size:438mm 297mm'));
  assert.ok(result.includes('data-spine-width-mm="18" style="width:438mm;height:297mm"'));
  assert.equal((result.match(/data-cover-sheet="cover-outside"/g) ?? []).length, 1);
  assert.ok(result.includes('cover-back-cover-background'));
  assert.ok(result.includes('cover-spine-background'));
  assert.ok(result.includes('cover-front-cover-background'));
  assert.ok(result.includes('left:47.94520547945205%'));
  assert.ok(result.includes('transform:rotate(-90deg)'));
  assert.ok(buildPdfPrintDocument(manuscript).includes('data-spine-width-mm="18"'));
  assert.deepEqual(getPublicationMatter(parseOmiJson(serializeOmiJson(manuscript))), model);
  const geometry = structuredClone(frame);
  model.spineWidthMm = 8;
  assert.deepEqual(frame, geometry);
  assert.ok(renderHtmlArticle(manuscript).html.includes('size:428mm 297mm'));
  // A disabled outside cover leaves a blank panel instead of leaking its retained draft.
  back.enabled = false;
  assert.equal(renderHtmlArticle(manuscript).html.includes('cover-back-cover-background'), false);
  assert.ok(renderHtmlArticle(manuscript).html.includes('width:428mm;height:297mm'));
  spine.enabled = false;
  assert.equal(renderHtmlArticle(manuscript).html.includes('data-spine-width-mm='), true);
  assert.throws(() => validatePublicationMatter({ ...model, spineWidthMm: NaN }));
  assert.doesNotThrow(() => validatePublicationMatter({ ...model, spineWidthMm: 0 }));
  assert.throws(() => validatePublicationMatter({ ...model, spineWidthMm: -1 }));
  assert.throws(() => validatePublicationMatter({ ...model, spineWidthMm: 101 }));
  const legacy = { ...model, spineWidthMm: undefined, pages: model.pages.filter((page) => page.kind !== 'spine') };
  assert.doesNotThrow(() => validatePublicationMatter(legacy));
});


test('overlapping frame layers reorder without changing content or geometry and survive OMI/HTML/PDF', () => {
  const manuscript = createVersionedTestManuscript();
  manuscript.documentStructure = createDocumentStructureProfile('volume');
  const model = createPublicationMatter(manuscript), page = model.pages[4]!;
  page.enabled = true;
  const frames = ['Bottom', 'Middle', 'Top'].map((name) => {
    const frame = createPublicationMatterFrame('text', 210, 297);
    frame.name = name; frame.xMm = 30; frame.yMm = 40;
    frame.content = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: name }] }] });
    return frame;
  });
  const original = structuredClone(frames);
  page.frames = reorderPublicationMatterFrame(frames, frames[0]!.id, 1);
  assert.deepEqual(page.frames.map((frame) => frame.name), ['Middle', 'Bottom', 'Top']);
  page.frames = reorderPublicationMatterFrame(page.frames, frames[2]!.id, 0);
  assert.deepEqual(page.frames.map((frame) => frame.name), ['Top', 'Middle', 'Bottom']);
  assert.deepEqual(frames, original);
  for (const frame of page.frames) assert.deepEqual(frame, original.find((item) => item.id === frame.id));
  manuscript.extensions = { [PUBLICATION_MATTER_EXTENSION]: model };
  const restored = parseOmiJson(serializeOmiJson(manuscript));
  assert.deepEqual(getPublicationMatter(restored)!.pages[4]!.frames, page.frames);
  const layerOrder = (html: string) => [...html.matchAll(/data-matter-frame-id="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(layerOrder(renderHtmlArticle(restored).html), page.frames.map((frame) => frame.id));
  assert.deepEqual(layerOrder(buildPdfPrintDocument(restored)), page.frames.map((frame) => frame.id));
  assert.throws(() => reorderPublicationMatterFrame(frames, 'unknown-frame', 0));
  assert.throws(() => reorderPublicationMatterFrame(frames, frames[0]!.id, frames.length));
});


test('publication measurement units use DTP points and picas with physical round trips', () => {
  assert.equal(publicationMeasurementToMm(72, 'pt'), 25.4);
  assert.equal(publicationMeasurementToMm(6, 'pc'), 25.4);
  assert.ok(Math.abs(publicationMeasurementFromMm(publicationMeasurementToMm(1, 'pc'), 'pt') - 12) < 1e-12);
  for (const unit of PUBLICATION_MEASUREMENT_UNITS) {
    assert.equal(isPublicationMeasurementUnit(unit), true);
    for (const mm of [-20000, -25.4, -0.25, 0, .000001, 1, 12.7, 210, 20000]) {
      const converted = publicationMeasurementFromMm(mm, unit);
      assert.ok(Math.abs(publicationMeasurementToMm(converted, unit) - mm) < 1e-10);
      const displayed = formatPublicationMeasurement(mm, unit);
      const parsed = parsePublicationMeasurement(displayed, unit, -20000, 20000);
      assert.ok(parsed !== undefined && Math.abs(parsed - mm) <= Math.max(1, Math.abs(mm)) * 1e-11);
    }
  }
  assert.equal(isPublicationMeasurementUnit('px'), false);
  assert.equal(isPublicationMeasurementUnit(null), false);
  assert.equal(parsePublicationMeasurement('6', 'pc', 1, 2000), 25.4);
  assert.ok(Math.abs(parsePublicationMeasurement('-12', 'pt', -20000, 20000)! + 25.4 / 6) < 1e-12);
  for (const invalid of ['', ' ', 'not-a-size', 'Infinity', 'NaN', '-1', '100000']) {
    assert.equal(parsePublicationMeasurement(invalid, 'pc', 1, 2000), undefined);
  }
  assert.equal(parsePublicationMeasurement(formatPublicationMeasurement(1, 'pc'), 'pc', 1, 2000), 1);
  assert.equal(parsePublicationMeasurement('0.0000001', 'mm', .000001, 20000), undefined);
});
