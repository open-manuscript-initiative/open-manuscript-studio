import { randomBytes } from 'node:crypto';

import { Router } from 'express';

import { issueOjsAssignmentGrant } from '../integrations/ojs/ojsAssignmentGrant.js';
import { loadOjsAssignmentContext } from '../integrations/ojs/ojsAssignmentContext.js';
import { loadOjsLaunchData } from '../integrations/ojs/ojsClient.js';
import { verifyOjsLaunch } from '../integrations/ojs/launchVerifier.js';
import { createReviewSnapshotFromOjs } from '../integrations/ojs/reviewSnapshot.js';

export const integrationRouter = Router();

function escapeJsonForHtml(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

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

      // The complete OJS file list is only needed server-side to choose the
      // manuscript source. Do not copy every attachment into the browser
      // handoff payload; large submissions can exceed sessionStorage quota.
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

      const nonce = randomBytes(18).toString('base64');
      const serialized = escapeJsonForHtml(launchData);
      response.setHeader(
        'Content-Security-Policy',
        `default-src 'none'; script-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'`,
      );
      response.setHeader('Cache-Control', 'no-store, max-age=0');
      response.status(200).type('html').send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Opening Open Manuscript Studio</title></head>
<body><p>Opening Open Manuscript Studio…</p><script nonce="${nonce}">
try { sessionStorage.setItem('omi:ojs-launch', ${JSON.stringify(serialized)}); window.location.replace('/?omiOjsLaunch=1'); }
catch (error) { const detail = error instanceof Error ? ' (' + error.name + ': ' + error.message + ')' : ''; document.body.textContent = 'Unable to hand the OJS submission to Open Manuscript Studio.' + detail; }
</script></body></html>`);
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
