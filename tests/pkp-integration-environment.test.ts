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
const fixtureSource = readSource(
  './pkp-integration/pkp/omiIntegrationFixture.php',
);
const e2eSource = readSource('./pkp-integration/e2e/pkp-environment.spec.ts');
const environmentScriptSource = readSource(
  './pkp-integration/scripts/pkp-env.sh',
);
const waitForHttpSource = readSource(
  './pkp-integration/scripts/wait-for-http.mjs',
);
const workflowSource = readSource(
  '../.github/workflows/pkp-integration-environment.yml',
);
const trustedRemoteUrlSource = readSource(
  '../server/src/integrations/security/trustedRemoteUrl.ts',
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
  assert.match(pkpDockerfileSource, /SetEnvIf Authorization/);
  assert.match(pkpDockerfileSource, /HTTP_AUTHORIZATION/);
});

test('CI only executes the fixed plugin branch without shared credentials or caches', () => {
  assert.doesNotMatch(workflowSource, /^\s+plugin_ref:/m);
  assert.doesNotMatch(workflowSource, /inputs\.plugin_ref/);
  assert.match(workflowSource, /^\s+ref:\s*main\s*$/m);
  assert.doesNotMatch(workflowSource, /^\s+cache:\s*npm\s*$/m);
  assert.match(
    workflowSource,
    /uses: actions\/setup-node@v7[\s\S]*?package-manager-cache:\s*false/,
  );
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

test('workflow fixtures use PKP services and preserve reviewer file isolation', () => {
  assert.match(pkpDockerfileSource, /tools\/omiIntegrationFixture\.php/);
  assert.match(fixtureSource, /app\(\)->get\('context'\)->add/);
  assert.match(fixtureSource, /Repo::submission\(\)->add/);
  assert.match(fixtureSource, /Repo::stageAssignment\(\)->build/);
  assert.match(fixtureSource, /ReviewRoundDAO/);
  assert.match(fixtureSource, /ReviewFilesDAO/);
  assert.match(fixtureSource, /ReviewFormDAO/);
  assert.match(fixtureSource, /ReviewFormResponseDAO/);
  assert.match(fixtureSource, /SUBMISSION_REVIEW_METHOD_DOUBLEANONYMOUS/);
  assert.match(fixtureSource, /'chapterId'\s*=>/);
  assert.doesNotMatch(fixtureSource, /DB::|INSERT\s+INTO|UPDATE\s+\w+\s+SET/i);
  assert.match(environmentScriptSource, /dist\/cli\/addIntegration\.js/);
  assert.match(environmentScriptSource, /verify-review/);
});

test('Playwright exercises signed roles, anonymous article review and writeback', () => {
  assert.match(e2eSource, /actorMode: 'editor'/);
  assert.match(e2eSource, /actorMode: 'author'/);
  assert.match(e2eSource, /actorMode: 'review'/);
  assert.match(e2eSource, /contributors\.read/);
  assert.match(e2eSource, /forbiddenFileId/);
  assert.match(e2eSource, /authorIdentity: 'hidden'/);
  assert.match(e2eSource, /documentKind: 'article'/);
  assert.match(e2eSource, /Corrected line break and hyphenation/);
  assert.match(e2eSource, /assigned\/\$\{assignmentId\}\/review-form/);
  assert.match(e2eSource, /ojsWriteback: \{ status: 'synced' \}/);
  assert.match(e2eSource, /expectApiStatus\(replay, 401\)/);
});

test('private test routing is an explicit test-only exception', () => {
  assert.match(composeSource, /INTEGRATION_TEST_ALLOWED_HOSTS: pkp\.test/);
  assert.match(composeSource, /pkp\.test:host-gateway/);
  assert.match(environmentScriptSource, /configure_pkp_test_hosts/);
  assert.match(
    environmentScriptSource,
    /allowed_hosts = [\s\S]*?pkp\.test[\s\S]*?127\.0\.0\.1/,
  );
  assert.match(
    environmentScriptSource,
    /\^\[ \\\\t\]\*allowed_hosts\[ \\\\t\]\*=\.\*\$\/m/,
  );
  assert.doesNotMatch(
    environmentScriptSource,
    /\^\[;\[:space:\]\]\*allowed_hosts/,
  );
  assert.match(
    environmentScriptSource,
    /\^\[\[:space:\]\]\*allowed_hosts\[\[:space:\]\]\*=\.\*pkp\\\.test/,
  );
  assert.match(environmentScriptSource, /compose restart pkp/);
  assert.match(environmentScriptSource, /Host: pkp\.test/);
  assert.match(waitForHttpSource, /response\.status < 400/);
  assert.match(trustedRemoteUrlSource, /process\.env\.NODE_ENV !== 'test'/);
  assert.match(trustedRemoteUrlSource, /INTEGRATION_TEST_ALLOWED_HOSTS/);
  assert.match(trustedRemoteUrlSource, /allowed\.includes\(url\.hostname\.toLowerCase\(\)\)/);
});
