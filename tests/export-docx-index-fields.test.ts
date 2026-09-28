import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildDocxExport,
  renderWordGeneratedIndexField,
  renderWordIndexEntryFields,
} from '../src/services/exportDocx.ts';
import { createTestManuscript } from './testManuscriptFixture.ts';

test('exports semantic OMI index occurrences as Word XE fields', () => {
  const xml = renderWordIndexEntryFields([
    {
      id: 'entry-1',
      kind: 'name',
      terms: ['Apafi Mihály'],
      targetBlockId: 'block-1',
      source: { format: 'docx-xe' },
    },
    {
      id: 'entry-2',
      kind: 'name',
      terms: ['Bethlen', 'Gábor'],
      targetBlockId: 'block-1',
      source: { format: 'manual' },
    },
  ]);

  assert.match(xml, /XE &quot;Apafi Mihály&quot;/);
  assert.match(xml, /XE &quot;Bethlen:Gábor&quot;/);
  assert.equal((xml.match(/w:fldCharType="begin"/g) ?? []).length, 2);
});

test('exports a dirty Word INDEX field whose page numbers are recalculated after pagination', () => {
  const xml = renderWordGeneratedIndexField('hu');
  assert.match(xml, /w:dirty="true"/);
  assert.match(xml, /> INDEX </);
  assert.match(xml, /oldalszámai/);
});

test('exports given and family names as separate Word character styles', () => {
  const result = buildDocxExport(createTestManuscript());
  const entries = readStoreZipEntries(result.bytes);
  const documentXml = new TextDecoder().decode(
    entries.get('word/document.xml'),
  );
  const stylesXml = new TextDecoder().decode(
    entries.get('word/styles.xml'),
  );

  assert.match(stylesXml, /w:styleId="OMIAuthorGivenName"/);
  assert.match(stylesXml, /w:styleId="OMIAuthorFamilyName"/);
  assert.match(
    documentXml,
    /w:rStyle w:val="OMIAuthorGivenName"\/><\/w:rPr><w:t xml:space="preserve">Ada<\/w:t>/,
  );
  assert.match(
    documentXml,
    /w:rStyle w:val="OMIAuthorFamilyName"\/><\/w:rPr><w:t xml:space="preserve">Scholar<\/w:t>/,
  );
});

test('exports linked OMI notes as native Word footnotes by default and retains explicit endnotes', () => {
  const manuscript = createTestManuscript();
  const block = manuscript.sections[0]!.blocks[0]!;
  block.content = JSON.stringify({
    type: 'doc',
    content: [{
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Before ' },
        { type: 'omiNote', attrs: { noteId: 'note-default', anchorId: 'anchor-default', label: '9', noteType: 'footnote' } },
        { type: 'text', text: ' between ' },
        { type: 'omiNote', attrs: { noteId: 'note-end', anchorId: 'anchor-end', label: '4', noteType: 'endnote' } },
        { type: 'text', text: ' after.' },
      ],
    }],
  });
  manuscript.annotations = [
    {
      id: 'note-default',
      type: 'note',
      targetBlockId: block.id,
      body: 'A default footnote & its text.',
      renderingHint: 'hidden',
    },
    {
      id: 'note-end',
      type: 'note',
      noteKind: 'endnote',
      targetBlockId: block.id,
      body: 'An explicit endnote.',
      renderingHint: 'endnote',
    },
    {
      id: 'comment-only',
      type: 'comment',
      targetBlockId: block.id,
      body: 'Review comment must not be exported as a scholarly note.',
      renderingHint: 'margin',
    },
    {
      id: 'note-without-anchor',
      type: 'note',
      targetBlockId: block.id,
      body: 'Orphaned note content is retained.',
      renderingHint: 'footnote',
    },
  ];

  const result = buildDocxExport(manuscript);
  const entries = readStoreZipEntries(result.bytes);
  const documentXml = new TextDecoder().decode(entries.get('word/document.xml'));
  const footnotesXml = new TextDecoder().decode(entries.get('word/footnotes.xml'));
  const endnotesXml = new TextDecoder().decode(entries.get('word/endnotes.xml'));
  const relationshipsXml = new TextDecoder().decode(entries.get('word/_rels/document.xml.rels'));
  const contentTypesXml = new TextDecoder().decode(entries.get('[Content_Types].xml'));

  assert.match(documentXml, /Before <\/w:t><\/w:r><w:r><w:footnoteReference w:id="1"\/><\/w:r><w:r><w:t xml:space="preserve"> between <\/w:t>/);
  assert.match(documentXml, /w:endnoteReference w:id="1"/);
  assert.match(footnotesXml, /w:footnote w:id="1"/);
  assert.match(footnotesXml, /A default footnote &amp; its text\./);
  assert.match(endnotesXml, /w:endnote w:id="1"/);
  assert.match(endnotesXml, /An explicit endnote\./);
  assert.match(relationshipsXml, /relationships\/footnotes" Target="footnotes\.xml"/);
  assert.match(relationshipsXml, /relationships\/endnotes" Target="endnotes\.xml"/);
  assert.match(contentTypesXml, /word\/footnotes\.xml/);
  assert.match(contentTypesXml, /word\/endnotes\.xml/);
  assert.doesNotMatch(footnotesXml + endnotesXml, /Review comment/);
  assert.doesNotMatch(documentXml, /A default footnote|An explicit endnote/);
  assert.match(documentXml, /Orphaned note content is retained\./);
  assert.match(result.warnings.join('\n'), /no inline anchor/);
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
