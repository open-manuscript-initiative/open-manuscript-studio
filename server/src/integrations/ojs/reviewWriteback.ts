import { validateAssignmentTranslation, requiresDocumentTranslation } from '../../services/translationAssignmentPolicy.js';
import { assertTranslationAssignmentScope } from '../../services/translationAssignmentScope.js';
import { buildReviewDocx, REVIEW_DOCX_MEDIA_TYPE } from './reviewDocument.js';
import { ojsWorkflowRequest } from './workflowRequest.js';
import { sanitizeReviewManuscript, authorVisibleReviewManuscript } from '../../services/reviewManuscriptModel.js';
import { fetchPinnedPublicUrl } from '../../cloud/security/connectionPinnedHttp.js';
import { createHash, createHmac } from 'node:crypto';

import { ExternalPlatform } from '../../generated/prisma/client.js';
import { getActiveInstallationWithSecret } from '../externalInstallations.js';
import { prisma } from '../../lib/prisma.js';
import { assertTrustedIntegrationUrl } from '../security/trustedRemoteUrl.js';
import { getOjsReviewFormContext } from './reviewForm.js';

interface WritebackContextRow {
  api_base_url: string;
  assignment_token?: string | null;
  receipt?: Record<string, unknown> | null;
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

async function writeBackLegacyExternalReview(
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
      submissionExternalId: assignment.externalSubmissionId ?? assignment.manuscriptId,
      reviewAssignmentExternalId: assignment.externalAssignmentId,
      authorAndEditorComment: authorComments,
      editorOnlyComment: editorComments,
      ...(installation.platform === ExternalPlatform.OJS
        ? {
            recommendation: assignment.recommendation ?? '',
            ...(assignment.externalRecommendationId
              ? { reviewerRecommendationExternalId: assignment.externalRecommendationId }
              : {}),
          }
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

    const response = await fetchPinnedPublicUrl(target, {
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


export type OjsWritebackResult = { status: 'synced' | 'not_applicable' | 'failed'; message?: string };

export async function writeBackSubmittedExternalReview(assignmentId: string, reviewerUserId: string): Promise<OjsWritebackResult> {
  try {
    const assignment = await prisma.peerReviewAssignment.findFirst({ where: { id: assignmentId, reviewerUserId },
      include: { feedback: { orderBy: { createdAt: 'asc' } }, reviewer: { select: { fullName: true } } } });
    if (!assignment) return { status: 'not_applicable' };
    if (!assignment.externalInstallationId) {
      if (assignment.workspaceId.startsWith('ojs:')) throw new Error('This older task has no OJS binding. Reassign it from the OJS manuscript workspace.');
      return { status: 'not_applicable' };
    }
    const installation = await getActiveInstallationWithSecret(assignment.externalInstallationId);
    if (installation?.platform === ExternalPlatform.OMP) return writeBackLegacyExternalReview(assignmentId, reviewerUserId);
    if (!installation || !assignment.externalAssignmentId || !assignment.externalSubmissionId) throw new Error('The OJS assignment binding is incomplete.');
    if (!['SUBMITTED', 'COMPLETED'].includes(assignment.status)) throw new Error('Submit the assignment before returning it to OJS.');
    const rows = await prisma.$queryRaw<WritebackContextRow[]>`
      SELECT api_base_url, assignment_token, receipt FROM ojs_review_writeback_contexts WHERE assignment_id = ${assignmentId}::uuid LIMIT 1
    `;
    const context = rows[0];
    if (!context) throw new Error('Reopen this assignment from OJS to establish its return connection.');
    await assertTranslationAssignmentScope(reviewerUserId, assignment);
    if (context.receipt) return { status: 'synced' };
    const translated = validateAssignmentTranslation(assignment);
    const metadataOnly = assignment.assignmentType === 'TRANSLATION' && !requiresDocumentTranslation(assignment.targetLanguage, assignment.publicationLanguages);
    const openIdentity = assignment.assignmentType !== 'SCIENTIFIC_REVIEW';
    const source = assignment.reviewRevisionSnapshot ?? assignment.manuscriptSnapshot;
    if (!source) throw new Error('No manuscript is attached to this assignment.');
    const manuscript = sanitizeReviewManuscript(source, openIdentity);
    const publicManuscript = authorVisibleReviewManuscript(manuscript, openIdentity);
    if (translated) { publicManuscript.title = translated.title; publicManuscript.abstract = translated.abstract; publicManuscript.keywords = translated.keywords; }
    const form = await getOjsReviewFormContext(assignment.id);
    const comments = (visibility: 'AUTHOR_AND_EDITOR' | 'EDITOR_ONLY') => [
      ...assignment.feedback.filter(item => item.visibility === visibility).map(item => item.body),
      ...(manuscript.annotations ?? []).filter(item => item.visibility === visibility.toLowerCase()).map(item =>
        `[${item.id}; ${item.status}${item.replyToCommentId ? `; reply: ${item.replyToCommentId}` : ''}] “${item.targetText}”\n${item.body}`),
    ].map(item => item.trim()).filter(Boolean).join('\n\n');
    const content = { protocol: 'omi-review-revision/1', assignmentType: assignment.assignmentType,
      anonymityMode: openIdentity ? 'open' : 'double_blind', manuscript: publicManuscript };
    const sidecar = Buffer.from(JSON.stringify(content), 'utf8');
    const payload = {
      submissionExternalId: assignment.externalSubmissionId, reviewAssignmentExternalId: assignment.externalAssignmentId,
      reviewRound: assignment.reviewRound, assignmentType: assignment.assignmentType,
      assignmentToken: context.assignment_token ?? null,
      authorAndEditorComment: comments('AUTHOR_AND_EDITOR'), editorOnlyComment: comments('EDITOR_ONLY'),
      recommendation: assignment.recommendation ?? '',
      ...(assignment.externalRecommendationId ? { reviewerRecommendationExternalId: assignment.externalRecommendationId } : {}),
      reviewFormResponses: form?.responses ?? [],
      ...(translated ? { translationMetadata: translated, documentTranslationCompleted: translated.documentCompleted } : {}),
    };
    const sourceDigest = createHash('sha256').update(JSON.stringify({ payload, manuscript })).digest('hex');
    const docx = metadataOnly ? Buffer.alloc(0) : await buildReviewDocx(publicManuscript, openIdentity, assignment.reviewer.fullName);
    const filePrefix = translated ? `translation-${translated.sourceLanguage}-${translated.targetLanguage}-assignment-${assignmentId}` : `assignment-${assignmentId}`;
    const files = metadataOnly ? [] : [
      { fileName: `${filePrefix}.docx`, mediaType: REVIEW_DOCX_MEDIA_TYPE, bytes: docx },
      { fileName: `${filePrefix}.omi-review.json`, mediaType: 'application/vnd.openmanuscript.review+json', bytes: sidecar },
    ];
    const result = await ojsWorkflowRequest(assignment.externalInstallationId, context.api_base_url, 'assignment-result', {
      ...payload, sourceDigest,
      files: files.map(({ bytes, ...file }) => ({ ...file, contentBase64: bytes.toString('base64') })),
    });
    if (result.written !== true || result.sourceDigest !== sourceDigest || result.submissionExternalId !== assignment.externalSubmissionId ||
      result.reviewAssignmentExternalId !== assignment.externalAssignmentId || !Array.isArray(result.files) || result.files.length !== files.length) {
      throw new Error('OJS did not acknowledge this assignment and its complete document transfer.');
    }
    if (translated && ((result.translationMetadata as Record<string, unknown> | undefined)?.targetLanguage !== translated.targetLanguage || !Array.isArray((result.translationMetadata as Record<string, unknown> | undefined)?.fields) || ((result.translationMetadata as { fields: string[] }).fields.length !== 3))) throw new Error('OJS did not confirm all translated metadata fields in the correct target language.');
    for (const file of files) {
      const receipt = result.files.find((item: Record<string, unknown>) => item.fileName === file.fileName);
      if (!receipt?.submissionFileExternalId || (!result.unchanged && receipt.sha256 !== createHash('sha256').update(file.bytes).digest('hex'))) {
        throw new Error('OJS did not confirm the stored document checksum.');
      }
    }
    const storedReceipt = await prisma.$executeRaw`UPDATE ojs_review_writeback_contexts AS context SET receipt = ${JSON.stringify(result)}::jsonb,
      last_error = NULL, synced_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP FROM peer_review_assignments AS task
      WHERE context.assignment_id = ${assignmentId}::uuid AND task.id = context.assignment_id
      AND task.status IN ('SUBMITTED', 'COMPLETED') AND task.revision_updated_at IS NOT DISTINCT FROM ${assignment.revisionUpdatedAt ?? null}::timestamptz`;
    if (storedReceipt !== 1) throw new Error('The working revision changed during transfer. Return the latest revision to OJS.');
    return { status: 'synced' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'OJS writeback failed.';
    try { await prisma.$executeRaw`UPDATE ojs_review_writeback_contexts SET last_error = ${message}, updated_at = CURRENT_TIMESTAMP WHERE assignment_id = ${assignmentId}::uuid`; } catch { /* Preserve the original transfer failure if status persistence is unavailable. */ }
    return { status: 'failed', message };
  }
}

export async function getOjsWritebackStatus(assignmentId: string, reviewerUserId: string): Promise<OjsWritebackResult | { status: 'pending' }> {
  const assignment = await prisma.peerReviewAssignment.findFirst({ where: { id: assignmentId, reviewerUserId }, select: { externalInstallationId: true, status: true, workspaceId: true } });
  if (!assignment?.externalInstallationId) return assignment?.workspaceId.startsWith('ojs:') ? { status: 'failed', message: 'Restore this task’s OJS connection from the manuscript’s participant panel.' } : { status: 'not_applicable' };
  const installation = await getActiveInstallationWithSecret(assignment.externalInstallationId);
  if (installation?.platform !== ExternalPlatform.OJS) return { status: 'not_applicable' };
  const rows = await prisma.$queryRaw<Array<{ receipt: unknown; last_error: string | null }>>`SELECT receipt, last_error FROM ojs_review_writeback_contexts WHERE assignment_id = ${assignmentId}::uuid LIMIT 1`;
  if (rows[0]?.receipt) return { status: 'synced' };
  if (rows[0]?.last_error) return { status: 'failed', message: rows[0].last_error };
  return { status: 'pending' };
}
