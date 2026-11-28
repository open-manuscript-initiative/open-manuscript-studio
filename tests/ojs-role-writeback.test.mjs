import test, { mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

let assignment, receipt, error, payload, remoteFailure;
const url = path => new URL(`../server/dist/${path}.js`, import.meta.url).href;
mock.module(url('lib/prisma'), { namedExports: { prisma: {
  peerReviewAssignment: { findFirst: async ({ where }) => where.reviewerUserId === 'participant' ? assignment : null },
  $queryRaw: async () => [{ api_base_url: 'https://ojs.example.org/index.php/j/api/v1/omi-integration', assignment_token: 'bound-token', receipt, last_error: error }],
  $executeRaw: async (strings, ...values) => {
    if (strings.join('').includes('SET receipt')) { receipt = JSON.parse(values[0]); error = null; }
    else if (strings.join('').includes('SET last_error')) error = values[0];
    return 1;
  },
} } });
mock.module(url('integrations/externalInstallations'), { namedExports: { getActiveInstallationWithSecret: async () => ({ platform: 'OJS' }) } });
mock.module(url('integrations/ojs/reviewForm'), { namedExports: { getOjsReviewFormContext: async () => ({ responses: [] }) } });
mock.module(url('integrations/ojs/workflowRequest'), { namedExports: { ojsWorkflowRequest: async (_installation, _base, operation, input) => {
  assert.equal(operation, 'assignment-result');
  payload = input;
  if (remoteFailure) throw new Error('OJS HTTP 503');
  return { translationMetadata: input.translationMetadata ? { targetLanguage: input.translationMetadata.targetLanguage, fields: ['title', 'abstract', 'keywords'] } : null, written: true, sourceDigest: input.sourceDigest, submissionExternalId: input.submissionExternalId,
    reviewAssignmentExternalId: input.reviewAssignmentExternalId,
    files: input.files.map((file, index) => ({ fileName: file.fileName, submissionFileExternalId: String(index + 1),
      sha256: createHash('sha256').update(Buffer.from(file.contentBase64, 'base64')).digest('hex') })),
  };
} } });
mock.module(new URL('../server/dist/services/translationAssignmentScope.js', import.meta.url).href, { namedExports: { assertTranslationAssignmentScope: async () => {}, readTranslationLanguagePairs: async () => [{ sourceLanguage: 'hu', targetLanguage: 'en' }] } });
const { writeBackSubmittedExternalReview, getOjsWritebackStatus } = await import(url('integrations/ojs/reviewWriteback'));
beforeEach(() => {
  receipt = null; error = null; payload = null; remoteFailure = false;
  assignment = { id: '11111111-1111-4111-8111-111111111111', workspaceId: 'ojs:test',
    externalInstallationId: 'installation', externalSubmissionId: '217', externalAssignmentId: '31',
    sourceLanguage: 'hu', targetLanguage: 'en', publicationLanguages: ['hu', 'en'], assignmentType: 'SCIENTIFIC_REVIEW', status: 'SUBMITTED', reviewRound: 2,
    reviewer: { fullName: 'Participant name' }, recommendation: 'MINOR_REVISION', externalRecommendationId: null,
    reviewRevisionSnapshot: { translation: { sourceLanguage: 'hu', targetLanguage: 'en', title: 'English title', abstract: 'English abstract', keywords: ['term'], documentCompleted: true }, title: 'Article', authors: [{ name: 'Author name' }],
      blocks: [{ id: 'p1', type: 'paragraph', text: 'Revised manuscript' }],
      annotations: [
        { id: 'c1', targetBlockId: 'p1', targetText: 'Revised', body: 'Visible annotation', visibility: 'author_and_editor', authorName: 'Participant name' },
        { id: 'c2', targetBlockId: 'p1', targetText: 'manuscript', body: 'Confidential annotation', visibility: 'editor_only' },
      ] }, feedback: [{ visibility: 'AUTHOR_AND_EDITOR', body: 'Summary' }, { visibility: 'EDITOR_ONLY', body: 'Confidential summary' }],
  };
});

for (const role of ['SCIENTIFIC_REVIEW', 'LANGUAGE_REVIEW', 'TRANSLATION']) test(`${role} returns Word and structured revision with matching assignment/round`, async () => {
  assignment.assignmentType = role;
  assert.equal((await writeBackSubmittedExternalReview(assignment.id, 'participant')).status, 'synced');
  assert.equal(payload.reviewRound, 2);
  assert.equal(payload.reviewAssignmentExternalId, '31');
  assert.equal(payload.files.length, 2);
  const snapshot = JSON.parse(Buffer.from(payload.files[1].contentBase64, 'base64'));
  assert.equal(snapshot.manuscript.blocks[0].text, 'Revised manuscript');
  if (role === 'TRANSLATION') { assert.equal(snapshot.manuscript.title, 'English title'); assert.ok(payload.files[0].fileName.startsWith('translation-hu-en-assignment-')); }
  assert.equal(snapshot.manuscript.annotations.length, 1);
  assert.equal(snapshot.manuscript.authorIdentity, role === 'SCIENTIFIC_REVIEW' ? 'hidden' : 'visible');
  assert.equal(JSON.stringify(snapshot).includes('Participant name'), role !== 'SCIENTIFIC_REVIEW');
  assert.ok(payload.editorOnlyComment.includes('Confidential annotation'));
  assert.ok(!payload.authorAndEditorComment.includes('Confidential annotation'));
  assert.equal((await getOjsWritebackStatus(assignment.id, 'participant')).status, 'synced');
});
test('failed transfer stays retryable after local submission; successful receipt avoids duplicate upload', async () => {
  remoteFailure = true;
  assert.equal((await writeBackSubmittedExternalReview(assignment.id, 'participant')).status, 'failed');
  assert.equal(assignment.status, 'SUBMITTED');
  assert.equal((await getOjsWritebackStatus(assignment.id, 'participant')).status, 'failed');
  remoteFailure = false;
  assert.equal((await writeBackSubmittedExternalReview(assignment.id, 'participant')).status, 'synced');
  payload = null;
  assert.equal((await writeBackSubmittedExternalReview(assignment.id, 'participant')).status, 'synced');
  assert.equal(payload, null);
});
test('another participant cannot resend the assignment', async () => {
  assert.equal((await writeBackSubmittedExternalReview(assignment.id, 'other-user')).status, 'not_applicable');
  assert.equal(payload, null);
});
test('older unbound OJS tasks report a recoverable failure instead of silently skipping', async () => {
  assignment.externalInstallationId = null;
  assert.equal((await writeBackSubmittedExternalReview(assignment.id, 'participant')).status, 'failed');
  assert.equal(payload, null);
});

test('metadata-only translation returns localized metadata without sending the source manuscript', async () => {
  assignment.assignmentType = 'TRANSLATION'; assignment.publicationLanguages = ['hu'];
  assignment.reviewRevisionSnapshot.translation.documentCompleted = false;
  assert.equal((await writeBackSubmittedExternalReview(assignment.id, 'participant')).status, 'synced');
  assert.equal(payload.files.length, 0); assert.equal(payload.translationMetadata.title, 'English title');
});
test('incomplete translated metadata cannot be returned to OJS', async () => {
  assignment.assignmentType = 'TRANSLATION'; assignment.reviewRevisionSnapshot.translation.keywords = [];
  assert.equal((await writeBackSubmittedExternalReview(assignment.id, 'participant')).status, 'failed');
  assert.equal(payload, null);
});
