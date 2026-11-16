import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { getAccountDeletionCopy } from '../src/i18n/accountDeletionTranslations.ts';

const routeSource = readFileSync(
  new URL('../server/src/routes/accountDeletionRoutes.ts', import.meta.url),
  'utf8',
);
const accountDeletionUiSource = readFileSync(
  new URL('../src/components/AccountDeletionSection.tsx', import.meta.url),
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

test('account deletion removes login data while preserving scholarly history through a pseudonymized principal', () => {
  assert.match(serviceSource, /identityPrisma\.user\.delete/);
  assert.match(serviceSource, /userSession\.deleteMany/);
  assert.match(serviceSource, /userIdentity\.deleteMany/);
  assert.match(serviceSource, /cloudConnection\.deleteMany/);
  assert.match(serviceSource, /personalReferenceRecord\.deleteMany/);
  assert.match(serviceSource, /plainDocument\.deleteMany/);
  assert.match(serviceSource, /studioModulePreference\.deleteMany/);
  assert.match(serviceSource, /recognitionExecution\.deleteMany/);
  assert.match(serviceSource, /collaborationMessage\.updateMany/);
  assert.match(serviceSource, /senderUserId: null, senderName: 'Former contributor'/);
  assert.match(serviceSource, /studioModuleAuditEvent\.updateMany/);
  assert.match(serviceSource, /ipAddress: null, details: null/);
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

// Old translation overlays must not resurrect a blanket anonymity promise.
test('retention copy stays on the reviewed text until legal translations are updated', () => {
  assert.equal(getAccountDeletionCopy('bg').retained, getAccountDeletionCopy('en').retained);
  assert.match(getAccountDeletionCopy('en').retained, /pseudonymized/);
});

test('account deletion requires an explicit acknowledgement of the detailed consequences', () => {
  assert.match(accountDeletionUiSource, /labels\.reviewTitle/);
  assert.match(accountDeletionUiSource, /labels\.deletedAccount/);
  assert.match(accountDeletionUiSource, /labels\.deletedPrivate/);
  assert.match(accountDeletionUiSource, /labels\.retainedShared/);
  assert.match(accountDeletionUiSource, /labels\.retainedIdentity/);
  assert.match(accountDeletionUiSource, /labels\.external/);
  assert.match(accountDeletionUiSource, /labels\.backups/);
  assert.match(accountDeletionUiSource, /labels\.rights/);
  assert.match(accountDeletionUiSource, /labels\\.backupTitle/);
  assert.match(accountDeletionUiSource, /labels\\.backupRestore/);
  assert.match(accountDeletionUiSource, /fetchAccountData\\(\\)/);
  assert.match(accountDeletionUiSource, /saveExportBlob/);
  assert.match(accountDeletionUiSource, /type="checkbox"/);
  assert.match(accountDeletionUiSource, /checked=\{acknowledged\}/);
  assert.match(accountDeletionUiSource, /!confirmed \|\| !acknowledged \|\| deleting/);
  assert.match(accountDeletionUiSource, /setAcknowledged\(false\)/);
});

test('English, Hungarian and German notices describe both deletion and lawful retention', () => {
  for (const locale of ['en', 'hu', 'de']) {
    const copy = getAccountDeletionCopy(locale);
    for (const key of [
      'reviewTitle', 'reviewLead', 'deletedTitle', 'deletedAccount',
      'deletedConnections', 'deletedPrivate', 'retainedTitle', 'retainedShared', 'retainedIdentity',
      'externalTitle', 'external', 'backups', 'beforeDeleting', 'rights', 'acknowledge', 'backupTitle', 'backupDescription', 'backupAction', 'backupWorking', 'backupReady', 'backupError', 'backupRestore',
    ] as const) {
      assert.ok(copy[key].trim().length > 0, `${locale} missing ${key}`);
    }
  }
  assert.match(getAccountDeletionCopy('hu').retainedIdentity, /álnevesítés/);
  assert.match(getAccountDeletionCopy('en').retainedIdentity, /Pseudonymization/);
});
