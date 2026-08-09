import assert from 'node:assert/strict';
import test from 'node:test';

import { buildDocxExport } from '../src/services/exportDocx.ts';
import { buildEpubExport } from '../src/services/exportEpub.ts';
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
