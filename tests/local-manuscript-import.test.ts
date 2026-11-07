import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { readLocalManuscriptBytes } from '../src/services/localManuscriptImport.ts';
import { createAndroidDocumentReceiver } from '../src/services/androidDocumentOpening.ts';
import { serializeOmiJson } from '../src/services/exportOmi.ts';
import { buildOmiContainer } from '../src/services/omiContainer.ts';
import { createAssetMetadata } from '../src/model/assets.ts';
import { clearMemoryAssetCache, getAssetPayload, putAssetPayload } from '../src/services/assetRepository.ts';
import { commitManuscriptRevision, extractManuscriptState } from '../src/model/versioning.ts';
import { createVersionedTestManuscript } from './testManuscriptFixture.ts';

const encode = (text: string) => new TextEncoder().encode(text);
const manuscript = createVersionedTestManuscript();
const jsonBytes = encode(serializeOmiJson(manuscript));

test('shared local reader round-trips JSON and ZIP while preserving revision identity and asset bytes', async () => {
  const json = await readLocalManuscriptBytes(jsonBytes);
  assert.equal(json.isContainer, false);
  assert.equal(json.manuscript.headRevisionId, manuscript.headRevisionId);
  const bytes = encode('synthetic-image-payload');
  const asset = await createAssetMetadata(bytes, {
    id: 'local-reader-image', mediaType: 'image/png', fileName: 'figure.png', role: 'figure',
    createdAt: '2026-08-07T00:00:00.000Z',
  });
  const withAsset = commitManuscriptRevision(manuscript, {
    ...extractManuscriptState(manuscript), assets: [asset],
  }, { events: [{ operation: 'asset.attach' as never, targetId: asset.id, path: '/assets/-', nextValue: asset }], summary: 'Attach local test asset', timestamp: '2026-08-07T12:01:00.000Z' });
  await putAssetPayload(withAsset.id, asset.id, bytes);
  const packed = await buildOmiContainer(withAsset);
  assert.equal(packed.validForExport, true);
  clearMemoryAssetCache();
  const result = await readLocalManuscriptBytes(packed.bytes);
  assert.equal(result.isContainer, true);
  assert.equal(result.manuscript.id, withAsset.id);
  assert.equal(result.manuscript.headRevisionId, withAsset.headRevisionId);
  assert.deepEqual(await getAssetPayload(withAsset.id, asset.id), bytes);
});

test('shared reader rejects empty, non-OMI JSON and malformed archives before a document can load', async () => {
  await assert.rejects(readLocalManuscriptBytes(new Uint8Array()), /0 bytes/);
  await assert.rejects(readLocalManuscriptBytes(encode('{"id":"fake","title":"Fake","sections":[]}')));
  await assert.rejects(readLocalManuscriptBytes(new Uint8Array([0x50, 0x4b, 3, 4, 0])));
});

test('Android receiver handles cold start, warm opens, a repeated same URI, and failure recovery in order', async () => {
  let notify = () => {};
  let queue = ['content://downloads/initial'];
  let reading = 0;
  const reads: string[] = [];
  const opened: string[] = [];
  const errors: unknown[] = [];
  const connect = createAndroidDocumentReceiver({
    listen: async (handler) => { notify = handler; },
    takePending: async () => { const result = queue; queue = []; return result; },
    read: async (uri) => {
      assert.equal(++reading, 1, 'imports must be serialized'); reads.push(uri);
      await Promise.resolve(); --reading;
      return uri.endsWith('/empty') ? new Uint8Array() : jsonBytes;
    },
  });
  const disconnect = connect((doc) => opened.push(doc.id), (error) => errors.push(error));
  await waitFor(() => opened.length === 1);
  queue.push('content://downloads/empty', 'https://example.test/no-read', 'content://downloads/initial');
  notify(); notify();
  await waitFor(() => opened.length === 2 && errors.length === 2);
  assert.deepEqual(reads, ['content://downloads/initial', 'content://downloads/empty', 'content://downloads/initial']);
  disconnect();
  queue.push('content://downloads/after-login'); notify();
  await new Promise((resolve) => { setImmediate(resolve); });
  assert.equal(opened.length, 2);
  connect((doc) => opened.push(doc.id), (error) => errors.push(error));
  await waitFor(() => opened.length === 3);
});

test('Android receiver retains a consumed request across effect cleanup during an in-flight read', async () => {
  let release!: (bytes: Uint8Array) => void;
  let queued = true;
  const opened: string[] = [];
  const connect = createAndroidDocumentReceiver({
    listen: async () => {},
    takePending: async () => { const uris = queued ? ['content://docs/replay'] : []; queued = false; return uris; },
    read: async () => new Promise<Uint8Array>((resolve) => { release = resolve; }),
  });
  const stop = connect(() => assert.fail('unmounted receiver must not load'), assert.fail);
  await waitFor(() => Boolean(release));
  stop(); release(jsonBytes);
  await new Promise((resolve) => { setImmediate(resolve); });
  connect((doc) => opened.push(doc.id), assert.fail);
  await new Promise((resolve) => { setImmediate(resolve); });
  release(jsonBytes);
  await waitFor(() => opened.length === 1);
});

test('packaged native capability authorizes the actual binary read command without broad filesystem scopes', () => {
  const capability = JSON.parse(readFileSync('src-tauri/capabilities/default.json', 'utf8'));
  assert.ok(capability.permissions.includes('fs:allow-read-file'));
  assert.deepEqual(capability.webviews, ['main']);
  assert.equal(capability.remote, undefined);
  assert.ok(!capability.permissions.includes('fs:scope-home-recursive'));
  const android = JSON.parse(readFileSync('src-tauri/tauri.android.conf.json', 'utf8'));
  assert.ok(android.bundle.fileAssociations.some((item: { mimeType: string }) => item.mimeType === 'application/octet-stream'));
});

async function waitFor(condition: () => boolean) {
  for (let i = 0; i < 100; i++) {
    if (condition()) return;
    await new Promise((resolve) => { setImmediate(resolve); });
  }
  assert.fail('Android document receiver did not finish');
}
