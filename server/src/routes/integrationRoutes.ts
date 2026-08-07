import { Router } from 'express';

import { verifyOjsLaunch } from '../integrations/ojs/launchVerifier.js';

export const integrationRouter = Router();

integrationRouter.get(
  '/ojs/launch',
  async (request, response) => {
    const payload =
      typeof request.query.payload === 'string'
        ? request.query.payload
        : '';

    const signature =
      typeof request.query.signature === 'string'
        ? request.query.signature
        : '';

    if (!payload || !signature) {
      response.status(400).json({
        error: {
          code: 'MISSING_LAUNCH_ASSERTION',
          message:
            'The launch payload and signature are required.',
        },
      });
      return;
    }

    try {
      const verified = await verifyOjsLaunch(
        payload,
        signature,
      );

      response.status(200).json({
        protocol: 'omi-integration/1',
        profile: 'omi-integration/1/ojs',
        status: 'verified',
        installation: verified.installation,
        context:
          verified.claims.context ?? null,
        submission:
          verified.claims.submission ?? null,
        actor:
          verified.claims.actor ?? null,
        scope: verified.claims.scope ?? [],
        expiresAt: new Date(
          verified.claims.exp * 1000,
        ).toISOString(),
      });
    } catch (error) {
      response.status(401).json({
        error: {
          code: 'INVALID_LAUNCH_ASSERTION',
          message:
            error instanceof Error
              ? error.message
              : 'Launch verification failed.',
        },
      });
    }
  },
);
