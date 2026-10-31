import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const json = (path) => JSON.parse(read(path));
const app = json('package.json');
const lock = json('package-lock.json');
const tauri = json('src-tauri/tauri.conf.json');
const android = json('src-tauri/tauri.android.conf.json');
const ios = json('src-tauri/tauri.ios.conf.json');

test('release candidate uses one shared version across JS, native and lockfiles', () => {
  assert.equal(app.version, '0.3.0-beta.13');
  assert.equal(lock.version, app.version);
  assert.equal(lock.packages[''].version, app.version);
  assert.equal(tauri.version, app.version);
  assert.equal(android.version, app.version);
  assert.match(read('src-tauri/Cargo.toml'), /^version = "0\.3\.0-beta\.13"$/m);
  assert.match(read('src-tauri/Cargo.lock'), /\[\[package\]\]\nname = "open-manuscript-studio"\nversion = "0\.3\.0-beta\.13"/);
});

test('mobile and Windows package counters are incremented coherently', () => {
  assert.equal(android.bundle.android.versionCode, 1212);
  assert.equal(ios.version, '0.3.0');
  assert.equal(ios.bundle.iOS.bundleVersion, '25');
  assert.equal(tauri.bundle.windows.wix.version, '0.3.0.13');
});

test('release notes retain explicit security blockers, format stability and Go/No-Go', () => {
  const release = read('docs/release/0.3.0-beta.13.md');
  const stage = read('docs/stabilization/nine-stage-release-gate.md');
  for (const marker of ['#765','#770','#774','#271','OMI-SPEC-320@0.3.0','Go/No-Go']) {
    assert.ok(release.includes(marker), marker);
  }
  assert.match(release, /NOT an independently certified/);
  assert.match(stage, /All nine development-stage PRs were merged/);
});
