import { Router, type Response } from 'express';
import { z } from 'zod';

import {
  acceptCollaborationInvitation,
  acceptCollaborationInvitationById,
  CollaborationInvitationError,
  createCollaborativeDocument,
  declineCollaborationInvitation,
  declineCollaborationInvitationById,
  inspectCollaborationInvitation,
  inviteCollaborator,
  listPendingCollaborationInvitations,
  listCollaborativeDocumentAccess,
  revokeCollaborator,
  revokeCollaborationInvitation,
} from '../services/collaborationInvitationService.js';
import { requireSession, type AuthenticatedRequest } from '../middleware/requireSession.js';
import {
  CollaborationTicketError,
  issueCollaborationConnectionTicket,
} from '../services/collaborationTicketService.js';

export const collaborationRouter = Router();

const documentSchema = z.object({
  documentId: z.string().trim().min(1).max(128),
  title: z.string().trim().min(1).max(500),
  initialState: z.string().max(11_184_812).optional(),
}).strict();

const inviteSchema = z.object({
  email: z.string().trim().email().max(320),
  role: z.enum(['EDITOR', 'AUTHOR', 'VIEWER']),
}).strict();

collaborationRouter.post('/documents', requireSession, async (request: AuthenticatedRequest, response) => {
  try {
    const document = await createCollaborativeDocument(requireUserId(request), documentSchema.parse(request.body));
    response.status(201).json({ document: { id: document.id, title: document.title, createdAt: document.createdAt.toISOString() } });
  } catch (error) {
    sendError(response, error, 'COLLABORATION_DOCUMENT_CREATE_FAILED');
  }
});

collaborationRouter.get('/documents/:documentId/access', requireSession, async (request: AuthenticatedRequest, response) => {
  try {
    const access = await listCollaborativeDocumentAccess(
      requireUserId(request),
      parseId(request.params.documentId, 'document'),
    );
    response.setHeader('Cache-Control', 'no-store');
    response.status(200).json(access);
  } catch (error) {
    sendError(response, error, 'COLLABORATION_ACCESS_LOAD_FAILED');
  }
});

collaborationRouter.post('/documents/:documentId/connection-ticket', requireSession, async (request: AuthenticatedRequest, response) => {
  try {
    const ticket = await issueCollaborationConnectionTicket(
      requireUserId(request),
      parseId(request.params.documentId, 'document'),
    );
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Pragma', 'no-cache');
    response.status(201).json({ ticket });
  } catch (error) {
    sendError(response, error, 'COLLABORATION_TICKET_CREATE_FAILED');
  }
});

collaborationRouter.post('/documents/:documentId/invitations', requireSession, async (request: AuthenticatedRequest, response) => {
  try {
    const invitation = await inviteCollaborator(requireUserId(request), {
      documentId: parseId(request.params.documentId, 'document'),
      ...inviteSchema.parse(request.body),
    });
    response.status(201).json({ invitation });
  } catch (error) {
    sendError(response, error, 'COLLABORATION_INVITATION_CREATE_FAILED');
  }
});

collaborationRouter.delete('/documents/:documentId/invitations/:invitationId', requireSession, async (request: AuthenticatedRequest, response) => {
  try {
    await revokeCollaborationInvitation(
      requireUserId(request),
      parseId(request.params.documentId, 'document'),
      parseId(request.params.invitationId, 'invitation'),
    );
    response.status(204).end();
  } catch (error) {
    sendError(response, error, 'COLLABORATION_INVITATION_REVOKE_FAILED');
  }
});

collaborationRouter.delete('/documents/:documentId/members/:userId', requireSession, async (request: AuthenticatedRequest, response) => {
  try {
    await revokeCollaborator(
      requireUserId(request),
      parseId(request.params.documentId, 'document'),
      parseId(request.params.userId, 'user'),
    );
    response.status(204).end();
  } catch (error) {
    sendError(response, error, 'COLLABORATION_MEMBER_REVOKE_FAILED');
  }
});

collaborationRouter.get('/invitations/pending', requireSession, async (request: AuthenticatedRequest, response) => {
  try {
    const invitations = await listPendingCollaborationInvitations(requireUserId(request));
    response.setHeader('Cache-Control', 'no-store');
    response.status(200).json({ invitations });
  } catch (error) {
    sendError(response, error, 'COLLABORATION_PENDING_INVITATIONS_LOAD_FAILED');
  }
});

