import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { buildPdfWorkerEnvironment } from '../server/src/security/pdfWorkerEnvironment.ts';

const simulatedApiEnv = {
  PATH: process.env.PATH ?? '/usr/bin',
  LANG: 'hu_HU.UTF-8',
  HOME: '/home/studio',
  TMPDIR: '/tmp',
  XDG_CACHE_HOME: '/home/studio/.cache',
  DATABASE_URL: 'postgresql://user:secret@localhost/studio',
  INTEGRATION_MASTER_KEY: 'a'.repeat(64),
  ORCID_CLIENT_SECRET: 'orcid-private-token',
  GOOGLE_DRIVE_OAUTH_CLIENT_SECRET: 'google-private-token',
  OMI_SERVER_REGISTRY_GITHUB_PRIVATE_KEY: 'github-key',
  AWS_SECRET_ACCESS_KEY: 'cloud-private-key',
  NODE_OPTIONS: '--require=/tmp/unauthorized-module.js',
};

test('Poppler inherits only necessary executable, locale and temporary-directory settings', () => {
  const vars = buildPdfWorkerEnvironment('poppler', simulatedApiEnv);
  assert.equal(vars.PATH, simulatedApiEnv.PATH);
  assert.equal(vars.LANG, simulatedApiEnv.LANG);
  assert.equal(vars.TMPDIR, simulatedApiEnv.TMPDIR);
  assert.equal(vars.HOME, undefined);
  assert.equal(vars.XDG_CACHE_HOME, undefined);
  assert.equal(vars.DATABASE_URL, undefined);
  assert.equal(vars.INTEGRATION_MASTER_KEY, undefined);
  assert.equal(vars.NODE_OPTIONS, undefined);
});

test('Vivliostyle keeps font/runtime discovery without exposing database, OAuth or API secrets', () => {
  const vars = buildPdfWorkerEnvironment('vivliostyle', simulatedApiEnv);
  assert.equal(vars.PATH, simulatedApiEnv.PATH);
  assert.equal(vars.HOME, simulatedApiEnv.HOME);
  assert.equal(vars.XDG_CACHE_HOME, simulatedApiEnv.XDG_CACHE_HOME);
  for (const key of [
    'DATABASE_URL',
    'INTEGRATION_MASTER_KEY',
    'ORCID_CLIENT_SECRET',
    'GOOGLE_DRIVE_OAUTH_CLIENT_SECRET',
    'OMI_SERVER_REGISTRY_GITHUB_PRIVATE_KEY',
    'AWS_SECRET_ACCESS_KEY',
    'NODE_OPTIONS',
  ]) {
    assert.equal(vars[key], undefined, key);
  }
});

test('an actual child process cannot read the Studio credential environment', () => {
  const child = spawnSync(process.execPath, [
    '-e',
    'process.stdout.write(JSON.stringify({db: process.env.DATABASE_URL ?? null, lang: process.env.LANG ?? null}))',
  ], {
    env: buildPdfWorkerEnvironment('poppler', simulatedApiEnv),
    encoding: 'utf8',
    timeout: 5_000,
  });
  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(JSON.parse(child.stdout), { db: null, lang: 'hu_HU.UTF-8' });
});

test('both untrusted PDF subprocess launchers enforce environment allowlisting', () => {
  const pdf = readFileSync(new URL('../server/src/import/pdf/pdfImportService.ts', import.meta.url), 'utf8');
  const renderer = readFileSync(new URL('../server/src/services/vivliostylePdfRenderer.ts', import.meta.url), 'utf8');
  assert.match(pdf, /env: buildPdfWorkerEnvironment\('poppler'\)/);
  assert.match(renderer, /env: buildPdfWorkerEnvironment\('vivliostyle'\)/);
});
