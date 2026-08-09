import assert from 'node:assert/strict';
import test from 'node:test';

import { buildIdmlExport, IDML_MEDIA_TYPE } from '../src/services/exportIdml.ts';
import { createVersionedTestManuscript } from './testManuscriptFixture.ts';

test('builds an IDML package with design map, story, styles and spread', () => {
  const manuscript = createVersionedTestManuscript();
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

  const spread = new TextDecoder().decode(entries.get('Spreads/Spread_u2.xml'));
  assert.match(spread, /ParentStory="u3"/);
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