collaborationRouter.get('/invitations/:token', async (request, response) => {
  try {
    const invitation = await inspectCollaborationInvitation(parseId(request.params.token, 'invitation token'));
    response.setHeader('Cache-Control', 'no-store');
    if (!invitation) {
      response.status(404).json({ error: { code: 'INVALID_INVITATION', message: 'The invitation is invalid or expired.' } });
      return;
    }
    response.status(200).json({ invitation });
  } catch (error) {
    sendError(response, error, 'COLLABORATION_INVITATION_LOAD_FAILED');
  }
});

collaborationRouter.post('/invitations/:token/accept', requireSession, async (request: AuthenticatedRequest, response) => {
  try {
    const membership = await acceptCollaborationInvitation(
      requireUserId(request),
      parseId(request.params.token, 'invitation token'),
    );
    response.status(200).json({ membership });
  } catch (error) {
    sendError(response, error, 'COLLABORATION_INVITATION_ACCEPT_FAILED');
  }
});

collaborationRouter.post('/invitations/:token/decline', requireSession, async (request: AuthenticatedRequest, response) => {
  try {
    const result = await declineCollaborationInvitation(
      requireUserId(request),
      parseId(request.params.token, 'invitation token'),
    );
    response.status(200).json(result);
  } catch (error) {
    sendError(response, error, 'COLLABORATION_INVITATION_DECLINE_FAILED');
  }
});

collaborationRouter.post('/invitations/by-id/:invitationId/accept', requireSession, async (request: AuthenticatedRequest, response) => {
  try {
    const membership = await acceptCollaborationInvitationById(
      requireUserId(request),
      parseId(request.params.invitationId, 'invitation'),
    );
    response.status(200).json({ membership });
  } catch (error) {
    sendError(response, error, 'COLLABORATION_INVITATION_ACCEPT_FAILED');
  }
});

collaborationRouter.post('/invitations/by-id/:invitationId/decline', requireSession, async (request: AuthenticatedRequest, response) => {
  try {
    const result = await declineCollaborationInvitationById(
      requireUserId(request),
      parseId(request.params.invitationId, 'invitation'),
    );
    response.status(200).json(result);
  } catch (error) {
    sendError(response, error, 'COLLABORATION_INVITATION_DECLINE_FAILED');
  }
});

function requireUserId(request: AuthenticatedRequest): string {
  if (!request.authUserId) {
    const error = new Error('Authentication is required.');
    error.name = 'AuthenticationError';
    throw error;
  }
  return request.authUserId;
}

function parseId(value: string | string[] | undefined, label: string): string {
  const id = Array.isArray(value) ? value[0] : value;
  if (!id?.trim()) throw new TypeError(`The ${label} identifier is required.`);
  return id.trim();
}

function sendError(response: Response, error: unknown, fallbackCode: string): void {
  if (error instanceof CollaborationInvitationError) {
    const status = error.code === 'NOT_FOUND' ? 404
      : error.code === 'FORBIDDEN' ? 403
        : error.code === 'CONFLICT' ? 409
          : error.code === 'MAIL_DELIVERY_FAILED' ? 503
            : 400;
    response.status(status).json({ error: { code: error.code, message: error.message } });
    return;
  }
  if (error instanceof CollaborationTicketError) {
    response.status(error.code === 'NOT_FOUND' ? 404 : 403).json({ error: { code: error.code, message: error.message } });
    return;
  }
  if (error instanceof z.ZodError || error instanceof TypeError) {
    const message = error instanceof Error ? error.message : 'Invalid request.';
    response.status(400).json({ error: { code: 'INVALID_REQUEST', message } });
    return;
  }
  if (error instanceof Error && error.name === 'AuthenticationError') {
    response.status(401).json({ error: { code: 'NOT_AUTHENTICATED', message: error.message } });
    return;
  }
  console.error(`[OMI collaboration] ${fallbackCode}`, error);
  response.status(500).json({ error: { code: fallbackCode, message: 'The collaboration request failed.' } });
}
