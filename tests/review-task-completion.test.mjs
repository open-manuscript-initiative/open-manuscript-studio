import test, { mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
let task, closeDuringUpdate, invalidated;
const store = {
  reviewWorkspaceAccess: { findFirst: async () => ({ id: 'editor-access' }) },
  peerReviewAssignment: {
    findFirst: async () => task, findUnique: async () => task, findUniqueOrThrow: async () => task,
    updateMany: async ({ where, data }) => {
      if (closeDuringUpdate) task.status = 'COMPLETED';
      if (Array.isArray(where.status?.in) ? !where.status.in.includes(task.status) : where.status !== task.status) return { count: 0 };
      Object.assign(task, data); return { count: 1 };
    },
  },
  peerReviewFeedback: { create: async ({ data }) => { task.feedback.push({ ...data, id: 'feedback', createdAt: new Date(), updatedAt: new Date() }); } },
  $executeRaw: async () => { invalidated = true; return 1; },
  $transaction: async fn => fn(store),
};
mock.module(new URL('../server/dist/lib/prisma.js', import.meta.url).href, { namedExports: { prisma: store } });
mock.module(new URL('../server/dist/services/translationAssignmentScope.js', import.meta.url).href, { namedExports: { assertTranslationAssignmentScope: async () => {}, readTranslationLanguagePairs: async () => [{ sourceLanguage: 'hu', targetLanguage: 'en' }] } });
const { submitReview, addReviewFeedback, completeReview } = await import('../server/dist/services/peerReviewService.js');
beforeEach(() => {
  task = { id: 'task', workspaceId: 'workspace', manuscriptId: 'article', assignmentType: 'SCIENTIFIC_REVIEW',
    reviewerAlias: 'Reviewer', reviewRound: 1, anonymityMode: 'DOUBLE_BLIND', status: 'ACCEPTED',
    externalRecommendationStorage: null, externalRecommendationId: null, externalRecommendationOptions: null,
    sourceLanguage: 'hu', targetLanguage: 'en', publicationLanguages: ['hu'], reviewRevisionSnapshot: { translation: { sourceLanguage: 'hu', targetLanguage: 'en', title: 'Title', abstract: 'Abstract', keywords: ['term'] } },
    feedback: [], invitedAt: new Date(), revisionUpdatedAt: null,
    reviewer: { id: 'participant', fullName: 'Participant', email: 'participant@example.org' }, assignedBy: null,
  };
  closeDuringUpdate = false; invalidated = false;
});
test('submitting scientific peer review permanently blocks later feedback and resubmission', async () => {
  assert.equal((await submitReview('participant', 'task', 'ACCEPT')).status, 'submitted');
  await assert.rejects(addReviewFeedback('participant', 'task', 'AUTHOR_AND_EDITOR', 'Late note'), { name: 'ForbiddenError' });
  await assert.rejects(submitReview('participant', 'task', 'REJECT'), { name: 'ForbiddenError' });
  assert.equal(task.recommendation, 'ACCEPT');
});
for (const role of ['TRANSLATION', 'LANGUAGE_REVIEW']) test(`${role} remains active after submission until the editor completes it`, async () => {
  task.assignmentType = role; task.anonymityMode = 'OPEN';
  await submitReview('participant', 'task');
  await addReviewFeedback('participant', 'task', 'AUTHOR_AND_EDITOR', 'Further correction');
  assert.equal(task.status, 'IN_PROGRESS');
  assert.equal(invalidated, true);
  await assert.rejects(completeReview('editor', 'task'));
  await submitReview('participant', 'task');
  assert.equal((await completeReview('editor', 'task')).status, 'completed');
  await assert.rejects(addReviewFeedback('participant', 'task', 'AUTHOR_AND_EDITOR', 'Too late'), { name: 'ForbiddenError' });
});
test('a concurrent completion cannot be undone by submitting or adding feedback', async () => {
  closeDuringUpdate = true;
  await assert.rejects(submitReview('participant', 'task', 'ACCEPT'), { name: 'ForbiddenError' });
  assert.equal(task.status, 'COMPLETED');
  assert.equal(task.feedback.length, 0);
});
