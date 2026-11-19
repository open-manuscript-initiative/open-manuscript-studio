import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { downloadReleaseAsset } from '../scripts/download-github-release-asset.mjs';
import { gradleRelease, prepareBundledKotlinCompiler, verifiedKotlinCompilerPom, expandZip } from '../scripts/prepare-native-ci-downloads.mjs';

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
  assert.equal(f.requests[3].url, 'https://github.com/github/codeql-action/releases/download/synthetic-tag/tool.bin');
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

test('the exact compiler bundled with Gradle seeds its content-addressed cache', async t => {
  const f = await fixture(t);
  const archive = join(f.root, 'gradle.zip');
  const prepared = spawnSync('python3', ['-c',
    "import sys,zipfile; z=zipfile.ZipFile(sys.argv[1],'w'); z.writestr('gradle-9.6.1/lib/kotlin-compiler-embeddable-2.3.21.jar', b'Compiler from verified distribution'); z.close()", archive]);
  assert.equal(prepared.status, 0, prepared.stderr?.toString());
  const previous = { GRADLE_USER_HOME: process.env.GRADLE_USER_HOME, RUNNER_TEMP: process.env.RUNNER_TEMP };
  process.env.GRADLE_USER_HOME = f.root;
  process.env.RUNNER_TEMP = f.root;
  try {
    assert.equal(await prepareBundledKotlinCompiler(archive), '2.3.21');
    const bytes = Buffer.from('Compiler from verified distribution');
    const sha1 = createHash('sha1').update(bytes).digest('hex');
    const path = join(f.root, 'caches/modules-2/files-2.1/org.jetbrains.kotlin/kotlin-compiler-embeddable',
      '2.3.21', sha1, 'kotlin-compiler-embeddable-2.3.21.jar');
    assert.deepEqual(await readFile(path), bytes);
    const mavenRoot = join(f.root, 'omi-verified-kotlin-maven', 'org/jetbrains/kotlin/kotlin-compiler-embeddable/2.3.21');
    assert.deepEqual(await readFile(join(mavenRoot, 'kotlin-compiler-embeddable-2.3.21.jar')), bytes);
    const pom = await readFile(join(mavenRoot, 'kotlin-compiler-embeddable-2.3.21.pom'), 'utf8');
    assert.match(pom, /<version>2\.3\.21<\/version>/);
    assert.match(pom, /kotlin-script-runtime/);
    assert.match(pom, /kotlin-daemon-embeddable/);
    const init = await readFile(join(f.root, 'init.d', 'omi-verified-kotlin.init.gradle'), 'utf8');
    assert.match(init, /exclusiveContent/);
    assert.match(init, /forRepositories\(verifiedRepo\)/);
    assert.doesNotMatch(init, /gradle\.beforeProject/);
    assert.match(init, /includeVersion\('org\.jetbrains\.kotlin', 'kotlin-compiler-embeddable', '2\.3\.21'\)/);
    assert.match(init, /omi-verified-kotlin-maven/);

  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('unreviewed Kotlin compiler versions cannot reuse pinned local dependency metadata', () => {
  assert.throws(() => verifiedKotlinCompilerPom('2.4.0'), /explicit review/);
});


test('bundler ZIP extraction selects PowerShell 7 and passes literal paths through the environment', () => {
  const archive = "C:\\runner temp\\tool's archive.zip";
  const destination = "C:\\runner temp\\tool's cache";
  let call;
  expandZip(archive, destination, { spawnImpl: (...args) => { call = args; return { status: 0 }; } });
  assert.equal(call[0], 'pwsh');
  assert.ok(call[1].includes('-NoProfile'));
  assert.match(call[1].at(-1), /ZipFile\]::ExtractToDirectory/);
  assert.doesNotMatch(call[1].at(-1), /Expand-Archive/);
  assert.equal(call[2].env.OMI_TOOL_ARCHIVE, archive);
  assert.equal(call[2].env.OMI_TOOL_DESTINATION, destination);
  assert.ok(!call[1].some(argument => argument.includes(archive) || argument.includes(destination)));
});

test('bundler ZIP extraction propagates shell and extraction failures', () => {
  const error = new Error('pwsh unavailable');
  assert.throws(() => expandZip('tool.zip', 'cache', { spawnImpl: () => ({ error }) }), exception => exception === error);
  assert.throws(() => expandZip('tool.zip', 'cache', { spawnImpl: () => ({ status: 1 }) }), /archive extraction failed/);
});

test('bundler ZIP extracts nested files and overwrites stale cache bytes in the Windows runtime', { skip: process.platform !== 'win32' }, async t => {
  const root = await mkdtemp(join(tmpdir(), "omi bundler's zip "));
  t.after(() => rm(root, { recursive: true, force: true }));
  const archive = join(root, 'tool archive.zip');
  const destination = join(root, 'tool cache');
  // Small STORE ZIP containing nested/tool.txt; no external downloads required.
  await writeFile(archive, Buffer.from('UEsDBBQAAAAAAOxWc11xCXDdEwAAABMAAAAPAAAAbmVzdGVkL3Rvb2wudHh0dmVyaWZpZWQgdG9vbCBieXRlc1BLAQIUAxQAAAAAAOxWc11xCXDdEwAAABMAAAAPAAAAAAAAAAAAAACAAQAAAABuZXN0ZWQvdG9vbC50eHRQSwUGAAAAAAEAAQA9AAAAQAAAAAAA', 'base64'));
  expandZip(archive, destination);
  const tool = join(destination, 'nested', 'tool.txt');
  assert.equal(await readFile(tool, 'utf8'), 'verified tool bytes');
  await writeFile(tool, 'stale cache');
  expandZip(archive, destination);
  assert.equal(await readFile(tool, 'utf8'), 'verified tool bytes');
  await writeFile(archive, 'not a ZIP');
  assert.throws(() => expandZip(archive, destination), /archive extraction failed/);
});
