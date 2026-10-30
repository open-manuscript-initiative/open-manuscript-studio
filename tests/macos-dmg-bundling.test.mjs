import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const script = fileURLToPath(new URL('../scripts/bundle-macos-dmg.sh', import.meta.url));

function runBundler(t, results, target = 'x86_64-apple-darwin') {
  const dir = mkdtempSync(join(tmpdir(), 'omi-dmg-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const callsFile = join(dir, 'calls.jsonl');
  const waitsFile = join(dir, 'waits.jsonl');
  writeFileSync(join(dir, 'npm'), `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const dir = __dirname;
const file = path.join(dir, 'calls.jsonl');
const count = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim().split('\\n').length : 0;
fs.appendFileSync(file, JSON.stringify(process.argv.slice(2)) + '\\n');
const results = JSON.parse(process.env.OMI_TEST_RESULTS);
const result = results[count] || { code: 99, error: 'Unexpected extra invocation' };
if (result.error) console.error(result.error);
process.exit(result.code);
`, { mode: 0o755 });
  writeFileSync(join(dir, 'sleep'), `#!/usr/bin/env node
require('node:fs').appendFileSync(require('node:path').join(__dirname, 'waits.jsonl'), JSON.stringify(process.argv.slice(2)) + '\\n');
`, { mode: 0o755 });
  const result = spawnSync('bash', [script, target], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, OMI_TEST_RESULTS: JSON.stringify(results) },
    timeout: 5000,
  });
  if (result.error) throw result.error;
  const readLines = (file) => {
    try { return readFileSync(file, 'utf8').trim().split('\n').map(JSON.parse); }
    catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  };
  return { ...result, calls: readLines(callsFile), waits: readLines(waitsFile) };
}

for (const target of ['x86_64-apple-darwin', 'aarch64-apple-darwin']) {
  test(`packages ${target} without rebuilding or retrying on success`, (t) => {
    const result = runBundler(t, [{ code: 0 }], target);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(result.calls, [['run', 'tauri', '--', 'bundle', '--target', target, '--bundles', 'dmg', '--ci']]);
    assert.deepEqual(result.waits, []);
  });
}

test('recovers from hdiutil contention and retries only packaging', (t) => {
  const result = runBundler(t, [
    { code: 1, error: 'hdiutil: create failed - Resource busy' },
    { code: 1, error: 'hdiutil: convert failed - Resource busy' },
    { code: 0 },
  ]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.calls.length, 3);
  assert.deepEqual(result.calls[1], result.calls[0]);
  assert.deepEqual(result.calls[2], result.calls[0]);
  assert.deepEqual(result.waits, [['10'], ['20']]);
});

test('fails after three busy attempts and preserves the failure status', (t) => {
  const result = runBundler(t, Array.from({ length: 3 }, () => ({ code: 47, error: 'hdiutil: create failed - Resource busy' })));
  assert.equal(result.status, 47);
  assert.equal(result.calls.length, 3);
  assert.deepEqual(result.waits, [['10'], ['20']]);
  assert.match(result.stderr, /still failed after three attempts/);
});

test('does not retry unrelated packaging failures', (t) => {
  for (const error of ['Code signing failed', 'another tool: Resource busy']) {
    const result = runBundler(t, [{ code: 42, error }]);
    assert.equal(result.status, 42);
    assert.equal(result.calls.length, 1);
    assert.deepEqual(result.waits, []);
  }
});

test('rejects an unexpected target before invoking Tauri', (t) => {
  const result = runBundler(t, [], 'x86_64-unknown-linux-gnu');
  assert.equal(result.status, 2);
  assert.deepEqual(result.calls, []);
});
