import { createHash, randomBytes } from 'node:crypto';

import { prisma } from '../lib/prisma.js';

export class CollaborationTicketError extends Error {
  constructor(message: string, readonly code: 'FORBIDDEN' | 'NOT_FOUND') {
    super(message);
    this.name = 'CollaborationTicketError';
  }
}

const TICKET_TTL_MS = 5 * 60 * 1000;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,128}$/u;

export async function issueCollaborationConnectionTicket(userId: string, documentId: string) {
  const member = await prisma.collaborationMember.findUnique({
    where: { documentId_userId: { documentId, userId } },
    select: { role: true, revokedAt: true },
  });
  if (!member || member.revokedAt) {
    throw new CollaborationTicketError('You do not have access to this document.', 'FORBIDDEN');
  }
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + TICKET_TTL_MS);

  await prisma.collaborationConnectionTicket.deleteMany({
    where: { OR: [{ expiresAt: { lte: new Date() } }, { revokedAt: { not: null } }] },
  });
  await prisma.collaborationConnectionTicket.create({
    data: { documentId, userId, tokenHash: hashToken(token), expiresAt },
  });

  return {
    token,
    documentId,
    role: member.role,
    expiresAt: expiresAt.toISOString(),
    webSocketPath: '/collaboration/ws',
  };
}

export async function authorizeCollaborationConnectionTicket(token: string, documentId: string) {
  if (!TOKEN_PATTERN.test(token)) return null;
  const ticket = await prisma.collaborationConnectionTicket.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true, documentId: true, expiresAt: true, revokedAt: true },
  });
  if (!ticket || ticket.documentId !== documentId || ticket.revokedAt || ticket.expiresAt <= new Date()) return null;

  const member = await prisma.collaborationMember.findUnique({
    where: { documentId_userId: { documentId, userId: ticket.userId } },
    select: { role: true, revokedAt: true },
  });
  if (!member || member.revokedAt) return null;
  return { userId: ticket.userId, role: member.role };
}

export async function revokeCollaborationConnectionTickets(documentId: string, userId: string) {
  await prisma.collaborationConnectionTicket.updateMany({
    where: { documentId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
