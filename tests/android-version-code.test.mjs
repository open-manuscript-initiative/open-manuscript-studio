import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

import {
  calculateAndroidVersionCode,
  prepareAndroidVersionCode,
} from '../scripts/prepare-android-version-code.mjs';

test('maps Android Release run 26 to the next code after 1026', () => {
  assert.equal(
    calculateAndroidVersionCode({ current: 1026, runNumber: 26, runOffset: 1001 }),
    1027,
  );
});

test('keeps retries deterministic and advances on the next workflow run', () => {
  const first = calculateAndroidVersionCode({ current: 1026, runNumber: 26, runOffset: 1001 });
  const retry = calculateAndroidVersionCode({ current: 1026, runNumber: 26, runOffset: 1001 });
  const next = calculateAndroidVersionCode({ current: 1026, runNumber: 27, runOffset: 1001 });
  assert.equal(retry, first);
  assert.equal(next, first + 1);
});

test('rejects a run offset that would reuse the committed code', () => {
  assert.throws(
    () => calculateAndroidVersionCode({ current: 1027, runNumber: 26, runOffset: 1001 }),
    /not greater than the committed versionCode/,
  );
});

test('updates only the local build configuration', () => {
  const root = mkdtempSync(join(tmpdir(), 'omi-version-code-'));
  try {
    const path = join(root, 'tauri.android.conf.json');
    writeFileSync(path, JSON.stringify({
      productName: 'OMI Studio',
      bundle: { android: { versionCode: 1026 } },
    }, null, 2) + '\n');
    const result = prepareAndroidVersionCode({
      configPath: path,
      runNumber: 26,
      runOffset: 1001,
    });
    assert.deepEqual(result, { current: 1026, versionCode: 1027 });
    assert.equal(JSON.parse(readFileSync(path, 'utf8')).bundle.android.versionCode, 1027);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
