import assert from 'node:assert/strict';
import test from 'node:test';

import { buildOmiContainer } from '../src/services/omiContainer.ts';
import { createVersionedTestManuscript } from './testManuscriptFixture.ts';

test('embeds semantic HTML alongside JATS in a valid OMI container', async () => {
  const manuscript = createVersionedTestManuscript();
  const result = await buildOmiContainer(manuscript);
  const entries = readStoreZipEntries(result.bytes);

  assert.equal(result.validForExport, true);
  assert.equal(entries.has('publication/article.jats.xml'), true);
  assert.equal(entries.has('publication/article.html'), true);

  const html = new TextDecoder().decode(entries.get('publication/article.html'));
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /data-omi-manuscript-id="manuscript-test"/);
  assert.doesNotMatch(html, /<script\b/i);

  const manifest = JSON.parse(
    new TextDecoder().decode(entries.get('META-INF/manifest.json')),
  ) as { entries: Array<{ path: string; role: string }> };
  assert.equal(
    manifest.entries.some(
      (entry) =>
        entry.path === 'publication/article.html' &&
        entry.role === 'publication:semantic-html5',
    ),
    true,
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
    const name = decoder.decode(
      bytes.subarray(nameStart, nameStart + nameLength),
    );
    entries.set(name, bytes.slice(dataStart, dataStart + size));
    offset = dataStart + size;
  }

  return entries;
}
