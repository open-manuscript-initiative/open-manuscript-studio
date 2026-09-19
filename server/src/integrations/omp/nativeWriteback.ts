import { createHash, createHmac } from 'node:crypto';

import { ExternalPlatform } from '../../generated/prisma/client.js';
import { getActiveInstallationWithSecret } from '../externalInstallations.js';
import { assertTrustedIntegrationUrl } from '../security/trustedRemoteUrl.js';
import { getOmpReviewFormContext } from './reviewForm.js';
import {
  claimAuthorOmpNativeContext,
  getAuthorOmpNativeContext,
  getReviewerOmpNativeContext,
  type OmpNativeContext,
} from './nativeContext.js';
import { prisma } from '../../lib/prisma.js';

export interface OmpWritebackResult {
  status: 'synced' | 'not_applicable' | 'failed';
  message?: string;
}

export async function uploadOmpReviewerRevision(
  assignmentId: string,
  reviewerUserId: string,
): Promise<OmpWritebackResult> {
  const assignment = await prisma.peerReviewAssignment.findFirst({
    where: { id: assignmentId, reviewerUserId },
    select: {
      id: true,
      externalInstallationId: true,
      externalAssignmentId: true,
      reviewRevisionSnapshot: true,
      status: true,
    },
  });
  if (
    !assignment ||
    !assignment.externalInstallationId ||
    !assignment.externalAssignmentId ||
    !assignment.reviewRevisionSnapshot ||
    assignment.status !== 'SUBMITTED'
  ) {
    return { status: 'not_applicable' };
  }

  const installation = await getActiveInstallationWithSecret(assignment.externalInstallationId);
  if (!installation || installation.platform !== ExternalPlatform.OMP) {
    return { status: 'not_applicable' };
  }

  const context = await getReviewerOmpNativeContext(assignmentId);
  if (!context) return { status: 'not_applicable' };
  if (
    !context.writable ||
    !context.externalAssignmentId ||
    !context.externalReviewRoundId
  ) {
    return {
      status: 'failed',
      message: 'No writable native OMP reviewer context is available.',
    };
  }

  const bytes = Buffer.from(
    JSON.stringify({
      protocol: 'omi-review-revision/1',
      documentKind: 'article',
      authorIdentity: 'hidden',
      manuscript: assignment.reviewRevisionSnapshot,
    }),
    'utf8',
  );

  try {
    await signedOmpJsonRequest(context, 'review-attachments', {
      submissionExternalId: context.externalSubmissionId,
      actorExternalId: context.externalActorId,
      reviewAssignmentExternalId: context.externalAssignmentId,
      reviewRoundExternalId: context.externalReviewRoundId,
      ...(context.sourceGenreExternalId
        ? { genreExternalId: context.sourceGenreExternalId }
        : {}),
      fileName: `open-manuscript-review-${safeFilePart(context.externalAssignmentId)}.omi-review.json`,
      mediaType: 'application/vnd.openmanuscript.review+json',
      contentBase64: bytes.toString('base64'),
      summaryOfChanges: 'Open Manuscript Studio reviewer revision',
    });
    return { status: 'synced' };
  } catch (error) {
    return {
      status: 'failed',
      message: error instanceof Error
        ? error.message
        : 'OMP reviewer attachment upload failed.',
    };
  }
}

