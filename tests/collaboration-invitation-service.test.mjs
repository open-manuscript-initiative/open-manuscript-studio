import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mock, test } from 'node:test';

const token = 'a'.repeat(43);
const tokenHash = createHash('sha256').update(token).digest('hex');
const invite = {
  id: '30000000-0000-4000-8000-000000000003',
  documentId: 'manuscript-1',
  invitedByUserId: '10000000-0000-4000-8000-000000000001',
  invitedEmail: 'author@example.test',
  role: 'AUTHOR',
  tokenHash,
  expiresAt: new Date(Date.now() + 60_000),
  acceptedAt: null,
  declinedAt: null,
  revokedAt: null,
  document: { id: 'manuscript-1', title: 'A shared manuscript' },
};
const user = {
  id: '20000000-0000-4000-8000-000000000002',
  email: 'author@example.test',
  fullName: 'Invited Author',
  status: 'ACTIVE',
};
let invitationRow;
let membershipRow;
let authorizationMembership;

const invitations = {
  findUnique: async ({ where }) => where.tokenHash === invitationRow?.tokenHash
    ? structuredClone(invitationRow)
    : null,
  updateMany: async ({ where, data }) => {
    if (where.id !== invitationRow?.id || invitationRow.acceptedAt || invitationRow.declinedAt || invitationRow.revokedAt || invitationRow.expiresAt <= new Date()) return { count: 0 };
    Object.assign(invitationRow, data);
    return { count: 1 };
  },
};
const members = {
  findUnique: async () => authorizationMembership ? structuredClone(authorizationMembership) : null,
  upsert: async ({ create, update }) => {
    membershipRow = {
      id: '40000000-0000-4000-8000-000000000004',
      ...create,
      acceptedAt: new Date(),
      revokedAt: null,
    };
    if (update) Object.assign(membershipRow, update);
    return structuredClone(membershipRow);
  },
};
const users = { findUnique: async ({ where }) => where.id === user.id ? structuredClone(user) : null };
const auditEvents = { create: async () => ({ id: 'audit-event' }) };
mock.module(new URL('../server/dist/lib/prisma.js', import.meta.url).href, {
  namedExports: { prisma: { collaborationInvitation: invitations, collaborationMember: members, collaborationAuditEvent: auditEvents, user: users, $transaction: async (work) => work({ collaborationInvitation: invitations, collaborationMember: members, collaborationAuditEvent: auditEvents, user: users }) } },
});
mock.module(new URL('../server/dist/config/env.js', import.meta.url).href, {
  namedExports: { env: { FRONTEND_ORIGIN: 'https://studio.example.test', INVITATION_TTL_HOURS: 168, MAIL_FROM: 'Studio <no-reply@example.test>', SENDMAIL_PATH: '/usr/sbin/sendmail' } },
});
const service = await import('../server/dist/services/collaborationInvitationService.js');

test('invitation inspection never exposes an active membership and hides expired or consumed links', async () => {
  invitationRow = structuredClone(invite);
  membershipRow = null;
  assert.deepEqual(await service.inspectCollaborationInvitation(token), {
    email: 'author@example.test',
    role: 'AUTHOR',
    documentId: 'manuscript-1',
    documentTitle: 'A shared manuscript',
    expiresAt: invite.expiresAt.toISOString(),
    status: 'pending',
  });
  invitationRow.expiresAt = new Date(Date.now() - 1);
  assert.equal(await service.inspectCollaborationInvitation(token), null);
  invitationRow = structuredClone(invite);
  invitationRow.acceptedAt = new Date();
  assert.equal(await service.inspectCollaborationInvitation(token), null);
});

test('acceptance requires the invited account, creates membership only on accept, and is single-use', async () => {
  invitationRow = structuredClone(invite);
  membershipRow = null;
  await assert.rejects(
    service.acceptCollaborationInvitation('someone-else', token),
    { code: 'FORBIDDEN' },
  );
  assert.equal(membershipRow, null);

  const accepted = await service.acceptCollaborationInvitation(user.id, token);
  assert.equal(accepted.documentId, invite.documentId);
  assert.equal(accepted.displayName, user.fullName);
  assert.equal(accepted.role, 'AUTHOR');
  assert.equal(membershipRow.userId, user.id);
  assert.ok(invitationRow.acceptedAt instanceof Date);
  await assert.rejects(
    service.acceptCollaborationInvitation(user.id, token),
    { code: 'INVALID_INVITATION' },
  );
});

test('expired and malformed invitation tokens cannot be accepted', async () => {
  invitationRow = structuredClone(invite);
  invitationRow.expiresAt = new Date(Date.now() - 1);
  membershipRow = null;
  await assert.rejects(service.acceptCollaborationInvitation(user.id, token), { code: 'INVALID_INVITATION' });
  await assert.rejects(service.acceptCollaborationInvitation(user.id, 'not-a-token'), { code: 'INVALID_INVITATION' });
  assert.equal(membershipRow, null);
});

test('pending invitations are not memberships and only active owners or editors may invite', async () => {
  authorizationMembership = { id: 'member-1', role: 'AUTHOR', revokedAt: null };
  assert.equal((await service.requireActiveMember('manuscript-1', user.id)).role, 'AUTHOR');
  await assert.rejects(
    service.inviteCollaborator(user.id, { documentId: 'manuscript-1', email: 'next@example.test', role: 'AUTHOR' }),
    { code: 'FORBIDDEN' },
  );
  authorizationMembership = { id: 'member-2', role: 'EDITOR', revokedAt: null };
  assert.equal((await service.requireActiveMember('manuscript-1', user.id)).role, 'EDITOR');
  authorizationMembership.revokedAt = new Date();
  await assert.rejects(
    service.requireActiveMember('manuscript-1', user.id),
    { code: 'FORBIDDEN' },
  );
});
