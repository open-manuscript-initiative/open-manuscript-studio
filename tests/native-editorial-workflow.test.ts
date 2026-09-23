import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function source(path: string): string {
  return readFileSync(new URL('../' + path, import.meta.url), 'utf8');
}

const schema = source('server/prisma/schema.prisma');
const migration = source(
  'server/prisma/migrations/20260923113000_add_native_editorial_workflow/migration.sql',
);
const service = source('server/src/services/nativeEditorialWorkflowService.ts');
const routes = source('server/src/routes/nativeEditorialWorkflowRoutes.ts');
const app = source('server/src/app.ts');
const venueAuthority = source(
  'server/src/services/publicationVenueAuthorityService.ts',
);
const authorPanel = source('src/components/NativeSubmissionPanel.tsx');
const editorInbox = source('src/components/NativeEditorialInbox.tsx');
const publicationPanel = source('src/components/NewsletterPublishingPanel.tsx');
const reviewPortal = source('src/components/ReviewPortal.tsx');

test('Studio-native workflow is explicitly DNS-only and does not replace OJS/OMP authority', () => {
  assert.match(venueAuthority, /assertVerifiedNativePublicationVenue/);
  assert.match(venueAuthority, /integrationStatus === 'VERIFIED'/);
  assert.match(
    venueAuthority,
    /workflow must remain authoritative in the external publishing system/,
  );
  assert.match(authorPanel, /authority\?\.method === 'DNS_TXT'/);
  assert.match(authorPanel, /integrationStatus !== 'VERIFIED'/);
});

test('native submission schema preserves workflow state and immutable audit events', () => {
  assert.match(schema, /enum NativeSubmissionStatus \{/);
  assert.match(schema, /model NativeSubmission \{/);
  assert.match(schema, /model NativeSubmissionEvent \{/);
  assert.match(schema, /REVISION_REQUESTED/);
  assert.match(schema, /REVISION_SUBMITTED/);
  assert.match(schema, /ACCEPTED/);
  assert.equal(
    migration.match(/CREATE TABLE "native_submissions"/g)?.length,
    1,
  );
  assert.equal(
    migration.match(/CREATE TABLE "native_submission_events"/g)?.length,
    1,
  );
  assert.ok(
    migration.includes(`"state_digest" ~ '^[0-9a-f]{64}$'`),
  );
});

test('author submission creates review access and editor claim creates editor access', () => {
  assert.match(service, /role: 'AUTHOR'/);
  assert.match(service, /claimNativeSubmission/);
  assert.match(service, /role: 'EDITOR'/);
  assert.match(service, /assertVerifiedPublicationVenueEditorAuthority/);
  assert.match(service, /nativeSubmissionEvent\.create/);
});

test('native reviewer assignment reuses the blind review engine with an assigned snapshot', () => {
  assert.match(service, /assignmentType: 'SCIENTIFIC_REVIEW'/);
  assert.match(service, /anonymityMode/);
  assert.match(service, /setReviewManuscript/);
  assert.match(service, /authorIdentity: 'hidden'/);
  assert.match(service, /toAnonymousReviewSnapshot/);
});

test('editorial acceptance is a separate exact-revision decision before publishing', () => {
  assert.match(service, /acceptNativeSubmission/);
  assert.match(service, /createEditorialAcceptance/);
  assert.match(service, /publicationContentDigest/);
  assert.match(editorInbox, /acceptExactRevision/);
  assert.match(editorInbox, /getWebPublicationAssuranceEvidence/);
  assert.match(editorInbox, /prepareWebPublicationArtifact/);
  assert.match(publicationPanel, /!isDnsNativeVenue/);
  assert.match(publicationPanel, /nativeEditorialDecisionRequired/);
});

test('author revision and editor inbox are both surfaced in the Studio-native UI', () => {
  assert.match(authorPanel, /submitNativeRevision/);
  assert.match(authorPanel, /listAuthorReviews/);
  assert.match(editorInbox, /listNativeEditorialInbox/);
  assert.match(editorInbox, /assignNativeReviewer/);
  assert.match(editorInbox, /requestNativeRevision/);
  assert.match(editorInbox, /rejectNativeSubmission/);
  assert.match(reviewPortal, /NativeEditorialInbox/);
});

test('native workflow API is mounted under a dedicated v1 boundary', () => {
  assert.match(routes, /nativeEditorialWorkflowRouter\.post\('\/'/);
  assert.match(routes, /\/editor-inbox/);
  assert.match(routes, /\/request-revision/);
  assert.match(routes, /\/accept/);
  assert.match(app, /\/api\/v1\/native-submissions/);
});
