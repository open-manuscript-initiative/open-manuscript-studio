import assert from 'node:assert/strict';
import { beforeEach, mock, test } from 'node:test';
const url = path => new URL(`../server/dist/${path}.js`, import.meta.url).href;
const base = 'https://press.example.test/index.php/p/api/v1/omi-integration';
let files, requested;
mock.module(url('integrations/security/trustedRemoteUrl'), { namedExports: { assertTrustedIntegrationUrl: async value => new URL(value) } });
const source = { title: 'Volume', blocks: [{ id: 'p1', type: 'paragraph', text: 'Revised source text' }], annotations: [{ id: 'comment-1', targetBlockId: 'p1', targetText: 'source', body: 'Public correction', authorName: 'Language reviewer', visibility: 'author_and_editor', status: 'resolved' }] };
const { buildReviewDocx } = await import(url('integrations/ojs/reviewDocument'));
const docx = await buildReviewDocx(source, true, 'Editor');
mock.module(url('cloud/security/connectionPinnedHttp'), { namedExports: { fetchPinnedPublicUrl: async value => {
  const path = new URL(value).pathname;
  if (path.endsWith('/submission')) return Response.json({ protocol: 'omi-integration/1', profile: 'omi-integration/1/omp', submission: { externalId: '217', primaryLocale: 'hu', title: { hu: 'Volume' } } });
  if (path.endsWith('/files')) return Response.json({ files });
  requested.push(path);
  if (path.endsWith('/content')) return new Response(docx);
  if (path.endsWith('/snapshot')) return Response.json({ protocol: 'omi-review-revision/1', assignmentType: 'LANGUAGE_REVIEW', anonymityMode: 'open', manuscript: source });
  throw new Error(`Unexpected request: ${path}`);
} } });
const { createReviewSnapshotFromOjs } = await import(url('integrations/ojs/reviewSnapshot'));
const { loadOmpLaunchData } = await import(url('integrations/omp/ompClient'));
const claims = { actorMode: 'editor', apiBaseUrl: base, externalBaseUrl: 'https://press.example.test', scope: ['metadata.read', 'files.read'] };
beforeEach(() => { requested = []; files = [
  { externalId: '1', name: 'original.docx', stage: 2, updatedAt: '2026-11-27T10:00:00Z', contentPath: 'files/1/content' },
  { externalId: '2', name: 'assignment-revision.docx', stage: 20, updatedAt: '2026-11-28T10:00:00Z', contentPath: 'files/2/content' },
  { externalId: '3', name: 'assignment-revision.omi-review.json', stage: 20, contentPath: 'files/3/snapshot' },
  { externalId: '4', name: 'translation-hu-en-assignment-task.docx', stage: 9, updatedAt: '2026-11-29T10:00:00Z', contentPath: 'files/4/content' },
]; });
test('OMP reopening selects the latest source-language revision and restores exact public comment identity/status', async () => {
  const result = await loadOmpLaunchData(claims, 'signed', 'signature');
  assert.equal(result.sourceDocument.fileExternalId, '2');
  assert.deepEqual(result.sourceDocument.reviewSnapshot.annotations.map(item => [item.id, item.status]), [['comment-1', 'resolved']]);
  assert.equal(createReviewSnapshotFromOjs(result, { includeAuthorIdentity: true }).annotations[0].authorName, 'Language reviewer');
  assert.equal(createReviewSnapshotFromOjs(result).annotations[0].authorName, undefined);
  assert.ok(!requested.some(path => path.includes('/4/')));
});
test('OMP source reopening excludes reviewer attachments and other-language translations', async () => {
  files = files.filter(file => ['1', '4'].includes(file.externalId));
  files.push({ externalId: '5', name: 'private-review.docx', stage: 5, updatedAt: '2026-11-30T10:00:00Z', contentPath: 'files/5/content' });
  assert.equal((await loadOmpLaunchData(claims, 'signed', 'signature')).sourceDocument.fileExternalId, '1');
});
test('OMP paired snapshots cannot escape the installation origin', async () => {
  files[2].contentPath = 'https://other.example.test/snapshot';
  await assert.rejects(loadOmpLaunchData(claims, 'signed', 'signature'), /escaped/);
});
