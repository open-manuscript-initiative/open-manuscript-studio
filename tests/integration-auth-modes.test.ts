import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  getCloudConnectionMethods,
  getDefaultCloudConnectionMethod,
} from '../src/integrations/cloudStorageProviders.ts';
import { integrationCatalog } from '../src/integrations/registry.ts';
import { hasNativeSystemStorage } from '../src/mobile/platform/platform.ts';

const newsletterPublishingRoutes = readFileSync(
  new URL('../server/src/routes/newsletterPublishingRoutes.ts', import.meta.url),
  'utf8',
);
const newsletterPublishingPanel = readFileSync(
  new URL('../src/components/NewsletterPublishingPanel.tsx', import.meta.url),
  'utf8',
);
const webPublishingSettings = readFileSync(
  new URL('../src/components/WebPublishingSettings.tsx', import.meta.url),
  'utf8',
);
const serverSchema = readFileSync(
  new URL('../server/prisma/schema.prisma', import.meta.url),
  'utf8',
);
const userIntegrationRoutes = readFileSync(
  new URL('../server/src/routes/userIntegrationRoutes.ts', import.meta.url),
  'utf8',
);

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

test('desktop OneDrive keeps native system storage separate while exposing direct OAuth', () => {
  const methods = getCloudConnectionMethods('onedrive', 'personal', 'desktop');
  const oauth = methods.find((method) => method.id === 'oauth2');

  assert.equal(hasNativeSystemStorage('desktop'), true);
  assert.equal(methods.some((method) => method.id === 'local-folder'), false);
  assert.ok(oauth);
  assert.equal(oauth.available, true);
  assert.equal(oauth.implementation, 'oauth2');
  assert.equal(oauth.authentication, 'oauth2');
  assert.equal(oauth.recommended, true);
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


test('WordPress publishing uses application-password credentials and generic web publishing stays provider-neutral', () => {
  const wordpress = integrationCatalog.find((entry) => entry.id === 'wordpress');
  const generic = integrationCatalog.find((entry) => entry.id === 'web-publishing');

  assert.ok(wordpress);
  assert.ok(generic);
  assert.deepEqual(wordpress.authenticationModes, ['user_api_key']);
  assert.deepEqual(generic.authenticationModes, ['none', 'user_api_key']);
  assert.equal(wordpress.supportsMultipleConnections, true);
  assert.equal(generic.supportsMultipleConnections, true);
  assert.match(webPublishingSettings, /WordPress application password/);
  assert.match(webPublishingSettings, /authScheme/);
  assert.match(webPublishingSettings, /x-api-key/);
  assert.match(webPublishingSettings, /leave blank to keep the existing secret/i);
  assert.match(webPublishingSettings, /clearSecret: true/);
  assert.match(userIntegrationRoutes, /clearSecret: z\.boolean\(\)\.default\(false\)/);
  assert.match(userIntegrationRoutes, /encryptedSecret: null/);
});

test('website publication requires preview approval and keeps idempotent external receipts', () => {
  assert.match(newsletterPublishingPanel, /buildPublicationHtmlArtifact/);
  assert.match(newsletterPublishingPanel, /sandbox=""/);
  assert.match(newsletterPublishingPanel, /approved: true/);
  assert.match(newsletterPublishingRoutes, /approved: z\.literal\(true\)/);
  assert.match(newsletterPublishingRoutes, /omi-newsletter-publish\/1/);
  assert.match(newsletterPublishingRoutes, /wp-json\/wp\/v2\/media/);
  assert.match(newsletterPublishingRoutes, /wp-json\/wp\/v2\/posts/);
  assert.match(newsletterPublishingRoutes, /assertTrustedIntegrationUrl/);
  assert.match(newsletterPublishingRoutes, /redirect: 'error'/);
  assert.match(serverSchema, /model WebPublication \{/);
  assert.match(serverSchema, /@@unique\(\[userId, connectionId, manuscriptId\]\)/);
});
