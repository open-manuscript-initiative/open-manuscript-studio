import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import express from '../server/node_modules/express/index.js';

const owner = '10000000-0000-4000-8000-000000000001';
const otherUser = '10000000-0000-4000-8000-000000000002';
const savedDocumentId = '20000000-0000-4000-8000-000000000002';
let rows = [];
let providerDeleteCalls = 0;

const cloudBackup = {
  findMany: async ({ where }) => structuredClone(rows.filter((row) =>
    row.userId === where.userId && row.status === where.status,
  )),
  deleteMany: async ({ where }) => {
    const before = rows.length;
    rows = rows.filter((row) => row.id !== where.id || row.userId !== where.userId);
    return { count: before - rows.length };
  },
};

mock.module(new URL('../server/dist/lib/prisma.js', import.meta.url).href, {
  namedExports: { prisma: { cloudBackup } },
});
mock.module(new URL('../server/dist/middleware/requireSession.js', import.meta.url).href, {
  namedExports: {
    requireSession: (request, response, next) => {
      const userId = request.headers['x-test-user'];
      if (!userId) {
        response.sendStatus(401);
        return;
      }
      request.authUserId = userId;
      next();
    },
  },
});
mock.module(new URL('../server/dist/cloud/providerFactory.js', import.meta.url).href, {
  namedExports: {
    createCloudProvider: () => ({ delete: async () => { providerDeleteCalls += 1; } }),
    providerTypeFromDatabase: (value) => ({ GOOGLE_DRIVE: 'google-drive', WEBDAV: 'webdav' })[value],
  },
});

const { cloudRouter } = await import('../server/dist/routes/cloudRoutes.js');
const app = express();
app.use(cloudRouter);
const server = await new Promise((resolve) => {
  const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
});
const localFetch = globalThis.fetch;

async function request(path, method = 'GET', user = owner) {
  const response = await localFetch(`http://127.0.0.1:${server.address().port}${path}`, {
    method,
    headers: user ? { 'x-test-user': user } : {},
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

function reset() {
  rows = [{
    id: savedDocumentId,
    manuscriptId: 'manuscript-one',
    title: 'Sárospataki tanulmány',
    userId: owner,
    connectionId: '30000000-0000-4000-8000-000000000003',
    providerObjectId: 'drive-file-1',
    providerPath: 'OMI/manuscripts/manuscript-one.omi',
    locationUrl: 'https://drive.google.com/open?id=drive-file-1',
    packageVersion: '0.1.0-alpha.1',
    checksum: 'a'.repeat(64),
    sizeBytes: 1024n,
    status: 'COMPLETED',
    createdAt: new Date('2026-09-29T10:00:00.000Z'),
    connection: { displayName: 'Research Drive', providerType: 'GOOGLE_DRIVE' },
  }];
  providerDeleteCalls = 0;
}

test('profile saved-document links are private references, not cloud-file deletion commands', async (t) => {
  t.after(() => server.close());

  reset();
  assert.equal((await request('/profile/saved-documents', 'GET', null)).status, 401);

  const listed = await request('/profile/saved-documents');
  assert.equal(listed.status, 200);
  assert.equal(listed.body.savedDocuments.length, 1);
  assert.equal(listed.body.savedDocuments[0].title, 'Sárospataki tanulmány');
  assert.equal(listed.body.savedDocuments[0].locationUrl, 'https://drive.google.com/open?id=drive-file-1');
  assert.deepEqual((await request('/profile/saved-documents', 'GET', otherUser)).body.savedDocuments, []);

  assert.equal((await request(`/profile/saved-documents/${savedDocumentId}`, 'DELETE', otherUser)).status, 404);
  assert.equal(rows.length, 1);
  assert.equal((await request(`/profile/saved-documents/${savedDocumentId}`, 'DELETE')).status, 204);
  assert.equal(rows.length, 0);
  assert.equal(providerDeleteCalls, 0);
});
