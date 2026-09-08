import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import express from '../server/node_modules/express/index.js';

const owner = '10000000-0000-4000-8000-000000000001';
const connectionId = '20000000-0000-4000-8000-000000000002';
const destination = 'https://journal.example.test/index.php/test';
let rows = new Map();
let calls = [];
let nativeSubmitted = false;
let createFailure = false;
let createdRelease;
let createGate;
const matches = (row, where) => {
  if (where.OR && !where.OR.some((branch) => matches(row, branch))) return false;
  for (const key of ['id', 'digest', 'status', 'externalId']) {
    const expected = where[key];
    if (expected === undefined) continue;
    if (expected && typeof expected === 'object') {
      if (expected.in && !expected.in.includes(row[key])) return false;
      if ('not' in expected && row[key] === expected.not) return false;
    } else if (row[key] !== expected) return false;
  }
  if (where.updatedAt instanceof Date && row.updatedAt.getTime() !== where.updatedAt.getTime()) return false;
  if (where.updatedAt?.lt && !(row.updatedAt < where.updatedAt.lt)) return false;
  return true;
};
const table = {
  findUnique: async ({ where }) => {
    const key = where.userId_connectionId_manuscriptId;
    const row = key ? [...rows.values()].find((r) => r.userId === key.userId && r.connectionId === key.connectionId && r.manuscriptId === key.manuscriptId) : rows.get(where.id);
    return row ? structuredClone(row) : null;
  },
  findUniqueOrThrow: async (args) => { const row = await table.findUnique(args); if (!row) throw new Error('Missing row'); return row; },
  upsert: async ({ where, create }) => {
    const found = await table.findUnique({ where });
    if (found) return found;
    const row = { ...create, id: 'draft-1', status: 'NEW', externalId: null, publicationId: null, updatedAt: new Date() };
    rows.set(row.id, row); return structuredClone(row);
  },
  update: async ({ where, data }) => {
    const row = rows.get(where.id);
    if (!row) throw new Error('Missing row');
    Object.assign(row, data, { updatedAt: new Date() }); return structuredClone(row);
  },
  updateMany: async ({ where, data }) => {
    let count = 0;
    for (const row of rows.values()) if (matches(row, where)) { Object.assign(row, data, { updatedAt: new Date() }); count++; }
    return { count };
  },
};
mock.module(new URL('../server/dist/lib/prisma.js', import.meta.url).href, { namedExports: { prisma: {
  directSubmission: table,
  userIntegration: { findFirst: async ({ where }) => where.userId === owner && where.id === connectionId ? { id: connectionId, providerId: 'ojs', config: { baseUrl: destination } } : null },
} } });
mock.module(new URL('../server/dist/middleware/requireSession.js', import.meta.url).href, { namedExports: {
  requireSession: (req, res, next) => { const id = req.headers['x-test-user']; if (!id) { res.sendStatus(401); return; } req.authUserId = id; next(); },
} });
mock.module(new URL('../server/dist/integrations/security/trustedRemoteUrl.js', import.meta.url).href, { namedExports: { assertTrustedIntegrationUrl: async (url) => new URL(url) } });
const { directSubmissionRouter } = await import('../server/dist/routes/directSubmissionRoutes.js');
const app = express(); app.use(express.json({ limit: '25mb' })); app.use(directSubmissionRouter);
const server = await new Promise((resolve) => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
const localFetch = globalThis.fetch;
const options = { protocol: 'omi-direct-submission/1', platform: 'ojs', acceptingSubmissions: true, locales: ['en'], genres: [{ id: 2 }], sections: [{ id: 4 }] };
mock.method(globalThis, 'fetch', async (url, init) => {
  if (!String(url).startsWith(destination)) return localFetch(url, init);
  const path = String(url).split('/api/v1/')[1];
  calls.push({ path, method: init.method });
  let data = {};
  if (path === 'omi-integration/submission-options') data = options;
  else if (path === 'submissions' && init.method === 'POST') {
    if (createdRelease) createdRelease();
    if (createGate) await createGate;
    if (createFailure) throw new Error('Lost response after creation');
    data = { id: 12, currentPublicationId: 13 };
  } else if (path === 'submissions/12') data = { id: 12, submissionProgress: nativeSubmitted ? '' : 'start' };
  else if (path.endsWith('/contributors')) data = [{ id: 14, email: 'ada@example.test', userGroupId: 15 }];
  else if (path.endsWith('/contributors/14')) data = { id: 14 };
  else if (path.endsWith('/files') && init.method === 'GET') data = [];
  else if (path.endsWith('/submit') && JSON.parse(init.body).confirmCopyright) nativeSubmitted = true;
  return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
const input = { manuscriptId: 'article-1', locale: 'en', title: 'Title', abstract: 'Abstract', keywords: [], authors: [{ givenName: 'Ada', familyName: 'Author', email: 'ada@example.test' }], sectionId: 4, genreId: 2, docx: Buffer.from('PK\u0003\u0004test').toString('base64'), omi: '{"id":"article-1","sections":[]}' };
async function request(data, user = owner) {
  const response = await localFetch(`http://127.0.0.1:${server.address().port}/integrations/connections/${connectionId}/direct-submission`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(user ? { 'x-test-user': user } : {}) },
    body: JSON.stringify({ manuscriptId: input.manuscriptId, apiKey: 'author-test-key', ...data }),
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}
const reset = () => { rows = new Map(); calls = []; nativeSubmitted = false; createFailure = false; createGate = undefined; createdRelease = undefined; };

test('direct submission routes enforce ownership and preserve reservations', async (t) => {
  t.after(() => server.close());
  await t.test('anonymous and other users cannot use a connection', async () => {
    reset(); assert.equal((await request({ action: 'prepare', input }, null)).status, 401);
    assert.equal((await request({ action: 'prepare', input }, 'other-user')).status, 404);
    assert.equal(calls.length, 0);
  });
  await t.test('finalization requires confirmation and the prepared digest', async () => {
    reset(); const prepared = await request({ action: 'prepare', input });
    assert.equal(prepared.status, 200); assert.equal(prepared.body.receipt.status, 'READY');
    assert.equal((await request({ action: 'submit', digest: prepared.body.receipt.digest })).status, 409);
    assert.equal((await request({ action: 'submit', digest: '0'.repeat(64), confirmed: true })).status, 409);
    assert.equal(nativeSubmitted, false);
    assert.equal((await request({ action: 'submit', digest: prepared.body.receipt.digest, confirmed: true })).body.receipt.status, 'SUBMITTED');
    assert.equal((await request({ action: 'submit', digest: prepared.body.receipt.digest, confirmed: true })).status, 200);
    assert.equal(calls.filter((c) => c.path === 'submissions' && c.method === 'POST').length, 1);
  });
  await t.test('unknown create result stays reserved and is not retried automatically', async () => {
    reset(); createFailure = true;
    const failed = await request({ action: 'prepare', input });
    assert.equal(failed.body.receipt.status, 'UNKNOWN');
    await request({ action: 'prepare', input });
    assert.equal(calls.filter((c) => c.path === 'submissions' && c.method === 'POST').length, 1);
  });
  await t.test('concurrent preparations cannot create duplicate native submissions', async () => {
    reset(); let release;
    createGate = new Promise((resolve) => { release = resolve; });
    const creating = new Promise((resolve) => { createdRelease = resolve; });
    const first = request({ action: 'prepare', input });
    await creating;
    const second = await request({ action: 'prepare', input });
    assert.equal(second.status, 409); release();
    assert.equal((await first).status, 200);
    assert.equal(calls.filter((c) => c.path === 'submissions' && c.method === 'POST').length, 1);
  });
});
