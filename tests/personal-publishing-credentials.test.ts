import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const identitySchema = readFileSync(
  new URL('../server/prisma/identity/schema.prisma', import.meta.url),
  'utf8',
);
const migration = readFileSync(
  new URL('../server/prisma/identity/migrations/20260920154500_multiple_personal_publishing_credentials/migration.sql', import.meta.url),
  'utf8',
);
const authRoutes = readFileSync(
  new URL('../server/src/routes/authRoutes.ts', import.meta.url),
  'utf8',
);
const directSubmissionRoutes = readFileSync(
  new URL('../server/src/routes/directSubmissionRoutes.ts', import.meta.url),
  'utf8',
);
const accountPanel = readFileSync(
  new URL('../src/components/AccountPanel.tsx', import.meta.url),
  'utf8',
);
const credentialSettings = readFileSync(
  new URL('../src/components/PersonalPublishingCredentialsSettings.tsx', import.meta.url),
  'utf8',
);

test('personal publishing credentials are stored per user, provider and installation URL', () => {
  assert.match(identitySchema, /model PersonalPublishingCredential \{/);
  assert.match(identitySchema, /provider\s+PublicationVenueIntegrationProvider/);
  assert.match(identitySchema, /baseUrl\s+String\s+@map\("base_url"\)/);
  assert.match(identitySchema, /@@unique\(\[userId, provider, baseUrl\]\)/);
  assert.match(identitySchema, /publishingCredentials\s+PersonalPublishingCredential\[\]/);
  assert.doesNotMatch(identitySchema, /ojsApiKeyCiphertext|ompApiKeyCiphertext/);
});

test('credential migration preserves existing OJS and OMP keys before dropping legacy columns', () => {
  assert.match(migration, /INSERT INTO "personal_publishing_credentials"/);
  assert.match(migration, /'OJS'::"PublicationVenueIntegrationProvider"/);
  assert.match(migration, /'OMP'::"PublicationVenueIntegrationProvider"/);
  assert.match(migration, /"ojs_api_key_ciphertext"/);
  assert.match(migration, /"omp_api_key_ciphertext"/);
  assert.match(migration, /DROP COLUMN "ojs_api_key_ciphertext"/);
  assert.match(migration, /DROP COLUMN "omp_api_key_ciphertext"/);
});

test('personal credential API exposes a collection and never returns API key material', () => {
  assert.match(authRoutes, /get\('\/me\/publishing-credentials'/);
  assert.match(authRoutes, /put\('\/me\/publishing-credentials'/);
  assert.match(authRoutes, /delete\('\/me\/publishing-credentials\/:credentialId'/);
  assert.match(authRoutes, /userId_provider_baseUrl/);
  assert.match(authRoutes, /publicPublishingCredential/);

  const publicMapper = authRoutes.slice(
    authRoutes.indexOf('function publicPublishingCredential'),
    authRoutes.indexOf('function normalizePublishingBaseUrl'),
  );
  assert.doesNotMatch(publicMapper, /apiKey|ciphertext|authTag|apiKeyIv/);
});

test('publication artifact transfer resolves the key for the exact selected destination', () => {
  assert.match(
    directSubmissionRoutes,
    /resolvePersonalOmpCredential\(request\.authUserId!, baseUrl\)/,
  );
  assert.match(
    directSubmissionRoutes,
    /resolvePersonalOjsCredential\(request\.authUserId!, baseUrl\)/,
  );
  assert.doesNotMatch(
    directSubmissionRoutes,
    /belongs to a different .* installation/,
  );
});

test('personal profile renders the multi-installation credential manager', () => {
  assert.match(accountPanel, /<PersonalPublishingCredentialsSettings locale=\{locale\} \/>/);
  assert.doesNotMatch(accountPanel, /getPersonalOjsCredential|getPersonalOmpCredential/);
  assert.match(credentialSettings, /getPersonalPublishingCredentials/);
  assert.match(credentialSettings, /savePersonalPublishingCredential/);
  assert.match(credentialSettings, /deletePersonalPublishingCredential/);
  assert.match(credentialSettings, /<option value="ojs">/);
  assert.match(credentialSettings, /<option value="omp">/);
});
