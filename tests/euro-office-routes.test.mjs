import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import express from '../server/node_modules/express/index.js';

const owner = '10000000-0000-4000-8000-000000000001';
const otherUser = '10000000-0000-4000-8000-000000000002';
const docx = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x01, 0x02]);
let documents = [];

const officeDocument = {
  findMany: async ({ where }) => documents.filter((item) => item.userId === where.userId).map(publicDocument),
  findFirst: async ({ where }) => documents.find((item) => item.id === where.id && item.userId === where.userId) ?? null,
  create: async ({ data }) => {
    const created = { id: '20000000-0000-4000-8000-000000000001', ...data, createdAt: new Date(), updatedAt: new Date() };
    documents.push(created);
    return publicDocument(created);
  },
  update: async ({ where, data }) => {
    const item = documents.find((candidate) => candidate.id === where.id);
    Object.assign(item, data, { updatedAt: new Date() });
    return item;
  },
  deleteMany: async ({ where }) => {
    const before = documents.length;
    documents = documents.filter((item) => item.id !== where.id || item.userId !== where.userId);
    return { count: before - documents.length };
  },
};

function publicDocument(item) {
  const { fileBytes: _fileBytes, ...result } = item;
  return structuredClone(result);
}

mock.module(new URL('../server/dist/lib/prisma.js', import.meta.url).href, {
  namedExports: { prisma: { officeDocument } },
});
mock.module(new URL('../server/dist/config/env.js', import.meta.url).href, {
  namedExports: {
    env: {
      EURO_OFFICE_SERVER_URL: 'https://office.example.test',
      EURO_OFFICE_JWT_SECRET: '0123456789abcdef0123456789abcdef',
      FRONTEND_ORIGIN: 'https://studio.example.test',
    },
  },
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

const { officeDocumentRouter } = await import('../server/dist/routes/officeDocumentRoutes.js');
const app = express();
app.use(express.json({ limit: '28mb' }));
app.use('/api', officeDocumentRouter);
const server = await new Promise((resolve) => {
  const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
});
const localFetch = globalThis.fetch;

async function request(path, method = 'GET', user = owner, body) {
  return localFetch(`http://127.0.0.1:${server.address().port}/api${path}`, {
    method,
    headers: { ...(user ? { 'x-test-user': user } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

test('Euro-Office documents remain private and save through scoped callbacks', async (t) => {
  t.after(() => server.close());
  documents = [];
  assert.equal((await request('/office-documents', 'GET', null)).status, 401);

  const created = await request('/office-documents', 'POST', owner, {
    title: 'Simple note', fileName: 'simple-note.docx', contentBase64: docx.toString('base64'),
    authorName: 'Ada Example', authorEmail: 'ada@example.test',
  });
  assert.equal(created.status, 201);
  const { document } = await created.json();
  assert.equal(document.authorName, 'Ada Example');
  assert.equal((await request('/office-documents', 'GET', otherUser)).status, 200);
  assert.deepEqual((await (await request('/office-documents', 'GET', otherUser)).json()).documents, []);
  assert.equal((await request(`/office-documents/${document.id}/editor-config`, 'GET', otherUser)).status, 404);

  const configResponse = await request(`/office-documents/${document.id}/editor-config?lang=hu`, 'GET', owner);
  assert.equal(configResponse.status, 200);
  const editor = await configResponse.json();
  assert.equal(editor.config.editorConfig.lang, 'hu');
  assert.ok(editor.config.token);
  assert.equal(editor.config.document.permissions.comment, false);
  assert.equal(editor.config.editorConfig.customization.review.trackChanges, false);

  const downloadUrl = new URL(editor.config.document.url);
  const downloaded = await request(`${downloadUrl.pathname.replace('/api', '')}${downloadUrl.search}`, 'GET', null);
  assert.equal(downloaded.status, 200);
  assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), docx);

  const callbackUrl = new URL(editor.config.editorConfig.callbackUrl);
  const updatedDocx = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x09]);
  globalThis.fetch = async (input, init) => {
    if (String(input) === 'https://office.example.test/saved.docx') return new Response(updatedDocx);
    return localFetch(input, init);
  };
  try {
    const saved = await request(
      `${callbackUrl.pathname.replace('/api', '')}${callbackUrl.search}`,
      'POST', null, { status: 2, url: 'https://office.example.test/saved.docx' },
    );
    assert.equal(saved.status, 200);
    assert.deepEqual(documents[0].fileBytes, updatedDocx);
    const rejected = await request(
      `${callbackUrl.pathname.replace('/api', '')}${callbackUrl.search}`,
      'POST', null, { status: 2, url: 'https://attacker.example.test/stolen.docx' },
    );
    assert.equal(rejected.status, 400);
  } finally {
    globalThis.fetch = localFetch;
  }

  assert.equal((await request(`/office-documents/${document.id}`, 'DELETE', otherUser)).status, 404);
  assert.equal((await request(`/office-documents/${document.id}`, 'DELETE', owner)).status, 204);
});
