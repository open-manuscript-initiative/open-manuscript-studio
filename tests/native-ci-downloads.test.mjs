import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { downloadReleaseAsset } from '../scripts/download-github-release-asset.mjs';
import { gradleRelease } from '../scripts/prepare-native-ci-downloads.mjs';

const payload = Buffer.from('Synthetic official binary bytes');
const digest = createHash('sha256').update(payload).digest('hex');

async function fixture(t, { metadataFailures = [], assetFailures = [], bytes = payload,
  metadataHash = `sha256:${digest}`, existing } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'omi-verified-download-'));
  t.after(() => rm(root, { force: true, recursive: true }));
  const destination = join(root, 'tool.bin');
  if (existing) await writeFile(destination, existing);
  const requests = [];
  const waits = [];
  const options = { repository: 'github/codeql-action', tag: 'synthetic-tag',
    assetName: 'tool.bin', destination, wait: async milliseconds => waits.push(milliseconds),
    fetchImpl: async (url, init) => {
      requests.push({ url, accept: init.headers.Accept });
      if (url.includes('/releases/tags/')) {
        const status = metadataFailures.shift();
        if (status) return new Response(null, { status });
        return Response.json({ assets: [{ id: 42, name: 'tool.bin', digest: metadataHash,
          url: 'https://untrusted.invalid/never-request-this' }] });
      }
      const status = assetFailures.shift();
      return new Response(status ? null : bytes, { status: status || 200 });
    },
  };
  return { root, destination, requests, waits, options };
}

test('official API download verifies bytes and constructs the trusted asset endpoint', async t => {
  const f = await fixture(t);
  assert.equal(await downloadReleaseAsset(f.options), digest);
  assert.deepEqual(await readFile(f.destination), payload);
  assert.equal(f.requests[1].url, 'https://api.github.com/repos/github/codeql-action/releases/assets/42');
  assert.equal(f.requests[1].accept, 'application/octet-stream');
});

test('metadata and binary downloads retry transient HTTP failures', async t => {
  const f = await fixture(t, { metadataFailures: [503], assetFailures: [504, 502] });
  assert.equal(await downloadReleaseAsset(f.options), digest);
  assert.equal(f.requests.length, 5);
  assert.deepEqual(f.waits, [5000, 5000, 10000]);
});

test('valid cached bytes are verified and reused without another binary download', async t => {
  const f = await fixture(t, { existing: payload });
  await downloadReleaseAsset(f.options);
  assert.equal(f.requests.length, 1);
});

test('a checksum mismatch preserves the previous file and deletes partial bytes', async t => {
  const f = await fixture(t, { bytes: Buffer.from('corrupted download'), existing: Buffer.from('old file') });
  await assert.rejects(downloadReleaseAsset(f.options), /SHA-256 mismatch/);
  assert.equal(await readFile(f.destination, 'utf8'), 'old file');
  assert.deepEqual(await readdir(f.root), ['tool.bin']);
});

test('permanent HTTP errors and exhausted retries remain failing', async t => {
  for (const [statuses, count] of [[[404], 1], [[504, 504, 504, 504], 4]]) {
    const f = await fixture(t, { assetFailures: statuses });
    await assert.rejects(downloadReleaseAsset(f.options), /HTTP/);
    assert.equal(f.requests.length, count + 1);
    assert.deepEqual(await readdir(f.root), []);
  }
});

test('old releases require a pinned hash when GitHub publishes no digest', async t => {
  const f = await fixture(t, { metadataHash: null });
  await assert.rejects(downloadReleaseAsset(f.options), /SHA-256 is missing/);
  assert.equal(await downloadReleaseAsset({ ...f.options, sha256: digest }), digest);
});

test('untrusted repositories and inconsistent hashes are rejected', async t => {
  const f = await fixture(t);
  await assert.rejects(downloadReleaseAsset({ ...f.options, repository: 'untrusted/repo' }), /supported official/);
  assert.equal(f.requests.length, 0);
  await assert.rejects(downloadReleaseAsset({ ...f.options, sha256: '0'.repeat(64) }), /inconsistent/);
});

test('Gradle source selection retains the exact generated version and archive type', () => {
  assert.deepEqual(gradleRelease('distributionUrl=https\\://services.gradle.org/distributions/gradle-9.6.1-bin.zip\n'),
    { tag: 'v9.6.1', assetName: 'gradle-9.6.1-bin.zip' });
  assert.deepEqual(gradleRelease('distributionUrl=https\\://downloads.gradle.org/distributions/gradle-9.3.1-all.zip\r\n'),
    { tag: 'v9.3.1', assetName: 'gradle-9.3.1-all.zip' });
  assert.throws(() => gradleRelease('distributionUrl=https://untrusted.invalid/gradle-9.6.1-bin.zip'), /official/);
});
