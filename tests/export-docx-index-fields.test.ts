import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildDocxExport,
  renderWordGeneratedIndexField,
  renderWordIndexEntryFields,
} from '../src/services/exportDocx.ts';
import { getPublicationProfile } from '../src/model/publicationProfile.ts';
import { createSemanticField } from '../src/model/semanticFields.ts';
import { createNoteAnnotation } from '../src/model/notes.ts';
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

test('escapes Word XE quotes, backslashes and literal colons without changing hierarchy', () => {
  for (const fieldForm of ['simple', 'complex'] as const) {
    const xml = renderWordIndexEntryFields([{
      id: 'escaped-entry',
      kind: 'subject',
      terms: ['A\\B:C"D', 'Nested:term'],
      sortKey: 'Sort\\key:"quoted"',
      source: { format: 'docx-xe', fieldForm },
    }]);
    const expected = ' XE &quot;A\\\\B\\:C\\&quot;D:Nested\\:term&quot; \\y &quot;Sort\\\\key:\\&quot;quoted\\&quot;&quot; ';
    assert.ok(xml.includes(expected), xml);
  }
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
      renderingHint: 'footnote',
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

  assert.match(documentXml, /Before <\/w:t><\/w:r><w:r><w:rPr><w:rStyle w:val="FootnoteReference"\/><\/w:rPr><w:footnoteReference w:id="1"\/><\/w:r><w:r><w:t xml:space="preserve"> between <\/w:t>/);
  assert.match(documentXml, /w:rStyle w:val="EndnoteReference"\/><\/w:rPr><w:endnoteReference w:id="1"/);
  assert.match(footnotesXml, /w:footnote w:id="1"/);
  assert.match(footnotesXml, /w:footnoteRef\/><\/w:r><w:r><w:t xml:space="preserve"> <\/w:t><\/w:r><w:r><w:t xml:space="preserve">A default footnote/);
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

test('exports opt-in starred funding without shifting first numbered footnote', () => {
  const manuscript = createTestManuscript();
  manuscript.semanticFields = [createSemanticField({
    role: 'funding-statement',
    label: 'Funding',
    value: 'Fund <42> & Institute',
  })];
  const profile = structuredClone(getPublicationProfile('omi-generic-scholarly')!);
  profile.id = 'test-funding-style';
  profile.version = '1';
  manuscript.publicationProfile = { id: profile.id, version: profile.version };
  manuscript.embeddedPublicationProfile = profile;

  const block = manuscript.sections[0]!.blocks[0]!;
  block.content = JSON.stringify({
    type: 'doc',
    content: [{ type: 'paragraph', content: [
      { type: 'text', text: 'Main text ' },
      { type: 'omiNote', attrs: { noteId: 'n1', anchorId: 'a1', label: '1', noteType: 'footnote' } },
    ] }],
  });
  manuscript.annotations = [{
    id: 'n1', type: 'note', noteKind: 'footnote',
    anchorId: 'a1', targetBlockId: block.id,
    body: 'Ordinary numbered note', renderingHint: 'footnote',
  }];

  const disabled = readStoreZipEntries(buildDocxExport(manuscript).bytes);
  const disabledDocument = new TextDecoder().decode(disabled.get('word/document.xml'));
  assert.doesNotMatch(disabledDocument, /w:pStyle w:val="FundingNote"/);

  profile.rules.notes.fundingStarNote = true;
  const enabled = readStoreZipEntries(buildDocxExport(manuscript).bytes);
  const documentXml = new TextDecoder().decode(enabled.get('word/document.xml'));
  const footnotesXml = new TextDecoder().decode(enabled.get('word/footnotes.xml'));
  assert.match(documentXml, /<w:footnoteReference w:id="2" w:customMarkFollows="1"\/><w:t>\*<\/w:t>/);
  assert.doesNotMatch(documentXml, /w:pStyle w:val="FundingNote"|Fund &lt;42&gt;/);
  assert.match(footnotesXml, /w:pStyle w:val="FundingNote"/);
  assert.match(footnotesXml, /Fund &lt;42&gt; &amp; Institute/);
  assert.match(documentXml, /w:footnoteReference w:id="1"/);
  assert.match(footnotesXml, /w:footnote w:id="1"/);
  assert.match(footnotesXml, /<w:footnote w:id="2">[\s\S]*?<w:t>\*<\/w:t>/);
  assert.equal((footnotesXml.match(/<w:footnoteRef\/>/g)??[]).length,1);
});

test('DOCX local notes are unnumbered inline or numbered with ordinary notes by export style', () => {
  const manuscript = createTestManuscript();
  const block = manuscript.sections[0]!.blocks[0]!;
  const notes = [
    createNoteAnnotation({ id: 'foot-a', anchorId: 'anchor-foot-a', targetBlockId: block.id, body: 'First numbered note' }),
    createNoteAnnotation({ id: 'inline-a', anchorId: 'anchor-inline-a', targetBlockId: block.id, kind: 'author-note', body: 'Special local text' }),
    createNoteAnnotation({ id: 'foot-b', anchorId: 'anchor-foot-b', targetBlockId: block.id, body: 'Second numbered note' }),
  ];
  manuscript.annotations = notes;
  block.content = JSON.stringify({
    type: 'doc', content: [{ type: 'paragraph', content: notes.map((note) => ({
      type: 'omiNote', attrs: { noteId: note.id, anchorId: note.anchorId, noteType: note.noteKind, label: '?' },
    })) }],
  });
  const profile = structuredClone(getPublicationProfile('omi-generic-scholarly')!);
  profile.id = 'test-local-note-style';
  profile.version = '1';
  manuscript.publicationProfile = { id: profile.id, version: profile.version };
  manuscript.embeddedPublicationProfile = profile;
  const parts = () => {
    const exported = buildDocxExport(manuscript);
    const entries = readStoreZipEntries(exported.bytes);
    return { exported, body: new TextDecoder().decode(entries.get('word/document.xml')), footnotes: new TextDecoder().decode(entries.get('word/footnotes.xml')) };
  };

  profile.rules.notes.localNotePlacement = 'inline';
  const inline = parts();
  assert.match(inline.body, /\(Special local text\)/);
  assert.match(inline.body, /w:footnoteReference w:id="2"/);
  assert.doesNotMatch(inline.footnotes, /Special local text/);

  profile.rules.notes.localNotePlacement = 'margin';
  const margin = parts();
  assert.match(margin.body, /\(Special local text\)/);
  assert.match(margin.exported.warnings.join('\n'), /margin placement.*not supported/);

  profile.rules.notes.localNotePlacement = 'with-notes';
  const together = parts();
  assert.doesNotMatch(together.body, /\(Special local text\)/);
  assert.match(together.body, /w:footnoteReference w:id="3"/);
  assert.match(together.footnotes, /w:footnote w:id="2"/);
  assert.match(together.footnotes, /Special local text/);
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
