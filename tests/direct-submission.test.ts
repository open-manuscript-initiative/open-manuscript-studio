import assert from 'node:assert/strict';
import test from 'node:test';
import { createRemoteSubmission, prepareRemoteSubmission, finalizeRemoteSubmission, directSubmissionInput, submissionDigest, type RemoteRequest, type DirectSubmissionInput } from '../server/src/integrations/publishing/directSubmission.ts';
import { createDirectSubmissionSnapshot } from '../src/model/directSubmissionSnapshot.ts';
import { createBlankManuscript } from '../src/document/createBlankManuscript.ts';
import { buildDocxExport } from '../src/services/exportDocx.ts';

const input: DirectSubmissionInput = {
  manuscriptId: 'article-1', locale: 'en', title: 'An article', abstract: 'Abstract', keywords: ['history'],
  authors: [{ givenName: 'Ada', familyName: 'Author', email: 'ada@example.test' }],
  sectionId: 4, genreId: 2, docx: Buffer.from('PK\u0003\u0004example').toString('base64'), omi: '{"id":"article-1","sections":[]}',
};
function fake() {
  const calls: Array<{ method: string; path: string; body: unknown }> = [];
  const files: Array<{ id: number; name: Record<string,string> }> = [];
  let submitted = false;
  const remote: RemoteRequest = async (method, path, body) => {
    calls.push({ method, path, body });
    if (method === 'POST' && path === 'submissions') return { id: 12, currentPublicationId: 13 };
    if (method === 'GET' && path === 'submissions/12') return { id: 12, submissionProgress: submitted ? '' : 'start', currentPublicationId: 13 };
    if (method === 'GET' && path.endsWith('/contributors')) return [{ id: 14, email: 'ada@example.test', userGroupId: 15 }];
    if (method === 'PUT' && path.endsWith('/contributors/14')) return { id: 14 };
    if (method === 'GET' && path.endsWith('/files')) return files;
    if (body instanceof FormData && method === 'POST') {
      const name = String(body.get('name[en]'));
      files.push({ id: 20 + files.length, name: { en: name } });
      return { id: files.at(-1)!.id };
    }
    if (path.endsWith('/submit') && !(body as Record<string,unknown>)?._validateOnly) submitted = true;
    return {};
  };
  return { calls, files, remote };
}
test('OJS section and OMP series creation use native draft defaults', async () => {
  for (const platform of ['ojs','omp']) {
    const { calls, remote } = fake();
    assert.deepEqual(await createRemoteSubmission(remote, platform, input), { externalId: 12, publicationId: 13 });
    assert.deepEqual(calls[0]?.body, { locale: 'en', [platform === 'ojs' ? 'sectionId' : 'seriesId']: 4 });
  }
});
test('preparation transfers metadata, both source files and validates without final submission', async () => {
  const { remote, calls, files } = fake();
  await prepareRemoteSubmission(remote, { externalId: 12, publicationId: 13 }, input);
  assert.equal(files.length, 2);
  assert.equal(calls.filter((c) => c.path.endsWith('/submit')).length, 1);
  assert.deepEqual(calls.at(-1)?.body, { _validateOnly: true });
  assert.deepEqual(calls.find((c) => c.path.endsWith('/contributors/14'))?.body, {
    givenName: { en: 'Ada' }, familyName: { en: 'Author' }, email: 'ada@example.test', userGroupId: 15, includeInBrowse: true, seq: 0,
  });
  const uploads = calls.filter((c) => c.body instanceof FormData);
  assert.ok(uploads.every((c) => (c.body as FormData).get('fileStage') === '2'));
});
test('resuming an interrupted transfer reuses existing files and never creates a second submission', async () => {
  const { remote, calls, files } = fake();
  let fail = true;
  const interrupted: RemoteRequest = async (method, path, body) => {
    if (body instanceof FormData && files.length === 1 && fail) { fail = false; throw new Error('Network interrupted'); }
    return remote(method, path, body);
  };
  await assert.rejects(prepareRemoteSubmission(interrupted, { externalId: 12, publicationId: 13 }, input));
  assert.equal(files.length, 1);
  await prepareRemoteSubmission(interrupted, { externalId: 12, publicationId: 13 }, input);
  assert.equal(files.length, 2);
  assert.equal(calls.filter((c) => c.method === 'POST' && c.path === 'submissions').length, 0);
});
test('correcting a draft replaces its existing files rather than adding duplicate files', async () => {
  const { remote, calls, files } = fake();
  await prepareRemoteSubmission(remote, { externalId: 12, publicationId: 13 }, input);
  await prepareRemoteSubmission(remote, { externalId: 12, publicationId: 13 }, { ...input, title: 'Corrected' }, true);
  assert.equal(files.length, 2);
  assert.equal(calls.filter((c) => c.method === 'PUT' && /\/files\/\d+$/.test(c.path)).length, 2);
});
test('native validation errors prevent preparation from completing', async () => {
  const { remote, calls } = fake();
  const reject: RemoteRequest = (method, path, body) => path.endsWith('/submit') ? Promise.reject(new Error('Missing required abstract')) : remote(method, path, body);
  await assert.rejects(prepareRemoteSubmission(reject, { externalId: 12, publicationId: 13 }, input), /Missing required abstract/);
  assert.equal(calls.some((c) => c.path.endsWith('/submit') && !(c.body as Record<string,unknown>)?._validateOnly), false);
});
test('repeating finalization after a lost response does not submit or notify twice', async () => {
  const { remote, calls } = fake();
  await finalizeRemoteSubmission(remote, 12);
  await finalizeRemoteSubmission(remote, 12);
  assert.equal(calls.filter((c) => c.path.endsWith('/submit') && (c.body as Record<string,unknown>)?.confirmCopyright === true).length, 1);
});
test('invalid identifiers and malformed states cannot reach final submission', async () => {
  const { remote, calls } = fake();
  await assert.rejects(finalizeRemoteSubmission(remote, -1));
  assert.equal(calls.length, 0);
  await assert.rejects(finalizeRemoteSubmission(async () => ({}), 12), /invalid submission state/);
});
test('duplicate author emails are rejected and changes alter the snapshot digest', () => {
  assert.equal(directSubmissionInput.safeParse({ ...input, authors: [input.authors[0], { ...input.authors[0], email: 'ADA@example.test' }] }).success, false);
  assert.notEqual(submissionDigest(input), submissionDigest({ ...input, title: 'Changed' }));
});
test('exported metadata and authors match the reviewed snapshot without editing the open document', () => {
  const manuscript = createBlankManuscript({ kind: 'study', title: 'Original', locale: 'hu' });
  const before = JSON.stringify(manuscript);
  const snapshot = createDirectSubmissionSnapshot(manuscript, input);
  assert.equal(JSON.stringify(manuscript), before);
  assert.equal(snapshot.title, 'An article');
  assert.equal(snapshot.abstracts?.en, 'Abstract');
  const authorId = snapshot.contributions.find((c) => c.roles.includes('author'))?.agentId;
  assert.equal(snapshot.agents.find((a) => a.id === authorId)?.names[0]?.value, 'Ada Author');
  assert.equal(snapshot.contributions.find((c) => c.agentId === authorId)?.corresponding, true);
  const docx = buildDocxExport(snapshot);
  assert.equal(Buffer.from(docx.bytes).subarray(0,4).toString('hex'), '504b0304');
});
