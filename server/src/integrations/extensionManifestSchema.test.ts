import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extensionManifestSchema,
  INTEGRATION_EXTENSION_API_CAPABILITIES,
  INTEGRATION_EXTENSION_PERMISSIONS,
} from './extensionManifestSchema.ts';

const valid = () => ({
  model: 'omi-integration-extension' as const,
  apiVersion: '1' as const,
  id: 'org.example.scholar-service',
  name: 'Scholarly service',
  version: '1.2.0',
  kind: 'scholarly-service' as const,
  authenticationModes: ['oauth2'],
  permissions: ['metadata.read'],
  capabilities: ['metadata.lookup'],
  endpoints: { lookup: 'https://example.org/api/lookup' },
});

test('registered plugin manifest remains a strict permission declaration, not code execution', () => {
  const parsed = extensionManifestSchema.safeParse(valid());
  assert.equal(parsed.success, true);
  assert.equal(INTEGRATION_EXTENSION_API_CAPABILITIES.manifestOnly, true);
  assert.equal(INTEGRATION_EXTENSION_API_CAPABILITIES.executesPluginCode, false);
  assert.equal(INTEGRATION_EXTENSION_API_CAPABILITIES.grantsManuscriptAccess, false);
  assert.equal(INTEGRATION_EXTENSION_API_CAPABILITIES.publishingAuthority, false);
  assert.ok(INTEGRATION_EXTENSION_PERMISSIONS.includes('metadata.read'));
});

test('API-v1 plugin manifests reject unknown authorization, ambiguous fields and version negotiation', () => {
  const cases = [
    { ...valid(), apiVersion: '2' },
    { ...valid(), permissions: ['document.root'] },
    { ...valid(), permissions: ['metadata.read', 'metadata.read'] },
    { ...valid(), authenticationModes: ['none', 'oauth2'] },
    { ...valid(), version: 'latest' },
    { ...valid(), secret: 'MUST_NOT_BE_SAVED' },
  ];
  for (const value of cases) {
    assert.equal(extensionManifestSchema.safeParse(value).success, false, JSON.stringify(value));
  }
});

test('extension registry rejects local execution endpoints, credentials and non-HTTPS destinations', () => {
  const urls = [
    'http://example.org/api',
    'https://username:password@example.org/api',
    'https://localhost/api',
    'https://127.0.0.1/api',
    'https://[::1]/api',
    'https://169.254.1.1/api',
    'https://service.localhost/api',
  ];
  for (const url of urls) {
    const parsed = extensionManifestSchema.safeParse({ ...valid(), endpoints: { lookup: url } });
    assert.equal(parsed.success, false, url);
  }
});

test('OMI-SPEC-310 discovery pins API v1 without granting manuscript read or write access', () => {
  const caps = INTEGRATION_EXTENSION_API_CAPABILITIES;
  assert.equal(caps.apiVersion, '1');
  assert.equal(caps.specification, 'OMI-SPEC-310@0.1.0');
  assert.equal(caps.pluginSpecification, 'OMI-SPEC-300@0.1.0');
  assert.equal(caps.registryScope, 'authenticated-user');
  assert.equal(caps.status, 'partial-draft-implementation');
});
