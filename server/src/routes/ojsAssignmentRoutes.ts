import { createHash } from 'node:crypto';

import { Router, type Response } from 'express';
import { z } from 'zod';

import { verifyOjsAssignmentGrant } from '../integrations/ojs/ojsAssignmentGrant.js';
import { prisma } from '../lib/prisma.js';
import {
  requireSession,
  type AuthenticatedRequest,
} from '../middleware/requireSession.js';
import { sanitizeReviewManuscript } from '../services/reviewManuscriptService.js';

export const ojsAssignmentRouter = Router();

ojsAssignmentRouter.use(requireSession);

const createSchema = z.object({
  grant: z.string().min(20),
  reviewerEmail: z.string().email(),
  assignmentType: z.enum(['SCIENTIFIC_REVIEW', 'LANGUAGE_REVIEW', 'TRANSLATION']),
  sourceLanguage: z.string().trim().min(2).max(32).optional(),
  targetLanguage: z.string().trim().min(2).max(32).optional(),
  manuscript: z.unknown(),
});

ojsAssignmentRouter.get('/ojs/assignments', async (request: AuthenticatedRequest, response) => {
  try {
    const grant = typeof request.query.grant === 'string' ? request.query.grant : '';
    const context = await authorizeGrant(request, grant);
    const workspaceId = workspaceIdFor(context.installationId, context.contextId);

    const assignments = await prisma.peerReviewAssignment.findMany({
      where: {
        workspaceId,
        manuscriptId: context.manuscriptId,
        ...(context.actorMode === 'author'
          ? { assignmentType: { in: ['LANGUAGE_REVIEW', 'TRANSLATION'] as const } }
          : {}),
      },
      include: {
        reviewer: {
          select: { id: true, email: true, fullName: true, affiliation: true, orcid: true },
        },
      },
      orderBy: [{ assignmentType: 'asc' }, { invitedAt: 'asc' }],
    });

    response.status(200).json({
      actorMode: context.actorMode,
      assignments: assignments.map((assignment) => ({
        id: assignment.id,
        assignmentType: assignment.assignmentType.toLowerCase(),
        status: assignment.status.toLowerCase(),
        reviewerAlias: assignment.reviewerAlias,
        sourceLanguage: assignment.sourceLanguage,
        targetLanguage: assignment.targetLanguage,
        invitedAt: assignment.invitedAt.toISOString(),
        reviewer: context.actorMode === 'editor' || assignment.assignmentType !== 'SCIENTIFIC_REVIEW'
          ? {
              userId: assignment.reviewer.id,
              email: assignment.reviewer.email,
              fullName: assignment.reviewer.fullName,
              affiliation: assignment.reviewer.affiliation,
              orcid: assignment.reviewer.orcid,
            }
          : null,
      })),
    });
  } catch (error) {
    sendError(response, error, 'OJS_ASSIGNMENT_LIST_FAILED');
  }
});

ojsAssignmentRouter.post('/ojs/assignments', async (request: AuthenticatedRequest, response) => {
  try {
    const parsed = createSchema.parse(request.body);
    const context = await authorizeGrant(request, parsed.grant);
    if (context.actorMode !== 'editor') throw forbidden('Only an editor can create assignments.');

    if (parsed.assignmentType === 'TRANSLATION') {
      if (!parsed.sourceLanguage || !parsed.targetLanguage) {
        throw new Error('Translation assignments require source and target languages.');
      }
      if (parsed.sourceLanguage.toLowerCase() === parsed.targetLanguage.toLowerCase()) {
        throw new Error('Translation source and target languages must be different.');
      }
    }

    const reviewer = await prisma.user.findUnique({
      where: { email: parsed.reviewerEmail.trim().toLowerCase() },
      select: { id: true, status: true },
    });
    if (!reviewer || reviewer.status !== 'ACTIVE') {
      throw new Error('The selected OJS participant must have an active Studio account with the same email address.');
    }

    const workspaceId = workspaceIdFor(context.installationId, context.contextId);
    const aliasBase = parsed.assignmentType === 'SCIENTIFIC_REVIEW'
      ? 'Reviewer'
      : parsed.assignmentType === 'LANGUAGE_REVIEW'
        ? 'Language reviewer'
        : 'Translator';
    const sequence = await prisma.peerReviewAssignment.count({
      where: { workspaceId, manuscriptId: context.manuscriptId, assignmentType: parsed.assignmentType },
    });
    const manuscript = sanitizeReviewManuscript(parsed.manuscript);

    const assignment = await prisma.peerReviewAssignment.create({
      data: {
        workspaceId,
        manuscriptId: context.manuscriptId,
        reviewerUserId: reviewer.id,
        assignedByUserId: request.authUserId ?? null,
        reviewerAlias: `${aliasBase} ${sequence + 1}`,
        assignmentType: parsed.assignmentType,
        sourceLanguage: parsed.sourceLanguage?.trim() || null,
        targetLanguage: parsed.targetLanguage?.trim() || null,
        reviewRound: 1,
        anonymityMode: parsed.assignmentType === 'SCIENTIFIC_REVIEW' ? 'DOUBLE_BLIND' : 'OPEN',
        status: 'INVITED',
        manuscriptSnapshot: manuscript,
      },
      include: {
        reviewer: {
          select: { id: true, email: true, fullName: true, affiliation: true, orcid: true },
        },
      },
    });

    response.status(201).json({
      assignment: {
        id: assignment.id,
        assignmentType: assignment.assignmentType.toLowerCase(),
        status: assignment.status.toLowerCase(),
        reviewerAlias: assignment.reviewerAlias,
        sourceLanguage: assignment.sourceLanguage,
        targetLanguage: assignment.targetLanguage,
        reviewer: {
          userId: assignment.reviewer.id,
          email: assignment.reviewer.email,
          fullName: assignment.reviewer.fullName,
          affiliation: assignment.reviewer.affiliation,
          orcid: assignment.reviewer.orcid,
        },
      },
    });
  } catch (error) {
    sendError(response, error, 'OJS_ASSIGNMENT_CREATE_FAILED');
  }
});

async function authorizeGrant(request: AuthenticatedRequest, token: string) {
  if (!request.authUserId) throw forbidden('Authentication is required.');
  const grant = verifyOjsAssignmentGrant(token);
  const user = await prisma.user.findUnique({
    where: { id: request.authUserId },
    select: { email: true, status: true },
  });
  if (!user || user.status !== 'ACTIVE' || user.email.toLowerCase() !== grant.actorEmail) {
    throw forbidden('The OJS assignment grant belongs to a different Studio account.');
  }
  return grant;
}

function workspaceIdFor(installationId: string, contextId: string): string {
  return `ojs:${createHash('sha256')
    .update(`${installationId}:${contextId}`)
    .digest('hex')
    .slice(0, 40)}`;
}

function forbidden(message: string): Error {
  const error = new Error(message);
  error.name = 'ForbiddenError';
  return error;
}

function sendError(response: Response, error: unknown, fallbackCode: string): void {
  const message = error instanceof Error ? error.message : 'OJS assignment request failed.';
  const name = error instanceof Error ? error.name : '';
  if (error instanceof z.ZodError) {
    response.status(400).json({ error: { code: 'INVALID_REQUEST', message } });
    return;
  }
  if (name === 'ForbiddenError') {
    response.status(403).json({ error: { code: 'FORBIDDEN', message } });
    return;
  }
  if (name === 'PrismaClientKnownRequestError') {
    response.status(409).json({ error: { code: 'ASSIGNMENT_CONFLICT', message } });
    return;
  }
  response.status(400).json({ error: { code: fallbackCode, message } });
}
