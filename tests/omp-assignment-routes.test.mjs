import assert from 'node:assert/strict';
import { after, beforeEach, mock, test } from 'node:test';
import express from '../server/node_modules/express/index.js';
const url = path => new URL(`../server/dist/${path}.js`, import.meta.url).href;
mock.module(url('config/env'), { namedExports: { env: { INTEGRATION_MASTER_KEY: 'ab'.repeat(32) } } });
let saved, calls, account, revisionChanged;
const reviewer = { id: 'participant', email: 'translator@example.test', fullName: 'Translator', status: 'ACTIVE' };
const binding = { externalAssignmentId: 'workflow-11111111-1111-4111-8111-111111111111', assignmentToken: 'native-bound-token', reviewRound: 1, publicationLanguages: ['hu'] };
beforeEach(() => { saved = null; calls = []; account = 'editor'; revisionChanged = false; });
mock.module(url('lib/prisma'), { namedExports: { prisma: {
  user: { findUnique: async ({ where }) => where.id ? { email: account === 'editor' ? 'editor@example.test' : 'other@example.test', status: 'ACTIVE' } : reviewer },
  peerReviewAssignment: {
    findMany: async ({ where }) => { calls.push({ list: where }); return []; },
    count: async () => 0, findUnique: async () => null,
    create: async ({ data }) => { saved = { ...data, reviewer, invitedAt: new Date(), revisionUpdatedAt: null }; return saved; },
    findFirst: async ({ where }) => saved && where.id === saved.id && where.manuscriptId === saved.manuscriptId && where.workspaceId === saved.workspaceId ? saved : null,
    update: async ({ data }) => { Object.assign(saved, data); return saved; },
    updateMany: async ({ data }) => { if (revisionChanged) return { count: 0 }; Object.assign(saved, data); return { count: 1 }; },
  },
  $executeRaw: async () => 1, $queryRaw: async () => [{ receipt: { written: true }, assignment_token: Buffer.from(JSON.stringify({ stageId: 2, reviewRoundId: 5 })).toString('base64url') + '.signature' }],
} } });
mock.module(url('middleware/requireSession'), { namedExports: { requireSession: (req, res, next) => { req.authUserId = account; next(); } } });
mock.module(url('services/assignmentInvitationService'), { namedExports: { issueAssignmentInvitation: async () => { throw new Error('Unexpected invitation'); }, pendingPasswordPlaceholder: () => 'unused' } });
mock.module(url('services/reviewManuscriptService'), { namedExports: { sanitizeReviewManuscript: input => input } });
mock.module(url('integrations/externalInstallations'), { namedExports: { getActiveInstallationWithSecret: async () => ({ baseUrl: 'https://press.example.test' }) } });
mock.module(url('integrations/ojs/reviewWriteback'), { namedExports: { rememberOjsReviewWritebackEndpoint: async () => {} } });
mock.module(url('integrations/ojs/reviewForm'), { namedExports: { rememberOjsReviewForm: async () => {} } });
mock.module(url('integrations/ojs/workflowRequest'), { namedExports: { ojsWorkflowRequest: async (_id, _url, operation, body, platform) => { calls.push({ operation, body, platform }); return { ...binding, externalAssignmentId: `workflow-${body.assignmentId}` }; } } });
const { issueOjsAssignmentGrant, verifyOjsAssignmentGrant } = await import(url('integrations/ojs/ojsAssignmentGrant'));
const { ojsAssignmentRouter, ompAssignmentRouter } = await import(url('routes/ojsAssignmentRoutes'));
const app = express(); app.use(express.json()); app.use('/api/reviews', ojsAssignmentRouter, ompAssignmentRouter);
const server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
after(() => server.close());
const root = `http://127.0.0.1:${server.address().port}/api/reviews`;
function grant(platform = 'omp', extra = {}) { return issueOjsAssignmentGrant({ platform, installationId: 'installation', contextId: '1', manuscriptId: '217', externalSubmissionId: '217', actorEmail: 'editor@example.test', actorMode: 'editor', actorExternalId: '10', apiBaseUrl: 'https://press.example.test/api/v1/omi-integration', ...extra }); }
function send(platform, token, body, suffix = '') { return fetch(`${root}/${platform}/assignments${suffix}${body ? '' : `?grant=${encodeURIComponent(token)}`}`, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify({ grant: token, ...body }) } : {}) }); }
const task = { reviewerEmail: reviewer.email, assignmentType: 'TRANSLATION', sourceLanguage: 'hu_HU', targetLanguage: 'en_GB', manuscript: { title: 'Volume', blocks: [{ id: 'p1', type: 'paragraph', text: 'Original' }] } };

