import { renderHtmlArticle } from '../src/services/exportHtml.ts';
import { readDocxNotes } from '../src/services/docxNoteImport.ts';
import { OdtZip } from '../src/services/odtZip.ts';
import { parseDocxSource } from '../server/src/integrations/ojs/docxSource.ts';
import { applyNoteIntegrity } from '../server/src/integrations/ojs/docxNoteIntegrity.ts';
import { applyReferenceSemantics } from '../server/src/integrations/ojs/docxReferences.ts';
import { createStoreZip, textZipEntry } from '../src/services/simpleZip.ts';
import { serializeOmiJson } from '../src/services/exportOmi.ts';
import { parseOmiJson } from '../src/services/omiPortableFormat.ts';
import { createNoteBodyDocument } from '../src/model/noteRichText.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { getDocumentStructureProfile } from '../src/model/documentProfile.ts';
import { createManuscriptFromOjsLaunch as importLocalizedLaunch } from '../src/integrations/ojs/importOjsLaunchLocalized.ts';

import {
  createManuscriptFromOjsLaunch,
  type OjsLaunchPayload,
} from '../src/integrations/ojs/importOjsLaunch.ts';

function launchWithSource(
  sourceDocument: NonNullable<OjsLaunchPayload['sourceDocument']>,
): OjsLaunchPayload {
  return {
    protocol: 'omi-integration/1',
    profile: 'omi-integration/1/ojs',
    submission: {
      externalId: '780',
      primaryLocale: 'hu',
      title: { hu: 'Teszt kézirat' },
      subtitle: {},
      abstract: { hu: '' },
      keywords: { hu: [] },
    },
    contributors: [],
    files: [],
    sourceDocument,
  };
}

test('OJS articles remain standalone studies through both import paths', () => {
  for (const importer of [createManuscriptFromOjsLaunch, importLocalizedLaunch]) {
    const launch = launchWithSource({
      kind: 'docx',
      paragraphs: [
        { text: 'Bevezetés', headingLevel: 1 },
        { text: 'Első szakasz.' },
        { text: 'Eredmények', headingLevel: 1 },
        { text: 'Második szakasz.' },
      ],
    });
    const manuscript = importer(launch);
    assert.ok(manuscript);
    assert.equal(manuscript.sections.length, 2);
    assert.equal(manuscript.title, 'Teszt kézirat');
    const profile = getDocumentStructureProfile(manuscript);
    assert.equal(profile.kind, 'study');
    assert.equal(profile.volumeKind, undefined);
    assert.equal(profile.noteNumberingScope, 'continuous');

    delete launch.sourceDocument;
    const fallback = importer(launch);
    assert.ok(fallback);
    assert.equal(getDocumentStructureProfile(fallback).kind, 'study');
  }
});

test('OJS DOCX footnote becomes an OMI note marker and annotation', () => {
  const manuscript = createManuscriptFromOjsLaunch(
    launchWithSource({
      kind: 'docx',
      paragraphs: [
        {
          text: 'Szöveg folytatása.',
          inline: [
            { kind: 'text', text: 'Szöveg' },
            { kind: 'footnoteReference', footnoteId: '1' },
            { kind: 'text', text: ' folytatása.' },
          ],
        },
      ],
      footnotes: [{ id: '1', text: 'A lábjegyzet teljes szövege.' }],
      endnotes: [],
    }),
  );

  assert.ok(manuscript);
  assert.equal(manuscript.annotations.length, 1);
  assert.equal(manuscript.annotations[0]?.type, 'note');
  assert.equal(manuscript.annotations[0]?.noteKind, 'footnote');
  assert.equal(manuscript.annotations[0]?.body, 'A lábjegyzet teljes szövege.');

  const block = manuscript.sections[0]?.blocks[0];
  assert.ok(block);
  const doc = JSON.parse(block.content) as {
    content?: Array<{ content?: Array<{ type?: string; attrs?: Record<string, unknown> }> }>;
  };
  const marker = doc.content?.[0]?.content?.find((node) => node.type === 'omiNote');
  assert.ok(marker);
  assert.equal(marker.attrs?.noteType, 'footnote');
  assert.equal(marker.attrs?.label, '1');
  assert.equal(marker.attrs?.noteId, manuscript.annotations[0]?.id);
  assert.equal(marker.attrs?.anchorId, manuscript.annotations[0]?.anchorId);
});

