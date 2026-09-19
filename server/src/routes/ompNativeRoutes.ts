import { Router, type Response } from 'express';
import { z } from 'zod';

import { writeOmpAuthorRevision } from '../integrations/omp/nativeWriteback.js';
import {
  requireSession,
  type AuthenticatedRequest,
} from '../middleware/requireSession.js';

export const ompNativeRouter = Router();

const authorRevisionSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  mediaType: z.string().trim().min(1).max(128),
  contentBase64: z.string().min(1).max(35_000_000),
  summaryOfChanges: z.string().trim().max(100_000).optional(),
});

ompNativeRouter.post(
  '/author/:contextId/revision',
  requireSession,
  async (request: AuthenticatedRequest, response) => {
    try {
      if (!request.authUserId) {
        const error = new Error('Authentication is required.');
        error.name = 'AuthenticationError';
        throw error;
      }
      const contextId = parseUuid(request.params.contextId);
      const input = authorRevisionSchema.parse(request.body ?? {});
      const result = await writeOmpAuthorRevision(
        contextId,
        request.authUserId,
        {
          fileName: input.fileName,
          mediaType: input.mediaType,
          contentBase64: input.contentBase64,
          ...(input.summaryOfChanges !== undefined
            ? { summaryOfChanges: input.summaryOfChanges }
            : {}),
        },
      );
      response.status(200).json(result);
    } catch (error) {
      sendError(response, error);
    }
  },
);

function parseUuid(value: string | string[] | undefined): string {
  const id = Array.isArray(value) ? value[0] : value;
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error('A valid OMP native workflow context identifier is required.');
  }
  return id;
}

function sendError(response: Response, error: unknown): void {
  const message = error instanceof Error
    ? error.message
    : 'OMP native workflow request failed.';
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

  response.status(400).json({
    error: { code: 'OMP_NATIVE_WRITE_FAILED', message },
  });
}