test('signed grants cannot cross OJS/OMP routes; old OJS grants remain valid only for OJS', async () => {
  assert.equal((await send('omp', grant('ojs'))).status, 403);
  assert.equal((await send('ojs', grant('omp'))).status, 403);
  assert.equal((await send('omp', grant())).status, 200);
  const old = issueOjsAssignmentGrant({ installationId: 'i', contextId: '1', manuscriptId: '217', actorEmail: 'editor@example.test', actorMode: 'editor' });
  assert.equal(verifyOjsAssignmentGrant(old).platform, 'ojs');
  assert.throws(() => verifyOjsAssignmentGrant(old, 'omp'));
  assert.equal(calls.filter(call => call.list).length, 1);
  assert.match(calls[0].list.workspaceId, /^omp:/);
});
test('OMP assignment creation stores native binding, directional pair and publication scope', async () => {
  const result = await send('omp', grant(), task);
  assert.equal(result.status, 201, await result.text());
  assert.equal(calls[0].platform, 'OMP'); assert.equal(calls[0].body.submissionExternalId, '217');
  assert.equal(saved.sourceLanguage, 'hu'); assert.equal(saved.targetLanguage, 'en');
  assert.deepEqual(saved.publicationLanguages, ['hu']); assert.equal(saved.anonymityMode, 'OPEN');
  assert.match(saved.workspaceId, /^omp:/);
});
test('author and mismatched signed account cannot assign native OMP work', async () => {
  assert.equal((await send('omp', grant('omp', { actorMode: 'author' }), task)).status, 403);
  account = 'other'; assert.equal((await send('omp', grant(), task)).status, 403);
  assert.equal(saved, null);
});
test('native-authorized editorial completion closes open work and rejects a concurrent revision', async () => {
  const token = grant(); assert.equal((await send('omp', token, task)).status, 201);
  saved.status = 'SUBMITTED';
  revisionChanged = true;
  assert.equal((await send('omp', token, {}, `/${saved.id}/complete`)).status, 400);
  assert.equal(saved.status, 'SUBMITTED');
  revisionChanged = false;
  assert.equal((await send('omp', token, {}, `/${saved.id}/complete`)).status, 200);
  assert.equal(saved.status, 'COMPLETED');
  assert.equal(calls.at(-1).platform, 'OMP');
});

test('OMP reconnect forwards the native stage/round identity in addition to its numeric review round', async () => {
  const token = grant(); assert.equal((await send('omp', token, task)).status, 201);
  assert.equal((await send('omp', token, {}, `/${saved.id}/reconnect`)).status, 200);
  assert.equal(calls.at(-1).body.expectedStageId, 2);
  assert.equal(calls.at(-1).body.expectedReviewRoundExternalId, 5);
  assert.equal(calls.at(-1).body.expectedReviewRound, 1);
});
test('OJS uses its original workspace/provider and retains metadata-only task behavior', async () => {
  assert.equal((await send('ojs', grant('ojs'), task)).status, 201);
  assert.equal(calls[0].platform, 'OJS'); assert.match(saved.workspaceId, /^ojs:/);
  assert.deepEqual(saved.publicationLanguages, ['hu']);
});
