import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { resolvePublicationProfile } from '../src/model/publicationProfile.ts';
import { ensureManuscriptRevisionStateDigests } from '../src/model/revisionIntegrity.ts';
import { commitManuscriptRevision, extractManuscriptState } from '../src/model/versioning.ts';
import { buildDocxExport } from '../src/services/exportDocx.ts';
import { buildEpubExport } from '../src/services/exportEpub.ts';
import { renderHtmlArticle, validateHtmlStructure } from '../src/services/exportHtml.ts';
import { renderJatsArticle, validateJatsStructure } from '../src/services/exportJats.ts';
import { parseOmiJson, toPortableOmiManuscript } from '../src/services/omiPortableFormat.ts';
import { buildPdfPrintDocument } from '../src/services/exportPdf.ts';
import {
  createReferenceManuscript,
  REFERENCE_MANUSCRIPT_FEATURES,
  REFERENCE_MANUSCRIPT_NON_PORTABLE_SETTINGS,
} from './referenceManuscriptFixture.ts';

const FIXTURE_URL = new URL(
  './fixtures/reference-manuscript-all-features.omi.json',
  import.meta.url,
);

test('reference fixture is canonical OMI-SPEC-320@0.2.0 and synchronized with its builder', () => {
  const raw = readFileSync(FIXTURE_URL, 'utf8');
  const wire = JSON.parse(raw) as {
    schema?: string;
    omi?: {
      format?: string;
      version?: string;
      profiles?: string[];
      specifications?: Record<string, string>;
    };
  };

  assert.equal(wire.schema, 'https://openmanuscript.org/schemas/omi-manuscript-0.2.schema.json');
  assert.equal(wire.omi?.format, 'manuscript');
  assert.equal(wire.omi?.version, '0.2.0');
  assert.deepEqual(wire.omi?.profiles, ['core-snapshot', 'history-exchange']);
  assert.equal(wire.omi?.specifications?.['OMI-SPEC-160'], '0.1.0');

  const generated = toPortableOmiManuscript(createReferenceManuscript());
  assert.deepEqual(wire, generated);

  const parsed = parseOmiJson(raw);
  assert.deepEqual(toPortableOmiManuscript(parsed), generated);
});

test('reference manuscript covers the portable feature families used by the lifecycle gate', () => {
  const manuscript = parseOmiJson(readFileSync(FIXTURE_URL, 'utf8'));

  assert.equal(REFERENCE_MANUSCRIPT_FEATURES.length, 29);
  assert.ok(REFERENCE_MANUSCRIPT_NON_PORTABLE_SETTINGS.length >= 6);

  assert.deepEqual(
    new Set(manuscript.agents.map((agent) => agent.type)),
    new Set(['person', 'organization', 'consortium', 'project', 'service', 'unidentified']),
  );
  assert.deepEqual(
    new Set((manuscript.assets ?? []).map((asset) => asset.role)),
    new Set(['figure', 'supplementary-material', 'source-data', 'attachment']),
  );
  assert.deepEqual(
    new Set(
      manuscript.sections.flatMap((section) =>
        section.blocks.flatMap((block) => block.visual ? [block.visual.kind] : []),
      ),
    ),
    new Set(['image', 'table', 'chart', 'equation', 'music-score']),
  );
  assert.deepEqual(
    new Set(
      manuscript.sections.flatMap((section) =>
        section.blocks.flatMap((block) =>
          block.visual?.kind === 'music-score' ? [block.visual.format] : [],
        ),
      ),
    ),
    new Set(['musicxml', 'midi']),
  );
  assert.deepEqual(
    new Set(manuscript.annotations.map((annotation) => annotation.type)),
    new Set(['note', 'comment', 'editorial', 'semantic']),
  );
  assert.deepEqual(
    new Set(
      manuscript.annotations
        .map((annotation) => annotation.noteKind)
        .filter(Boolean),
    ),
    new Set(['footnote', 'endnote', 'author-note']),
  );
  assert.deepEqual(
    new Set((manuscript.proofing?.changes ?? []).map((change) => change.status)),
    new Set(['pending', 'accepted', 'rejected']),
  );
  assert.deepEqual(
    new Set((manuscript.publicationCorrections ?? []).map((item) => item.kind)),
    new Set([
      'discretionary-hyphen',
      'nonbreaking',
      'forced-line-break',
      'page-break-before',
      'keep-together',
      'keep-with-next',
    ]),
  );
  assert.deepEqual(
    new Set((manuscript.semanticFields ?? []).map((field) => field.valueType)),
    new Set(['text', 'rich-text', 'date', 'boolean', 'choice']),
  );
  assert.deepEqual(
    new Set((manuscript.computedFields ?? []).map((field) => field.kind)),
    new Set([
      'document-property',
      'semantic-field',
      'cross-reference',
      'current-date',
      'section-count',
      'word-count',
    ]),
  );
  assert.deepEqual(
    new Set((manuscript.generatedListDefinitions ?? []).map((item) => item.kind)),
    new Set(['toc', 'figures', 'tables', 'index', 'references', 'custom']),
  );
  assert.deepEqual(
    new Set((manuscript.crossReferences ?? []).map((item) => item.targetKind)),
    new Set(['section', 'figure', 'table', 'chart', 'equation']),
  );
  assert.deepEqual(
    new Set((manuscript.indexEntries ?? []).map((item) => item.relation)),
    new Set(['location', 'see-also', 'see']),
  );

  assert.equal(manuscript.documentStructure?.kind, 'volume');
  assert.equal(manuscript.documentStructure?.volumeKind, 'edited-volume');
  assert.equal(manuscript.tableOfContents?.hyperlinks, true);
  assert.equal(manuscript.publicationProfile?.id, 'omi-reference-complete');
  assert.equal(manuscript.embeddedPublicationProfile?.rules.layout.columns, 2);
  assert.ok(manuscript.embeddedPublicationProfile?.exportStylesheet?.cssText);
  assert.ok(manuscript.embeddedPublicationProfile?.printStylesheet?.cssText);
  assert.ok(manuscript.metadata?.publicationVenue);
  assert.ok(manuscript.extensions?.['org.pkp.ojs']?.openScience);
  assert.ok(manuscript.localizedFrontMatter?.hu?.abstract);
  assert.ok(manuscript.abstracts?.de);
  assert.ok(manuscript.keywordsByLocale?.hu?.length);
  assert.ok(manuscript.namedAnchors?.length);
  assert.ok(manuscript.categorizedReferenceLists?.length);
  assert.ok(manuscript.indexDefinitions?.length);
  assert.ok(manuscript.generatedIndexes?.length);
  assert.ok(manuscript.titleMatter?.colophon);
  assert.ok(manuscript.motto);
  assert.equal(manuscript.revisionHistory.completeness, 'complete');
  assert.equal(manuscript.revisionHistory.revisions.length, 2);
  assert.equal(manuscript.tombstones.length, 1);

  const richContent = manuscript.sections
    .flatMap((section) => section.blocks)
    .find((block) => block.id === 'block-rich-inline')?.content ?? '';
  for (const marker of [
    '"bold"',
    '"italic"',
    '"strike"',
    '"omiUnderline"',
    '"omiSmallCaps"',
    '"omiSuperscript"',
    '"omiSubscript"',
    '"code"',
    '"omiLanguage"',
    '"omiLink"',
    '"omiCitation"',
    '"omiCrossReference"',
    '"omiNote"',
    '"bulletList"',
    '"orderedList"',
    '"codeBlock"',
  ]) {
    assert.equal(richContent.includes(marker), true, 'missing rich-content marker ' + marker);
  }
});

