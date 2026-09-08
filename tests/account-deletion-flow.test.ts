import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { getAccountDeletionCopy } from '../src/i18n/accountDeletionTranslations.ts';

const routeSource = readFileSync(
  new URL('../server/src/routes/accountDeletionRoutes.ts', import.meta.url),
  'utf8',
);
const serviceSource = readFileSync(
  new URL('../server/src/services/accountDeletionService.ts', import.meta.url),
  'utf8',
);

test('account deletion is authenticated and requires the current e-mail address', () => {
  assert.match(routeSource, /requireSession/);
  assert.match(routeSource, /confirmationEmail/);
  assert.match(serviceSource, /normalizeEmail\(confirmationEmail\)/);
  assert.match(serviceSource, /identityUser\.email/);
});

test('account deletion removes login data while preserving scholarly history only through an anonymized principal', () => {
  assert.match(serviceSource, /identityPrisma\.user\.delete/);
  assert.match(serviceSource, /userSession\.deleteMany/);
  assert.match(serviceSource, /userIdentity\.deleteMany/);
  assert.match(serviceSource, /cloudConnection\.deleteMany/);
  assert.match(serviceSource, /userIntegration\.deleteMany/);
  assert.match(serviceSource, /reviewWorkspaceAccess\.deleteMany/);
  assert.match(serviceSource, /fullName: 'Deleted account'/);
  assert.match(serviceSource, /status: 'DISABLED'/);
  assert.doesNotMatch(serviceSource, /peerReviewAssignment\.deleteMany/);
});

test('last institutional and central owners must transfer ownership before deletion', () => {
  assert.match(serviceSource, /institutionMembership\.count/);
  assert.match(serviceSource, /centralAdminGrant\.count/);
  assert.match(serviceSource, /Transfer ownership/);
  assert.match(serviceSource, /Transfer central OMI ownership/);
});

test('account deletion copy explains retained and external data', () => {
  for (const locale of ['en', 'hu', 'de']) {
    const copy = getAccountDeletionCopy(locale);
    assert.ok(copy.title.length > 0);
    assert.ok(copy.retained.length > 0);
    assert.ok(copy.external.length > 0);
  }
});
