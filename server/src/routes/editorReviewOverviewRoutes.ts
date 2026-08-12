import { Router, type Response } from 'express';

import { prisma } from '../lib/prisma.js';
import {
  requireSession,
  type AuthenticatedRequest,
} from '../middleware/requireSession.js';

export const editorReviewOverviewRouter = Router();

editorReviewOverviewRouter.use(requireSession);

editorReviewOverviewRouter.get('/editor/overview', async (request: AuthenticatedRequest, response) => {
  try {
    const userId = requireUserId(request);

    const editorAccess = await prisma.reviewWorkspaceAccess.findMany({
      where: { userId, role: 'EDITOR' },
      select: { workspaceId: true, manuscriptId: true },
    });

    const workspaceIds = Array.from(new Set(editorAccess.map((item) => item.workspaceId)));
    if (!workspaceIds.length) {
      response.status(200).json({ reviews: [] });
      return;
    }

    const [assignments, authorAccess] = await Promise.all([
      prisma.peerReviewAssignment.findMany({
        where: { workspaceId: { in: workspaceIds } },
        include: {
          reviewer: {
            select: {
              id: true,
              email: true,
              fullName: true,
              affiliation: true,
              orcid: true,
            },
          },
          feedback: { orderBy: { createdAt: 'asc' } },
        },
        orderBy: [
          { reviewRound: 'desc' },
          { assignmentType: 'asc' },
          { invitedAt: 'asc' },
        ],
      }),
      prisma.reviewWorkspaceAccess.findMany({
        where: { workspaceId: { in: workspaceIds }, role: 'AUTHOR' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
              affiliation: true,
              affiliationRorId: true,
              orcid: true,
            },
          },
        },
      }),
    ]);

    const authorsByWorkspace = new Map<string, typeof authorAccess>();
    for (const access of authorAccess) {
      const list = authorsByWorkspace.get(access.workspaceId) ?? [];
      list.push(access);
      authorsByWorkspace.set(access.workspaceId, list);
    }

    const reviews = assignments.map((assignment) => ({
      id: assignment.id,
      workspaceId: assignment.workspaceId,
      manuscriptId: assignment.manuscriptId,
      reviewerAlias: assignment.reviewerAlias,
      assignmentType: assignment.assignmentType.toLowerCase(),
      sourceLanguage: assignment.sourceLanguage,
      targetLanguage: assignment.targetLanguage,
      reviewRound: assignment.reviewRound,
      anonymityMode: assignment.anonymityMode.toLowerCase(),
      status: assignment.status.toLowerCase(),
      recommendation: assignment.recommendation?.toLowerCase() ?? null,
      reviewer: {
        userId: assignment.reviewer.id,
        email: assignment.reviewer.email,
        fullName: assignment.reviewer.fullName,
        affiliation: assignment.reviewer.affiliation,
        orcid: assignment.reviewer.orcid,
      },
      authors: (authorsByWorkspace.get(assignment.workspaceId) ?? [])
        .filter((access) => access.manuscriptId === assignment.manuscriptId)
        .map((access) => ({
          userId: access.user.id,
          email: access.user.email,
          fullName: access.user.fullName,
          affiliation: access.user.affiliation,
          affiliationRorId: access.user.affiliationRorId,
          orcid: access.user.orcid,
        })),
      feedback: assignment.feedback.map((item) => ({
        id: item.id,
        visibility: item.visibility.toLowerCase(),
        body: item.body,
        createdAt: item.createdAt.toISOString(),
      })),
      invitedAt: assignment.invitedAt.toISOString(),
      acceptedAt: assignment.acceptedAt?.toISOString() ?? null,
      submittedAt: assignment.submittedAt?.toISOString() ?? null,
      completedAt: assignment.completedAt?.toISOString() ?? null,
    }));

    response.status(200).json({ reviews });
  } catch (error) {
    sendError(response, error);
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

function sendError(response: Response, error: unknown): void {
  const message = error instanceof Error ? error.message : 'Unable to load editorial assignment overview.';
  const name = error instanceof Error ? error.name : '';
  if (name === 'AuthenticationError') {
    response.status(401).json({ error: { code: 'NOT_AUTHENTICATED', message } });
    return;
  }
  response.status(400).json({ error: { code: 'EDITOR_REVIEW_OVERVIEW_FAILED', message } });
}
