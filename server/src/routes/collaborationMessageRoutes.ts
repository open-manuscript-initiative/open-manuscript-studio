import { Router, type Response } from 'express';
import { z } from 'zod';

import { requireSession, type AuthenticatedRequest } from '../middleware/requireSession.js';
import { prisma } from '../lib/prisma.js';

export const collaborationMessageRouter = Router();

const messageSchema = z.object({
  body: z.string().trim().min(1).max(4000),
}).strict();

collaborationMessageRouter.get('/:documentId/messages', requireSession, async (request: AuthenticatedRequest, response) => {
  try {
    const userId = requireUserId(request);
    const documentId = parseDocumentId(request.params.documentId);
    await requireMembership(documentId, userId);
    const records = await prisma.collaborationMessage.findMany({
      where: { documentId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { sender: { select: { fullName: true } } },
    });
    response.setHeader('Cache-Control', 'no-store');
    response.status(200).json({
      messages: records.reverse().map((message) => ({
        id: message.id,
        senderUserId: message.senderUserId,
        senderName: message.sender?.fullName || message.senderName,
        body: message.body,
        createdAt: message.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    sendMessageError(response, error, 'COLLABORATION_MESSAGES_LOAD_FAILED');
  }
});

collaborationMessageRouter.post('/:documentId/messages', requireSession, async (request: AuthenticatedRequest, response) => {
  try {
    const userId = requireUserId(request);
    const documentId = parseDocumentId(request.params.documentId);
    await requireMembership(documentId, userId);
    const { body } = messageSchema.parse(request.body);
    const sender = await prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true, status: true },
    });
    if (!sender || sender.status !== 'ACTIVE') {
      response.status(403).json({ error: { code: 'FORBIDDEN', message: 'An active Studio account is required.' } });
      return;
    }
    const message = await prisma.collaborationMessage.create({
      data: { documentId, senderUserId: userId, senderName: sender.fullName, body },
    });
    response.setHeader('Cache-Control', 'no-store');
    response.status(201).json({
      message: {
        id: message.id,
        senderUserId: message.senderUserId,
        senderName: message.senderName,
        body: message.body,
        createdAt: message.createdAt.toISOString(),
      },
    });
  } catch (error) {
    sendMessageError(response, error, 'COLLABORATION_MESSAGE_SEND_FAILED');
  }
});

async function requireMembership(documentId: string, userId: string): Promise<void> {
  const membership = await prisma.collaborationMember.findFirst({
    where: { documentId, userId, revokedAt: null },
    select: { id: true },
  });
  if (!membership) {
    const error = new Error('You do not have access to this manuscript conversation.');
    error.name = 'CollaborationMessageForbiddenError';
    throw error;
  }
}

function requireUserId(request: AuthenticatedRequest): string {
  if (!request.authUserId) {
    const error = new Error('Authentication is required.');
    error.name = 'AuthenticationError';
    throw error;
  }
  return request.authUserId;
}

function parseDocumentId(value: string | string[] | undefined): string {
  const id = Array.isArray(value) ? value[0] : value;
  if (!id?.trim() || id.trim().length > 128) throw new TypeError('A valid document identifier is required.');
  return id.trim();
}

function sendMessageError(response: Response, error: unknown, fallbackCode: string): void {
  if (error instanceof z.ZodError || error instanceof TypeError) {
    response.status(400).json({ error: { code: 'INVALID_REQUEST', message: error.message } });
    return;
  }
  if (error instanceof Error && error.name === 'AuthenticationError') {
    response.status(401).json({ error: { code: 'NOT_AUTHENTICATED', message: error.message } });
    return;
  }
  if (error instanceof Error && error.name === 'CollaborationMessageForbiddenError') {
    response.status(403).json({ error: { code: 'FORBIDDEN', message: error.message } });
    return;
  }
  console.error('[OMI collaboration chat] ' + fallbackCode, error);
  response.status(500).json({ error: { code: fallbackCode, message: 'The collaboration chat request failed.' } });
}
