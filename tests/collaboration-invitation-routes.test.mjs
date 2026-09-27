import assert from 'node:assert/strict';
import { after, mock, test } from 'node:test';
import express from '../server/node_modules/express/index.js';

const owner = '10000000-0000-4000-8000-000000000001';
const inviteToken = 'b'.repeat(43);
const calls = [];
let createdDocumentInput;
class CollaborationInvitationError extends Error {}
const service = {
  CollaborationInvitationError,
  createCollaborativeDocument: async (_userId, input) => {
    createdDocumentInput = input;
    return { id: input.documentId, title: input.title, createdAt: new Date('2026-09-27T00:00:00Z') };
  },
  listCollaborativeDocumentAccess: async (_userId, _documentId) => ({ members: [{ userId: owner, role: 'OWNER' }], invitations: [] }),
  listPendingCollaborationInvitations: async (userId) => {
    calls.push({ action: 'inbox', userId });
    return [{ id: '30000000-0000-4000-8000-000000000003', documentId: 'manuscript-1', documentTitle: 'A shared manuscript', role: 'AUTHOR', status: 'pending' }];
  },
  inviteCollaborator: async (userId, input) => {
    calls.push({ action: 'invite', userId, input });
    return { id: '30000000-0000-4000-8000-000000000003', email: input.email, role: input.role, status: 'pending' };
  },
  inspectCollaborationInvitation: async (_token) => _token === inviteToken ? { email: 'author@example.test', role: 'AUTHOR', status: 'pending' } : null,
  acceptCollaborationInvitation: async (userId, token) => {
    calls.push({ action: 'accept', userId, token });
    return { userId, role: 'AUTHOR', documentId: 'manuscript-1' };
  },
  acceptCollaborationInvitationById: async (userId, id) => {
    calls.push({ action: 'accept-by-id', userId, id });
    return { userId, role: 'AUTHOR', documentId: 'manuscript-1' };
  },
  declineCollaborationInvitation: async (_userId, _token) => ({ status: 'declined' }),
  declineCollaborationInvitationById: async (userId, id) => {
    calls.push({ action: 'decline-by-id', userId, id });
    return { status: 'declined' };
  },
  revokeCollaborationInvitation: async (userId, id) => calls.push({ action: 'revoke', userId, id }),
  revokeCollaborator: async (userId, documentId, target) => calls.push({ action: 'remove', userId, documentId, target }),
};
const ticketService = {
  CollaborationTicketError: class CollaborationTicketError extends Error {},
  issueCollaborationConnectionTicket: async (userId, documentId) => {
    calls.push({ action: 'ticket', userId, documentId });
    return { token: 'ticket-secret', documentId, role: 'AUTHOR', expiresAt: '2026-09-27T16:50:00.000Z', webSocketPath: '/collaboration/ws' };
  },
};
mock.module(new URL('../server/dist/services/collaborationInvitationService.js', import.meta.url).href, { namedExports: service });
mock.module(new URL('../server/dist/services/collaborationTicketService.js', import.meta.url).href, { namedExports: ticketService });
mock.module(new URL('../server/dist/middleware/requireSession.js', import.meta.url).href, { namedExports: {
  requireSession: (request, response, next) => {
    const userId = request.headers['x-test-user'];
    if (!userId) { response.sendStatus(401); return; }
    request.authUserId = userId;
    next();
  },
} });
const { collaborationRouter } = await import('../server/dist/routes/collaborationRoutes.js');
const app = express();
app.use(express.json({ limit: '12mb' }));
app.use('/api/collaboration', collaborationRouter);
const server = await new Promise((resolve) => {
  const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
});
after(() => server.close());
const fetchLocal = (path, { userId, method = 'GET', body } = {}) => fetch(
  `http://127.0.0.1:${server.address().port}/api/collaboration${path}`,
  { method, headers: { ...(userId ? { 'x-test-user': userId } : {}), ...(body ? { 'content-type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) },
);

test('collaboration routes require a session to create spaces and invite collaborators', async () => {
  assert.equal((await fetchLocal('/documents', { method: 'POST', body: { documentId: 'ms-1', title: 'Title' } })).status, 401);
  const created = await fetchLocal('/documents', { userId: owner, method: 'POST', body: { documentId: 'ms-1', title: 'A manuscript' } });
  assert.equal(created.status, 201);
  const invite = await fetchLocal('/documents/ms-1/invitations', { userId: owner, method: 'POST', body: { email: 'Author@Example.test', role: 'AUTHOR' } });
  assert.equal(invite.status, 201);
  assert.equal((await invite.json()).invitation.status, 'pending');
  assert.equal(calls.at(-1).input.email, 'Author@Example.test');
});

test('document registration accepts a bounded initial Yjs state payload', async () => {
  const initialState = Buffer.from('seeded manuscript state').toString('base64');
  const response = await fetchLocal('/documents', {
    userId: owner,
    method: 'POST',
    body: { documentId: 'ms-seeded', title: 'Seeded manuscript', initialState },
  });
  assert.equal(response.status, 201);
  assert.equal(createdDocumentInput.initialState, initialState);
});

test('invitation must be explicitly accepted by the signed-in account', async () => {
  const inspected = await fetchLocal(`/invitations/${inviteToken}`);
  assert.equal(inspected.status, 200);
  assert.equal((await inspected.json()).invitation.status, 'pending');
  const accepted = await fetchLocal(`/invitations/${inviteToken}/accept`, { userId: '20000000-0000-4000-8000-000000000002', method: 'POST' });
  assert.equal(accepted.status, 200);
  assert.equal((await accepted.json()).membership.role, 'AUTHOR');
  assert.equal(calls.at(-1).action, 'accept');
  assert.equal(calls.at(-1).token, inviteToken);
});

test('the authenticated in-app inbox lists pending invitations and accepts them by ID', async () => {
  const inbox = await fetchLocal('/invitations/pending', { userId: owner });
  assert.equal(inbox.status, 200);
  assert.equal(inbox.headers.get('cache-control'), 'no-store');
  assert.equal((await inbox.json()).invitations[0].documentTitle, 'A shared manuscript');
  assert.deepEqual(calls.at(-1), { action: 'inbox', userId: owner });

  const accepted = await fetchLocal('/invitations/by-id/30000000-0000-4000-8000-000000000003/accept', {
    userId: owner, method: 'POST',
  });
  assert.equal(accepted.status, 200);
  assert.equal(calls.at(-1).action, 'accept-by-id');
});

test('malformed invitation requests are rejected before they reach the service', async () => {
  const response = await fetchLocal('/documents/ms-1/invitations', { userId: owner, method: 'POST', body: { email: 'bad', role: 'OWNER' } });
  assert.equal(response.status, 400);
  assert.equal(calls.filter((call) => call.action === 'invite').length, 1);
});

test('connection tickets require login, have a no-store response, and are document-scoped', async () => {
  assert.equal((await fetchLocal('/documents/ms-1/connection-ticket', { method: 'POST' })).status, 401);
  const response = await fetchLocal('/documents/ms-1/connection-ticket', { userId: owner, method: 'POST' });
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await response.json()).ticket.webSocketPath, '/collaboration/ws');
  assert.deepEqual(calls.at(-1), { action: 'ticket', userId: owner, documentId: 'ms-1' });
});
