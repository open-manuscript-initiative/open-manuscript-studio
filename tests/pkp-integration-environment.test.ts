import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const composeSource = readFileSync(
  new URL('./pkp-integration/compose.yml', import.meta.url),
  'utf8',
);
const pkpDockerfileSource = readFileSync(
  new URL('./pkp-integration/Dockerfile.pkp', import.meta.url),
  'utf8',
);
const environmentScriptSource = readFileSync(
  new URL('./pkp-integration/scripts/pkp-env.sh', import.meta.url),
  'utf8',
);

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
  assert.match(environmentScriptSource, /PluginRegistry::loadCategory/);
  assert.doesNotMatch(environmentScriptSource, /mysql\s+-|mariadb\s+-|psql\s+-/);
});
