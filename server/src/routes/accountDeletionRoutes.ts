import { Router } from 'express';
import { z } from 'zod';

import {
  requireSession,
  type AuthenticatedRequest,
} from '../middleware/requireSession.js';
import {
  AccountDeletionBlockedError,
  deleteStudioAccount,
} from '../services/accountDeletionService.js';

export const accountDeletionRouter = Router();

const deletionSchema = z.object({
  confirmationEmail: z.string().email().max(320),
});

accountDeletionRouter.delete(
  '/account',
  requireSession,
  async (request: AuthenticatedRequest, response) => {
    const parsed = deletionSchema.safeParse(request.body);
    if (!parsed.success || !request.authUserId) {
      response.status(400).json({
        error: {
          code: 'INVALID_ACCOUNT_DELETION_REQUEST',
          message: 'Enter the current account e-mail address to confirm deletion.',
        },
      });
      return;
    }

    try {
      await deleteStudioAccount(
        request.authUserId,
        parsed.data.confirmationEmail,
      );
      response.clearCookie('omi_session', {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
      });
      response.status(204).end();
    } catch (error) {
      if (error instanceof AccountDeletionBlockedError) {
        response.status(409).json({
          error: {
            code: 'ACCOUNT_DELETION_BLOCKED',
            message: error.message,
          },
        });
        return;
      }

      console.error('[OMI account deletion] failed', error);
      response.status(500).json({
        error: {
          code: 'ACCOUNT_DELETION_FAILED',
          message: 'The account could not be deleted. Please try again or contact the Studio operator.',
        },
      });
    }
  },
);
