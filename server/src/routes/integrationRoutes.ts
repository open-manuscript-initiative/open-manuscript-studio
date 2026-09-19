import { Router } from 'express';

import { createOmpHandoff, consumeOmpHandoff } from '../integrations/omp/handoffStore.js';
import {
  loadOmpAuthorContext,
  loadOmpLaunchData,
  loadOmpPlatformCapabilities,
} from '../integrations/omp/ompClient.js';
import { verifyOmpLaunch } from '../integrations/omp/launchVerifier.js';
import { createPendingAuthorOmpNativeContext } from '../integrations/omp/nativeContext.js';
import { createOjsHandoff, consumeOjsHandoff } from '../integrations/ojs/handoffStore.js';
import { issueOjsAssignmentGrant } from '../integrations/ojs/ojsAssignmentGrant.js';
import { loadOjsAssignmentContext } from '../integrations/ojs/ojsAssignmentContext.js';
import { loadOjsLaunchData } from '../integrations/ojs/ojsClient.js';
import { verifyOjsLaunch } from '../integrations/ojs/launchVerifier.js';
import { createReviewSnapshotFromOjs } from '../integrations/ojs/reviewSnapshot.js';

export const integrationRouter = Router();

integrationRouter.get('/omp/handoff/:token', (request, response) => {
  const token = typeof request.params.token === 'string' ? request.params.token : '';
  if (!token) {
    response.status(400).json({
      error: {
        code: 'MISSING_HANDOFF_TOKEN',
        message: 'The OMP handoff token is required.',
      },
    });
    return;
  }

  const payload = consumeOmpHandoff(token);
  if (!payload) {
    response.status(410).json({
      error: {
        code: 'OMP_HANDOFF_EXPIRED',
        message: 'The OMP handoff token is invalid, expired, or has already been used.',
      },
    });
    return;
  }

  response.setHeader('Cache-Control', 'no-store, max-age=0');
  response.status(200).json(payload);
});

integrationRouter.get('/omp/launch', async (request, response) => {
  const payload = typeof request.query.payload === 'string' ? request.query.payload : '';
  const signature = typeof request.query.signature === 'string' ? request.query.signature : '';

  if (!payload || !signature) {
    response.status(400).json({
      error: {
        code: 'MISSING_LAUNCH_ASSERTION',
        message: 'The OMP launch payload and signature are required.',
      },
    });
    return;
  }

  try {
    const verified = await verifyOmpLaunch(payload, signature);
    const [ompData, platformCapabilities] = await Promise.all([
      loadOmpLaunchData(verified.claims, payload, signature),
      loadOmpPlatformCapabilities(verified.claims, payload, signature),
    ]);

    const submissionExternalId = verified.claims.submission?.externalId?.trim();
    const actorExternalId = verified.claims.actor?.externalId?.trim();
    const apiBaseUrl = verified.claims.apiBaseUrl?.trim();
    let nativeContext: Record<string, unknown> | null = null;

    const nativeAuthorWriteAvailable = Boolean(
      platformCapabilities.nativeApis?.authorRevisions?.supported &&
      platformCapabilities.nativeApis?.serviceWriteback?.supported &&
      platformCapabilities.nativeApis?.serviceWriteback?.authentication ===
        'omi-hmac-sha256',
    );
    if (verified.claims.actorMode === 'author' && nativeAuthorWriteAvailable) {
      if (!submissionExternalId || !actorExternalId || !apiBaseUrl) {
        throw new Error('The OMP author launch is missing its native workflow identifiers.');
      }
      const authorContext = await loadOmpAuthorContext(
        verified.claims,
        payload,
        signature,
      );
      if (authorContext.submissionExternalId !== submissionExternalId) {
        throw new Error('OMP returned an author context for a different submission.');
      }

      const sourceFileExternalId = ompData.sourceDocument?.fileExternalId;
      const sourceFile = sourceFileExternalId
        ? ompData.files.find((item) => item.externalId === sourceFileExternalId)
        : ompData.files[0];

      const stored = await createPendingAuthorOmpNativeContext({
        installationId: verified.installation.installationId,
        apiBaseUrl,
        externalSubmissionId: submissionExternalId,
        externalActorId: actorExternalId,
        ...(authorContext.reviewRoundExternalId
          ? { externalReviewRoundId: authorContext.reviewRoundExternalId }
          : {}),
        ...(Number.isInteger(authorContext.round)
          ? { reviewRound: authorContext.round }
          : {}),
        ...(Number.isInteger(authorContext.stageId)
          ? { stageId: authorContext.stageId }
          : {}),
        ...(sourceFile?.externalId
          ? { sourceSubmissionFileExternalId: sourceFile.externalId }
          : {}),
        ...(sourceFile?.genreExternalId
          ? { sourceGenreExternalId: sourceFile.genreExternalId }
          : {}),
        capabilities: platformCapabilities as unknown as Record<string, unknown>,
        writable: Boolean(authorContext.writable),
      });
      nativeContext = {
        id: stored.id,
        actorMode: 'author',
        writable: stored.writable,
        reason: authorContext.reason ?? null,
        reviewRoundExternalId: stored.externalReviewRoundId,
        reviewRound: stored.reviewRound,
        stageId: stored.stageId,
      };
    }

    const launchData = {
      protocol: 'omi-integration/1',
      profile: 'omi-integration/1/omp',
      status: 'verified',
      installation: verified.installation,
      context: verified.claims.context ?? null,
      submission: ompData.submission,
      component: verified.claims.component ?? null,
      reviewAssignment: verified.claims.reviewAssignment ?? null,
      contributors: ompData.contributors,
      files: ompData.files,
      sourceDocument: ompData.sourceDocument,
      actor: verified.claims.actor ?? null,
      actorMode: verified.claims.actorMode ?? null,
      scope: verified.claims.scope ?? [],
      nativeContext,
      expiresAt: new Date(verified.claims.exp * 1000).toISOString(),
    };

    const handoffToken = createOmpHandoff(launchData);
    response.setHeader('Cache-Control', 'no-store, max-age=0');
    response.redirect(302, `/?omiOmpLaunch=${encodeURIComponent(handoffToken)}`);
  } catch (error) {
    response.status(401).json({
      error: {
        code: 'INVALID_OMP_LAUNCH_ASSERTION',
        message: error instanceof Error ? error.message : 'OMP launch verification failed.',
      },
    });
  }
});

