import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const script = fileURLToPath(new URL('../scripts/tauri-build-with-download-retry.sh', import.meta.url));

function runBuild(t, results, args = ['--bundles', 'msi,nsis']) {
  const dir = mkdtempSync(join(tmpdir(), 'omi-download-retry-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const calls = join(dir, 'calls.jsonl');
  const waits = join(dir, 'waits.txt');
  const build = join(dir, 'build.cjs');
  writeFileSync(build, `
const fs = require('node:fs');
const calls = process.env.OMI_TEST_CALLS;
const count = fs.existsSync(calls) ? fs.readFileSync(calls, 'utf8').trim().split('\\n').length : 0;
fs.appendFileSync(calls, JSON.stringify(process.argv.slice(2)) + '\\n');
const result = JSON.parse(process.env.OMI_TEST_RESULTS)[count] || { code: 99, error: 'Unexpected invocation' };
if (result.error) console.error(result.error);
process.exit(result.code);
`);
  writeFileSync(join(dir, 'sleep'), '#!/usr/bin/env bash\nprintf "%s\\n" "$1" >> "$OMI_TEST_WAITS"\n', { mode: 0o755 });
  const result = spawnSync('bash', [script, process.execPath, build, ...args], {
    encoding: 'utf8', timeout: 5000,
    env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, OMI_TEST_CALLS: calls,
      OMI_TEST_WAITS: waits, OMI_TEST_RESULTS: JSON.stringify(results) },
  });
  if (result.error) throw result.error;
  const readLines = path => {
    try { return readFileSync(path, 'utf8').trim().split('\n'); }
    catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  };
  return { ...result, calls: readLines(calls).map(JSON.parse), waits: readLines(waits) };
}

test('successful builds execute once and preserve literal arguments', t => {
  const args = ['--bundles', 'msi,nsis', 'literal value; $(no-execution)'];
  const result = runBuild(t, [{ code: 0 }], args);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.calls, [args]);
  assert.deepEqual(result.waits, []);
});

test('temporary bundler download failures recover within the same job', t => {
  const result = runBuild(t, [
    { code: 1, error: 'failed to bundle project: `http status: 504`' },
    { code: 1, error: 'failed to bundle project: `http status: 502`' },
    { code: 0 },
  ]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.calls.length, 3);
  assert.deepEqual(result.calls[1], result.calls[0]);
  assert.deepEqual(result.waits, ['10', '20']);
});

test('persistent download failures stay red after four attempts', t => {
  const result = runBuild(t, Array.from({ length: 4 }, () => (
    { code: 47, error: 'failed to bundle project: `http status: 503`' }
  )));
  assert.equal(result.status, 47);
  assert.equal(result.calls.length, 4);
  assert.deepEqual(result.waits, ['10', '20', '30']);
});

test('compiler, signing, checksum, authorization and missing-asset failures are not retried', t => {
  for (const error of ['error[E0308]: mismatched types', 'Code signing failed', 'checksum mismatch',
    'failed to bundle project: `http status: 403`', 'failed to bundle project: `http status: 404`']) {
    const result = runBuild(t, [{ code: 42, error }]);
    assert.equal(result.status, 42);
    assert.equal(result.calls.length, 1);
    assert.deepEqual(result.waits, []);
  }
});

test('an unrelated failure after a retried download preserves its exit status', t => {
  const result = runBuild(t, [
    { code: 1, error: 'failed to bundle project: `http status: 504`' },
    { code: 43, error: 'Code signing failed' },
  ]);
  assert.equal(result.status, 43);
  assert.equal(result.calls.length, 2);
});

test('a missing command is rejected', () => {
  assert.equal(spawnSync('bash', [script]).status, 2);
});
