import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveOrcidRuntimeConfig,
  validateOrcidDeployment,
} from '../server/src/integrations/orcidEnvironment.ts';

test('ORCID defaults safely to Sandbox when no environment is configured', () => {
  assert.deepEqual(resolveOrcidRuntimeConfig({}), {
    environment: 'sandbox',
    baseUrl: 'https://sandbox.orcid.org',
    issuer: 'https://sandbox.orcid.org',
  });
});

test('ORCID production environment resolves production endpoints', () => {
  assert.deepEqual(resolveOrcidRuntimeConfig({ environment: 'production' }), {
    environment: 'production',
    baseUrl: 'https://orcid.org',
    issuer: 'https://orcid.org',
  });
});

test('legacy ORCID_BASE_URL is inferred for backward compatibility', () => {
  assert.equal(
    resolveOrcidRuntimeConfig({ legacyBaseUrl: 'https://sandbox.orcid.org/' }).environment,
    'sandbox',
  );
  assert.equal(
    resolveOrcidRuntimeConfig({ legacyBaseUrl: 'https://orcid.org/' }).environment,
    'production',
  );
});

test('mismatched ORCID environment and legacy base URL fails closed', () => {
  assert.throws(
    () => resolveOrcidRuntimeConfig({
      environment: 'production',
      legacyBaseUrl: 'https://sandbox.orcid.org',
    }),
    /does not match ORCID_ENVIRONMENT=production/,
  );
});

test('partial ORCID credentials are rejected', () => {
  assert.throws(
    () => validateOrcidDeployment({
      environment: 'sandbox',
      nodeEnv: 'production',
      clientId: 'APP-EXAMPLE',
    }),
    /must either both be configured or both be omitted/,
  );
});

test('production deployment rejects an insecure ORCID callback', () => {
  assert.throws(
    () => validateOrcidDeployment({
      environment: 'production',
      nodeEnv: 'production',
      clientId: 'APP-EXAMPLE',
      clientSecret: 'secret',
      redirectUri: 'http://openmanuscript.org/api/auth/orcid/callback',
    }),
    /must use HTTPS in production/,
  );
});

test('production deployment accepts HTTPS callback and complete credentials', () => {
  assert.doesNotThrow(() => validateOrcidDeployment({
    environment: 'production',
    nodeEnv: 'production',
    clientId: 'APP-EXAMPLE',
    clientSecret: 'secret',
    redirectUri: 'https://openmanuscript.org/api/auth/orcid/callback',
  }));
});
