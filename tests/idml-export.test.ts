import assert from 'node:assert/strict';
import test from 'node:test';

import { DOMParser as XmlParser } from '@xmldom/xmldom';

import { buildIdmlExport, IDML_MEDIA_TYPE } from '../src/services/exportIdml.ts';
import type { PublicationStyle } from '../src/services/publicationStyleExport.ts';
import { createVersionedTestManuscript } from './testManuscriptFixture.ts';

test('builds an IDML package with paragraph and character styles', () => {
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
          { type: 'text', text: ' strong emphasis', marks: [{ type: 'bold' }, { type: 'italic' }] },
        ],
      }],
    });
  }

  const result = buildIdmlExport(manuscript);
  const entries = readStoreZipEntries(result.bytes);

  assert.match(result.fileName, /\.idml$/);
  assert.equal(new TextDecoder().decode(entries.get('mimetype')), IDML_MEDIA_TYPE);
  assert.equal(entries.has('designmap.xml'), true);
  assert.equal(entries.has('Resources/Styles.xml'), true);
  assert.equal(entries.has('Stories/Story_u3.xml'), true);
  assert.equal(entries.has('Spreads/Spread_u2.xml'), true);

  const story = new TextDecoder().decode(entries.get('Stories/Story_u3.xml'));
  assert.match(story, /AppliedParagraphStyle="ParagraphStyle\/OMI Title"/);
  assert.match(story, /AppliedParagraphStyle="ParagraphStyle\/OMI Heading 1"/);
  assert.match(story, /AppliedCharacterStyle="CharacterStyle\/OMI Emphasis"/);
  assert.match(story, /AppliedCharacterStyle="CharacterStyle\/OMI Strong Emphasis"/);
  assert.match(
    story,
    /AppliedCharacterStyle="CharacterStyle\/OMI Author Given Name"><Content>Ada<\/Content>/,
  );
  assert.match(
    story,
    /AppliedCharacterStyle="CharacterStyle\/OMI Author Family Name"><Content>Scholar<\/Content>/,
  );

  const styles = new TextDecoder().decode(entries.get('Resources/Styles.xml'));
  assert.match(styles, /Name="OMI Emphasis"/);
  assert.match(styles, /<ParagraphStyle Self="ParagraphStyle\/OMI Title"[^>]*><Properties><AppliedFont type="string">Times New Roman<\/AppliedFont><FontStyle type="string">Bold<\/FontStyle><\/Properties><\/ParagraphStyle>/);
  assert.match(styles, /Name="OMI Strong"/);
  assert.match(styles, /Name="OMI Small Caps"/);
  assert.match(styles, /Name="OMI Author Given Name"/);
  assert.match(styles, /Name="OMI Author Family Name"/);

  const spread = new TextDecoder().decode(entries.get('Spreads/Spread_u2.xml'));
  assert.match(spread, /ParentStory="u3"/);
});


test('IDML package follows the InDesign UCF and design-map structure', () => {
  const result = buildIdmlExport(createVersionedTestManuscript());
  const entries = readStoreZipEntries(result.bytes);
  const names = [...entries.keys()];

  assert.equal(names[0], 'mimetype');
  assert.equal(names[1], 'designmap.xml');
  assert.equal(
    new DataView(result.bytes.buffer, result.bytes.byteOffset, result.bytes.byteLength).getUint16(8, true),
    0,
    'the leading UCF mimetype entry must be stored without compression',
  );
  assert.equal(new TextDecoder().decode(entries.get('mimetype')), IDML_MEDIA_TYPE);

  const designMap = new TextDecoder().decode(entries.get('designmap.xml'));
  assert.ok(designMap.includes('<?aid style="50" type="document" readerVersion="6.0" featureSet="257" product="8.0(0)"?>'));
  assert.ok(designMap.includes('<Document xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging" DOMVersion="8.0" Self="d" StoryList="u3"'));
  assert.ok(designMap.includes('<idPkg:Preferences src="Resources/Preferences.xml"/>'));
  assert.doesNotMatch(designMap, /<idPkg:DesignMap|<idPkg:Properties/);

  const references = [...designMap.matchAll(/\bsrc="([^"]+)"/g)].map((match) => match[1]);
  for (const reference of references) {
    assert.equal(entries.has(reference), true, `designmap reference must exist: ${reference}`);
  }

  for (const [name, bytes] of entries) {
    if (!name.endsWith('.xml')) continue;
    const xml = new TextDecoder().decode(bytes);
    const document = new XmlParser({
      onError: (_level, message) => {
        throw new Error(`${name}: ${message}`);
      },
    }).parseFromString(xml, 'application/xml');
    assert.ok(document.documentElement, `${name} must have an XML root element`);
  }
});

