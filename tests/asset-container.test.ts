import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createAssetMetadata,
  decodeDataUrl,
  sha256Hex,
} from '../src/model/assets.ts';
import {
  clearMemoryAssetCache,
  putAssetPayload,
} from '../src/services/assetRepository.ts';
import {
  buildOmiContainer,
  isSafeContainerPath,
  OMI_CONTAINER_MEDIA_TYPE,
} from '../src/services/omiContainer.ts';
import { createTestManuscript } from './testManuscriptFixture.ts';

test('decodes embedded image data and produces deterministic SHA-256 evidence', async () => {
  const decoded = decodeDataUrl('data:text/plain;base64,aGVsbG8=');
  assert.ok(decoded);
  assert.equal(decoded.mediaType, 'text/plain');
  assert.equal(new TextDecoder().decode(decoded.bytes), 'hello');
  assert.equal(
    await sha256Hex(decoded.bytes),
    '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
  );
});

test('creates portable asset metadata without embedding payload bytes', async () => {
  const bytes = new TextEncoder().encode('figure payload');
  const asset = await createAssetMetadata(bytes, {
    id: 'asset-figure-1',
    mediaType: 'image/png',
    fileName: '../unsafe figure.png',
    role: 'figure',
    createdAt: '2026-08-07T00:00:00.000Z',
  });

  assert.equal(asset.id, 'asset-figure-1');
  assert.equal(asset.mediaType, 'image/png');
  assert.equal(asset.size, bytes.byteLength);
  assert.equal(asset.checksum.algorithm, 'sha256');
  assert.equal(asset.checksum.scope, 'raw-bytes');
  assert.equal(asset.fileName.includes('/'), false);
  assert.equal('bytes' in asset, false);
});

test('rejects archive traversal and ambiguous container paths', () => {
  assert.equal(isSafeContainerPath('media/images/figure.png'), true);
  assert.equal(isSafeContainerPath('../figure.png'), false);
  assert.equal(isSafeContainerPath('/absolute/path'), false);
  assert.equal(isSafeContainerPath('media\\figure.png'), false);
  assert.equal(isSafeContainerPath('media//figure.png'), false);
});

test('builds a portable OMI ZIP with external asset payload and clean document JSON', async () => {
  clearMemoryAssetCache();
  const manuscript = createTestManuscript();
  const bytes = new TextEncoder().encode('fake-png-payload');
  const asset = await createAssetMetadata(bytes, {
    id: 'asset-figure-1',
    mediaType: 'image/png',
    fileName: 'figure.png',
    role: 'figure',
    createdAt: '2026-08-07T00:00:00.000Z',
  });
  manuscript.assets = [asset];
  manuscript.sections[0]?.blocks.push({
    id: 'figure-block-1',
    type: 'image',
    content: '',
    visual: {
      kind: 'image',
      assetId: asset.id,
      src: 'data:image/png;base64,ZmFrZS1wbmctcGF5bG9hZA==',
      mediaType: 'image/png',
      fileName: 'figure.png',
      alt: 'Test figure',
      caption: 'Portable figure',
    },
  });
  await putAssetPayload(manuscript.id, asset.id, bytes);

  const result = await buildOmiContainer(manuscript);
  const entries = readStoreZipEntries(result.bytes);
  const documentJson = new TextDecoder().decode(entries.get('manuscript/document.json'));
  const jats = new TextDecoder().decode(entries.get('publication/article.jats.xml'));
  const manifest = new TextDecoder().decode(entries.get('META-INF/manifest.json'));

  assert.equal(result.validForExport, true);
  assert.equal(new TextDecoder().decode(entries.get('META-INF/mimetype')), OMI_CONTAINER_MEDIA_TYPE);
  assert.ok(entries.has('META-INF/checksums.json'));
  assert.ok(entries.has('media/images/asset-figure-1-figure.png'));
  assert.equal(documentJson.includes('data:image/png;base64'), false);
  assert.ok(documentJson.includes('"assetId": "asset-figure-1"'));
  assert.ok(jats.includes('xlink:href="media/images/asset-figure-1-figure.png"'));
  assert.ok(manifest.includes('OMI-SPEC-330@0.1.0'));
});

function readStoreZipEntries(bytes: Uint8Array): Map<string, Uint8Array> {
  const entries = new Map<string, Uint8Array>();
  const decoder = new TextDecoder();
  let offset = 0;

  while (offset + 30 <= bytes.length) {
    const view = new DataView(bytes.buffer, bytes.byteOffset + offset, bytes.byteLength - offset);
    if (view.getUint32(0, true) !== 0x04034b50) break;
    const method = view.getUint16(8, true);
    assert.equal(method, 0);
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
