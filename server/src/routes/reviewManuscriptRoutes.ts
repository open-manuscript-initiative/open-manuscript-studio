import { Router, type Response } from 'express';
import { z } from 'zod';

import {
  requireSession,
  type AuthenticatedRequest,
} from '../middleware/requireSession.js';
import {
  getReviewManuscriptForReviewer,
  setReviewManuscript,
} from '../services/reviewManuscriptService.js';

export const reviewManuscriptRouter = Router();

reviewManuscriptRouter.use(requireSession);

const blockSchema = z.object({
  type: z.enum(['heading', 'paragraph', 'note']).default('paragraph'),
  text: z.string().min(1).max(200_000),
  level: z.number().int().min(1).max(6).optional(),
});

const manuscriptSchema = z.object({
  title: z.string().min(1).max(500),
  subtitle: z.string().max(500).optional(),
  abstract: z.string().max(20_000).optional(),
  keywords: z.array(z.string().max(200)).max(100).default([]),
  blocks: z.array(blockSchema).max(20_000).default([]),
}).strip();

reviewManuscriptRouter.put(
  '/assignments/:assignmentId/manuscript',
  async (request: AuthenticatedRequest, response) => {
    try {
      const userId = requireUserId(request);
      const assignmentId = parseId(request.params.assignmentId);
      const manuscript = manuscriptSchema.parse(request.body);
      const stored = await setReviewManuscript(userId, assignmentId, manuscript);
      response.status(200).json({ manuscript: stored });
    } catch (error) {
      sendError(response, error, 'REVIEW_MANUSCRIPT_UPDATE_FAILED');
    }
  },
);

reviewManuscriptRouter.get(
  '/assigned/:assignmentId/manuscript',
  async (request: AuthenticatedRequest, response) => {
    try {
      const userId = requireUserId(request);
      const assignmentId = parseId(request.params.assignmentId);
      const manuscript = await getReviewManuscriptForReviewer(userId, assignmentId);
      response.status(200).json({ manuscript });
    } catch (error) {
      sendError(response, error, 'REVIEW_MANUSCRIPT_LOAD_FAILED');
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

function parseId(value: string | string[] | undefined): string {
  const id = Array.isArray(value) ? value[0] : value;
  if (!id?.trim()) throw new Error('The review assignment identifier is required.');
  return id.trim();
}

function sendError(response: Response, error: unknown, fallbackCode: string): void {
  const message = error instanceof Error ? error.message : 'Review manuscript request failed.';
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
