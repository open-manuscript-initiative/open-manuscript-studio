import { Router, type Response } from 'express';
import { z } from 'zod';

import {
  requireSession,
  type AuthenticatedRequest,
} from '../middleware/requireSession.js';
import {
  acceptReview,
  addReviewFeedback,
  completeReview,
  createReviewAssignment,
  declineReview,
  getReviewerAssignment,
  listAuthorReviews,
  listEditorReviews,
  listReviewerAssignments,
  submitReview,
} from '../services/peerReviewService.js';

export const peerReviewRouter = Router();

peerReviewRouter.use(requireSession);

const assignmentTypeSchema = z.enum([
  'SCIENTIFIC_REVIEW',
  'LANGUAGE_REVIEW',
  'TRANSLATION',
  'EDITORIAL_REVISION',
]);

const anonymityModeSchema = z.enum([
  'DOUBLE_BLIND',
  'SINGLE_BLIND',
  'OPEN',
]);

const languageSchema = z.string().trim().min(2).max(32);

const createAssignmentSchema = z.object({
  manuscriptId: z.string().min(1).max(128),
  reviewerEmail: z.string().email(),
  reviewRound: z.number().int().min(1).max(99).default(1),
  assignmentType: assignmentTypeSchema.default('SCIENTIFIC_REVIEW'),
  sourceLanguage: languageSchema.optional(),
  targetLanguage: languageSchema.optional(),
  anonymityMode: anonymityModeSchema.optional(),
});

const feedbackSchema = z.object({
  visibility: z.enum(['AUTHOR_AND_EDITOR', 'EDITOR_ONLY']),
  body: z.string().trim().min(1).max(100_000),
});

const submitSchema = z.object({
  recommendation: z.enum([
    'ACCEPT',
    'MINOR_REVISION',
    'MAJOR_REVISION',
    'REJECT',
  ]).optional(),
});

peerReviewRouter.post(
  '/workspaces/:workspaceId/assignments',
  async (request: AuthenticatedRequest, response) => {
    try {
      const userId = requireUserId(request);
      const workspaceId = parseId(request.params.workspaceId, 'workspace');
      const parsed = createAssignmentSchema.parse(request.body);
      const review = await createReviewAssignment(userId, {
        workspaceId,
        manuscriptId: parsed.manuscriptId,
        reviewerEmail: parsed.reviewerEmail,
        reviewRound: parsed.reviewRound,
        assignmentType: parsed.assignmentType,
        ...(parsed.sourceLanguage !== undefined ? { sourceLanguage: parsed.sourceLanguage } : {}),
        ...(parsed.targetLanguage !== undefined ? { targetLanguage: parsed.targetLanguage } : {}),
        ...(parsed.anonymityMode !== undefined ? { anonymityMode: parsed.anonymityMode } : {}),
      });
      response.status(201).json({ review });
    } catch (error) {
      sendError(response, error, 'REVIEW_ASSIGNMENT_FAILED');
    }
  },
);

peerReviewRouter.get(
  '/workspaces/:workspaceId/assignments',
  async (request: AuthenticatedRequest, response) => {
    try {
      const reviews = await listEditorReviews(
        requireUserId(request),
        parseId(request.params.workspaceId, 'workspace'),
      );
      response.status(200).json({ reviews });
    } catch (error) {
      sendError(response, error, 'REVIEW_LIST_FAILED');
    }
  },
);

peerReviewRouter.get(
  '/workspaces/:workspaceId/author',
  async (request: AuthenticatedRequest, response) => {
    try {
      const reviews = await listAuthorReviews(
        requireUserId(request),
        parseId(request.params.workspaceId, 'workspace'),
      );
      response.status(200).json({ reviews });
    } catch (error) {
      sendError(response, error, 'AUTHOR_REVIEW_LIST_FAILED');
    }
  },
);

