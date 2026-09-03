import { Router } from 'express';

import { loadOmpLaunchData } from '../integrations/omp/ompClient.js';
import { verifyOmpLaunch } from '../integrations/omp/launchVerifier.js';
import {
  loadOmpReviewForm,
  rememberOmpReviewForm,
} from '../integrations/omp/reviewForm.js';
import { createReviewSnapshotFromOjs } from '../integrations/ojs/reviewSnapshot.js';
import { rememberOjsReviewWritebackEndpoint } from '../integrations/ojs/reviewWriteback.js';
import { prisma } from '../lib/prisma.js';
import {
  requireSession,
  type AuthenticatedRequest,
} from '../middleware/requireSession.js';
import {
  setReviewManuscriptFromOjs,
  upsertOjsReviewAssignment,
} from '../services/reviewManuscriptService.js';

export const ompReviewRouter = Router();

ompReviewRouter.post(
  '/launch',
  requireSession,
  async (request: AuthenticatedRequest, response) => {
    const payload = typeof request.body?.payload === 'string' ? request.body.payload : '';
    const signature = typeof request.body?.signature === 'string' ? request.body.signature : '';

    if (!payload || !signature || !request.authUserId) {
      response.status(400).json({
        error: {
          code: 'MISSING_OMP_REVIEW_LAUNCH_DATA',
          message: 'The OMP review launch payload and signature are required.',
        },
      });
      return;
    }

    try {
      const verified = await verifyOmpLaunch(payload, signature);
      const submissionId = verified.claims.submission?.externalId;
      const componentId = verified.claims.component?.externalId;
      const externalAssignmentId = verified.claims.reviewAssignment?.externalId;
      const contextId = verified.claims.context?.externalId;

      if (verified.claims.actorMode !== 'review') {
        throw new Error('The OMP launch assertion is not a reviewer launch.');
      }
      if (!submissionId || !componentId || !externalAssignmentId || !contextId) {
        throw new Error(
          'The OMP review launch does not identify its monograph, assigned study, review assignment, or press context.',
        );
      }
      if (!verified.claims.scope?.includes('review.response.write')) {
        throw new Error('The OMP review launch does not grant review.response.write.');
      }

      const [ompData, reviewForm] = await Promise.all([
        loadOmpLaunchData(verified.claims, payload, signature),
        loadOmpReviewForm(
          verified.claims,
          payload,
          signature,
          verified.installation.baseUrl,
        ),
      ]);

      const assignment = await upsertOjsReviewAssignment({
        reviewerUserId: request.authUserId,
        installationId: verified.installation.installationId,
        contextId,
        externalAssignmentId,
        externalSubmissionId: submissionId,
        reviewDocumentId: componentId,
        platform: 'omp',
      });

      await Promise.all([
        rememberOjsReviewWritebackEndpoint(
          assignment.id,
          verified.claims.apiBaseUrl,
          verified.installation.baseUrl,
        ),
        rememberOmpReviewForm(assignment.id, reviewForm),
      ]);

      const sourceLanguage = getOmpSubmissionLocale(ompData.submission);
      if (sourceLanguage) {
        await prisma.peerReviewAssignment.update({
          where: { id: assignment.id },
          data: { sourceLanguage },
        });
      }

      const snapshot = createReviewSnapshotFromOjs(ompData, {
        title: getOmpStudyTitle(verified.claims.component),
        // The submission endpoint describes the parent monograph. Reviewers
        // receive only the assigned study body, never volume-level metadata.
        includeSubmissionMetadata: false,
      });
      await setReviewManuscriptFromOjs(assignment.id, componentId, snapshot);

      response.setHeader('Cache-Control', 'no-store, max-age=0');
      response.status(200).json({
        assignmentId: assignment.id,
        reviewForm: reviewForm
          ? { externalId: reviewForm.externalId, elementCount: reviewForm.elements.length }
          : null,
      });
    } catch (error) {
      const name = error instanceof Error ? error.name : '';
      response.status(name === 'ForbiddenError' ? 403 : 401).json({
        error: {
          code: name === 'ForbiddenError' ? 'OMP_REVIEW_LAUNCH_FORBIDDEN' : 'INVALID_OMP_REVIEW_LAUNCH',
          message: error instanceof Error ? error.message : 'OMP review launch failed.',
        },
      });
    }
  },
);

function getOmpSubmissionLocale(value: unknown): string | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const submission = value as Record<string, unknown>;
  const raw = submission.primaryLocale;
  if (typeof raw !== 'string') return undefined;
  const normalized = raw.trim().replace('_', '-');
  return normalized ? normalized.slice(0, 32) : undefined;
}

function getOmpStudyTitle(
  component: { externalId?: string; title?: string } | undefined,
): string {
  const title = component?.title?.trim();
  return title || `Study ${component?.externalId ?? ''}`.trim();
}
