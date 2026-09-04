import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const normalizeLineEndings = (source: string): string =>
  source.replace(/\r\n?/g, '\n');

const readSource = (relativePath: string): string =>
  normalizeLineEndings(
    readFileSync(new URL(relativePath, import.meta.url), 'utf8'),
  );

const composeSource = readSource('./pkp-integration/compose.yml');
const pkpDockerfileSource = readSource('./pkp-integration/Dockerfile.pkp');
const environmentScriptSource = readSource(
  './pkp-integration/scripts/pkp-env.sh',
);
const workflowSource = readSource(
  '../.github/workflows/pkp-integration-environment.yml',
);

test('configuration checks are independent of checkout line endings', () => {
  assert.equal(
    normalizeLineEndings('networks:\r\n  - pkp-private\r\n'),
    'networks:\n  - pkp-private\n',
  );
});

test('PKP integration environment supports pinned OJS and OMP images', () => {
  assert.match(pkpDockerfileSource, /ARG PKP_PLATFORM=ojs/);
  assert.match(pkpDockerfileSource, /ARG PKP_VERSION=3_5_0-4/);
  assert.match(
    pkpDockerfileSource,
    /docker\.io\/pkpofficial\/\$\{PKP_PLATFORM\}:\$\{PKP_VERSION\}/,
  );
  assert.match(environmentScriptSource, /PLATFORM.*ojs/);
  assert.match(environmentScriptSource, /omi-ojs-plugin\.git/);
  assert.match(environmentScriptSource, /omi-omp-plugin\.git/);
});

test('manual plugin refs cannot poison shared caches or reuse checkout credentials', () => {
  assert.doesNotMatch(workflowSource, /^\s+cache:\s*npm\s*$/m);
  assert.equal(
    workflowSource.match(/persist-credentials:\s*false/g)?.length,
    2,
  );
  assert.match(workflowSource, /permissions:\n\s+contents: read/);
  assert.ok(
    workflowSource.indexOf('- name: Checkout matching integration plugin') >
      workflowSource.indexOf('- name: Install Playwright Chromium'),
  );
});

test('Studio and PKP retain separate database boundaries', () => {
  assert.match(composeSource, /pkp-db:/);
  assert.match(composeSource, /studio-db:/);
  assert.match(composeSource, /DATABASE_URL: postgresql:\/\/omi_test:[^\n]+@studio-db:/);
  assert.doesNotMatch(
    composeSource.match(/studio-api:[\s\S]*?\nvolumes:/)?.[0] ?? '',
    /PKP_DB_(?:HOST|NAME|USER|PASSWORD)/,
  );
  assert.doesNotMatch(composeSource, /ports:[\s\S]{0,100}3306/);
  assert.match(composeSource, /pkp-db:[\s\S]*?networks:\n\s+- pkp-private/);
  assert.match(composeSource, /studio-db:[\s\S]*?networks:\n\s+- studio-private/);
  assert.match(composeSource, /pkp-private:\n\s+internal: true/);
  assert.match(composeSource, /studio-private:\n\s+internal: true/);
});

test('plugin registration uses PKP application tooling instead of direct SQL', () => {
  assert.match(
    environmentScriptSource,
    /lib\/pkp\/tools\/installPluginVersion\.php/,
  );
  assert.match(
    environmentScriptSource,
    /require_once "plugins\/generic\/studioIntegration\/StudioIntegrationPlugin\.php"/,
  );
  assert.match(environmentScriptSource, /is_subclass_of/);
  assert.doesNotMatch(environmentScriptSource, /mysql\s+-|mariadb\s+-|psql\s+-/);
});
