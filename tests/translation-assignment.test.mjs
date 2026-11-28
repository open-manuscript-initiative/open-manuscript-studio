import test, { mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
const path = name => new URL(`../server/dist/${name}.js`, import.meta.url).href;
let pairs, tasks, profileFailure;
mock.module(path('lib/identityPrisma'), { namedExports: { identityPrisma: { user: { findUnique: async () => { if (profileFailure) throw profileFailure; return { translationLanguagePairs: pairs }; } } } } });
mock.module(path('lib/prisma'), { namedExports: { prisma: { peerReviewAssignment: {
  findMany: async () => tasks,
  findFirst: async ({ where }) => tasks.find(task => task.id === where.id),
} } } });
const policy = await import(path('services/translationAssignmentPolicy'));
const { assertTranslationAssignmentScope } = await import(path('services/translationAssignmentScope'));
const { listReviewerAssignments, getReviewerAssignment, acceptReview } = await import(path('services/peerReviewService'));
const { getReviewRevisionForReviewer, saveReviewRevisionForReviewer } = await import(path('services/reviewManuscriptService'));
function task(id, sourceLanguage, targetLanguage) { return { id, assignmentType: 'TRANSLATION', sourceLanguage, targetLanguage, publicationLanguages: ['hu'], status: 'INVITED', invitedAt: new Date(), reviewer: { id: 'translator', fullName: 'Translator' }, feedback: [], anonymityMode: 'OPEN' }; }
beforeEach(() => { profileFailure = null; pairs = [{ sourceLanguage: 'hu', targetLanguage: 'en' }]; tasks = [task('english', 'hu', 'en'), task('german', 'hu', 'de'), task('reverse', 'en', 'hu')]; });
test('directional profile normalizes OJS locale suffixes without merging scripts or reverse pairs', () => {
  assert.deepEqual(policy.normalizeTranslationLanguagePairs([{ sourceLanguage: 'hu_HU', targetLanguage: 'en_GB' }, ...pairs]), pairs);
  assert.equal(policy.matchesTranslationPair(pairs, 'hu', 'de'), false);
  assert.equal(policy.matchesTranslationPair(pairs, 'en', 'hu'), false);
  assert.equal(policy.translationLanguage('zh_Hans_CN'), 'zh-Hans');
  assert.equal(policy.matchesTranslationPair([{ sourceLanguage: 'hu', targetLanguage: 'zh-Hans' }], 'hu', 'zh-Hant'), false);
  assert.throws(() => policy.normalizeTranslationLanguagePairs([{ sourceLanguage: 'en_US', targetLanguage: 'en_GB' }]));
});
test('server lists only tasks in configured pairs and blocks direct access or acceptance of another pair', async () => {
  assert.deepEqual((await listReviewerAssignments('translator')).map(task => task.id), ['english']);
  assert.equal((await getReviewerAssignment('translator', 'english')).id, 'english');
  for (const operation of [getReviewerAssignment, acceptReview, getReviewRevisionForReviewer]) await assert.rejects(operation('translator', 'german'), { name: 'TranslationPairMismatchError' });
  await assert.rejects(saveReviewRevisionForReviewer('translator', 'german', {}), { name: 'TranslationPairMismatchError' });
  pairs.push({ sourceLanguage: 'hu', targetLanguage: 'de' });
  assert.deepEqual((await listReviewerAssignments('translator')).map(task => task.id), ['english', 'german']);
});
test('missing profile hides translations and signals a setup requirement before opening work', async () => {
  pairs = [];
  assert.deepEqual(await listReviewerAssignments('translator'), []);
  await assert.rejects(assertTranslationAssignmentScope('translator', tasks[0]), { name: 'TranslationProfileRequiredError' });
});
function draft() { return { ...tasks[0], reviewRevisionSnapshot: { blocks: [{ type: 'paragraph', text: 'Original' }], translation: { sourceLanguage: 'hu', targetLanguage: 'en', title: 'Title', abstract: 'Abstract', keywords: ['term'], documentCompleted: false } } }; }
test('title, abstract and keywords are individually mandatory even for a metadata-only task', () => {
  assert.ok(policy.validateAssignmentTranslation(draft()));
  for (const field of ['title', 'abstract', 'keywords']) {
    const assignment = draft(); assignment.reviewRevisionSnapshot.translation[field] = field === 'keywords' ? ['  '] : '   ';
    assert.throws(() => policy.validateAssignmentTranslation(assignment), /all required/);
  }
  const assignment = draft(); assignment.reviewRevisionSnapshot.translation.targetLanguage = 'de';
  assert.throws(() => policy.validateAssignmentTranslation(assignment), /source and target/);
});
test('full manuscript required only for the target publication language', () => {
  const assignment = draft(); assignment.publicationLanguages = ['hu', 'de'];
  assert.ok(policy.validateAssignmentTranslation(assignment));
  assignment.publicationLanguages.push('en');
  assert.throws(() => policy.validateAssignmentTranslation(assignment), /full manuscript/);
  assignment.reviewRevisionSnapshot.translation.documentCompleted = true;
  assert.ok(policy.validateAssignmentTranslation(assignment));
  assignment.reviewRevisionSnapshot.blocks = [];
  assert.throws(() => policy.validateAssignmentTranslation(assignment), /full manuscript/);
});

test('only the missing translation preference column has the migration compatibility fallback', async () => {
  const { readTranslationLanguagePairs } = await import(path('repositories/translationProfileRepository'));
  profileFailure = { code: 'P2022', meta: { column: 'users.translation_language_pairs' } };
  assert.deepEqual(await readTranslationLanguagePairs('translator'), []);
  for (const failure of [{ code: 'P2022', meta: { column: 'users.email' } }, { code: 'P1001', message: 'translation_language_pairs connection failure' }]) {
    profileFailure = failure;
    await assert.rejects(readTranslationLanguagePairs('translator'));
  }
});

test('English and German returned manuscripts cannot replace the Hungarian primary source', () => {
  for (const target of ['en', 'de']) {
    const name = `translation-hu-${target}-assignment-task.docx`;
    assert.equal(policy.translationDocumentMatchesSourceLanguage(name, 'hu_HU'), false);
    assert.equal(policy.translationDocumentMatchesSourceLanguage(name, target), true);
    assert.equal(policy.translationDocumentMatchesSourceLanguage(name, undefined), false);
  }
  assert.equal(policy.translationDocumentMatchesSourceLanguage('original.docx', 'hu'), true);
});
