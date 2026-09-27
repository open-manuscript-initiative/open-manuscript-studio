import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mock, test } from 'node:test';

const documentId = 'manuscript-123';
const userId = '10000000-0000-4000-8000-000000000001';
let member = { role: 'AUTHOR', revokedAt: null };
let ticketRow = null;
let revokedWhere = null;
const tickets = {
  deleteMany: async () => ({ count: 0 }),
  create: async ({ data }) => { ticketRow = { id: 'ticket-id', ...data, revokedAt: null }; return ticketRow; },
  findUnique: async ({ where }) => where.tokenHash === ticketRow?.tokenHash ? structuredClone(ticketRow) : null,
  updateMany: async ({ where, data }) => { revokedWhere = where; if (ticketRow) Object.assign(ticketRow, data); return { count: ticketRow ? 1 : 0 }; },
};
mock.module(new URL('../server/dist/lib/prisma.js', import.meta.url).href, {
  namedExports: { prisma: { collaborationConnectionTicket: tickets, collaborationMember: { findUnique: async () => structuredClone(member) } } },
});
const service = await import('../server/dist/services/collaborationTicketService.js');

test('ticket issuance requires active membership and stores only a SHA-256 digest', async () => {
  const before = Date.now();
  const issued = await service.issueCollaborationConnectionTicket(userId, documentId);
  assert.match(issued.token, /^[A-Za-z0-9_-]{43}$/u);
  assert.equal(issued.documentId, documentId);
  assert.equal(issued.role, 'AUTHOR');
  assert.equal(issued.webSocketPath, '/collaboration/ws');
  assert.equal(ticketRow.tokenHash, createHash('sha256').update(issued.token).digest('hex'));
  assert.ok(!JSON.stringify(ticketRow).includes(issued.token));
  const expiry = Date.parse(issued.expiresAt);
  assert.ok(expiry >= before + 299_000 && expiry <= Date.now() + 301_000);

  member = { role: 'VIEWER', revokedAt: null };
  assert.equal((await service.issueCollaborationConnectionTicket(userId, documentId)).role, 'VIEWER');
  member = { role: 'AUTHOR', revokedAt: new Date() };
  await assert.rejects(service.issueCollaborationConnectionTicket(userId, documentId), { code: 'FORBIDDEN' });
});

test('ticket authorization checks document, expiry, revocation, and current membership', async () => {
  member = { role: 'AUTHOR', revokedAt: null };
  const raw = 'x'.repeat(43);
  ticketRow = { id: 'ticket-id', tokenHash: createHash('sha256').update(raw).digest('hex'), documentId, userId, expiresAt: new Date(Date.now() + 60_000), revokedAt: null };
  assert.deepEqual(await service.authorizeCollaborationConnectionTicket(raw, documentId), { userId, role: 'AUTHOR' });
  assert.equal(await service.authorizeCollaborationConnectionTicket(raw, 'another-document'), null);
  member = { role: 'AUTHOR', revokedAt: new Date() };
  assert.equal(await service.authorizeCollaborationConnectionTicket(raw, documentId), null);
  member = { role: 'AUTHOR', revokedAt: null };
  ticketRow.expiresAt = new Date(Date.now() - 1);
  assert.equal(await service.authorizeCollaborationConnectionTicket(raw, documentId), null);
  ticketRow.expiresAt = new Date(Date.now() + 60_000);
  ticketRow.revokedAt = new Date();
  assert.equal(await service.authorizeCollaborationConnectionTicket(raw, documentId), null);
  assert.equal(await service.authorizeCollaborationConnectionTicket('invalid', documentId), null);
});

test('ticket revocation is scoped to one manuscript member', async () => {
  await service.revokeCollaborationConnectionTickets(documentId, userId);
  assert.deepEqual(revokedWhere, { documentId, userId, revokedAt: null });
  assert.ok(ticketRow.revokedAt instanceof Date);
});
