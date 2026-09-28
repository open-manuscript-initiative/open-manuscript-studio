import assert from 'node:assert/strict';
import { after, mock, test } from 'node:test';
import express from '../server/node_modules/express/index.js';

const owner = '10000000-0000-4000-8000-000000000001';
const documentId = 'manuscript-chat-test';
const participants = new Set([owner]);
const messages = [];
let nextId = 1;

mock.module(new URL('../server/dist/lib/prisma.js', import.meta.url).href, {
  namedExports: {
    prisma: {
      collaborationMember: {
        findFirst: async ({ where }) => where.documentId === documentId && where.revokedAt === null && participants.has(where.userId)
          ? { id: 'active-membership' }
          : null,
      },
      collaborationMessage: {
        findMany: async ({ where, orderBy, take }) => messages
          .filter((message) => message.documentId === where.documentId)
          .sort((a, b) => orderBy.createdAt === 'desc'
            ? b.createdAt.getTime() - a.createdAt.getTime()
            : a.createdAt.getTime() - b.createdAt.getTime())
          .slice(0, take)
          .map((message) => ({ ...message, sender: { fullName: message.senderName } })),
        create: async ({ data }) => {
          const message = { id: 'message-' + nextId++, ...data, createdAt: new Date() };
          messages.push(message);
          return message;
        },
      },
      user: {
        findUnique: async ({ where }) => where.id === owner ? { fullName: 'Test Author', status: 'ACTIVE' } : null,
      },
    },
  },
});
mock.module(new URL('../server/dist/middleware/requireSession.js', import.meta.url).href, {
  namedExports: {
    requireSession: (request, response, next) => {
      const userId = request.headers['x-test-user'];
      if (!userId) {
        response.status(401).json({ error: { code: 'NOT_AUTHENTICATED' } });
        return;
      }
      request.authUserId = userId;
      next();
    },
  },
});
const { collaborationMessageRouter } = await import('../server/dist/routes/collaborationMessageRoutes.js');
const app = express();
app.use(express.json());
app.use('/api/collaboration/documents', collaborationMessageRouter);
const server = await new Promise((resolve) => {
  const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
});
after(() => server.close());

const fetchLocal = (userId, method = 'GET', body) => fetch(
  'http://127.0.0.1:' + server.address().port + '/api/collaboration/documents/' + documentId + '/messages',
  {
    method,
    headers: {
      ...(userId ? { 'x-test-user': userId } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  },
);

test('chat messages require authentication and active document membership', async () => {
  assert.equal((await fetchLocal(null)).status, 401);
  assert.equal((await fetchLocal('10000000-0000-4000-8000-000000000099')).status, 403);
  assert.equal((await fetchLocal(owner, 'POST', { body: 'hello' })).status, 201);
  const response = await fetchLocal(owner);
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).messages.map((message) => message.body), ['hello']);
});

test('chat rejects empty and oversized messages', async () => {
  assert.equal((await fetchLocal(owner, 'POST', { body: '   ' })).status, 400);
  assert.equal((await fetchLocal(owner, 'POST', { body: 'x'.repeat(4001) })).status, 400);
});
