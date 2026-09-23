import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const schema = read('../server/prisma/schema.prisma');
const migration = read('../server/prisma/migrations/20260923120000_add_studio_native_editorial_workflow/migration.sql');
const service = read('../server/src/services/nativeEditorialWorkflowService.ts');
const venueAuthority = read('../server/src/services/publicationVenueAuthorityService.ts');
const routes = read('../server/src/routes/nativeEditorialWorkflowRoutes.ts');
const app = read('../server/src/app.ts');
const panel = read('../src/components/NativeEditorialWorkflowPanel.tsx');
const publishing = read('../src/components/NewsletterPublishingPanel.tsx');
const snapshot = read('../src/services/nativeEditorialSnapshot.ts');

test('Studio-native workflow is explicit persistent editorial state', () => {
  assert.match(schema, /enum NativeEditorialSubmissionStatus \{/);
  for (const state of [
    'SUBMITTED',
    'IN_REVIEW',
    'REVISION_REQUESTED',
    'REVISION_SUBMITTED',
    'ACCEPTED',
    'REJECTED',
    'PUBLISHED',
  ]) {
    assert.match(schema, new RegExp('\\b' + state + '\\b'));
  }
  assert.match(schema, /model NativeEditorialSubmission \{/);
  assert.match(schema, /model NativeEditorialSubmissionEvent \{/);
  assert.match(schema, /model NativeEditorialSubmissionAsset \{/);
  assert.match(schema, /manuscriptStateSnapshot\s+Json/);
  assert.match(schema, /reviewSnapshot\s+Json/);
  assert.match(schema, /@@unique\(\[authorUserId, publicationVenueId, manuscriptId\]\)/);
});

test('native submission migration preserves digest, audit and asset integrity', () => {
  assert.equal(
    migration.match(/CREATE TABLE "native_editorial_submissions"/g)?.length,
    1,
  );
  assert.equal(
    migration.match(/CREATE TABLE "native_editorial_submission_events"/g)?.length,
    1,
  );
  assert.equal(
    migration.match(/CREATE TABLE "native_editorial_submission_assets"/g)?.length,
    1,
  );
  assert.match(migration, /"state_digest" ~ '\^\[0-9a-f\]\{64\}\$'/);
  assert.match(migration, /"publication_content_digest" ~ '\^\[0-9a-f\]\{64\}\$'/);
  assert.match(migration, /"checksum" ~ '\^\[0-9a-f\]\{64\}\$'/);
  assert.match(migration, /BYTEA NOT NULL/);
});

test('OJS and OMP remain authoritative and are excluded from native workflow', () => {
  assert.match(
    venueAuthority,
    /This publication venue uses an authoritative OJS\/OMP workflow/,
  );
  assert.match(venueAuthority, /assertStudioNativePublicationVenue/);
  assert.match(venueAuthority, /assertStudioNativePublicationVenueEditorAuthority/);
  assert.match(service, /assertStudioNativePublicationVenue\(input\.publicationVenueId\)/);
  assert.match(service, /assertStudioNativePublicationVenueEditorAuthority/);
  assert.match(service, /assertRevisionPublicationVenue/);
  assert.match(service, /The submitted manuscript revision is not bound to the selected publication venue/);
  assert.match(panel, /venue\.integrationProvider === 'OJS'/);
  assert.match(panel, /venue\.integrationProvider === 'OMP'/);
  assert.match(panel, /OJS\/OMP is authoritative/);
});

test('editorial acceptance is independent from publication', () => {
  assert.match(service, /acceptNativeEditorialSubmission/);
  assert.match(service, /createEditorialAcceptance/);
  assert.match(service, /status: submission\.status === 'PUBLISHED' \? 'PUBLISHED' : 'ACCEPTED'/);
  assert.match(panel, /acceptNativeEditorialSubmission/);
  assert.match(panel, /Kézirat elfogadása/);
  assert.match(publishing, /!isStudioNativeDnsVenue\(prepared\.source\)/);
  assert.match(publishing, /nativeEditorialDecisionRequired/);
  assert.match(publishing, /markNativeEditorialPublished/);
});

test('review workflow reuses anonymous assignments with exact submitted snapshots', () => {
  assert.match(service, /createReviewAssignment/);
  assert.match(service, /setReviewManuscript/);
  assert.match(service, /assignmentType: 'SCIENTIFIC_REVIEW'/);
  assert.match(service, /anonymityMode: 'DOUBLE_BLIND'/);
  assert.match(snapshot, /authorIdentity: 'hidden'/);
  assert.doesNotMatch(snapshot, /manuscript\.authors/);
  assert.match(panel, /completeNativeEditorialReview/);
  assert.match(panel, /requestNativeEditorialRevision/);
  assert.match(panel, /authorDetail\.reviews/);
  assert.match(panel, /noAuthorVisibleFeedback/);
  assert.match(service, /note: review\.reviewerAlias/);
  assert.doesNotMatch(service, /note: reviewerEmail\.trim/);
});

test('new review round cannot be bypassed by older completed evidence', () => {
  assert.match(
    service,
    /submission\.status === 'IN_REVIEW'[\s\S]*?submission\.reviewRound/,
  );
  assert.match(service, /requiredRound\?: number/);
  assert.match(service, /requiredRound === undefined/);
  assert.match(
    service,
    /A revision can be requested only after the current review round has been completed/,
  );
});

test('submission assets are self-contained and checksum verified', () => {
  assert.match(service, /validateSubmissionAssets/);
  assert.match(service, /createHash\('sha256'\)/);
  assert.match(service, /nativeEditorialSubmissionAsset\.createMany/);
  assert.match(service, /nativeEditorialSubmissionAsset\.deleteMany/);
  assert.match(snapshot, /getAssetPayload/);
  assert.match(snapshot, /putAssetPayload/);
  assert.match(snapshot, /restoreNativeEditorialManuscript/);
});

test('native editorial API is authenticated and registered separately', () => {
  assert.match(routes, /nativeEditorialWorkflowRouter\.use\(requireSession\)/);
  assert.match(routes, /\/submissions\/.*\/accept/);
  assert.match(routes, /\/submissions\/.*\/request-revision/);
  assert.match(routes, /\/submissions\/.*\/reviewers/);
  assert.match(app, /\/api\/native-editorial/);
  assert.match(app, /nativeEditorialWorkflowRouter/);
});

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}