test('reference manuscript survives edit, save and reopen without losing portable settings', () => {
  const imported = parseOmiJson(readFileSync(FIXTURE_URL, 'utf8'));
  const nextState = extractManuscriptState(imported);
  const introduction = nextState.sections.find(
    (section) => section.id === 'section-introduction',
  );
  const richBlock = introduction?.blocks.find(
    (block) => block.id === 'block-rich-inline',
  );
  assert.ok(richBlock);

  nextState.subtitle =
    'Edited during the import → edit → save → reopen lifecycle conformance test';
  nextState.semanticFields = (nextState.semanticFields ?? []).map((field) =>
    field.id === 'field-short-title'
      ? {
          ...field,
          value: 'OMI Reference — edited',
          modifiedAt: '2026-09-19T13:00:00.000Z',
        }
      : field,
  );

  const parsedRich = JSON.parse(richBlock.content) as {
    type: string;
    content?: Array<{ type?: string; content?: unknown[] }>;
  };
  const firstParagraph = parsedRich.content?.find((node) => node.type === 'paragraph');
  firstParagraph?.content?.push({
    type: 'text',
    text: ' Lifecycle edit persisted.',
  });
  richBlock.content = JSON.stringify(parsedRich);

  const committed = commitManuscriptRevision(imported, nextState, {
    summary: 'Lifecycle conformance edit',
    actorAgentId: 'agent-author',
    timestamp: '2026-09-19T13:00:00.000Z',
    events: [
      {
        operation: 'manuscript.subtitle.set',
        targetId: imported.id,
        path: '/subtitle',
        previousValue: imported.subtitle,
        nextValue: nextState.subtitle,
      },
      {
        operation: 'block.content.set',
        targetId: richBlock.id,
        path: '/sections/section-introduction/blocks/block-rich-inline/content',
        previousValue: imported.sections
          .flatMap((section) => section.blocks)
          .find((block) => block.id === richBlock.id)?.content,
        nextValue: richBlock.content,
      },
    ],
  });

  const saved = ensureManuscriptRevisionStateDigests(committed);
  const reopened = parseOmiJson(
    JSON.stringify(toPortableOmiManuscript(saved)),
  );

  assert.equal(reopened.subtitle, nextState.subtitle);
  assert.equal(
    reopened.semanticFields?.find((field) => field.id === 'field-short-title')?.value,
    'OMI Reference — edited',
  );
  assert.equal(
    reopened.sections
      .flatMap((section) => section.blocks)
      .find((block) => block.id === 'block-rich-inline')?.content
      .includes('Lifecycle edit persisted.'),
    true,
  );

  const preservedKeys = [
    'metadata',
    'extensions',
    'localizedFrontMatter',
    'documentStructure',
    'titleMatter',
    'proofing',
    'publicationCorrections',
    'bibliographicRecords',
    'citationClusters',
    'crossReferences',
    'assets',
    'namedAnchors',
    'semanticFields',
    'computedFields',
    'tableOfContents',
    'indexDefinitions',
    'indexEntries',
    'generatedIndexes',
    'categorizedReferenceLists',
    'generatedListDefinitions',
    'publicationProfile',
    'embeddedPublicationProfile',
  ];

  for (const key of preservedKeys) {
    assert.deepEqual(
      (reopened as unknown as Record<string, unknown>)[key],
      (saved as unknown as Record<string, unknown>)[key],
      'portable setting changed during save/reopen: ' + key,
    );
  }

  assert.equal(reopened.revisionHistory.revisions.length, 3);
  assert.equal(reopened.tombstones.length, 1);
});

