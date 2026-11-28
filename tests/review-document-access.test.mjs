import test, { mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

let assignment, closeDuringSave, invalidated;
const path = name => new URL(`../server/dist/${name}.js`, import.meta.url).href;
const store = {
  peerReviewAssignment: {
    findFirst: async () => assignment,
    updateMany: async ({ where, data }) => {
      if (closeDuringSave) assignment.status = 'COMPLETED';
      if (!where.status.in.includes(assignment.status)) return { count: 0 };
      Object.assign(assignment, data);
      return { count: 1 };
    },
  },
  $queryRaw: async strings => strings.join('').includes('SELECT assignment_type')
    ? [{ assignment_type: assignment.assignmentType, status: assignment.status }]
    : [{ form_external_id: 'form', definition: { externalId: 'form', elements: [{ externalId: 'question', type: 'textarea', question: 'Review', description: '', required: false, authorVisible: true, options: [], value: null }] }, responses: [] }],
  $executeRaw: async () => { invalidated = true; return 1; },
  $transaction: async fn => fn(store),
};
mock.module(path('lib/prisma'), { namedExports: { prisma: store } });
mock.module(path('services/peerReviewService'), { namedExports: { requireWorkspaceRole: async () => {} } });
mock.module(new URL('../server/dist/services/translationAssignmentScope.js', import.meta.url).href, { namedExports: { assertTranslationAssignmentScope: async () => {}, readTranslationLanguagePairs: async () => [{ sourceLanguage: 'hu', targetLanguage: 'en' }] } });
const { getReviewManuscriptForReviewer, getReviewRevisionForReviewer, saveReviewRevisionForReviewer } = await import(path('services/reviewManuscriptService'));
const { saveOjsReviewFormResponses } = await import(path('integrations/ojs/reviewForm'));
const manuscript = { translation: { sourceLanguage: 'hu', targetLanguage: 'en', title: 'Title', abstract: 'Abstract', keywords: ['term'] }, title: 'Article', blocks: [{ id: 'p1', type: 'paragraph', text: 'Current content' }] };
beforeEach(() => {
  assignment = { id: 'task', sourceLanguage: 'hu', targetLanguage: 'en', publicationLanguages: ['hu'], status: 'ACCEPTED', assignmentType: 'SCIENTIFIC_REVIEW', reviewer: { fullName: 'Participant' }, manuscriptSnapshot: manuscript, reviewRevisionSnapshot: manuscript };
  closeDuringSave = false; invalidated = false;
});

for (const role of ['SCIENTIFIC_REVIEW', 'LANGUAGE_REVIEW', 'TRANSLATION']) {
  test(`${role}: original and working document access follows the complete lifecycle`, async () => {
    assignment.assignmentType = role;
    for (const status of ['INVITED', 'ACCEPTED', 'IN_PROGRESS', 'SUBMITTED', 'COMPLETED', 'DECLINED']) {
      assignment.status = status;
      const closed = ['COMPLETED', 'DECLINED'].includes(status) || (role === 'SCIENTIFIC_REVIEW' && status === 'SUBMITTED');
      for (const read of [getReviewManuscriptForReviewer, getReviewRevisionForReviewer]) {
        if (closed) await assert.rejects(read('participant', 'task'), { name: 'ForbiddenError' });
        else assert.equal((await read('participant', 'task')).blocks[0].text, 'Current content');
      }
    }
  });
}
test('scientific submission blocks later writes and does not reopen the task', async () => {
  assignment.status = 'SUBMITTED';
  await assert.rejects(saveReviewRevisionForReviewer('participant', 'task', manuscript), { name: 'ForbiddenError' });
  assert.equal(assignment.status, 'SUBMITTED');
  assert.equal(invalidated, false);
});
for (const role of ['LANGUAGE_REVIEW', 'TRANSLATION']) test(`${role}: a submitted task can be revised until the editor marks it complete`, async () => {
  assignment.assignmentType = role; assignment.status = 'SUBMITTED';
  await saveReviewRevisionForReviewer('participant', 'task', manuscript);
  assert.equal(assignment.status, 'IN_PROGRESS');
  assert.equal(invalidated, true);
  assignment.status = 'COMPLETED';
  await assert.rejects(saveReviewRevisionForReviewer('participant', 'task', manuscript), { name: 'ForbiddenError' });
  await assert.rejects(getReviewRevisionForReviewer('participant', 'task'), { name: 'ForbiddenError' });
});
test('editor completion racing a save cannot reopen a closed document', async () => {
  assignment.assignmentType = 'TRANSLATION'; closeDuringSave = true;
  await assert.rejects(saveReviewRevisionForReviewer('participant', 'task', manuscript), { name: 'ForbiddenError' });
  assert.equal(assignment.status, 'COMPLETED');
  assert.equal(invalidated, false);
});

test('a submitted scientific review form cannot be changed through the form API service', async () => {
  assignment.status = 'SUBMITTED';
  await assert.rejects(saveOjsReviewFormResponses('task', [{ elementExternalId: 'question', value: 'Changed after submission' }]), { name: 'ForbiddenError' });
  assert.equal(invalidated, false);
});
