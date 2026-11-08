import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { privacyClientTypes } from '../server/dist/contracts/privacyClientTypes.js';
import { privacyOpenApi } from '../server/dist/contracts/privacyOpenApi.js';
import { accountOverviewSchema, privacyErrorSchema } from '../server/dist/contracts/privacyContract.js';
import { createAccountDataService } from '../server/dist/services/accountDataService.js';

const date = new Date('2026-11-08T00:00:00Z');
const record = {
  id: 'synthetic-owner', email: 'owner@example.test', fullName: 'Synthetic owner',
  affiliation: null, affiliationRorId: null, country: null, website: null, orcid: null,
  bio: null, timeZone: null, interfaceLanguage: 'en', status: 'ACTIVE',
  createdAt: date, updatedAt: date, lastLoginAt: null,
  profileEmails: [], identities: [], institutionMemberships: [], sessions: [], passkeys: [],
};
test('published OpenAPI is generated from the executable strict response/error schemas', () => {
  const file = JSON.parse(readFileSync(new URL('../docs/api/privacy-v1.openapi.json', import.meta.url), 'utf8'));
  assert.deepEqual(file, privacyOpenApi());
  assert.equal(readFileSync(new URL('../src/api/privacyContract.ts', import.meta.url), 'utf8'), privacyClientTypes());
  assert.deepEqual(Object.keys(file.paths), ['/api/v1/privacy', '/api/v1/account/data']);
  assert.equal(file.components.schemas.AccountOverview.additionalProperties, false);
  assert.equal(file.components.schemas.AccountOverview.properties.profile.additionalProperties, false);
  assert.equal(privacyErrorSchema.safeParse({ error: { code: 'ACCOUNT_EXPORT_FAILED', message: 'safe', debug: 'secret' } }).success, false);
});
test('account use case bounds collections and rejects unexpected adapter fields before delivery', async () => {
  const rows = Array.from({ length: 1001 }, () => ({ createdAt: date, expiresAt: date }));
  const repository = { findAccount: async () => ({ ...record, sessions: rows }), readWorkflowRole: async () => 'general' };
  const result = await createAccountDataService(repository)('synthetic-owner');
  assert.equal(result.sessions.length, 1000);
  assert.deepEqual(result.incompleteSections, ['sessions']);
  assert.equal(result.profile.createdAt, date.toISOString());
  assert.equal(accountOverviewSchema.safeParse(result).success, true);
  assert.equal(await createAccountDataService({ ...repository, findAccount: async () => null })('absent'), null);
  await assert.rejects(createAccountDataService({ ...repository, findAccount: async () => ({ ...record, passwordHash: 'SECRET' }) })('synthetic-owner'));
  await assert.rejects(createAccountDataService({ ...repository, findAccount: async () => ({ ...record, passkeys: [{ label: 'key', deviceType: 'singleDevice', backedUp: false, createdAt: date, lastUsedAt: null, publicKey: 'SECRET' }] }) })('synthetic-owner'));
});
