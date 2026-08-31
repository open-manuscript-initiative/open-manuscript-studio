import { createHash, createHmac } from 'node:crypto';

import { ExternalPlatform } from '../../generated/prisma/client.js';
import { getActiveInstallationWithSecret } from '../externalInstallations.js';
import { prisma } from '../../lib/prisma.js';
import { assertTrustedIntegrationUrl } from '../security/trustedRemoteUrl.js';
import { getOjsReviewFormContext } from './reviewForm.js';

interface WritebackContextRow {
  api_base_url: string;
}

export async function rememberOjsReviewWritebackEndpoint(
  assignmentId: string,
  apiBaseUrl: string | undefined,
  installationBaseUrl: string,
): Promise<void> {
  if (!apiBaseUrl) return;
  const trusted = await assertTrustedIntegrationUrl(apiBaseUrl, installationBaseUrl);
  const normalized = trusted.toString().replace(/\/$/, '');

  await prisma.$executeRaw`
    INSERT INTO ojs_review_writeback_contexts (assignment_id, api_base_url, updated_at)
    VALUES (${assignmentId}::uuid, ${normalized}, CURRENT_TIMESTAMP)
    ON CONFLICT (assignment_id)
    DO UPDATE SET api_base_url = EXCLUDED.api_base_url, updated_at = CURRENT_TIMESTAMP
  `;
}

export async function writeBackSubmittedExternalReview(
  assignmentId: string,
  reviewerUserId: string,
): Promise<{ status: 'synced' | 'not_applicable' | 'failed'; message?: string }> {
  const assignment = await prisma.peerReviewAssignment.findFirst({
    where: { id: assignmentId, reviewerUserId },
    include: {
      feedback: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (
    !assignment ||
    !assignment.externalInstallationId ||
    !assignment.externalAssignmentId ||
    assignment.status !== 'SUBMITTED'
  ) {
    return { status: 'not_applicable' };
  }

  const rows = await prisma.$queryRaw<WritebackContextRow[]>`
    SELECT api_base_url
    FROM ojs_review_writeback_contexts
    WHERE assignment_id = ${assignment.id}::uuid
    LIMIT 1
  `;
  const apiBaseUrl = rows[0]?.api_base_url;
  if (!apiBaseUrl) {
    return { status: 'failed', message: 'No persisted external review writeback endpoint is available.' };
  }

  const installation = await getActiveInstallationWithSecret(assignment.externalInstallationId);
  if (!installation) {
    return { status: 'failed', message: 'The linked external installation is unavailable or disabled.' };
  }

  try {
    const trustedBase = await assertTrustedIntegrationUrl(apiBaseUrl, installation.baseUrl);
    const target = new URL(`${trustedBase.toString().replace(/\/$/, '')}/review-result`);
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
    const reviewFormContext = await getOjsReviewFormContext(assignment.id);

    const body = JSON.stringify({
      submissionExternalId: assignment.manuscriptId,
      reviewAssignmentExternalId: assignment.externalAssignmentId,
      authorAndEditorComment: authorComments,
      editorOnlyComment: editorComments,
      ...(installation.platform === ExternalPlatform.OJS
        ? { recommendation: assignment.recommendation ?? '' }
        : {}),
      reviewFormResponses: reviewFormContext?.responses ?? [],
    });

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

    if (!response.ok) {
      const text = (await response.text()).slice(0, 500);
      const platform = installation.platform === ExternalPlatform.OMP ? 'OMP' : 'OJS';
      return {
        status: 'failed',
        message: `${platform} review writeback failed with HTTP ${response.status}${text ? `: ${text}` : ''}`,
      };
    }
    return { status: 'synced' };
  } catch (error) {
    return {
      status: 'failed',
      message: error instanceof Error ? error.message : 'External review writeback failed.',
    };
  }
}

// Backwards-compatible export for existing callers while the persistence table
// names are migrated to platform-neutral terminology in a later schema change.
export const writeBackSubmittedOjsReview = writeBackSubmittedExternalReview;
