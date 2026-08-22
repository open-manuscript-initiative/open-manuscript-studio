import { createHash, randomBytes } from 'node:crypto';

import { Router } from 'express';

import { env } from '../config/env.js';
import {
  encodeOrcidStateReturnPath,
  normalizeNativeReturnOrigin,
} from '../integrations/nativeAuthHandoff.js';
import { identityPrisma } from '../lib/identityPrisma.js';
import {
  requireSession,
  type AuthenticatedRequest,
} from '../middleware/requireSession.js';

export const orcidLinkStartRouter = Router();

const STATE_TTL_MINUTES = 10;

orcidLinkStartRouter.post(
  '/auth/orcid/link/start',
  requireSession,
  async (request: AuthenticatedRequest, response) => {
    if (!env.ORCID_CLIENT_ID || !env.ORCID_CLIENT_SECRET) {
      response.status(503).json({
        error: {
          code: 'ORCID_NOT_CONFIGURED',
          message: 'ORCID sign-in is not configured.',
        },
      });
      return;
    }

    const requestedNativeReturnOrigin = typeof request.body?.returnOrigin === 'string'
      ? request.body.returnOrigin
      : undefined;
    const nativeReturnOrigin = requestedNativeReturnOrigin
      ? normalizeNativeReturnOrigin(requestedNativeReturnOrigin)
      : undefined;

    if (requestedNativeReturnOrigin && !nativeReturnOrigin) {
      response.status(400).json({
        error: {
          code: 'INVALID_NATIVE_RETURN_ORIGIN',
          message: 'The native authentication return origin is not supported.',
        },
      });
      return;
    }

    const state = randomBytes(32).toString('base64url');
    const nonce = randomBytes(32).toString('base64url');
    await identityPrisma.oAuthLoginState.create({
      data: {
        stateHash: hash(state),
        provider: 'ORCID',
        mode: 'link',
        userId: request.authUserId!,
        invitationToken: null,
        returnPath: encodeOrcidStateReturnPath(hash(nonce), nativeReturnOrigin),
        expiresAt: new Date(Date.now() + STATE_TTL_MINUTES * 60 * 1000),
      },
    });

    const authorizeUrl = new URL('/oauth/authorize', env.ORCID_BASE_URL);
    authorizeUrl.searchParams.set('client_id', env.ORCID_CLIENT_ID);
    authorizeUrl.searchParams.set('response_type', 'code');
    authorizeUrl.searchParams.set('scope', 'openid');
    authorizeUrl.searchParams.set(
      'redirect_uri',
      env.ORCID_REDIRECT_URI || `${env.FRONTEND_ORIGIN.replace(/\/$/, '')}/api/auth/orcid/callback`,
    );
    authorizeUrl.searchParams.set('state', state);
    authorizeUrl.searchParams.set('nonce', nonce);

    response.status(200).json({ url: authorizeUrl.toString() });
  },
);

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
