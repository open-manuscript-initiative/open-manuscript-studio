import { Router } from 'express';
import { z } from 'zod';

import { checkProofreading } from '../services/proofreadingService.js';
import {
  requireSession,
  type AuthenticatedRequest,
} from '../middleware/requireSession.js';

export const proofreadingRouter = Router();

const proofreadingSchema = z.object({
  language: z.string().trim().min(2).max(32),
  text: z.string().min(1).max(20_000),
  blockId: z.string().trim().min(1).max(256).optional(),
});

proofreadingRouter.post(
  '/integrations/proofreading/check',
  requireSession,
  async (request: AuthenticatedRequest, response) => {
    const input = proofreadingSchema.safeParse(request.body);
    if (!input.success) {
      response.status(400).json({
        error: {
          code: 'INVALID_PROOFREADING_REQUEST',
          message: 'The proofreading request is invalid.',
          fields: input.error.flatten().fieldErrors,
        },
      });
      return;
    }

    try {
      const result = await checkProofreading(request.authUserId!, input.data);
      response.status(200).json(result);
    } catch (error) {
      response.status(400).json({
        error: {
          code: 'PROOFREADING_FAILED',
          message: error instanceof Error ? error.message : 'Proofreading failed.',
        },
      });
    }
  },
);
