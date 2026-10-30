import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { findVerifiedFederatedIdentity } from '../server/src/services/verifiedFederatedIdentity.ts';

type Identity = { id: string; provider: string; profile: unknown };

test('privileged bootstrap rejects an unrelated but valid linked federated account', () => {
  const identities: Identity[] = [
    { id: 'personal', provider: 'OIDC', profile: { email: 'personal@example.org', emailVerified: true } },
    { id: 'no-email', provider: 'OIDC', profile: { emailVerified: true } },
    { id: 'unverified', provider: 'OIDC', profile: { email: 'admin@example.org', emailVerified: false } },
    { id: 'untrusted', provider: 'ORCID', profile: { email: 'admin@example.org', emailVerified: true } },
  ];
  assert.equal(findVerifiedFederatedIdentity('admin@example.org', identities), undefined);
});

test('privileged bootstrap accepts only a matching, explicitly verified SSO email', () => {
  const identities: Identity[] = [
    { id: 'wrong', provider: 'OIDC', profile: { email: 'other@example.org', emailVerified: true } },
    { id: 'correct', provider: 'OIDC', profile: { email: ' ADMIN@EXAMPLE.ORG ', emailVerified: true } },
  ];
  assert.equal(findVerifiedFederatedIdentity('admin@example.org', identities)?.id, 'correct');
  assert.equal(findVerifiedFederatedIdentity('  ADMIN@example.org ', identities)?.id, 'correct');
  assert.equal(findVerifiedFederatedIdentity('admin@example.org', [
    { id: 'saml', provider: 'SAML', profile: { email: 'admin@example.org', emailVerified: true } },
  ])?.id, 'saml');
});

test('privileged bootstrap fails closed for malformed or absent verification evidence', () => {
  const invalidProfiles = [
    null, undefined, {}, [], 'admin@example.org',
    { email: 'admin@example.org' },
    { email: 'admin@example.org', emailVerified: 'true' },
    { email: 'admin@example.org', emailVerified: 1 },
    { email: 'admin@example.org', emailVerified: false },
    { email: 'other@example.org', emailVerified: true },
  ];
  for (const profile of invalidProfiles) {
    assert.equal(findVerifiedFederatedIdentity('admin@example.org', [
      { id: 'invalid', provider: 'OIDC', profile },
    ]), undefined);
  }
  assert.equal(findVerifiedFederatedIdentity('', [
    { id: 'blank', provider: 'OIDC', profile: { email: '', emailVerified: true } },
  ]), undefined);
});

test('both privileged auto-provisioning paths enforce the shared verified identity requirement', () => {
  for (const sourcePath of [
    '../server/src/services/centralAdminService.ts',
    '../server/src/services/institutionAccessService.ts',
  ]) {
    const source = readFileSync(new URL(sourcePath, import.meta.url), 'utf8');
    assert.match(source, /findVerifiedFederatedIdentity\(user\.email, user\.identities\)/);
  }
  const oidc = readFileSync(new URL('../server/src/integrations/oidcProvider.ts', import.meta.url), 'utf8');
  assert.match(oidc, /const emailVerified = claims\.email_verified === true;/);
  assert.doesNotMatch(oidc, /Boolean\(email\)/);
});
