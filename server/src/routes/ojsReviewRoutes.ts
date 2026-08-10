import { Router } from 'express';

import { loadOjsLaunchData } from '../integrations/ojs/ojsClient.js';
import { verifyOjsLaunch } from '../integrations/ojs/launchVerifier.js';
import { createReviewSnapshotFromOjs } from '../integrations/ojs/reviewSnapshot.js';
import { setReviewManuscriptFromOjs } from '../services/reviewManuscriptService.js';

export const ojsReviewRouter = Router();

ojsReviewRouter.get('/launch', async (request, response) => {
  const payload = typeof request.query.payload === 'string' ? request.query.payload : '';
  const signature = typeof request.query.signature === 'string' ? request.query.signature : '';
  const assignmentId = typeof request.query.assignmentId === 'string'
    ? request.query.assignmentId.trim()
    : '';

  if (!payload || !signature || !assignmentId) {
    response.status(400).json({
      error: {
        code: 'MISSING_REVIEW_LAUNCH_DATA',
        message: 'The review assignment, launch payload and signature are required.',
      },
    });
    return;
  }

  try {
    const verified = await verifyOjsLaunch(payload, signature);
    const submissionId = verified.claims.submission?.externalId;
    if (!submissionId) {
      throw new Error('The OJS review launch does not identify a submission.');
    }

    const ojsData = await loadOjsLaunchData(verified.claims, payload, signature);
    const snapshot = createReviewSnapshotFromOjs(ojsData);
    await setReviewManuscriptFromOjs(assignmentId, submissionId, snapshot);

    const target = new URL('/', `${request.protocol}://${request.get('host')}`);
    target.searchParams.set('review', '1');
    target.searchParams.set('assignmentId', assignmentId);
    response.setHeader('Cache-Control', 'no-store, max-age=0');
    response.redirect(303, `${target.pathname}${target.search}`);
  } catch (error) {
    response.status(401).json({
      error: {
        code: 'INVALID_REVIEW_LAUNCH',
        message: error instanceof Error ? error.message : 'OJS review launch failed.',
      },
    });
  }
});
