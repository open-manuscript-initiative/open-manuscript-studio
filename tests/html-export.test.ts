import assert from 'node:assert/strict';
import test from 'node:test';

import { createAssetMetadata } from '../src/model/assets.ts';
import { createCrossReference } from '../src/model/crossReferences.ts';
import {
  commitManuscriptRevision,
  extractManuscriptState,
} from '../src/model/versioning.ts';
import { putAssetPayload } from '../src/services/assetRepository.ts';
import {
  renderHtmlArticle,
  validateHtmlStructure,
} from '../src/services/exportHtml.ts';
import { buildHtmlPackage } from '../src/services/exportHtmlPackage.ts';
import type { OmiManuscriptState } from '../src/types/omi.ts';
import {
  createTestManuscript,
  createVersionedTestManuscript,
} from './testManuscriptFixture.ts';

test('renders deterministic semantic HTML5 with front matter and traceability metadata', () => {
  const manuscript = createTestManuscript();
  manuscript.title = 'Meaning < Structure & Publication';
  manuscript.subtitle = 'A portable subtitle';
  manuscript.motto = 'Write naturally. Structure once.';

  const first = renderHtmlArticle(manuscript);
  const second = renderHtmlArticle(manuscript);

  assert.equal(first.html, second.html);
  assert.match(first.html, /^<!doctype html>/);
  assert.match(first.html, /<html lang="en">/);
  assert.match(
    first.html,
    /<h1 id="article-title">Meaning &lt; Structure &amp; Publication<\/h1>/,
  );
  assert.match(first.html, /class="article-subtitle">A portable subtitle<\/p>/);
  assert.match(
    first.html,
    /class="article-motto motto-right motto-italic">Write naturally\. Structure once\.<\/blockquote>/,
  );
  assert.match(first.html, /name="omi-head-revision"/);
  assert.match(first.html, /<section id="sec-section-one"/);
});

test('renders semantic citations, notes and internal cross-references as navigable HTML links', () => {
  const manuscript = createTestManuscript();
  const section = manuscript.sections[0];
  const block = section?.blocks[0];
  assert.ok(section);
  assert.ok(block);

  const recordId = 'record-one';
  const citationId = 'citation-one';
  const noteId = 'note-one';
  const xref = createCrossReference(
    {
      id: 'xref-one',
      anchorId: 'anchor-xref',
      sourceBlockId: block.id,
      targetId: section.id,
      targetKind: 'section',
    },
    '2026-08-07T12:00:00.000Z',
  );

  manuscript.bibliographicRecords = [
    {
      id: recordId,
      type: 'journal-article',
      title: 'Semantic publishing',
      contributors: [
        {
          id: 'bib-author',
          role: 'author',
          givenName: 'Ada',
          familyName: 'Scholar',
        },
      ],
      issued: '2026',
      identifiers: [],
      status: 'verified',
    },
  ];
  manuscript.citations = [
    {
      id: citationId,
      target: recordId,
      anchorId: 'anchor-citation',
      targetBlockId: block.id,
      locator: { type: 'page', value: '12' },
    },
  ];
  manuscript.annotations = [
    {
      id: noteId,
      type: 'note',
      noteKind: 'footnote',
      anchorId: 'anchor-note',
      targetBlockId: block.id,
      body: 'A semantic note body.',
      renderingHint: 'footnote',
    },
  ];
  manuscript.crossReferences = [xref];
  block.content = JSON.stringify({
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'See ' },
          {
            type: 'omiCrossReference',
            attrs: { crossReferenceId: xref.id, anchorId: xref.anchorId },
          },
          { type: 'text', text: ' and ' },
          {
            type: 'omiCitation',
            attrs: {
              citationId,
              citationIds: [citationId],
              anchorId: 'anchor-citation',
            },
          },
          {
            type: 'omiNote',
            attrs: { noteId, anchorId: 'anchor-note' },
          },
        ],
      },
    ],
  });

  const result = renderHtmlArticle(manuscript);

  assert.match(result.html, /class="xref" href="#sec-section-one">Section 1<\/a>/);
  assert.match(
    result.html,
    /role="doc-biblioref" href="#ref-record-one"[^>]*>\(Scholar, 2026, p\. 12\)<\/a>/,
  );
  assert.match(
    result.html,
    /id="noteref-note-one" role="doc-noteref" href="#note-note-one">1<\/a>/,
  );
  assert.match(result.html, /id="note-note-one" role="doc-endnote"/);
  assert.match(result.html, /id="ref-record-one" data-omi-record-id="record-one"/);
  assert.equal(
    result.diagnostics.some(
      (diagnostic) => diagnostic.code === 'unresolved-html-fragment',
    ),
    false,
  );
});

