import assert from 'node:assert/strict';
import test from 'node:test';

import { integrationCatalog } from '../src/integrations/registry.ts';

test('every integration declares at least one authentication mode and a valid preferred mode', () => {
  for (const entry of integrationCatalog) {
    assert.ok(entry.authenticationModes.length > 0, `${entry.id} must declare authentication`);
    assert.ok(
      entry.authenticationModes.includes(entry.preferredAuthenticationMode),
      `${entry.id} preferred authentication must be supported`,
    );
  }
});

test('DeepL never models provider email/password authentication', () => {
  const deepl = integrationCatalog.find((entry) => entry.id === 'deepl');
  assert.ok(deepl);
  assert.deepEqual(deepl.authenticationModes, ['server_secret', 'user_api_key']);
  assert.equal(deepl.supportsPerUserAuthentication, true);
});

test('identity and cloud providers use delegated authentication', () => {
  const orcid = integrationCatalog.find((entry) => entry.id === 'orcid');
  const storage = integrationCatalog.find((entry) => entry.id === 'cloud-storage');
  assert.ok(orcid);
  assert.ok(storage);
  assert.deepEqual(orcid.authenticationModes, ['oauth2']);
  assert.ok(storage.authenticationModes.includes('oauth2'));
});

test('OJS and OMP retain purpose-built integration token authentication', () => {
  const publishing = integrationCatalog.find((entry) => entry.id === 'ojs-omp');
  assert.ok(publishing);
  assert.deepEqual(publishing.authenticationModes, ['integration_token']);
});
