import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  referenceManagerRecordToOmi,
} from '../src/services/referenceManagerApi.ts';

test('maps a personal reference-manager record to the portable OMI citation model', () => {
  const record = referenceManagerRecordToOmi({
    provider: 'zotero',
    externalId: 'ABCD1234',
    type: 'journal-article',
    title: 'Reference-manager integration',
    contributors: [
      {
        role: 'author',
        givenName: 'Ada',
        familyName: 'Example',
      },
    ],
    containerTitle: 'Journal of Examples',
    issued: '2026',
    identifiers: [
      { scheme: 'zotero', value: 'ABCD1234' },
      { scheme: 'doi', value: '10.1000/example' },
    ],
    url: 'https://doi.org/10.1000/example',
  });

  assert.equal(record.title, 'Reference-manager integration');
  assert.equal(record.status, 'resolved');
  assert.equal(record.contributors[0]?.familyName, 'Example');
  assert.equal(
    record.identifiers.some(
      (identifier) =>
        identifier.scheme === 'zotero' && identifier.value === 'ABCD1234',
    ),
    true,
  );
  assert.equal(
    record.identifiers.some(
      (identifier) =>
        identifier.scheme === 'doi' && identifier.value === '10.1000/example',
    ),
    true,
  );
});

test('keeps Zotero credentials out of URLs and pins Web API v3', () => {
  const source = readFileSync(
    'server/src/integrations/referenceManagers/referenceManagerService.ts',
    'utf8',
  );

  assert.match(source, /https:\/\/api\.zotero\.org\/keys\/current/);
  assert.match(source, /'Zotero-API-Key': apiKey/);
  assert.match(source, /'Zotero-API-Version': '3'/);
  assert.match(source, /qmode', 'everything'/);
  assert.doesNotMatch(source, /searchParams\.set\(['"]key['"]/);
});

test('uses Mendeley authorization-code OAuth with encrypted refreshable credentials', () => {
  const service = readFileSync(
    'server/src/integrations/referenceManagers/referenceManagerService.ts',
    'utf8',
  );
  const routes = readFileSync(
    'server/src/routes/referenceManagerRoutes.ts',
    'utf8',
  );

  assert.match(routes, /https:\/\/api\.mendeley\.com\/oauth\/authorize/);
  assert.match(routes, /response_type', 'code'/);
  assert.match(routes, /scope', 'all'/);
  assert.match(routes, /state/);
  assert.match(service, /https:\/\/api\.mendeley\.com\/oauth\/token/);
  assert.match(service, /grant_type: 'refresh_token'/);
  assert.match(service, /encryptSecret/);
  assert.match(service, /application\/vnd\.mendeley-document\.1\+json/);
});

test('reference-manager integrations are read-only at the declared permission boundary', () => {
  const clientRegistry = readFileSync('src/integrations/registry.ts', 'utf8');
  const serverRegistry = readFileSync(
    'server/src/integrations/providerRegistry.ts',
    'utf8',
  );

  for (const provider of ['zotero', 'mendeley']) {
    assert.match(clientRegistry, new RegExp(`id: '${provider}'`));
    assert.match(serverRegistry, new RegExp(`id: '${provider}'`));
  }

  const relevant = clientRegistry
    .split("id: 'zotero'")[1]
    ?.split("id: 'orcid'")[0] ?? '';
  assert.match(relevant, /references\.read/);
  assert.doesNotMatch(relevant, /references\.write/);
});
