import assert from 'node:assert/strict';
import { mock, test } from 'node:test';

let user;
let grants = [];
let memberships = [];
let institutionLookups = 0;
mock.module(new URL('../server/dist/config/env.js', import.meta.url).href, {
  namedExports: { env: {
    CENTRAL_ADMIN_EMAILS: 'admin@example.org',
    INSTITUTIONAL_ADMIN_EMAILS: 'admin@example.org',
    DEPLOYMENT_MODE: 'institutional',
    INSTITUTIONAL_NAME: 'Synthetic Test Institution',
  } },
});
mock.module(new URL('../server/dist/lib/identityPrisma.js', import.meta.url).href, {
  namedExports: { identityPrisma: {
    user: { findUnique: async () => user },
    centralAdminGrant: { create: async ({ data }) => { grants.push(data); return data; } },
    institution: { findFirst: async () => { institutionLookups += 1; return { id: 'institution' }; } },
    institutionMembership: {
      findUnique: async () => null,
      count: async () => 0,
      create: async ({ data }) => { memberships.push(data); return data; },
    },
  } },
});
const { provisionConfiguredCentralAdmin, requireFederatedCentralAdminCandidate } = await import('../server/dist/services/centralAdminService.js');
const { provisionConfiguredInstitutionOwner } = await import('../server/dist/services/institutionAccessService.js');

test('both admin services enforce evidence before repository writes', async (t) => {
  const validIdentity = { id: 'verified-identity', provider: 'OIDC', profile: { email: 'ADMIN@example.org', emailVerified: true } };
  const eligible = { id: 'user', status: 'ACTIVE', email: 'admin@example.org', identities: [validIdentity], centralAdminGrant: null };
  for (const [name, candidate] of [
    ['missing user', null],
    ['suspended', { ...eligible, status: 'SUSPENDED' }],
    ['not allow-listed', { ...eligible, email: 'other@example.org', identities: [{ ...validIdentity, profile: { email: 'other@example.org', emailVerified: true } }] }],
    ['unrelated federation', { ...eligible, identities: [{ ...validIdentity, profile: { email: 'other@example.org', emailVerified: true } }] }],
    ['missing verification', { ...eligible, identities: [{ ...validIdentity, profile: { email: 'admin@example.org' } }] }],
    ['username only', { ...eligible, identities: [{ ...validIdentity, profile: { preferred_username: 'admin@example.org' } }] }],
    ['password only', { ...eligible, identities: [] }],
  ]) {
    await t.test(name, async () => {
      user = candidate;
      grants = []; memberships = []; institutionLookups = 0;
      await provisionConfiguredCentralAdmin('user');
      await provisionConfiguredInstitutionOwner('user');
      assert.deepEqual(grants, []);
      assert.deepEqual(memberships, []);
      assert.equal(institutionLookups, 0, 'Ineligible bootstrap must not create or look up institutions');
      if (name !== 'not allow-listed') await assert.rejects(requireFederatedCentralAdminCandidate('user'));
    });
  }
  await t.test('verified bootstrap uses the matched identity for institutional ownership', async () => {
    user = eligible;
    await provisionConfiguredCentralAdmin('user');
    await provisionConfiguredInstitutionOwner('user');
    assert.deepEqual(grants, [{ userId: 'user', role: 'OWNER' }]);
    assert.equal(memberships.length, 1);
    assert.equal(memberships[0].identityId, 'verified-identity');
    assert.equal(memberships[0].emailVerified, true);
    assert.equal(memberships[0].role, 'OWNER');
    assert.equal((await requireFederatedCentralAdminCandidate('user')).id, 'user');
  });
  await t.test('explicit operator eligibility is separate from bootstrap allow-list', async () => {
    user = { ...eligible, email: 'second@example.org', identities: [{ ...validIdentity, profile: { email: 'second@example.org', emailVerified: true } }] };
    assert.equal((await requireFederatedCentralAdminCandidate('user')).id, 'user');
  });
  await t.test('existing central grants are not duplicated by bootstrap', async () => {
    user = { ...eligible, centralAdminGrant: { role: 'ADMIN' } };
    grants = [];
    await provisionConfiguredCentralAdmin('user');
    assert.deepEqual(grants, []);
  });
});