integrationRouter.get('/ojs/handoff/:token', (request, response) => {
  const token = typeof request.params.token === 'string' ? request.params.token : '';
  if (!token) {
    response.status(400).json({
      error: {
        code: 'MISSING_HANDOFF_TOKEN',
        message: 'The OJS handoff token is required.',
      },
    });
    return;
  }

  const payload = consumeOjsHandoff(token);
  if (!payload) {
    response.status(410).json({
      error: {
        code: 'OJS_HANDOFF_EXPIRED',
        message: 'The OJS handoff token is invalid, expired, or has already been used.',
      },
    });
    return;
  }

  response.setHeader('Cache-Control', 'no-store, max-age=0');
  response.status(200).json(payload);
});

integrationRouter.get(
  '/ojs/launch',
  async (request, response) => {
    const payload = typeof request.query.payload === 'string' ? request.query.payload : '';
    const signature = typeof request.query.signature === 'string' ? request.query.signature : '';

    if (!payload || !signature) {
      response.status(400).json({
        error: {
          code: 'MISSING_LAUNCH_ASSERTION',
          message: 'The launch payload and signature are required.',
        },
      });
      return;
    }

    try {
      const verified = await verifyOjsLaunch(payload, signature);
      const ojsData = await loadOjsLaunchData(
        verified.claims,
        payload,
        signature,
        verified.installation.baseUrl,
      );
      const assignmentContext = await loadOjsAssignmentContext(
        verified.claims,
        payload,
        signature,
        verified.installation.baseUrl,
      );

      const actorMode = verified.claims.actorMode === 'editor' || verified.claims.actorMode === 'author'
        ? verified.claims.actorMode
        : undefined;
      const manuscriptId = verified.claims.submission?.externalId;
      const contextId = verified.claims.context?.externalId;
      const assignmentGrant = actorMode && manuscriptId && contextId && assignmentContext.actorEmail
        ? issueOjsAssignmentGrant({
            installationId: verified.installation.installationId,
            contextId,
            manuscriptId,
            actorEmail: assignmentContext.actorEmail,
            actorMode,
          })
        : undefined;
      const reviewSnapshot = assignmentGrant ? createReviewSnapshotFromOjs(ojsData) : undefined;

      const launchData = {
        protocol: 'omi-integration/1',
        profile: 'omi-integration/1/ojs',
        status: 'verified',
        installation: verified.installation,
        context: verified.claims.context ?? null,
        submission: ojsData.submission,
        contributors: ojsData.contributors,
        sourceDocument: ojsData.sourceDocument,
        actor: {
          ...(verified.claims.actor ?? {}),
          ...(assignmentContext.actorEmail ? { email: assignmentContext.actorEmail } : {}),
          ...(assignmentContext.actorFullName ? { fullName: assignmentContext.actorFullName } : {}),
        },
        actorMode: actorMode ?? verified.claims.actorMode ?? null,
        scope: verified.claims.scope ?? [],
        assignmentContext: assignmentGrant
          ? {
              grant: assignmentGrant,
              candidates: actorMode === 'editor' ? assignmentContext.candidates : [],
              manuscript: reviewSnapshot,
            }
          : null,
        expiresAt: new Date(verified.claims.exp * 1000).toISOString(),
      };

      const handoffToken = createOjsHandoff(launchData);
      response.setHeader('Cache-Control', 'no-store, max-age=0');
      response.redirect(302, `/?omiOjsLaunch=${encodeURIComponent(handoffToken)}`);
    } catch (error) {
      response.status(401).json({
        error: {
          code: 'INVALID_LAUNCH_ASSERTION',
          message: error instanceof Error ? error.message : 'Launch verification failed.',
        },
      });
    }
  },
);
