import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createPublisherExportStylesheet,
  createPublisherPrintStylesheet,
  validatePublisherExportCss,
} from '../src/model/publisherExportStyle.ts';
import { resolvePublicationProfile } from '../src/model/publicationProfile.ts';
import { buildDocxExport } from '../src/services/exportDocx.ts';
import { buildEpubExport } from '../src/services/exportEpub.ts';
import { buildPdfPrintDocument } from '../src/services/exportPdf.ts';
import { createVersionedTestManuscript } from './testManuscriptFixture.ts';

test('DOCX export contains Word heading and named character styles', () => {
  const manuscript = createVersionedTestManuscript();
  const block = manuscript.sections[0]?.blocks[0];
  if (block) {
    block.content = JSON.stringify({
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Normal ' },
          { type: 'text', text: 'emphasis', marks: [{ type: 'italic' }] },
        ],
      }],
    });
  }
  const result = buildDocxExport(manuscript);
  const entries = readStoreZipEntries(result.bytes);

  assert.equal(entries.has('[Content_Types].xml'), true);
  assert.equal(entries.has('word/document.xml'), true);
  assert.equal(entries.has('word/styles.xml'), true);

  const styles = new TextDecoder().decode(entries.get('word/styles.xml'));
  assert.match(styles, /w:styleId="Heading1"/);
  assert.match(styles, /w:outlineLvl w:val="0"/);
  assert.match(styles, /w:styleId="OMIEmphasis"/);
  assert.match(styles, /w:name w:val="OMI Emphasis"/);

  const document = new TextDecoder().decode(entries.get('word/document.xml'));
  assert.match(document, /w:rStyle w:val="OMIEmphasis"/);
});

test('EPUB export contains EPUB 3 package essentials', () => {
  const manuscript = createVersionedTestManuscript();
  const result = buildEpubExport(manuscript);
  const entries = readStoreZipEntries(result.bytes);

  assert.equal(new TextDecoder().decode(entries.get('mimetype')), 'application/epub+zip');
  assert.equal(entries.has('META-INF/container.xml'), true);
  assert.equal(entries.has('EPUB/package.opf'), true);
  assert.equal(entries.has('EPUB/article.xhtml'), true);
  assert.equal(entries.has('EPUB/nav.xhtml'), true);

  const opf = new TextDecoder().decode(entries.get('EPUB/package.opf'));
  assert.match(opf, /<package[^>]+version="3.0"/);
  assert.match(opf, /properties="nav"/);
});

test('PDF print document applies profile page settings and publisher print CSS in override order', () => {
  const manuscript = createVersionedTestManuscript();
  const base = resolvePublicationProfile(manuscript);
  const profile = {
    ...base,
    id: 'publisher:test-pdf',
    version: '2',
    rules: {
      ...base.rules,
      layout: {
        ...base.rules.layout,
        pageSize: 'Letter' as const,
        marginMm: { top: 18, right: 19, bottom: 20, left: 21 },
      },
      outputs: [...new Set([...base.rules.outputs, 'pdf' as const])],
    },
    exportStylesheet: createPublisherExportStylesheet(
      'journal.css',
      '.omi-scholarly-article { font-family: Georgia, serif; }',
      '2026-08-16T00:00:00Z',
    ),
    printStylesheet: createPublisherPrintStylesheet(
      'journal-print.css',
      '@page { margin: 12mm; }\n@media print { h2 { break-before: page; } }',
      '2026-08-16T00:00:00Z',
    ),
  };

  const html = buildPdfPrintDocument(manuscript, profile);

  assert.match(html, /meta name="omi-output-format" content="pdf-print"/);
  assert.match(html, /size: Letter/);
  assert.match(html, /margin: 18mm 19mm 20mm 21mm/);
  assert.match(html, /font-family: Georgia, serif/);
  assert.match(html, /@page \{ margin: 12mm; \}/);
  assert.match(html, /h2 \{ break-before: page; \}/);
  assert.ok(
    html.indexOf('margin: 18mm 19mm 20mm 21mm') <
      html.indexOf('@page { margin: 12mm; }'),
    'publisher print CSS must load after generated page defaults',
  );
});

test('publisher CSS validator rejects markup escape from inline print style', () => {
  assert.match(
    validatePublisherExportCss('</style><script>alert(1)</script>') ?? '',
    /style tags/i,
  );
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
