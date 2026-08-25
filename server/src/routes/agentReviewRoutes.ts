import { randomUUID } from 'node:crypto';

import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma.js';
import {
  requireSession,
  type AuthenticatedRequest,
} from '../middleware/requireSession.js';

export const agentReviewRouter = Router();

const reviewSchema = z.object({
  auditId: z.string().uuid(),
  decision: z.enum(['accepted', 'rejected']),
  blockId: z.string().trim().min(1).max(256),
  segmentId: z.string().trim().min(1).max(512),
  model: z.string().trim().min(1).max(256).optional(),
});

agentReviewRouter.post(
  '/integrations/agents/review',
  requireSession,
  async (request: AuthenticatedRequest, response) => {
    const input = reviewSchema.safeParse(request.body);
    if (!input.success) {
      response.status(400).json({
        error: {
          code: 'INVALID_AGENT_REVIEW',
          message: 'The agent review decision is invalid.',
          fields: input.error.flatten().fieldErrors,
        },
      });
      return;
    }

    const sourceRows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM integration_audit_events
      WHERE id = ${input.data.auditId}::uuid
        AND user_id = ${request.authUserId!}::uuid
        AND provider_id = 'ai-provider'
      LIMIT 1
    `;
    if (!sourceRows[0]) {
      response.status(404).json({
        error: {
          code: 'AGENT_AUDIT_NOT_FOUND',
          message: 'The source agent audit event was not found.',
        },
      });
      return;
    }

    const detail = JSON.stringify({
      sourceAuditId: input.data.auditId,
      segmentId: input.data.segmentId,
      model: input.data.model ?? null,
      decision: input.data.decision,
    });
    const operation = `review.${input.data.decision}`;

    await prisma.$executeRaw`
      INSERT INTO integration_audit_events
        (id, user_id, provider_id, operation, scope_kind, scope_id,
         input_digest, input_length, output_digest, output_length,
         permissions, review_confidential, direct_write, status, detail)
      VALUES
        (${randomUUID()}::uuid, ${request.authUserId!}::uuid, 'omi-agents', ${operation},
         'block', ${input.data.blockId}, NULL, NULL, NULL, NULL, '[]'::jsonb,
         FALSE, FALSE, 'SUCCESS', ${detail}::jsonb)
    `;

    response.status(204).end();
  },
);