test('OJS import pairs notes by Word ID and labels them in document order', () => {
  const manuscript = createManuscriptFromOjsLaunch(
    launchWithSource({
      kind: 'docx',
      paragraphs: [{
        text: 'First marker, second marker.',
        inline: [
          { kind: 'footnoteReference', footnoteId: '14' },
          { kind: 'text', text: ' between ' },
          { kind: 'footnoteReference', footnoteId: '2' },
        ],
      }],
      // Deliberately reverse the package order: document references pair to
      // note bodies by w:id, while labels follow their positions in Word.
      footnotes: [
        { id: '2', text: 'Body for Word note 2.' },
        { id: '14', text: 'Body for Word note 14.' },
      ],
      endnotes: [],
    }),
  );

  assert.ok(manuscript);
  assert.deepEqual(manuscript.annotations.map((annotation) => annotation.body), [
    'Body for Word note 14.',
    'Body for Word note 2.',
  ]);
  const block = manuscript.sections[0]?.blocks[0];
  assert.ok(block);
  const markers = JSON.stringify(JSON.parse(block.content)).match(/"type":"omiNote"/g) ?? [];
  assert.equal(markers.length, 2);
  assert.match(block.content, /"label":"1"/);
  assert.match(block.content, /"label":"2"/);
});

test('OJS DOCX endnote is imported as an OMI endnote', () => {
  const manuscript = createManuscriptFromOjsLaunch(
    launchWithSource({
      kind: 'docx',
      paragraphs: [
        {
          text: 'Végjegyzetes mondat.',
          inline: [
            { kind: 'text', text: 'Végjegyzetes mondat' },
            { kind: 'endnoteReference', endnoteId: '2' },
            { kind: 'text', text: '.' },
          ],
        },
      ],
      footnotes: [],
      endnotes: [{ id: '2', text: 'A végjegyzet szövege.' }],
    }),
  );

  assert.ok(manuscript);
  assert.equal(manuscript.annotations.length, 1);
  assert.equal(manuscript.annotations[0]?.noteKind, 'endnote');
  assert.equal(manuscript.annotations[0]?.renderingHint, 'endnote');
  assert.equal(manuscript.annotations[0]?.body, 'A végjegyzet szövege.');
});

test('OJS note reference is preserved even when its source body is missing', () => {
  const manuscript = createManuscriptFromOjsLaunch(
    launchWithSource({
      kind: 'docx',
      paragraphs: [
        {
          text: 'Hiányos jegyzet.',
          inline: [
            { kind: 'text', text: 'Hiányos jegyzet' },
            { kind: 'footnoteReference', footnoteId: '99' },
            { kind: 'text', text: '.' },
          ],
        },
      ],
      footnotes: [],
      endnotes: [],
    }),
  );

  assert.ok(manuscript);
  assert.equal(manuscript.annotations.length, 1);
  assert.equal(manuscript.annotations[0]?.noteKind, 'footnote');
  assert.equal(manuscript.annotations[0]?.body, '');

  const block = manuscript.sections[0]?.blocks[0];
  assert.ok(block);
  assert.match(block.content, /"type":"omiNote"/);
});

test('OJS editable import labels its provider source without exposing private source filenames', () => {
  const launch = launchWithSource({
    kind: 'docx',
    fileName: 'PRIVATE-SYNTHETIC-AUTHOR.docx',
    paragraphs: [{ text: 'Synthetic public excerpt.' }],
  });
  launch.installation = { displayName: 'Synthetic Journal' };
  const manuscript = importLocalizedLaunch(launch);
  assert.ok(manuscript);
  const content = manuscript.sections.flatMap((section) => section.blocks.map((block) => block.content)).join(' ');
  assert.match(content, /Synthetic Journal/);
  assert.doesNotMatch(content, /PRIVATE-SYNTHETIC-AUTHOR/);
});