test('renders rich text, tables, equations and portable asset paths without presentation scripts', async () => {
  const manuscript = createTestManuscript();
  const section = manuscript.sections[0];
  assert.ok(section);
  const bytes = new TextEncoder().encode('fake-image');
  const asset = await createAssetMetadata(bytes, {
    id: 'asset-one',
    mediaType: 'image/png',
    fileName: 'figure.png',
    role: 'figure',
    createdAt: '2026-08-07T12:00:00.000Z',
  });
  manuscript.assets = [asset];
  section.blocks = [
    {
      id: 'rich-block',
      type: 'paragraph',
      content: JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Latin',
                marks: [
                  { type: 'italic' },
                  { type: 'omiLanguage', attrs: { lang: 'la' } },
                ],
              },
              {
                type: 'text',
                text: ' source',
                marks: [
                  {
                    type: 'omiLink',
                    attrs: { href: 'https://example.org/' },
                  },
                ],
              },
            ],
          },
        ],
      }),
    },
    {
      id: 'image-one',
      type: 'image',
      content: '',
      visual: {
        kind: 'image',
        assetId: asset.id,
        src: '',
        mediaType: asset.mediaType,
        fileName: asset.fileName,
        alt: 'Accessible figure',
        caption: 'Portable figure',
      },
    },
    {
      id: 'table-one',
      type: 'table',
      content: '',
      visual: {
        kind: 'table',
        cells: [
          ['Year', 'Value'],
          ['2026', '10'],
        ],
        headerRows: 1,
        caption: 'Results',
      },
    },
    {
      id: 'equation-one',
      type: 'equation',
      content: '',
      visual: {
        kind: 'equation',
        notation: 'latex',
        source: 'E=mc^2',
        latex: 'E=mc^2',
      },
    },
  ];

  const result = renderHtmlArticle(manuscript);

  assert.match(result.html, /<em><span lang="la">Latin<\/span><\/em>|<span lang="la"><em>Latin<\/em><\/span>/);
  assert.match(result.html, /href="https:\/\/example\.org\/" rel="external"> source<\/a>/);
  assert.match(
    result.html,
    /src="media\/images\/asset-one-figure\.png" alt="Accessible figure"/,
  );
  assert.match(result.html, /<figure id="tbl-table-one" class="scholarly-table"/);
  assert.match(result.html, /<thead><tr><th scope="col">Year<\/th>/);
  assert.match(result.html, /<figure id="eq-equation-one" class="scholarly-equation"/);
  assert.match(result.html, /<math xmlns="http:\/\/www\.w3\.org\/1998\/Math\/MathML" display="block">/);
  assert.doesNotMatch(result.html, /<script\b/i);
});

test('HTML structural validation reports duplicate ids and broken fragment links', () => {
  const diagnostics = validateHtmlStructure(
    '<!doctype html><html lang="en"><head></head><body><article class="omi-scholarly-article"><header class="article-front"><h1 id="same">T</h1></header><p id="same"><a href="#missing">x</a></p></article></body></html>',
  );

  assert.equal(
    diagnostics.some((diagnostic) => diagnostic.code === 'duplicate-html-id'),
    true,
  );
  assert.equal(
    diagnostics.some(
      (diagnostic) => diagnostic.code === 'unresolved-html-fragment',
    ),
    true,
  );
});

test('builds an offline HTML ZIP package with manifest and verified relative asset payloads', async () => {
  const manuscript = createVersionedTestManuscript();
  const bytes = new TextEncoder().encode('portable-image-payload');
  const asset = await createAssetMetadata(bytes, {
    id: 'asset-package-image',
    mediaType: 'image/png',
    fileName: 'result.png',
    role: 'figure',
    createdAt: '2026-08-07T12:01:00.000Z',
  });
  const figureBlock = {
    id: 'package-image-block',
    type: 'image',
    content: '',
    visual: {
      kind: 'image' as const,
      assetId: asset.id,
      src: '',
      mediaType: asset.mediaType,
      fileName: asset.fileName,
      alt: 'Package image',
    },
  };
  const current = extractManuscriptState(manuscript);
  const nextState: OmiManuscriptState = {
    ...current,
    assets: [asset],
    sections: current.sections.map((section, index) =>
      index === 0
        ? { ...section, blocks: [...section.blocks, figureBlock] }
        : section,
    ),
  };
  const committed = commitManuscriptRevision(manuscript, nextState, {
    summary: 'Attach HTML package asset',
    timestamp: '2026-08-07T12:02:00.000Z',
    events: [
      {
        operation: 'asset.attach' as never,
        targetId: asset.id,
        path: '/assets/-',
        nextValue: asset,
      },
    ],
  });
  await putAssetPayload(committed.id, asset.id, bytes);

  const result = await buildHtmlPackage(committed);
  const entries = readStoreZipEntries(result.bytes);

  assert.equal(result.validForExport, true);
  assert.equal(entries.has('index.html'), true);
  assert.equal(entries.has('manifest.json'), true);
  assert.equal(
    entries.has('media/images/asset-package-image-result.png'),
    true,
  );
  const html = new TextDecoder().decode(entries.get('index.html'));
  assert.match(
    html,
    /src="media\/images\/asset-package-image-result\.png"/,
  );
  const manifest = JSON.parse(
    new TextDecoder().decode(entries.get('manifest.json')),
  ) as { manuscriptId: string; headRevisionId: string; entries: unknown[] };
  assert.equal(manifest.manuscriptId, committed.id);
  assert.equal(manifest.headRevisionId, committed.headRevisionId);
  assert.equal(manifest.entries.length, 2);
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
    assert.equal(view.getUint16(8, true), 0);
    const size = view.getUint32(18, true);
    const nameLength = view.getUint16(26, true);
    const extraLength = view.getUint16(28, true);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const name = decoder.decode(
      bytes.subarray(nameStart, nameStart + nameLength),
    );
    entries.set(name, bytes.slice(dataStart, dataStart + size));
    offset = dataStart + size;
  }

  return entries;
}