peerReviewRouter.get(
  '/assigned',
  async (request: AuthenticatedRequest, response) => {
    try {
      const reviews = await listReviewerAssignments(requireUserId(request));
      response.status(200).json({ reviews });
    } catch (error) {
      sendError(response, error, 'REVIEWER_REVIEW_LIST_FAILED');
    }
  },
);

peerReviewRouter.get(
  '/assigned/:assignmentId',
  async (request: AuthenticatedRequest, response) => {
    try {
      const review = await getReviewerAssignment(
        requireUserId(request),
        parseId(request.params.assignmentId, 'review assignment'),
      );
      response.status(200).json({ review });
    } catch (error) {
      sendError(response, error, 'REVIEW_NOT_FOUND');
    }
  },
);

peerReviewRouter.post(
  '/assigned/:assignmentId/accept',
  async (request: AuthenticatedRequest, response) => {
    try {
      const review = await acceptReview(
        requireUserId(request),
        parseId(request.params.assignmentId, 'review assignment'),
      );
      response.status(200).json({ review });
    } catch (error) {
      sendError(response, error, 'REVIEW_ACCEPT_FAILED');
    }
  },
);

peerReviewRouter.post(
  '/assigned/:assignmentId/decline',
  async (request: AuthenticatedRequest, response) => {
    try {
      const review = await declineReview(
        requireUserId(request),
        parseId(request.params.assignmentId, 'review assignment'),
      );
      response.status(200).json({ review });
    } catch (error) {
      sendError(response, error, 'REVIEW_DECLINE_FAILED');
    }
  },
);

peerReviewRouter.post(
  '/assigned/:assignmentId/feedback',
  async (request: AuthenticatedRequest, response) => {
    try {
      const parsed = feedbackSchema.parse(request.body);
      const review = await addReviewFeedback(
        requireUserId(request),
        parseId(request.params.assignmentId, 'review assignment'),
        parsed.visibility,
        parsed.body,
      );
      response.status(201).json({ review });
    } catch (error) {
      sendError(response, error, 'REVIEW_FEEDBACK_FAILED');
    }
  },
);

peerReviewRouter.post(
  '/assigned/:assignmentId/submit',
  async (request: AuthenticatedRequest, response) => {
    try {
      const parsed = submitSchema.parse(request.body ?? {});
      const review = parsed.recommendation === undefined
        ? await submitReview(
            requireUserId(request),
            parseId(request.params.assignmentId, 'review assignment'),
          )
        : await submitReview(
            requireUserId(request),
            parseId(request.params.assignmentId, 'review assignment'),
            parsed.recommendation,
          );
      response.status(200).json({ review });
    } catch (error) {
      sendError(response, error, 'REVIEW_SUBMIT_FAILED');
    }
  },
);

peerReviewRouter.post(
  '/assignments/:assignmentId/complete',
  async (request: AuthenticatedRequest, response) => {
    try {
      const review = await completeReview(
        requireUserId(request),
        parseId(request.params.assignmentId, 'review assignment'),
      );
      response.status(200).json({ review });
    } catch (error) {
      sendError(response, error, 'REVIEW_COMPLETE_FAILED');
    }
  },
);

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
  if (!id?.trim()) throw new Error(`The ${label} identifier is required.`);
  return id.trim();
}

function sendError(response: Response, error: unknown, fallbackCode: string): void {
  const message = error instanceof Error ? error.message : 'Editorial workflow request failed.';
  const name = error instanceof Error ? error.name : '';

  if (error instanceof z.ZodError) {
    response.status(400).json({ error: { code: 'INVALID_REQUEST', message } });
    return;
  }
  if (name === 'AuthenticationError') {
    response.status(401).json({ error: { code: 'NOT_AUTHENTICATED', message } });
    return;
  }
  if (name === 'ForbiddenError') {
    response.status(403).json({ error: { code: 'FORBIDDEN', message } });
    return;
  }
  if (name === 'NotFoundError') {
    response.status(404).json({ error: { code: 'REVIEW_NOT_FOUND', message } });
    return;
  }

  response.status(400).json({ error: { code: fallbackCode, message } });
}
