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
import { buildPdfPrintDocument, pdfDocumentTitle } from '../src/services/exportPdf.ts';
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
  assert.match(html, /data-omi-pdf-mode="print"/);
  assert.match(html, /data-omi-pdf-content="publication"/);
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

test('PDF editorial view removes publication geometry while preserving semantic manuscript content', () => {
  const manuscript = createVersionedTestManuscript();
  const base = resolvePublicationProfile(manuscript);
  const profile = {
    ...base,
    id: 'publisher:test-editorial-pdf',
    version: '3',
    rules: {
      ...base.rules,
      layout: {
        ...base.rules.layout,
        pageSize: 'Letter' as const,
        marginMm: { top: 11, right: 12, bottom: 13, left: 14 },
      },
      outputs: [...new Set([...base.rules.outputs, 'pdf' as const])],
    },
    exportStylesheet: createPublisherExportStylesheet(
      'publisher-editorial-test.css',
      '.omi-scholarly-article { border: 17px solid magenta; }',
      '2026-09-06T00:00:00Z',
    ),
    printStylesheet: createPublisherPrintStylesheet(
      'publisher-editorial-test-print.css',
      '@page { margin: 3mm; }',
      '2026-09-06T00:00:00Z',
    ),
  };

  const publicationHtml = buildPdfPrintDocument(manuscript, profile, 'print', 'publication');
  const editorialHtml = buildPdfPrintDocument(manuscript, profile, 'print', 'editorial');

  assert.match(publicationHtml, /data-omi-pdf-content="publication"/);
  assert.match(publicationHtml, /size: Letter/);
  assert.match(publicationHtml, /border: 17px solid magenta/);
  assert.match(publicationHtml, /@page \{ margin: 3mm; \}/);

  assert.match(editorialHtml, /data-omi-pdf-content="editorial"/);
  assert.match(editorialHtml, /data-omi-print-style data-omi-pdf-content="editorial"/);
  assert.match(editorialHtml, /@page \{\s*size: auto;\s*margin: 20mm;/);
  assert.match(editorialHtml, /Test manuscript/);
  assert.doesNotMatch(editorialHtml, /size: Letter/);
  assert.doesNotMatch(editorialHtml, /border: 17px solid magenta/);
  assert.doesNotMatch(editorialHtml, /@page \{ margin: 3mm; \}/);
});

test('PDF variants remove hyperlinks from print output and retain them in interactive output', () => {
  const manuscript = createVersionedTestManuscript();
  const block = manuscript.sections[0]?.blocks[0];
  if (!block) throw new Error('PDF link test requires a text block.');
  block.content = JSON.stringify({
    type: 'doc',
    content: [{
      type: 'paragraph',
      content: [{
        type: 'text',
        text: 'Open Manuscript Initiative',
        marks: [{ type: 'omiLink', attrs: { href: 'https://openmanuscript.org' } }],
      }],
    }],
  });

  const base = resolvePublicationProfile(manuscript);
  const profile = {
    ...base,
    rules: {
      ...base.rules,
      outputs: [...new Set([...base.rules.outputs, 'pdf' as const])],
    },
  };

  const printHtml = buildPdfPrintDocument(manuscript, profile, 'print');
  const interactiveHtml = buildPdfPrintDocument(manuscript, profile, 'interactive');
  const editorialInteractiveHtml = buildPdfPrintDocument(manuscript, profile, 'interactive', 'editorial');

  assert.match(printHtml, /meta name="omi-output-format" content="pdf-print"/);
  assert.match(printHtml, /class="omi-pdf-output omi-pdf-mode-print omi-pdf-content-publication"/);
  assert.doesNotMatch(printHtml, /<a\b/i);

  assert.match(interactiveHtml, /meta name="omi-output-format" content="pdf-interactive"/);
  assert.match(interactiveHtml, /class="omi-pdf-output omi-pdf-mode-interactive omi-pdf-content-publication"/);
  assert.match(interactiveHtml, /href="https:\/\/openmanuscript\.org\/"/);
  assert.match(interactiveHtml, /body\[data-omi-pdf-mode="interactive"\] a\[href\]/);
  assert.match(editorialInteractiveHtml, /data-omi-pdf-content="editorial"/);
  assert.match(editorialInteractiveHtml, /href="https:\/\/openmanuscript\.org\/"/);
  assert.equal(pdfDocumentTitle(manuscript, 'print'), 'Test manuscript');
  assert.equal(pdfDocumentTitle(manuscript, 'interactive'), 'Test manuscript – interactive');
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