test('preserves rich OJS DOCX notes through server integrity, both launch paths and OMI reopen', async () => {
  const w = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const r = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const bytes = Buffer.from(createStoreZip([
    textZipEntry('word/document.xml', `<w:document xmlns:w="${w}"><w:body><w:p><w:r><w:t>Body</w:t><w:footnoteReference w:id="14"/><w:endnoteReference w:id="2"/></w:r></w:p></w:body></w:document>`),
    textZipEntry('word/styles.xml', `<w:styles xmlns:w="${w}"><w:style w:styleId="BaseNote"><w:rPr><w:i/></w:rPr></w:style><w:style w:styleId="Inherited"><w:basedOn w:val="BaseNote"/></w:style></w:styles>`),
    textZipEntry('word/footnotes.xml', `<w:footnotes xmlns:w="${w}" xmlns:r="${r}"><w:footnote w:id="-1"><w:p/></w:footnote><w:footnote w:id="14"><w:p>
      <w:r><w:rPr><w:vertAlign w:val="superscript"/></w:rPr><w:footnoteRef/></w:r>
      <w:r><w:rPr><w:rStyle w:val="Inherited"/><w:b/></w:rPr><w:t>Styled</w:t></w:r>
      <w:r><w:rPr><w:rStyle w:val="Inherited"/><w:i w:val="0"/></w:rPr><w:t> plain</w:t></w:r>
      <w:r><w:rPr><w:u/><w:strike/><w:smallCaps/></w:rPr><w:t> decorated</w:t></w:r>
      <w:r><w:rPr><w:vertAlign w:val="superscript"/></w:rPr><w:t>2</w:t></w:r>
      <w:r><w:br/><w:t>Line</w:t><w:tab/><w:t>tab</w:t></w:r>
      <w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText> XE "Hidden" </w:instrText></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>
      <w:del><w:r><w:delText>Deleted</w:delText></w:r></w:del>
      </w:p><w:p><w:hyperlink r:id="note-link"><w:r><w:t>Link</w:t></w:r></w:hyperlink></w:p></w:footnote></w:footnotes>`),
    textZipEntry('word/endnotes.xml', `<w:endnotes xmlns:w="${w}"><w:endnote w:id="2"><w:p><w:r><w:rPr><w:vertAlign w:val="subscript"/></w:rPr><w:t>End</w:t></w:r></w:p></w:endnote></w:endnotes>`),
    textZipEntry('word/_rels/footnotes.xml.rels', '<Relationships><Relationship Id="note-link" Target="https://source.example/note"/></Relationships>'),
    textZipEntry('word/_rels/document.xml.rels', '<Relationships><Relationship Id="note-link" Target="https://wrong.example/"/></Relationships>'),
  ]));
  const parsed = parseDocxSource(bytes, '1', 'source.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  const local = await readDocxNotes(new OdtZip(new Uint8Array(bytes).buffer));
  assert.equal(parsed.footnotes[0]?.bodyContent, local.footnotes.get('14')?.bodyContent);
  assert.equal(parsed.endnotes[0]?.bodyContent, local.endnotes.get('2')?.bodyContent);
  const source = applyReferenceSemantics(bytes, applyNoteIntegrity(bytes, parsed));
  assert.equal(source.footnotes.length, 1);
  assert.equal(source.footnotes[0]?.bodyContent, parsed.footnotes[0]?.bodyContent);
  for (const importer of [createManuscriptFromOjsLaunch, importLocalizedLaunch]) {
    const manuscript = importer(launchWithSource(source));
    assert.ok(manuscript);
    assert.equal(manuscript.annotations.length, 2);
    const note = manuscript.annotations[0]!;
    const doc = JSON.parse(note.bodyContent!);
    const nodes = doc.content.flatMap((p: { content: Array<{ text?: string; marks?: Array<{ type: string; attrs?: Record<string, unknown> }> }> }) => p.content);
    const marks = (text: string) => nodes.find((node: { text?: string }) => node.text === text)?.marks ?? [];
    assert.deepEqual(marks('Styled').map((mark: { type: string }) => mark.type), ['italic', 'bold']);
    assert.deepEqual(marks(' plain'), []);
    assert.deepEqual(marks(' decorated').map((mark: { type: string }) => mark.type), ['omiUnderline', 'strike', 'omiSmallCaps']);
    assert.equal(marks('2')[0]?.type, 'omiSuperscript');
    assert.deepEqual(marks('Link'), [{ type: 'omiLink', attrs: { href: 'https://source.example/note' } }]);
    assert.equal(doc.content.length, 2);
    assert.match(note.body, /Line\ttab\nLink$/);
    assert.doesNotMatch(note.body, /Hidden|Deleted/);
    assert.equal(JSON.parse(manuscript.annotations[1]!.bodyContent!).content[0].content[0].marks[0].type, 'omiSubscript');
    const restored = parseOmiJson(serializeOmiJson(manuscript));
    assert.equal(restored.annotations[0]?.bodyContent, note.bodyContent);
    assert.deepEqual(createNoteBodyDocument(note, [], 'chicago-notes-bibliography', 'hu'), doc);
    assert.match(renderHtmlArticle(manuscript).html, /<strong><em>Styled<\/em><\/strong>/);
  }
});

test('falls back to legacy plain notes when optional OJS rich content is absent or malformed', () => {
  for (const bodyContent of [undefined, '{bad', '{"type":"doc","content":[{"type":"omiNote"}]}']) {
    const manuscript = importLocalizedLaunch(launchWithSource({ kind: 'docx', paragraphs: [{ text: 'Body', inline: [{ kind: 'text', text: 'Body' }, { kind: 'footnoteReference', footnoteId: '1' }] }], footnotes: [{ id: '1', text: 'Legacy note', bodyContent }] }));
    assert.equal(manuscript?.annotations[0]?.body, 'Legacy note');
    assert.equal(manuscript?.annotations[0]?.bodyContent, undefined);
  }
});
