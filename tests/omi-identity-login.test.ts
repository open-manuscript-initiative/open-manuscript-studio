import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

function source(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('central OMI Identity is a first-class configured OIDC provider', () => {
  const provider = source('server/src/integrations/oidcProvider.ts');
  assert.match(provider, /'omi' \| 'google' \| 'microsoft' \| 'oidc'/);
  assert.match(provider, /OMI_IDENTITY_ISSUER/);
  assert.match(provider, /OMI_IDENTITY_CLIENT_ID/);
  assert.match(provider, /OMI_IDENTITY_CLIENT_SECRET/);
  assert.match(provider, /OMI_IDENTITY_REDIRECT_URI/);
  assert.match(provider, /openid profile email orcid/);
});

test('OMI sign-in never implicitly creates or merges a local Studio account', () => {
  const routes = source('server/src/routes/oidcProviderRoutes.ts');
  assert.match(routes, /provider\.key === 'omi'\) return null/);
  assert.match(routes, /omi_account_not_linked/);
  assert.match(routes, /already linked to a different OMI account/);
  assert.match(routes, /data: \{ omiUserId: profile\.subject \}/);
});

test('Studio persists the immutable global OMI UUID separately from local authorization', () => {
  const schema = source('server/prisma/identity/schema.prisma');
  const migration = source('server/prisma/identity/migrations/20260919190000_add_omi_user_id/migration.sql');
  assert.match(schema, /omiUserId\s+String\?\s+@unique\s+@map\("omi_user_id"\)\s+@db\.Uuid/);
  assert.match(migration, /ADD COLUMN "omi_user_id" UUID/);
  assert.match(migration, /CREATE UNIQUE INDEX "users_omi_user_id_key"/);
});

test('login UI distinguishes central, institutional and local authentication paths', () => {
  const login = source('src/auth/LoginPage.tsx');
  assert.match(login, /Központi OMI-fiók/);
  assert.match(login, /Intézményi bejelentkezés/);
  assert.match(login, /Helyi Stúdió-fiók/);
  assert.match(login, /handleOidcSignIn\('omi'/);
  assert.match(login, /handleOidcSignIn\('oidc'/);
});

test('linked identity settings allow explicit OMI account enrollment', () => {
  const settings = source('src/components/LinkedIdentitiesSettings.tsx');
  const linkedModel = source('src/services/linkedIdentityApi.ts');
  assert.match(settings, /\['omi', 'google', 'microsoft', 'oidc'\]/);
  assert.match(linkedModel, /\| 'omi'/);
});
