import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mock, test } from 'node:test';
import * as Y from 'yjs';

const token = 'a'.repeat(43);
const tokenHash = createHash('sha256').update(token).digest('hex');
const invite = {
  id: '30000000-0000-4000-8000-000000000003',
  documentId: 'manuscript-1',
  invitedByUserId: '10000000-0000-4000-8000-000000000001',
  invitedEmail: 'author@example.test',
  role: 'AUTHOR',
  tokenHash,
  createdAt: new Date('2026-09-27T00:00:00Z'),
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
const createdStates = [];
const collaborativeDocuments = {
  findUnique: async () => null,
  create: async ({ data }) => ({ ...data, createdAt: new Date() }),
};
const documentStates = {
  create: async ({ data }) => { createdStates.push(data); return data; },
};
let packageAvailable = true;
let storedPackage;
const packages = {
  findUnique: async () => packageAvailable ? (storedPackage ?? { documentId: 'manuscript-1' }) : null,
  upsert: async ({ create, update }) => {
    storedPackage = { ...create, ...update, updatedAt: new Date() };
    return { checksum: storedPackage.checksum, packageVersion: storedPackage.packageVersion, updatedAt: storedPackage.updatedAt };
  },
};

const invitations = {
  findUnique: async ({ where }) => (where.tokenHash === invitationRow?.tokenHash || where.id === invitationRow?.id)
    ? structuredClone(invitationRow)
    : null,
  findMany: async () => invitationRow ? [{ ...structuredClone(invitationRow), document: { id: invitationRow.documentId, title: invite.document.title } }] : [],
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
  create: async ({ data }) => data,
};
const users = { findUnique: async ({ where }) => where.id === user.id ? structuredClone(user) : null };
const auditEvents = { create: async () => ({ id: 'audit-event' }) };
mock.module(new URL('../server/dist/lib/prisma.js', import.meta.url).href, {
  namedExports: { prisma: { collaborativeDocument: collaborativeDocuments, collaborativeDocumentState: documentStates, collaborativeDocumentPackage: packages, collaborationInvitation: invitations, collaborationMember: members, collaborationAuditEvent: auditEvents, user: users, $transaction: async (work) => work({ collaborativeDocument: collaborativeDocuments, collaborativeDocumentState: documentStates, collaborativeDocumentPackage: packages, collaborationInvitation: invitations, collaborationMember: members, collaborationAuditEvent: auditEvents, user: users }) } },
});
mock.module(new URL('../server/dist/lib/identityPrisma.js', import.meta.url).href, {
  namedExports: { identityPrisma: { userIdentity: { findMany: async () => [{ profile: { email_verified: true } }] } } },
});
mock.module(new URL('../server/dist/config/env.js', import.meta.url).href, {
  namedExports: { env: { FRONTEND_ORIGIN: 'https://studio.example.test', INVITATION_TTL_HOURS: 168, MAIL_FROM: 'Studio <no-reply@example.test>', SENDMAIL_PATH: '/usr/sbin/sendmail' } },
});
const service = await import('../server/dist/services/collaborationInvitationService.js');

test('collaboration space and initial Yjs state are created in one transaction', async () => {
  const document = new Y.Doc();
  document.getText('seed').insert(0, 'existing manuscript text');
  const initialState = Buffer.from(Y.encodeStateAsUpdate(document)).toString('base64');
  document.destroy();
  const result = await service.createCollaborativeDocument(user.id, {
    documentId: 'seeded-manuscript',
    title: 'Seeded manuscript',
    initialState,
  });
  assert.equal(result.id, 'seeded-manuscript');
  assert.equal(createdStates.at(-1).documentId, 'seeded-manuscript');
  const restored = new Y.Doc();
  Y.applyUpdate(restored, createdStates.at(-1).state);
  assert.equal(restored.getText('seed').toString(), 'existing manuscript text');
  restored.destroy();
});

test('invalid initial Yjs states are rejected before a collaboration space is created', async () => {
  await assert.rejects(
    service.createCollaborativeDocument(user.id, {
      documentId: 'bad-seed', title: 'Bad seed', initialState: Buffer.from('not a Yjs update').toString('base64'),
    }),
    /initial collaboration state is invalid/u,
  );
});

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

test('Studio inbox exposes only pending invitations for the signed-in email and accepts by invitation ID', async () => {
  invitationRow = structuredClone(invite);
  membershipRow = null;
  const pending = await service.listPendingCollaborationInvitations(user.id);
  assert.equal(pending.length, 1);
  assert.equal(pending[0].documentTitle, 'A shared manuscript');
  assert.equal('token' in pending[0], false);
  assert.equal('tokenHash' in pending[0], false);

  const accepted = await service.acceptCollaborationInvitationById(user.id, invite.id);
  assert.equal(accepted.documentId, invite.documentId);
  assert.equal(membershipRow.userId, user.id);
  await assert.rejects(service.acceptCollaborationInvitationById(user.id, invite.id), { code: 'INVALID_INVITATION' });
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
  authorizationMembership = { id: 'member-1', role: 'VIEWER', revokedAt: null };
  assert.equal((await service.requireActiveMember('manuscript-1', user.id)).role, 'VIEWER');
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

test('a collaborator cannot be invited until a complete shared OMI package exists', async () => {
  authorizationMembership = { id: 'owner-member', role: 'OWNER', revokedAt: null };
  packageAvailable = false;
  try {
    await assert.rejects(
      service.inviteCollaborator(user.id, { documentId: 'manuscript-1', email: 'next@example.test', role: 'AUTHOR' }),
      { code: 'CONFLICT' },
    );
  } finally {
    packageAvailable = true;
    authorizationMembership = null;
  }
});

test('publishes only ZIP packages and returns the stored package checksum', async () => {
  authorizationMembership = { id: 'owner-member', role: 'OWNER', revokedAt: null };
  const bytes = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
  try {
    const result = await service.publishCollaborativeDocumentPackage(user.id, {
      documentId: 'manuscript-1',
      packageVersion: '0.1.0-alpha.1',
      packageBase64: bytes.toString('base64'),
    });
    assert.equal(result.checksum, createHash('sha256').update(bytes).digest('hex'));
    await assert.rejects(service.publishCollaborativeDocumentPackage(user.id, {
      documentId: 'manuscript-1', packageVersion: '0.1.0-alpha.1', packageBase64: Buffer.from('not a zip').toString('base64'),
    }), TypeError);
  } finally {
    authorizationMembership = null;
    storedPackage = null;
  }
});
