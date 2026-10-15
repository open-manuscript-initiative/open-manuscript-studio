import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import express from '../server/node_modules/express/index.js';
import { jwtVerify } from '../server/node_modules/jose/dist/webapi/index.js';

const owner = '10000000-0000-4000-8000-000000000001';
const otherUser = '10000000-0000-4000-8000-000000000002';
const secret = 'a'.repeat(64);
const docs = [];
const sessions = [];

const plainDocument = {
  findMany: async ({ where }) => docs.filter((doc) => doc.userId === where.userId).map((doc) => ({
    id: doc.id, title: doc.title, revision: doc.revision, createdAt: doc.createdAt, updatedAt: doc.updatedAt,
  })),
  findFirst: async ({ where }) => docs.find((doc) => doc.id === where.id && doc.userId === where.userId) ?? null,
  create: async ({ data }) => {
    const doc = { id: '20000000-0000-4000-8000-000000000001', ...data, revision: 1, createdAt: new Date(), updatedAt: new Date() };
    docs.push(doc);
    return { id: doc.id, title: doc.title, revision: doc.revision, createdAt: doc.createdAt, updatedAt: doc.updatedAt };
  },
  updateMany: async ({ where, data }) => {
    const doc = docs.find((item) => item.id === where.id && item.userId === where.userId);
    if (!doc) return { count: 0 };
    doc.content = data.content;
    doc.revision += data.revision.increment;
    doc.updatedAt = new Date();
    return { count: 1 };
  },
};
const euroOfficeSession = {
  deleteMany: async ({ where }) => {
    for (let index = sessions.length - 1; index >= 0; index -= 1) {
      if (sessions[index].documentId === where.documentId) sessions.splice(index, 1);
    }
    return { count: 0 };
  },
  create: async ({ data }) => { sessions.push(data); return data; },
  findFirst: async ({ where, include }) => {
    const session = sessions.find((item) =>
      item.documentId === where.documentId && item.tokenHash === where.tokenHash && item.expiresAt > new Date(),
    );
    if (!session) return null;
    if (include?.document) return { ...session, document: docs.find((doc) => doc.id === session.documentId) };
    return session;
  },
};
const prisma = {
  plainDocument,
  euroOfficeSession,
  user: { findUnique: async () => ({ fullName: 'Test Author' }) },
  $transaction: async (operations) => Promise.all(operations),
};

mock.module(new URL('../server/dist/lib/prisma.js', import.meta.url).href, {
  namedExports: { prisma },
});
mock.module(new URL('../server/dist/config/env.js', import.meta.url).href, {
  namedExports: { env: {
    EUROOFFICE_ENABLED: true,
    EUROOFFICE_URL: 'https://office.example.org',
    EUROOFFICE_JWT_SECRET: secret,
    FRONTEND_ORIGIN: 'https://studio.example.org',
  } },
});
mock.module(new URL('../server/dist/middleware/requireSession.js', import.meta.url).href, {
  namedExports: {
    requireSession: (request, response, next) => {
      const userId = request.headers['x-test-user'];
      if (!userId) { response.sendStatus(401); return; }
      request.authUserId = userId;
      next();
    },
  },
});

const { euroOfficeRouter } = await import('../server/dist/routes/euroOfficeRoutes.js');
const app = express();
app.use(express.json());
app.use('/api', euroOfficeRouter);
const server = await new Promise((resolve) => {
  const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
});
const localFetch = globalThis.fetch;

async function request(path, init = {}, userId = owner) {
  const headers = new Headers(init.headers);
  if (userId) headers.set('x-test-user', userId);
  const response = await localFetch(`http://127.0.0.1:${server.address().port}${path}`, { ...init, headers });
  return response;
}

test('ordinary DOCX stays native and uses an owner-scoped, short-lived EuroOffice API session', async (t) => {
  t.after(() => server.close());
  docs.length = 0;
  sessions.length = 0;

  assert.equal((await request('/api/eurooffice/status', {}, null)).status, 401);
  assert.deepEqual(await (await request('/api/eurooffice/status')).json(), { enabled: true });

  const created = await request('/api/eurooffice/documents', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Plain text' }),
  });
  assert.equal(created.status, 201);
  const documentId = (await created.json()).document.id;
  const otherUserDocuments = await (await request('/api/eurooffice/documents', {}, otherUser)).json();
  assert.equal(otherUserDocuments.documents.length, 0);

  const launched = await request(`/api/eurooffice/documents/${documentId}/session`);
  assert.equal(launched.status, 200);
  const launch = await launched.json();
  assert.equal(launch.apiScriptUrl, 'https://office.example.org/web-apps/apps/api/documents/api.js');
  assert.equal(launch.config.document.fileType, 'docx');
  const claims = await jwtVerify(launch.config.token, new TextEncoder().encode(secret));
  assert.equal(claims.payload.document.title, 'Plain text.docx');
  assert.equal(JSON.stringify(launch).includes(secret), false);

  const capability = new URL(launch.config.document.url).searchParams.get('token');
  const fileResponse = await request(`/api/integrations/eurooffice/${documentId}/content?token=${capability}`, {}, null);
  assert.equal(fileResponse.status, 200);
  assert.equal(Buffer.from(await fileResponse.arrayBuffer()).subarray(0, 4).toString('hex'), '504b0304');
  assert.equal((await request(`/api/integrations/eurooffice/${documentId}/content?token=wrong`, {}, null)).status, 404);

  const blockedCallback = await request(`/api/integrations/eurooffice/${documentId}/callback?token=${capability}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ status: 2, key: launch.config.document.key, url: 'https://attacker.example/file' }),
  }, null);
  assert.equal(blockedCallback.status, 400);
  assert.equal(docs[0].revision, 1);

  const updatedPackage = Buffer.from('PK\u0003\u0004updated-docx');
  globalThis.fetch = async () => new Response(updatedPackage, { status: 200 });
  try {
    const callbackResponse = await request(`/api/integrations/eurooffice/${documentId}/callback?token=${capability}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 2, key: launch.config.document.key, url: 'https://office.example.org/cache/docx' }),
    }, null);
    assert.equal(callbackResponse.status, 200);
    assert.deepEqual(await callbackResponse.json(), { error: 0 });
  } finally {
    globalThis.fetch = localFetch;
  }
  assert.equal(docs[0].revision, 2);
  assert.equal(Buffer.from(docs[0].content).toString(), updatedPackage.toString());
});
