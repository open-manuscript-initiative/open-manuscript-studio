import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const identitySchema = readFileSync(
  new URL('../server/prisma/identity/schema.prisma', import.meta.url),
  'utf8',
);
const credentialMigration = readFileSync(
  new URL('../server/prisma/identity/migrations/20260920154500_multiple_personal_publishing_credentials/migration.sql', import.meta.url),
  'utf8',
);
const profileEmailMigration = readFileSync(
  new URL('../server/prisma/identity/migrations/20260920163000_profile_emails_and_credential_binding/migration.sql', import.meta.url),
  'utf8',
);
const profileEmailUuidRepairMigration = readFileSync(
  new URL('../server/prisma/identity/migrations/20260920172500_repair_profile_email_rfc_uuid/migration.sql', import.meta.url),
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
const emailSettings = readFileSync(
  new URL('../src/components/PersonalEmailsSettings.tsx', import.meta.url),
  'utf8',
);
const credentialSettings = readFileSync(
  new URL('../src/components/PersonalPublishingCredentialsSettings.tsx', import.meta.url),
  'utf8',
);

test('personal profile supports multiple e-mail addresses', () => {
  assert.match(identitySchema, /model UserProfileEmail \{/);
  assert.match(identitySchema, /profileEmails\s+UserProfileEmail\[\]/);
  assert.match(identitySchema, /@@unique\(\[userId, email\]\)/);
  assert.match(profileEmailMigration, /CREATE TABLE "user_profile_emails"/);
  assert.match(profileEmailMigration, /lower\("email"\)/);
  assert.match(profileEmailMigration, /CREATE TRIGGER "users_create_primary_profile_email"/);
  assert.match(authRoutes, /get\('\/me\/profile-emails'/);
  assert.match(authRoutes, /post\('\/me\/profile-emails'/);
  assert.match(authRoutes, /delete\('\/me\/profile-emails\/:profileEmailId'/);
  assert.match(authRoutes, /PRIMARY_PROFILE_EMAIL/);
  assert.match(authRoutes, /PROFILE_EMAIL_IN_USE/);
  assert.match(emailSettings, /addPersonalProfileEmail/);
  assert.match(emailSettings, /deletePersonalProfileEmail/);
});

test('profile e-mail IDs satisfy the public RFC UUID contract', () => {
  assert.match(profileEmailMigration, /md5\("id"::text/);
  assert.match(profileEmailUuidRepairMigration, /SET "id" = gen_random_uuid\(\)/);
  assert.match(
    profileEmailUuidRepairMigration,
    /\[1-8\]\[0-9a-f\]\{3\}.*\[89ab\]\[0-9a-f\]\{3\}/,
  );
  assert.match(
    profileEmailUuidRepairMigration,
    /CREATE OR REPLACE FUNCTION "create_primary_user_profile_email"\(\)/,
  );
  assert.match(profileEmailUuidRepairMigration, /VALUES \(\s*gen_random_uuid\(\)/);
});

test('personal publishing credentials are stored per user, provider, installation URL and e-mail', () => {
  assert.match(identitySchema, /model PersonalPublishingCredential \{/);
  assert.match(identitySchema, /profileEmailId\s+String\s+@map\("profile_email_id"\)/);
  assert.match(identitySchema, /profileEmail\s+UserProfileEmail/);
  assert.match(identitySchema, /provider\s+PublicationVenueIntegrationProvider/);
  assert.match(identitySchema, /baseUrl\s+String\s+@map\("base_url"\)/);
  assert.match(identitySchema, /@@unique\(\[userId, provider, baseUrl, profileEmailId\]\)/);
  assert.match(identitySchema, /publishingCredentials\s+PersonalPublishingCredential\[\]/);
  assert.doesNotMatch(identitySchema, /ojsApiKeyCiphertext|ompApiKeyCiphertext/);
});

test('credential migrations preserve existing keys and bind them to the primary e-mail', () => {
  assert.match(credentialMigration, /INSERT INTO "personal_publishing_credentials"/);
  assert.match(credentialMigration, /'OJS'::"PublicationVenueIntegrationProvider"/);
  assert.match(credentialMigration, /'OMP'::"PublicationVenueIntegrationProvider"/);
  assert.match(profileEmailMigration, /ADD COLUMN "profile_email_id" UUID/);
  assert.match(profileEmailMigration, /profile_email\."is_primary" = true/);
  assert.match(profileEmailMigration, /ALTER COLUMN "profile_email_id" SET NOT NULL/);
  assert.match(profileEmailMigration, /profile_email_id_fkey/);
});

test('personal credential API exposes e-mail binding without returning API key material', () => {
  assert.match(authRoutes, /get\('\/me\/publishing-credentials'/);
  assert.match(authRoutes, /put\('\/me\/publishing-credentials'/);
  assert.match(authRoutes, /delete\('\/me\/publishing-credentials\/:credentialId'/);
  assert.match(authRoutes, /userId_provider_baseUrl_profileEmailId/);
  assert.match(authRoutes, /profileEmailId: credential\.profileEmailId/);
  assert.match(authRoutes, /email: credential\.profileEmail\.email/);
  assert.match(authRoutes, /profileEmailId: z\.string\(\)\.uuid\(\)/);

  const publicMapper = authRoutes.slice(
    authRoutes.indexOf('function publicPublishingCredential'),
    authRoutes.indexOf('function normalizePublishingBaseUrl'),
  );
  assert.doesNotMatch(publicMapper, /ciphertext|authTag|apiKeyIv/);
});

test('credential resolution defaults to the primary e-mail and supports an explicit address', () => {
  assert.match(authRoutes, /email\?: string/);
  assert.match(authRoutes, /profileEmail: normalizedEmail/);
  assert.match(authRoutes, /\{ isPrimary: true \}/);
  assert.match(
    directSubmissionRoutes,
    /resolvePersonalOmpCredential\(request\.authUserId!, baseUrl\)/,
  );
  assert.match(
    directSubmissionRoutes,
    /resolvePersonalOjsCredential\(request\.authUserId!, baseUrl\)/,
  );
});

test('personal profile renders e-mail management and e-mail-aware credential settings', () => {
  assert.match(accountPanel, /<PersonalEmailsSettings/);
  assert.match(accountPanel, /<PersonalPublishingCredentialsSettings/);
  assert.match(credentialSettings, /getPersonalProfileEmails/);
  assert.match(credentialSettings, /profileEmailId/);
  assert.match(credentialSettings, /credential\.email/);
  assert.match(credentialSettings, /<option value="ojs">/);
  assert.match(credentialSettings, /<option value="omp">/);
});
