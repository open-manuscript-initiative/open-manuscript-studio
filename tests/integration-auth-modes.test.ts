import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getCloudConnectionMethods,
  getDefaultCloudConnectionMethod,
} from '../src/integrations/cloudStorageProviders.ts';
import { integrationCatalog } from '../src/integrations/registry.ts';
import { hasNativeSystemStorage } from '../src/mobile/platform/platform.ts';

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

test('cloud storage declares provider-dependent authentication capabilities', () => {
  const storage = integrationCatalog.find((entry) => entry.id === 'cloud-storage');
  assert.ok(storage);
  assert.deepEqual(storage.authenticationModes, ['none', 'server_secret', 'oauth2']);
  assert.equal(storage.preferredAuthenticationMode, 'none');
  assert.equal(storage.requiresServerSecret, false);
  assert.equal(storage.supportsPerUserAuthentication, true);
  assert.equal(storage.supportsMultipleConnections, true);
  assert.equal(storage.status, 'available');
});

test('desktop OneDrive uses native system storage without duplicating it as a provider connection', () => {
  const methods = getCloudConnectionMethods('onedrive', 'personal', 'desktop');
  const oauth = methods.find((method) => method.id === 'oauth2');

  assert.equal(hasNativeSystemStorage('desktop'), true);
  assert.equal(methods.some((method) => method.id === 'local-folder'), false);
  assert.ok(oauth);
  assert.equal(oauth.available, false);
  assert.equal(getDefaultCloudConnectionMethod('onedrive', 'personal', 'desktop'), 'oauth2');
});

test('web Nextcloud uses direct WebDAV while OAuth remains a future option', () => {
  const methods = getCloudConnectionMethods('nextcloud', 'business', 'web');
  const webdav = methods.find((method) => method.id === 'webdav');
  const oauth = methods.find((method) => method.id === 'oauth2');

  assert.ok(webdav);
  assert.equal(webdav.available, true);
  assert.equal(webdav.authentication, 'webdav-credentials');
  assert.ok(oauth);
  assert.equal(oauth.available, false);
  assert.equal(getDefaultCloudConnectionMethod('nextcloud', 'business', 'web'), 'webdav');
});

test('ORCID uses delegated authentication', () => {
  const orcid = integrationCatalog.find((entry) => entry.id === 'orcid');
  assert.ok(orcid);
  assert.deepEqual(orcid.authenticationModes, ['oauth2']);
});

test('OJS and OMP retain purpose-built integration token authentication', () => {
  const ojs = integrationCatalog.find((entry) => entry.id === 'ojs');
  const omp = integrationCatalog.find((entry) => entry.id === 'omp');

  assert.ok(ojs);
  assert.ok(omp);
  assert.deepEqual(ojs.authenticationModes, ['integration_token']);
  assert.deepEqual(omp.authenticationModes, ['integration_token']);
  assert.equal(ojs.supportsMultipleConnections, true);
  assert.equal(omp.supportsMultipleConnections, true);
});