test('reference manuscript exports through all lifecycle output gates', () => {
  const manuscript = parseOmiJson(readFileSync(FIXTURE_URL, 'utf8'));
  const profile = resolvePublicationProfile(manuscript);

  const html = renderHtmlArticle(manuscript, profile);
  const htmlErrors = html.diagnostics.filter((item) => item.severity === 'error');
  assert.equal(htmlErrors.length, 0, JSON.stringify(htmlErrors));
  assert.equal(
    validateHtmlStructure(html.html).filter((item) => item.severity === 'error').length,
    0,
  );
  assert.equal(html.html.includes('OMI Reference Manuscript'), true);
  assert.equal(html.html.includes('Structured manuscript lifecycle'), true);
  assert.equal(html.html.includes('href="https://openmanuscript.org/"'), true);

  const jats = renderJatsArticle(manuscript, profile);
  const jatsErrors = jats.diagnostics.filter((item) => item.severity === 'error');
  assert.equal(jatsErrors.length, 0, JSON.stringify(jatsErrors));
  assert.equal(
    validateJatsStructure(jats.xml).filter((item) => item.severity === 'error').length,
    0,
  );
  assert.equal(jats.xml.includes('<article-title>OMI Reference Manuscript'), true);
  assert.equal(jats.xml.includes('<table-wrap'), true);
  assert.equal(jats.xml.includes('<disp-formula'), true);

  const docx = buildDocxExport(manuscript);
  const docxEntries = readStoreZipEntries(docx.bytes);
  assert.ok(docx.bytes.byteLength > 500);
  assert.ok(docxEntries.has('word/document.xml'));
  assert.ok(docxEntries.has('word/styles.xml'));
  const documentXml = new TextDecoder().decode(docxEntries.get('word/document.xml'));
  assert.equal(documentXml.includes('OMI Reference Manuscript'), true);
  assert.equal(documentXml.includes('XE &quot;Scholar, Ada&quot;'), true);
  assert.equal(documentXml.includes(' INDEX '), true);

  const epub = buildEpubExport(manuscript);
  const epubEntries = readStoreZipEntries(epub.bytes);
  assert.equal(
    new TextDecoder().decode(epubEntries.get('mimetype')),
    'application/epub+zip',
  );
  assert.ok(epubEntries.has('EPUB/article.xhtml'));
  assert.equal(
    new TextDecoder().decode(epubEntries.get('EPUB/article.xhtml'))
      .includes('OMI Reference Manuscript'),
    true,
  );

  const printPdfSource = buildPdfPrintDocument(manuscript, profile, 'print', 'publication');
  const interactivePdfSource = buildPdfPrintDocument(manuscript, profile, 'interactive', 'publication');
  const editorialPdfSource = buildPdfPrintDocument(manuscript, profile, 'print', 'editorial');

  assert.equal(printPdfSource.includes('data-omi-pdf-mode="print"'), true);
  assert.equal(/<a\b/i.test(printPdfSource), false);
  assert.equal(interactivePdfSource.includes('data-omi-pdf-mode="interactive"'), true);
  assert.equal(interactivePdfSource.includes('href="https://openmanuscript.org/"'), true);
  assert.equal(editorialPdfSource.includes('data-omi-pdf-content="editorial"'), true);
  assert.equal(editorialPdfSource.includes('max-width: 72rem'), false);
});

function readStoreZipEntries(bytes: Uint8Array): Map<string, Uint8Array> {
  const entries = new Map<string, Uint8Array>();
  const decoder = new TextDecoder();
  let offset = 0;

  while (offset + 30 <= bytes.length) {
    const view = new DataView(
      bytes.buffer,
      bytes.byteOffset + offset,
      bytes.byteLength - offset,
    );
    if (view.getUint32(0, true) !== 0x04034b50) break;
    const size = view.getUint32(18, true);
    const nameLength = view.getUint16(26, true);
    const extraLength = view.getUint16(28, true);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const name = decoder.decode(bytes.subarray(nameStart, nameStart + nameLength));
    entries.set(name, bytes.slice(dataStart, dataStart + size));
    offset = dataStart + size;
  }

  return entries;
}
