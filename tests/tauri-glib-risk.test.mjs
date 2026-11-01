import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  ADVISORY, evaluateGlibRisk, glibVersionAffected, renderGlibRisk,
  runGlibRiskCli,
} from '../scripts/check-tauri-glib-risk.mjs';

function fixture(entries) {
  return 'version = 4\n\n' + Object.entries(entries).flatMap(([name, versions]) =>
    versions.map(version => '[[package]]\nname = "' + name +
      '"\nversion = "' + version + '"\n'),
  ).join('\n');
}
const gtk3Graph = {
  tauri: ['2.12.2'], 'tauri-runtime-wry': ['2.12.1'], wry: ['0.57.0'],
  gtk: ['0.18.2'], webkit2gtk: ['2.0.2'], glib: ['0.18.5'],
};

test('known affected Tauri GTK3 GLib remains visible rather than falsely marked fixed', () => {
  const report = evaluateGlibRisk(fixture(gtk3Graph));
  assert.equal(report.advisory, ADVISORY);
  assert.equal(report.status, 'unresolved-upstream');
  assert.deepEqual(report.affected, ['0.18.5']);
  assert.match(renderGlibRisk(report), /OPEN: vulnerable glib/);
  assert.match(renderGlibRisk(report), /Do not dismiss Dependabot/);
});

test('glib advisory introduced at 0.15 and fixed starting 0.20', () => {
  for (const version of ['0.15.0', '0.18.5', '0.19.9']) {
    assert.equal(glibVersionAffected(version), true);
  }
  for (const version of ['0.14.9','0.20.0','0.20.13','1.0.0']) {
    assert.equal(glibVersionAffected(version), false);
  }
  assert.equal(glibVersionAffected('not-a-semver'), null);
  assert.equal(glibVersionAffected('0.20.0-rc.1'), null, 'unreleased 0.20 prerelease is not a verified fix');
});

test('both glib 0.18 and 0.20 must remain affected until the old copy is gone', () => {
  const report = evaluateGlibRisk(fixture({ ...gtk3Graph, glib: ['0.18.5','0.20.12'] }));
  assert.equal(report.status, 'unresolved-upstream');
  assert.deepEqual(report.affected, ['0.18.5']);
});

test('a complete newer supported GTK/WebKit stack becomes candidate-fixed, not automatically closed', () => {
  const report = evaluateGlibRisk(fixture({
    ...gtk3Graph, gtk: [], webkit2gtk: [], gtk4: ['0.10.0'],
    webkit6: ['0.5.0'], glib: ['0.20.12'],
  }));
  assert.equal(report.status, 'candidate-fixed');
  assert.match(renderGlibRisk(report), /Verify cargo tree/);
});

test('partial GTK4 migration carrying affected glib is blocked for review', () => {
  const report = evaluateGlibRisk(fixture({
    ...gtk3Graph, gtk: [], webkit2gtk: [], gtk4: ['0.10.0'],
  }));
  assert.equal(report.status, 'review-required');
});

test('missing glib while the GTK3 dependency is present is not silently cleared', () => {
  assert.equal(evaluateGlibRisk(fixture({ ...gtk3Graph, glib: [] })).status, 'review-required');
});

test('unsupported graph, missing Tauri or malformed glib version require explicit review', () => {
  assert.equal(evaluateGlibRisk(fixture({ ...gtk3Graph, tauri: [] })).status, 'review-required');
  assert.equal(evaluateGlibRisk(fixture({ ...gtk3Graph, glib: ['unknown'] })).status, 'review-required');
});

test('normal CI reports the upstream blocker but a strict stable release gate refuses it', t => {
  const dir = mkdtempSync(join(tmpdir(), 'omi-glib-risk-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const lock = join(dir, 'Cargo.lock');
  const summary = join(dir, 'summary.md');
  writeFileSync(lock, fixture(gtk3Graph));
  writeFileSync(summary, '');
  const log = console.log;
  try {
    console.log = () => {};
    assert.equal(runGlibRiskCli(['--lockfile', lock], { GITHUB_STEP_SUMMARY: summary }), 0);
    assert.equal(runGlibRiskCli(['--lockfile', lock, '--strict'], {}), 3);
    assert.equal(runGlibRiskCli(['--lockfile', lock], { GITHUB_ACTIONS: 'true' }), 0);
  } finally {
    console.log = log;
  }
  assert.match(readFileSync(summary, 'utf8'), /RUSTSEC-2024-0429/);
});

test('real Studio Cargo.lock remains explicitly tracked while vulnerable', () => {
  const file = readFileSync(new URL('../src-tauri/Cargo.lock', import.meta.url), 'utf8');
  const report = evaluateGlibRisk(file);
  // Updating gtk/wry/tauri is permitted, but an unexpected dependency
  // transition always requires security review before CI may pass.
  assert.notEqual(report.status, 'review-required', renderGlibRisk(report));
  if (report.status === 'unresolved-upstream') {
    assert.ok(report.affected.length >= 1);
  }
});
