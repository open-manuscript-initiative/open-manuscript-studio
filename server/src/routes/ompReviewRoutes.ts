import { Router } from 'express';

import {
  loadOmpLaunchData,
  loadOmpPlatformCapabilities,
  loadOmpReviewAttachments,
  loadOmpReviewContext,
} from '../integrations/omp/ompClient.js';
import { verifyOmpLaunch } from '../integrations/omp/launchVerifier.js';
import {
  loadOmpReviewForm,
  rememberOmpReviewForm,
} from '../integrations/omp/reviewForm.js';
import { createReviewSnapshotFromOjs } from '../integrations/ojs/reviewSnapshot.js';
import { persistReviewerOmpNativeContext } from '../integrations/omp/nativeContext.js';
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

      const [ompData, reviewForm, platformCapabilities, reviewContext, attachments] =
        await Promise.all([
          loadOmpLaunchData(verified.claims, payload, signature),
          loadOmpReviewForm(
            verified.claims,
            payload,
            signature,
            verified.installation.baseUrl,
          ),
          loadOmpPlatformCapabilities(verified.claims, payload, signature),
          loadOmpReviewContext(verified.claims, payload, signature),
          loadOmpReviewAttachments(verified.claims, payload, signature),
        ]);

      const nativeAssignment = reviewContext.reviewAssignment;
      const nativeReviewRoundExternalId = nativeAssignment?.reviewRoundExternalId;
      const nativeReviewRound = nativeAssignment?.round;
      const nativeStageId = nativeAssignment?.stageId;
      if (
        reviewContext.submissionExternalId !== submissionId ||
        nativeAssignment?.externalId !== externalAssignmentId ||
        !nativeReviewRoundExternalId ||
        typeof nativeReviewRound !== 'number' ||
        !Number.isInteger(nativeReviewRound) ||
        typeof nativeStageId !== 'number' ||
        !Number.isInteger(nativeStageId) ||
        nativeAssignment.cancelled ||
        nativeAssignment.declined
      ) {
        throw new Error('OMP returned a review context that does not match the signed assignment.');
      }
      if (
        attachments.submissionExternalId !== submissionId ||
        attachments.reviewAssignmentExternalId !== externalAssignmentId
      ) {
        throw new Error('OMP reviewer attachments escaped the signed assignment boundary.');
      }

      const serviceWriteback = platformCapabilities.nativeApis?.serviceWriteback;
      const nativeWritesAvailable = Boolean(
        serviceWriteback?.supported &&
        serviceWriteback.authentication === 'omi-hmac-sha256' &&
        serviceWriteback.reviewAttachments === 'review-attachments' &&
        serviceWriteback.reviewResult === 'review-result-v2',
      );
      const recommendationSupported = Boolean(
        platformCapabilities.nativeApis?.reviewRecommendations?.supported &&
        reviewContext.reviewRecommendations?.supported,
      );
      const recommendationOptions = recommendationSupported
        ? normalizeRecommendationOptions(reviewContext.reviewRecommendations?.options)
        : [];
      const selectedRecommendation = recommendationOptions.some(
        (option) => option.externalId === reviewContext.reviewRecommendations?.selectedExternalId,
      )
        ? reviewContext.reviewRecommendations?.selectedExternalId ?? null
        : null;

      const assignment = await upsertOjsReviewAssignment({
        reviewerUserId: request.authUserId,
        installationId: verified.installation.installationId,
        contextId,
        externalAssignmentId,
        externalSubmissionId: submissionId,
        reviewDocumentId: componentId,
        reviewRound: nativeReviewRound,
        platform: 'omp',
        recommendationStorage: recommendationSupported ? 'native' : 'unavailable',
        recommendationOptions,
        ...(selectedRecommendation
          ? { recommendationExternalId: selectedRecommendation }
          : {}),
      });

      const apiBaseUrl = verified.claims.apiBaseUrl?.trim();
      const actorExternalId = verified.claims.actor?.externalId?.trim();
      if (!apiBaseUrl || !actorExternalId) {
        throw new Error('The OMP reviewer launch is missing its server-side workflow context.');
      }
      const sourceFileExternalId = ompData.sourceDocument?.fileExternalId;
      const sourceFile = sourceFileExternalId
        ? ompData.files.find((item) => item.externalId === sourceFileExternalId)
        : undefined;

      await Promise.all([
        nativeWritesAvailable
          ? persistReviewerOmpNativeContext({
              assignmentId: assignment.id,
              installationId: verified.installation.installationId,
              apiBaseUrl,
              externalSubmissionId: submissionId,
              externalActorId: actorExternalId,
              externalAssignmentId,
              externalReviewRoundId: nativeReviewRoundExternalId,
              reviewRound: nativeReviewRound,
              stageId: nativeStageId,
              componentExternalId: componentId,
              ...(sourceFileExternalId
                ? { sourceSubmissionFileExternalId: sourceFileExternalId }
                : {}),
              ...(sourceFile?.genreExternalId
                ? { sourceGenreExternalId: sourceFile.genreExternalId }
                : {}),
              capabilities: platformCapabilities as unknown as Record<string, unknown>,
              writable: !nativeAssignment.dateCompleted,
            })
          : rememberOjsReviewWritebackEndpoint(
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
        // The plugin projects the assigned chapter as an article. Keep the
        // signed component title authoritative and omit all parent metadata.
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

function normalizeRecommendationOptions(
  value: Array<{ externalId?: string; label?: string }> | undefined,
): Array<{ externalId: string; label: string }> {
  const result: Array<{ externalId: string; label: string }> = [];
  const seen = new Set<string>();
  for (const item of value ?? []) {
    const externalId = item.externalId?.trim() ?? '';
    const label = item.label?.trim() ?? '';
    if (!externalId || !label || seen.has(externalId)) continue;
    seen.add(externalId);
    result.push({ externalId, label });
  }
  return result;
}

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
