import { Router } from 'express';

import { loadOjsLaunchData } from '../integrations/ojs/ojsClient.js';
import { verifyOjsLaunch } from '../integrations/ojs/launchVerifier.js';
import { createReviewSnapshotFromOjs } from '../integrations/ojs/reviewSnapshot.js';
import { prisma } from '../lib/prisma.js';
import {
  requireSession,
  type AuthenticatedRequest,
} from '../middleware/requireSession.js';
import {
  setReviewManuscriptFromOjs,
  upsertOjsReviewAssignment,
} from '../services/reviewManuscriptService.js';

export const ojsReviewRouter = Router();

ojsReviewRouter.post(
  '/launch',
  requireSession,
  async (request: AuthenticatedRequest, response) => {
    const payload = typeof request.body?.payload === 'string' ? request.body.payload : '';
    const signature = typeof request.body?.signature === 'string' ? request.body.signature : '';

    if (!payload || !signature || !request.authUserId) {
      response.status(400).json({
        error: {
          code: 'MISSING_REVIEW_LAUNCH_DATA',
          message: 'The review launch payload and signature are required.',
        },
      });
      return;
    }

    try {
      const verified = await verifyOjsLaunch(payload, signature);
      const submissionId = verified.claims.submission?.externalId;
      const externalAssignmentId = verified.claims.reviewAssignment?.externalId;
      const contextId = verified.claims.context?.externalId;

      if (verified.claims.actorMode !== 'review') {
        throw new Error('The OJS launch assertion is not a reviewer launch.');
      }
      if (!submissionId || !externalAssignmentId || !contextId) {
        throw new Error('The OJS review launch does not identify its submission, review assignment, or context.');
      }

      const ojsData = await loadOjsLaunchData(verified.claims, payload, signature);
      const assignment = await upsertOjsReviewAssignment({
        reviewerUserId: request.authUserId,
        installationId: verified.installation.installationId,
        contextId,
        externalAssignmentId,
        externalSubmissionId: submissionId,
        ...(verified.claims.reviewAssignment?.round
          ? { reviewRound: verified.claims.reviewAssignment.round }
          : {}),
      });

      const sourceLanguage = getOjsSubmissionLocale(ojsData.submission);
      if (sourceLanguage) {
        await prisma.peerReviewAssignment.update({
          where: { id: assignment.id },
          data: { sourceLanguage },
        });
      }

      const snapshot = createReviewSnapshotFromOjs(ojsData);
      await setReviewManuscriptFromOjs(assignment.id, submissionId, snapshot);

      response.setHeader('Cache-Control', 'no-store, max-age=0');
      response.status(200).json({ assignmentId: assignment.id });
    } catch (error) {
      const name = error instanceof Error ? error.name : '';
      response.status(name === 'ForbiddenError' ? 403 : 401).json({
        error: {
          code: name === 'ForbiddenError' ? 'REVIEW_LAUNCH_FORBIDDEN' : 'INVALID_REVIEW_LAUNCH',
          message: error instanceof Error ? error.message : 'OJS review launch failed.',
        },
      });
    }
  },
);

function getOjsSubmissionLocale(value: unknown): string | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const submission = value as Record<string, unknown>;
  const raw = submission.primaryLocale;
  if (typeof raw !== 'string') return undefined;
  const normalized = raw.trim().replace('_', '-');
  return normalized ? normalized.slice(0, 32) : undefined;
}
