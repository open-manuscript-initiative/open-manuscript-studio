import { Router } from 'express';

import { createOjsHandoff, consumeOjsHandoff } from '../integrations/ojs/handoffStore.js';
import { issueOjsAssignmentGrant } from '../integrations/ojs/ojsAssignmentGrant.js';
import { loadOjsAssignmentContext } from '../integrations/ojs/ojsAssignmentContext.js';
import { loadOjsLaunchData } from '../integrations/ojs/ojsClient.js';
import { verifyOjsLaunch } from '../integrations/ojs/launchVerifier.js';
import { createReviewSnapshotFromOjs } from '../integrations/ojs/reviewSnapshot.js';

export const integrationRouter = Router();

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
      const ojsData = await loadOjsLaunchData(verified.claims, payload, signature);
      const assignmentContext = await loadOjsAssignmentContext(
        verified.claims,
        payload,
        signature,
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

      // Keep the potentially large manuscript payload on the API server.
      // The browser receives only a short-lived, one-time token and retrieves
      // the launch data after Studio has loaded. This avoids Web Storage quota
      // limits when DOCX files contain embedded images or other rich content.
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