export async function writeBackSubmittedOmpReview(
  assignmentId: string,
  reviewerUserId: string,
): Promise<OmpWritebackResult> {
  const assignment = await prisma.peerReviewAssignment.findFirst({
    where: { id: assignmentId, reviewerUserId },
    include: { feedback: { orderBy: { createdAt: 'asc' } } },
  });
  if (
    !assignment ||
    !assignment.externalInstallationId ||
    !assignment.externalAssignmentId ||
    assignment.status !== 'SUBMITTED'
  ) {
    return { status: 'not_applicable' };
  }

  const installation = await getActiveInstallationWithSecret(assignment.externalInstallationId);
  if (!installation || installation.platform !== ExternalPlatform.OMP) {
    return { status: 'not_applicable' };
  }

  const context = await getReviewerOmpNativeContext(assignmentId);
  if (
    !context?.writable ||
    !context.externalAssignmentId ||
    !context.externalReviewRoundId
  ) {
    return {
      status: 'failed',
      message: 'No writable native OMP reviewer context is available.',
    };
  }

  const authorComments = assignment.feedback
    .filter((item) => item.visibility === 'AUTHOR_AND_EDITOR')
    .map((item) => item.body.trim())
    .filter(Boolean)
    .join('\n\n');
  const editorComments = assignment.feedback
    .filter((item) => item.visibility === 'EDITOR_ONLY')
    .map((item) => item.body.trim())
    .filter(Boolean)
    .join('\n\n');
  const reviewForm = await getOmpReviewFormContext(assignment.id);

  const capabilities = asRecord(context.capabilities);
  const nativeApis = asRecord(capabilities.nativeApis);
  const recommendationCapability = asRecord(nativeApis.reviewRecommendations);
  const recommendationSupported = recommendationCapability.supported === true;

  try {
    await signedOmpJsonRequest(context, 'review-result-v2', {
      submissionExternalId: context.externalSubmissionId,
      actorExternalId: context.externalActorId,
      reviewAssignmentExternalId: context.externalAssignmentId,
      reviewRoundExternalId: context.externalReviewRoundId,
      authorAndEditorComment: authorComments,
      editorOnlyComment: editorComments,
      reviewFormResponses: reviewForm?.responses ?? [],
      ...(recommendationSupported && assignment.externalRecommendationId
        ? { reviewerRecommendationExternalId: assignment.externalRecommendationId }
        : {}),
    });
    return { status: 'synced' };
  } catch (error) {
    return {
      status: 'failed',
      message: error instanceof Error
        ? error.message
        : 'OMP review-result-v2 writeback failed.',
    };
  }
}

export async function writeOmpAuthorRevision(
  contextId: string,
  userId: string,
  input: {
    fileName: string;
    mediaType: string;
    contentBase64: string;
    summaryOfChanges?: string;
  },
): Promise<{ file?: Record<string, unknown>; written: boolean }> {
  const context =
    await getAuthorOmpNativeContext(contextId, userId) ??
    await claimAuthorOmpNativeContext(contextId, userId);
  if (!context) {
    const error = new Error('The OMP author workflow context is unavailable or belongs to another Studio account.');
    error.name = 'ForbiddenError';
    throw error;
  }
  if (!context.writable || !context.externalReviewRoundId) {
    throw new Error('OMP has not opened the current review round for author revision upload.');
  }

  const response = await signedOmpJsonRequest(context, 'author-revisions', {
    submissionExternalId: context.externalSubmissionId,
    actorExternalId: context.externalActorId,
    reviewRoundExternalId: context.externalReviewRoundId,
    ...(context.sourceSubmissionFileExternalId
      ? { sourceSubmissionFileExternalId: context.sourceSubmissionFileExternalId }
      : {}),
    ...(context.sourceGenreExternalId
      ? { genreExternalId: context.sourceGenreExternalId }
      : {}),
    fileName: input.fileName,
    mediaType: input.mediaType,
    contentBase64: input.contentBase64,
    ...(input.summaryOfChanges?.trim()
      ? { summaryOfChanges: input.summaryOfChanges.trim() }
      : {}),
  });
  return {
    written: response.written === true,
    ...(asRecord(response.file) ? { file: asRecord(response.file) } : {}),
  };
}

async function signedOmpJsonRequest(
  context: OmpNativeContext,
  operation: 'review-attachments' | 'author-revisions' | 'review-result-v2',
  bodyValue: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const installation = await getActiveInstallationWithSecret(context.installationId);
  if (!installation || installation.platform !== ExternalPlatform.OMP) {
    throw new Error('The linked OMP installation is unavailable or disabled.');
  }

  const trustedBase = await assertTrustedIntegrationUrl(
    context.apiBaseUrl,
    installation.baseUrl,
  );
  const target = new URL(
    `${trustedBase.toString().replace(/\/$/, '')}/${operation}`,
  );
  const body = JSON.stringify(bodyValue);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const canonical = [
    timestamp,
    'POST',
    target.pathname,
    createHash('sha256').update(body).digest('hex'),
  ].join('\n');
  const signature = createHmac('sha256', installation.sharedSecret)
    .update(canonical)
    .digest('base64url');

  const response = await fetch(target, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-OMI-Installation': installation.installationId,
      'X-OMI-Timestamp': timestamp,
      'X-OMI-Signature': signature,
    },
    body,
    redirect: 'error',
    signal: AbortSignal.timeout(30_000),
  });

  const payload = await response.json().catch(() => null) as
    | Record<string, unknown>
    | null;
  if (!response.ok) {
    const error = asRecord(payload?.error);
    const message = typeof error.message === 'string'
      ? error.message
      : `OMP ${operation} failed with HTTP ${response.status}.`;
    throw new Error(message);
  }
  return payload ?? {};
}

function safeFilePart(value: string): string {
  return value.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'revision';
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
