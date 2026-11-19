import assert from 'node:assert/strict';
import test from 'node:test';
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

test('publication pages stay independent, opt in individually and keep canonical front/back order', () => {
  const manuscript = createVersionedTestManuscript();
  manuscript.documentStructure = createDocumentStructureProfile('volume');
  manuscript.titleMatter = { halfTitle: 'Short title', publisherName: 'Example Press', colophon: 'Edited independently' };
  const model = createPublicationMatter(manuscript);
  assert.equal(model.pages.length, 8);
  assert.ok(model.pages.every((page) => !page.enabled));
  assert.match(model.pages.find((page) => page.kind === 'half-title')!.content, /Short title/);
  const sectionsBefore = JSON.stringify(manuscript.sections);
  model.pages.forEach((page) => { page.enabled = true; });
  model.pages.reverse();
  manuscript.extensions = { [PUBLICATION_MATTER_EXTENSION]: model };
  assert.deepEqual([...publicationMatterPages(manuscript, 'before'), ...publicationMatterPages(manuscript, 'after')].map((page) => page.kind), [...PUBLICATION_MATTER_PAGES]);
  const html = renderHtmlArticle(manuscript).html;
  assert.ok(html.indexOf('data-publication-matter="front-cover"') < html.indexOf('<article class="omi-scholarly-article"'));
  assert.ok(html.indexOf('data-publication-matter="inside-back-cover"') > html.indexOf('</article>'));
  assert.equal((html.match(/data-publication-matter=/g) ?? []).length, 8);
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
  assert.match(buildPdfPrintDocument(manuscript), /data-publication-matter="front-cover"/);
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
