import { createHash, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import * as Y from 'yjs';

import { env } from '../config/env.js';
import { closeCollaborationDocumentConnections } from '../collaboration/collaborationServer.js';
import { identityPrisma } from '../lib/identityPrisma.js';
import { prisma } from '../lib/prisma.js';
import { revokeCollaborationConnectionTickets } from './collaborationTicketService.js';

export type CollaborationInviteRole = 'EDITOR' | 'AUTHOR' | 'VIEWER';
const MAX_SHARED_PACKAGE_BYTES = 100 * 1024 * 1024;

export class CollaborationInvitationError extends Error {
  constructor(
    message: string,
    readonly code: 'NOT_FOUND' | 'FORBIDDEN' | 'CONFLICT' | 'INVALID_INVITATION' | 'MAIL_DELIVERY_FAILED',
  ) {
    super(message);
    this.name = 'CollaborationInvitationError';
  }
}

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,128}$/u;

export async function createCollaborativeDocument(
  ownerUserId: string,
  input: { documentId: string; title: string; initialState?: string | undefined },
) {
  const id = input.documentId.trim();
  const title = input.title.trim();
  if (!id || id.length > 128 || !title || title.length > 500) {
    throw new TypeError('A valid document ID and title are required.');
  }

  const existing = await prisma.collaborativeDocument.findUnique({ where: { id } });
  if (existing) throw new CollaborationInvitationError('This document already has a collaboration space.', 'CONFLICT');

  const user = await prisma.user.findUnique({
    where: { id: ownerUserId },
    select: { id: true, status: true },
  });
  if (!user || user.status !== 'ACTIVE') {
    throw new CollaborationInvitationError('An active Studio account is required.', 'FORBIDDEN');
  }
  const initialState = decodeInitialState(input.initialState);

  return prisma.$transaction(async (transaction) => {
    const document = await transaction.collaborativeDocument.create({
      data: { id, title, ownerUserId },
    });
    await transaction.collaborationMember.create({
      data: { documentId: id, userId: ownerUserId, role: 'OWNER' },
    });
    if (initialState) {
      await transaction.collaborativeDocumentState.create({
        data: { documentId: id, state: Buffer.from(initialState) },
      });
    }
    await transaction.collaborationAuditEvent.create({
      data: { documentId: id, actorUserId: ownerUserId, type: 'DOCUMENT_REGISTERED' },
    });
    return document;
  });
}

function decodeInitialState(value: string | undefined): Uint8Array | null {
  if (value === undefined) return null;
  if (value.length === 0 || value.length > 11_184_812 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(value)) {
    throw new TypeError('The initial collaboration state is invalid or too large.');
  }
  const state = Buffer.from(value, 'base64');
  if (state.length > 8 * 1024 * 1024 || state.toString('base64') !== value) {
    throw new TypeError('The initial collaboration state is invalid or too large.');
  }
  const document = new Y.Doc();
  try {
    Y.applyUpdate(document, state);
  } catch {
    throw new TypeError('The initial collaboration state is invalid.');
  } finally {
    document.destroy();
  }
  return state;
}

