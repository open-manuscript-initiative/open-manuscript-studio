import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const configure = resolve('scripts/configure-android-signing.mjs');

test('release shrinking survives generated defaults and repeated signing setup', () => {
  const root = mkdtempSync(join(tmpdir(), 'omi-release-'));
  try {
    const file = join(root, 'src-tauri/gen/android/app/build.gradle.kts');
    mkdirSync(join(root, 'src-tauri/gen/android/app'), { recursive: true });
    const debug = 'getByName("debug") { isMinifyEnabled = false }';
    const rules = 'proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")';
    writeFileSync(file, `android {
    buildTypes {
        ${debug}
        getByName("release") {
            isMinifyEnabled = true
            isShrinkResources = false
            ${rules}
        }
    }
}
`);
    const run = () => spawnSync(process.execPath, [configure], { cwd: root, encoding: 'utf8' });
    const first = run();
    assert.equal(first.status, 0, first.stderr);
    const result = readFileSync(file, 'utf8');
    assert.ok(result.includes(debug));
    assert.ok(result.includes(rules));
    assert.ok(result.includes('signingConfig = signingConfigs.getByName("release")'));
    const override = result.slice(result.indexOf('// OMI Android release resource shrinking'));
    assert.match(override, /getByName\("release"\)/);
    assert.match(override, /isMinifyEnabled = true/);
    assert.match(override, /isShrinkResources = true/);
    assert.ok(result.lastIndexOf('isShrinkResources = true') > result.lastIndexOf('isShrinkResources = false'));
    assert.equal(run().status, 0);
    assert.equal(readFileSync(file, 'utf8'), result);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