test('exports assigned Studio paragraph styles as real IDML paragraph styles', () => {
  const manuscript = createVersionedTestManuscript();
  const block = manuscript.sections[0]?.blocks[0];
  assert.ok(block);
  block.paragraphStyleId = 'chapter-title';

  const publicationStyle = {
    paragraphStyles: {
      defaultStyleId: 'body',
      items: [
        {
          id: 'body',
          name: 'Body',
          basedOnId: null,
          nextStyleId: 'body',
          properties: {
            fontFamily: 'Garamond Premier Pro',
            fontSize: 11,
            tabStops: [{ positionMm: 12, alignment: 'left' }],
          },
          preservedIdml: { Imported: 'true' },
        },
        {
          id: 'chapter-title',
          name: 'Szakaszcím',
          basedOnId: 'body',
          nextStyleId: 'body',
          properties: {
            fontFamily: 'Garamond Premier Pro',
            fontSize: 18,
            fontStyle: 'italic',
            tracking: 100,
            tabStops: [{
              positionMm: 25.4,
              alignment: 'right',
              leader: '.',
            }],
            nestedStyles: [{
              id: 'nested-1',
              characterStyleId: 'OMI Small Caps',
              repeat: 1,
              through: false,
              delimiter: ':',
            }],
            grepStyles: [{
              id: 'grep-1',
              characterStyleId: 'OMI Emphasis',
              expression: '\\d+',
            }],
            hyphenation: false,
            openType: {
              ligatures: true,
              contextualAlternates: true,
              stylisticSets: [1, 3],
            },
          },
          preservedIdml: { Imported: 'true' },
        },
      ],
    },
  } as unknown as PublicationStyle;

  const result = buildIdmlExport(manuscript, publicationStyle);
  const entries = readStoreZipEntries(result.bytes);
  const styles = new TextDecoder().decode(entries.get('Resources/Styles.xml'));
  const story = new TextDecoder().decode(entries.get('Stories/Story_u3.xml'));
  const parsedStyles = new XmlParser({
    onError: (_level, message) => {
      throw new Error(`Resources/Styles.xml: ${message}`);
    },
  }).parseFromString(styles, 'application/xml');

  for (const id of ['body', 'chapter-title']) {
    const styleTag = styles.match(new RegExp(`<ParagraphStyle Self="ParagraphStyle/${id}"[^>]*>`))?.[0];
    assert.ok(styleTag, `style ${id} must be present`);
    assert.equal((styleTag.match(/\\bImported=/g) ?? []).length, 1);
    assert.match(styleTag, /Imported="false"/);
  }
  const tabStopIds = Array.from(parsedStyles.getElementsByTagName('TabStop'))
    .map((tabStop) => tabStop.getAttribute('Self'));
  assert.equal(tabStopIds.length, 2);
  assert.equal(new Set(tabStopIds).size, tabStopIds.length, 'tab stop Self IDs must be unique');

  assert.match(styles, /Self="ParagraphStyle\/chapter-title"/);
  assert.match(styles, /Name="Szakaszcím"/);
  assert.match(styles, /NextStyle="ParagraphStyle\/body"/);
  assert.match(styles, /<BasedOn type="object">ParagraphStyle\/body<\/BasedOn>/);
  assert.match(styles, /PointSize="18"/);
  assert.match(styles, /Tracking="100"/);
  assert.match(styles, /<TabStop[^>]*Position="72"[^>]*Alignment="RightAlign"/);
  assert.match(styles, /<AllNestedStyles type="list">/);
  assert.match(styles, /<AllGREPStyles type="list">/);
  assert.match(styles, /OtfStylisticSets="5"/);
  assert.match(story, /AppliedParagraphStyle="ParagraphStyle\/chapter-title"/);
});

function readStoreZipEntries(bytes: Uint8Array): Map<string, Uint8Array> {
  const entries = new Map<string, Uint8Array>();
  const decoder = new TextDecoder();
  let offset = 0;

  while (offset + 30 <= bytes.length) {
    const view = new DataView(bytes.buffer, bytes.byteOffset + offset, bytes.byteLength - offset);
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