export async function listCollaborativeDocumentAccess(
  actorUserId: string,
  documentId: string,
) {
  const actor = await requireActiveMember(documentId, actorUserId);
  const [members, invitations] = await Promise.all([
    prisma.collaborationMember.findMany({
      where: { documentId, revokedAt: null },
      include: { user: { select: { id: true, email: true, fullName: true } } },
      orderBy: [{ role: 'asc' }, { acceptedAt: 'asc' }],
    }),
    actor.role === 'OWNER' || actor.role === 'EDITOR' || actor.role === 'AUTHOR'
      ? prisma.collaborationInvitation.findMany({
          where: { documentId, acceptedAt: null, declinedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
          select: { id: true, invitedEmail: true, role: true, expiresAt: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        })
      : Promise.resolve([]),
  ]);
  return {
    members: members.map((member) => ({
      userId: member.user.id,
      email: member.user.email,
      displayName: member.user.fullName,
      role: member.role,
      acceptedAt: member.acceptedAt.toISOString(),
    })),
    invitations: invitations.map((invitation) => ({
      ...invitation,
      status: 'pending' as const,
      expiresAt: invitation.expiresAt.toISOString(),
      createdAt: invitation.createdAt.toISOString(),
    })),
  };
}

export async function publishCollaborativeDocumentPackage(
  actorUserId: string,
  input: { documentId: string; packageVersion: string; packageBase64: string },
) {
  await requireInviteAuthority(input.documentId, actorUserId);
  if (!input.packageVersion.trim() || input.packageVersion.length > 32
      || input.packageBase64.length > Math.ceil(MAX_SHARED_PACKAGE_BYTES * 4 / 3)
      || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(input.packageBase64)) {
    throw new TypeError('The shared OMI package is invalid or too large.');
  }
  const bytes = Buffer.from(input.packageBase64, 'base64');
  if (bytes.length < 4 || bytes.length > MAX_SHARED_PACKAGE_BYTES
      || bytes.toString('base64') !== input.packageBase64
      || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    throw new TypeError('The shared OMI package is invalid or too large.');
  }
  const checksum = createHash('sha256').update(bytes).digest('hex');
  const published = await prisma.collaborativeDocumentPackage.upsert({
    where: { documentId: input.documentId },
    create: {
      documentId: input.documentId,
      packageBytes: bytes,
      checksum,
      packageVersion: input.packageVersion.trim(),
    },
    update: {
      packageBytes: bytes,
      checksum,
      packageVersion: input.packageVersion.trim(),
    },
    select: { checksum: true, packageVersion: true, updatedAt: true },
  });
  return { ...published, updatedAt: published.updatedAt.toISOString() };
}

export async function downloadCollaborativeDocumentPackage(actorUserId: string, documentId: string) {
  await requireActiveMember(documentId, actorUserId);
  const [document, sharedPackage] = await Promise.all([
    prisma.collaborativeDocument.findUnique({ where: { id: documentId }, select: { title: true } }),
    prisma.collaborativeDocumentPackage.findUnique({ where: { documentId } }),
  ]);
  if (!document || !sharedPackage) {
    throw new CollaborationInvitationError('The shared OMI package is not available.', 'NOT_FOUND');
  }
  return {
    title: document.title,
    packageVersion: sharedPackage.packageVersion,
    checksum: sharedPackage.checksum,
    updatedAt: sharedPackage.updatedAt.toISOString(),
    packageBase64: Buffer.from(sharedPackage.packageBytes).toString('base64'),
  };
}

export async function listSharedCollaborativeDocuments(actorUserId: string) {
  const memberships = await prisma.collaborationMember.findMany({
    where: { userId: actorUserId, revokedAt: null, document: { package: { isNot: null } } },
    include: { document: { include: { package: { select: { updatedAt: true } } } } },
    orderBy: { document: { updatedAt: 'desc' } },
  });
  return memberships.map(({ document, role }) => ({
    documentId: document.id,
    title: document.title,
    role,
    packageUpdatedAt: document.package?.updatedAt.toISOString() ?? null,
  }));
}

export async function inviteCollaborator(
  actorUserId: string,
  input: { documentId: string; email: string; role: CollaborationInviteRole },
) {
  const email = normalizeEmail(input.email);
  if (!isEmail(email)) throw new TypeError('A valid invitation e-mail address is required.');
  await requireInviteAuthority(input.documentId, actorUserId);

  const publishedPackage = await prisma.collaborativeDocumentPackage.findUnique({
    where: { documentId: input.documentId },
    select: { documentId: true },
  });
  if (!publishedPackage) {
    throw new CollaborationInvitationError('Save the OMI package before inviting collaborators.', 'CONFLICT');
  }

  const document = await prisma.collaborativeDocument.findUnique({
    where: { id: input.documentId },
    select: { id: true, title: true },
  });
  if (!document) throw new CollaborationInvitationError('The collaboration space was not found.', 'NOT_FOUND');

  const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existingUser) {
    const membership = await prisma.collaborationMember.findUnique({
      where: { documentId_userId: { documentId: input.documentId, userId: existingUser.id } },
      select: { revokedAt: true },
    });
    if (membership && !membership.revokedAt) {
      throw new CollaborationInvitationError('This account already has access to the document.', 'CONFLICT');
    }
  }

  const rawToken = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + env.INVITATION_TTL_HOURS * 60 * 60 * 1000);
  const invitation = await prisma.$transaction(async (transaction) => {
    await transaction.collaborationInvitation.updateMany({
      where: {
        documentId: input.documentId,
        invitedEmail: email,
        acceptedAt: null,
        declinedAt: null,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
    const created = await transaction.collaborationInvitation.create({
      data: {
        documentId: input.documentId,
        invitedByUserId: actorUserId,
        invitedEmail: email,
        role: input.role,
        tokenHash: hashToken(rawToken),
        expiresAt,
      },
      select: { id: true, invitedEmail: true, role: true, expiresAt: true, createdAt: true },
    });
    await transaction.collaborationAuditEvent.create({
      data: {
        documentId: input.documentId,
        actorUserId,
        type: 'INVITATION_ISSUED',
        details: { role: input.role },
      },
    });
    return created;
  });

  const inviteUrl = new URL('/', env.FRONTEND_ORIGIN);
  inviteUrl.searchParams.set('collaborationInvite', rawToken);
  let emailSent = true;
  try {
    await sendInvitationMail({
      to: email,
      documentTitle: document.title,
      role: input.role,
      inviteUrl: inviteUrl.toString(),
      expiresAt,
    });
  } catch (error) {
    emailSent = false;
    console.error('[OMI collaboration invitation] mail delivery failed', error);
  }

  return {
    id: invitation.id,
    email: invitation.invitedEmail,
    role: invitation.role,
    expiresAt: invitation.expiresAt.toISOString(),
    status: 'pending' as const,
    emailSent,
  };
}

export async function inspectCollaborationInvitation(rawToken: string) {
  const token = validateToken(rawToken);
  if (!token) return null;
  const invitation = await prisma.collaborationInvitation.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { document: { select: { id: true, title: true } } },
  });
  if (!isPending(invitation)) return null;
  return {
    email: invitation.invitedEmail,
    role: invitation.role,
    documentId: invitation.document.id,
    documentTitle: invitation.document.title,
    expiresAt: invitation.expiresAt.toISOString(),
    status: 'pending' as const,
  };
}

export async function listPendingCollaborationInvitations(actorUserId: string) {
  const user = await prisma.user.findUnique({
    where: { id: actorUserId },
    select: { email: true, status: true },
  });
  if (!user || user.status !== 'ACTIVE') {
    throw new CollaborationInvitationError('An active Studio account is required.', 'FORBIDDEN');
  }
  if (!(await hasVerifiedMailbox(actorUserId))) return [];
  const invitations = await prisma.collaborationInvitation.findMany({
    where: {
      invitedEmail: normalizeEmail(user.email),
      acceptedAt: null,
      declinedAt: null,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: { document: { select: { id: true, title: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return invitations.map((invitation) => ({
    id: invitation.id,
    documentId: invitation.document.id,
    documentTitle: invitation.document.title,
    role: invitation.role,
    createdAt: invitation.createdAt.toISOString(),
    expiresAt: invitation.expiresAt.toISOString(),
    status: 'pending' as const,
  }));
}

export async function acceptCollaborationInvitation(actorUserId: string, rawToken: string) {
  const token = validateToken(rawToken);
  if (!token) throw new CollaborationInvitationError('The invitation is invalid or expired.', 'INVALID_INVITATION');

  return consumeCollaborationInvitation(actorUserId, { tokenHash: hashToken(token) }, false);
}

export async function acceptCollaborationInvitationById(actorUserId: string, invitationId: string) {
  return consumeCollaborationInvitation(actorUserId, { id: invitationId }, true);
}

async function consumeCollaborationInvitation(
  actorUserId: string,
  where: { tokenHash: string } | { id: string },
  requireVerifiedEmail: boolean,
) {
  return prisma.$transaction(async (transaction) => {
    const invitation = await transaction.collaborationInvitation.findUnique({
      where,
    });
    if (!isPending(invitation)) {
      throw new CollaborationInvitationError('The invitation is invalid or expired.', 'INVALID_INVITATION');
    }

    const user = await transaction.user.findUnique({
      where: { id: actorUserId },
      select: { id: true, email: true, fullName: true, status: true },
    });
    if (!user || user.status !== 'ACTIVE') {
      throw new CollaborationInvitationError('An active Studio account is required.', 'FORBIDDEN');
    }
    if (normalizeEmail(user.email) !== invitation.invitedEmail) {
      throw new CollaborationInvitationError('This invitation was sent to another e-mail address.', 'FORBIDDEN');
    }
    if (requireVerifiedEmail) {
      if (!(await hasVerifiedMailbox(actorUserId))) {
        throw new CollaborationInvitationError('Verify your e-mail address or accept using the invitation link sent to that address.', 'FORBIDDEN');
      }
    }

    const consumed = await transaction.collaborationInvitation.updateMany({
      where: {
        id: invitation.id,
        acceptedAt: null,
        declinedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { acceptedAt: new Date() },
    });
    if (consumed.count !== 1) {
      throw new CollaborationInvitationError('The invitation is invalid or expired.', 'INVALID_INVITATION');
    }

    const member = await transaction.collaborationMember.upsert({
      where: { documentId_userId: { documentId: invitation.documentId, userId: actorUserId } },
      create: {
        documentId: invitation.documentId,
        userId: actorUserId,
        role: invitation.role,
      },
      update: {
        role: invitation.role,
        acceptedAt: new Date(),
        revokedAt: null,
      },
    });
    await transaction.collaborationAuditEvent.create({
      data: {
        documentId: invitation.documentId,
        actorUserId,
        targetUserId: actorUserId,
        type: 'INVITATION_ACCEPTED',
        details: { role: member.role },
      },
    });
    return {
      documentId: invitation.documentId,
      userId: user.id,
      displayName: user.fullName,
      role: member.role,
      acceptedAt: member.acceptedAt.toISOString(),
    };
  });
}

export async function declineCollaborationInvitation(actorUserId: string, rawToken: string) {
  return closeCollaborationInvitation(actorUserId, rawToken, 'decline');
}

export async function declineCollaborationInvitationById(actorUserId: string, invitationId: string) {
  if (!invitationId.trim()) throw new CollaborationInvitationError('The invitation is invalid or expired.', 'INVALID_INVITATION');
  return closeCollaborationInvitationById(actorUserId, invitationId.trim());
}

export async function revokeCollaborationInvitation(actorUserId: string, documentId: string, invitationId: string) {
  const invitation = await prisma.collaborationInvitation.findUnique({
    where: { id: invitationId },
    select: { documentId: true, acceptedAt: true, declinedAt: true, revokedAt: true, expiresAt: true },
  });
  if (!invitation) throw new CollaborationInvitationError('The invitation was not found.', 'NOT_FOUND');
  if (invitation.documentId !== documentId) {
    throw new CollaborationInvitationError('The invitation was not found.', 'NOT_FOUND');
  }
  await requireInviteAuthority(invitation.documentId, actorUserId);
  if (invitation.acceptedAt || invitation.declinedAt || invitation.revokedAt || invitation.expiresAt <= new Date()) {
    throw new CollaborationInvitationError('Only a pending invitation can be revoked.', 'CONFLICT');
  }
  await prisma.$transaction(async (transaction) => {
    await transaction.collaborationInvitation.update({ where: { id: invitationId }, data: { revokedAt: new Date() } });
    await transaction.collaborationAuditEvent.create({
      data: { documentId: invitation.documentId, actorUserId, type: 'INVITATION_REVOKED' },
    });
  });
}

export async function revokeCollaborator(actorUserId: string, documentId: string, targetUserId: string) {
  const actor = await requireInviteAuthority(documentId, actorUserId);
  if (actor.role !== 'OWNER') {
    throw new CollaborationInvitationError('Only the document owner can remove a collaborator.', 'FORBIDDEN');
  }
  if (actorUserId === targetUserId) {
    throw new CollaborationInvitationError('Transfer ownership before leaving the collaboration.', 'CONFLICT');
  }
  const target = await prisma.collaborationMember.findUnique({
    where: { documentId_userId: { documentId, userId: targetUserId } },
    select: { id: true, role: true, revokedAt: true },
  });
  if (!target || target.revokedAt) throw new CollaborationInvitationError('The collaborator was not found.', 'NOT_FOUND');
  if (target.role === 'OWNER') throw new CollaborationInvitationError('The owner cannot be removed.', 'CONFLICT');
  await prisma.$transaction(async (transaction) => {
    await transaction.collaborationMember.update({ where: { id: target.id }, data: { revokedAt: new Date() } });
    await transaction.collaborationAuditEvent.create({
      data: {
        documentId,
        actorUserId,
        targetUserId,
        type: 'MEMBER_REVOKED',
        details: { role: target.role },
      },
    });
  });
  await revokeCollaborationConnectionTickets(documentId, targetUserId);
  closeCollaborationDocumentConnections(documentId);
}

export async function requireActiveMember(documentId: string, userId: string) {
  const member = await prisma.collaborationMember.findUnique({
    where: { documentId_userId: { documentId, userId } },
    select: { id: true, role: true, revokedAt: true },
  });
  if (!member || member.revokedAt) {
    throw new CollaborationInvitationError('You do not have access to this document.', 'FORBIDDEN');
  }
  return member;
}

async function requireInviteAuthority(documentId: string, userId: string) {
  const member = await requireActiveMember(documentId, userId);
  if (member.role !== 'OWNER' && member.role !== 'EDITOR' && member.role !== 'AUTHOR') {
    throw new CollaborationInvitationError('You do not have permission to invite collaborators.', 'FORBIDDEN');
  }
  return member;
}

async function closeCollaborationInvitation(
  actorUserId: string,
  rawToken: string,
  action: 'decline',
) {
  const token = validateToken(rawToken);
  if (!token) throw new CollaborationInvitationError('The invitation is invalid or expired.', 'INVALID_INVITATION');
  return prisma.$transaction(async (transaction) => {
    const invitation = await transaction.collaborationInvitation.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (!isPending(invitation)) {
      throw new CollaborationInvitationError('The invitation is invalid or expired.', 'INVALID_INVITATION');
    }
    const user = await transaction.user.findUnique({ where: { id: actorUserId }, select: { email: true, status: true } });
    if (!user || user.status !== 'ACTIVE' || normalizeEmail(user.email) !== invitation.invitedEmail) {
      throw new CollaborationInvitationError('This invitation was sent to another account.', 'FORBIDDEN');
    }
    if (!(await hasVerifiedMailbox(actorUserId))) {
      throw new CollaborationInvitationError('Verify your e-mail address or use the invitation link sent to that address.', 'FORBIDDEN');
    }
    const updated = await transaction.collaborationInvitation.updateMany({
      where: { id: invitation.id, acceptedAt: null, declinedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { declinedAt: new Date() },
    });
    if (updated.count !== 1) throw new CollaborationInvitationError('The invitation is invalid or expired.', 'INVALID_INVITATION');
    await transaction.collaborationAuditEvent.create({
      data: {
        documentId: invitation.documentId,
        actorUserId,
        type: 'INVITATION_DECLINED',
      },
    });
    return { status: action === 'decline' ? 'declined' as const : 'pending' as const };
  });
}

async function hasVerifiedMailbox(userId: string): Promise<boolean> {
  const identities = await identityPrisma.userIdentity.findMany({
    where: { userId },
    select: { profile: true },
  });
  return identities.some((identity) => {
    if (!identity.profile || typeof identity.profile !== 'object' || Array.isArray(identity.profile)) return false;
    const profile = identity.profile as Record<string, unknown>;
    return profile.emailVerified === true || profile.email_verified === true;
  });
}

async function closeCollaborationInvitationById(actorUserId: string, invitationId: string) {
  return prisma.$transaction(async (transaction) => {
    const invitation = await transaction.collaborationInvitation.findUnique({ where: { id: invitationId } });
    if (!isPending(invitation)) {
      throw new CollaborationInvitationError('The invitation is invalid or expired.', 'INVALID_INVITATION');
    }
    const user = await transaction.user.findUnique({ where: { id: actorUserId }, select: { email: true, status: true } });
    if (!user || user.status !== 'ACTIVE' || normalizeEmail(user.email) !== invitation.invitedEmail) {
      throw new CollaborationInvitationError('This invitation was sent to another account.', 'FORBIDDEN');
    }
    const updated = await transaction.collaborationInvitation.updateMany({
      where: { id: invitation.id, acceptedAt: null, declinedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { declinedAt: new Date() },
    });
    if (updated.count !== 1) throw new CollaborationInvitationError('The invitation is invalid or expired.', 'INVALID_INVITATION');
    await transaction.collaborationAuditEvent.create({
      data: { documentId: invitation.documentId, actorUserId, type: 'INVITATION_DECLINED' },
    });
    return { status: 'declined' as const };
  });
}

function isPending<T extends { acceptedAt: Date | null; declinedAt: Date | null; revokedAt: Date | null; expiresAt: Date } | null>(
  invitation: T,
): invitation is NonNullable<T> {
  return Boolean(
    invitation
    && !invitation.acceptedAt
    && !invitation.declinedAt
    && !invitation.revokedAt
    && invitation.expiresAt > new Date(),
  );
}

function validateToken(value: string): string | null {
  const token = value.trim();
  return TOKEN_PATTERN.test(token) ? token : null;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function isEmail(value: string): boolean {
  return value.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value);
}

async function sendInvitationMail(input: {
  to: string;
  documentTitle: string;
  role: CollaborationInviteRole;
  inviteUrl: string;
  expiresAt: Date;
}): Promise<void> {
  const role = input.role.toLowerCase();
  const subject = `Open Manuscript Studio manuscript invitation`;
  const body = [
    'You have been invited to collaborate on a manuscript in Open Manuscript Studio.',
    `Manuscript: ${input.documentTitle}`,
    `Role: ${role}`,
    '',
    'Sign in with the e-mail address that received this invitation, then accept it to access the manuscript.',
    '',
    input.inviteUrl,
    '',
    `This invitation expires on ${input.expiresAt.toISOString()}.`,
    '',
    'Open Manuscript Studio',
    'https://openmanuscript.org/',
  ].join('\n');
  const message = [
    `From: ${cleanHeader(env.MAIL_FROM)}`,
    `To: ${cleanHeader(input.to)}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    body,
    '',
  ].join('\r\n');

  await new Promise<void>((resolve, reject) => {
    const child = spawn(env.SENDMAIL_PATH, ['-i', '-t'], { stdio: ['pipe', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`sendmail exited with code ${code}: ${stderr.trim()}`));
    });
    child.stdin.end(message);
  });
}

function cleanHeader(value: string): string {
  return value.replace(/[\r\n]+/gu, ' ').trim();
}
