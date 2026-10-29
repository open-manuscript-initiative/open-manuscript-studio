import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('desktop updater does not enable legacy ZIP extraction by default', () => {
  const cargo = readFileSync(new URL('../src-tauri/Cargo.toml', import.meta.url), 'utf8');
  const updaterDeclaration = cargo.split('\n').find((line) => /^tauri-plugin-updater\s*=/.test(line));
  assert.ok(updaterDeclaration);
  assert.match(updaterDeclaration, /default-features\s*=\s*false/);
  assert.match(updaterDeclaration, /"rustls-tls"/);
  assert.match(updaterDeclaration, /"system-proxy"/);
  assert.doesNotMatch(updaterDeclaration, /"zip"/);
});

test('legacy-compatible compressed updater artifacts are not requested by bundle configuration', () => {
  const config = JSON.parse(readFileSync(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8')) as {
    bundle?: { createUpdaterArtifacts?: boolean | string };
  };
  assert.notEqual(config.bundle?.createUpdaterArtifacts, 'v1Compatible');
});
