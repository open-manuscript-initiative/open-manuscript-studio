import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { Router } from 'express';
import { z } from 'zod';

import { env } from '../config/env.js';
import {
  exchangeMendeleyAuthorizationCode,
  getReferenceManagerRecord,
  mendeleyRedirectUri,
  mendeleyServerConfigured,
  searchReferenceManager,
  storeExactMendeleyTokenSet,
  type ReferenceManagerProvider,
} from '../integrations/referenceManagers/referenceManagerService.js';
import {
  requireSession,
  type AuthenticatedRequest,
} from '../middleware/requireSession.js';

export const referenceManagerRouter = Router();

const providerSchema = z.enum(['zotero', 'mendeley']);
const querySchema = z.string().trim().min(2).max(500);
const oauthStartSchema = z.object({
  returnPath: z.string().trim().max(1024).optional(),
  returnOrigin: z.string().trim().max(2048).optional(),
});

referenceManagerRouter.get(
  '/integrations/reference-managers/:provider/search',
  requireSession,
  async (request: AuthenticatedRequest, response) => {
    const provider = providerSchema.safeParse(request.params.provider);
    const query = querySchema.safeParse(request.query.q);
    if (!provider.success || !query.success) {
      response.status(400).json({
        error: {
          code: 'INVALID_REFERENCE_MANAGER_SEARCH',
          message: 'A supported reference manager and a search query are required.',
        },
      });
      return;
    }

    try {
      const result = await searchReferenceManager(
        request.authUserId!,
        provider.data,
        query.data,
      );
      response.status(200).json({
        provider: provider.data,
        ...result,
      });
    } catch (error) {
      response.status(502).json({
        error: {
          code: 'REFERENCE_MANAGER_SEARCH_FAILED',
          message:
            error instanceof Error
              ? error.message
              : 'Reference-manager search failed.',
        },
      });
    }
  },
);

referenceManagerRouter.get(
  '/integrations/reference-managers/:provider/records/:externalId',
  requireSession,
  async (request: AuthenticatedRequest, response) => {
    const provider = providerSchema.safeParse(request.params.provider);
    const externalId = z.string().trim().min(1).max(256).safeParse(
      request.params.externalId,
    );
    if (!provider.success || !externalId.success) {
      response.status(400).json({
        error: {
          code: 'INVALID_REFERENCE_MANAGER_RECORD',
          message: 'A supported reference manager and record identifier are required.',
        },
      });
      return;
    }

    try {
      const record = await getReferenceManagerRecord(
        request.authUserId!,
        provider.data,
        externalId.data,
      );
      response.status(200).json({
        provider: provider.data,
        record,
      });
    } catch (error) {
      response.status(502).json({
        error: {
          code: 'REFERENCE_MANAGER_RECORD_FAILED',
          message:
            error instanceof Error
              ? error.message
              : 'Reference-manager record request failed.',
        },
      });
    }
  },
);

referenceManagerRouter.post(
  '/integrations/mendeley/oauth/start',
  requireSession,
  (request: AuthenticatedRequest, response) => {
    if (!mendeleyServerConfigured()) {
      response.status(503).json({
        error: {
          code: 'MENDELEY_NOT_CONFIGURED',
          message: 'Mendeley OAuth is not configured on this Studio server.',
        },
      });
      return;
    }

    const body = oauthStartSchema.safeParse(request.body ?? {});
    if (!body.success) {
      response.status(400).json({
        error: {
          code: 'INVALID_MENDELEY_OAUTH_REQUEST',
          message: 'The Mendeley authorization request is invalid.',
        },
      });
      return;
    }

    const returnOrigin = normalizeReturnOrigin(body.data.returnOrigin);
    if (body.data.returnOrigin && !returnOrigin) {
      response.status(400).json({
        error: {
          code: 'INVALID_NATIVE_RETURN_ORIGIN',
          message: 'The native authentication return origin is not supported.',
        },
      });
      return;
    }

    const state = issueOAuthState({
      provider: 'mendeley',
      userId: request.authUserId!,
      nonce: randomBytes(24).toString('base64url'),
      expiresAt: Date.now() + 10 * 60 * 1000,
      returnPath: safeReturnPath(body.data.returnPath),
      ...(returnOrigin ? { returnOrigin } : {}),
    });
    const url = new URL('https://api.mendeley.com/oauth/authorize');
    url.searchParams.set('client_id', env.MENDELEY_CLIENT_ID!);
    url.searchParams.set('redirect_uri', mendeleyRedirectUri());
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'all');
    url.searchParams.set('state', state);

    response.status(200).json({
      authorizationUrl: url.toString(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
  },
);

referenceManagerRouter.get(
  '/integrations/mendeley/oauth/callback',
  async (request, response) => {
    const stateValue =
      typeof request.query.state === 'string' ? request.query.state : '';
    const code = typeof request.query.code === 'string'
      ? request.query.code.trim()
      : '';
    const providerError =
      typeof request.query.error === 'string' ? request.query.error : '';

    let state: OAuthState | null;
    try {
      state = verifyOAuthState(stateValue);
    } catch {
      state = null;
    }

    if (!state || state.provider !== 'mendeley') {
      response.status(400).send('Mendeley authorization state is invalid or expired.');
      return;
    }

    if (providerError || !code) {
      redirectResult(response, state, {
        status: 'error',
        error:
          providerError === 'access_denied'
            ? 'access_denied'
            : 'authorization_failed',
      });
      return;
    }

    try {
      const token = await exchangeMendeleyAuthorizationCode(code);
      await storeExactMendeleyTokenSet(state.userId, token);
      redirectResult(response, state, { status: 'connected' });
    } catch (error) {
      console.error('[OMI Mendeley OAuth]', error);
      redirectResult(response, state, {
        status: 'error',
        error: 'exchange_failed',
      });
    }
  },
);

type OAuthReturnOrigin =
  | 'https://app.openmanuscript.org/auth/orcid'
  | 'openmanuscript://auth';

interface OAuthState {
  provider: ReferenceManagerProvider;
  userId: string;
  nonce: string;
  expiresAt: number;
  returnPath: string;
  returnOrigin?: OAuthReturnOrigin;
}

function issueOAuthState(state: OAuthState): string {
  const payload = Buffer.from(JSON.stringify(state)).toString('base64url');
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

function verifyOAuthState(value: string): OAuthState {
  const [payload, signature, extra] = value.split('.');
  if (!payload || !signature || extra) {
    throw new Error('Invalid OAuth state.');
  }
  const expected = sign(payload);
  const suppliedBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  if (
    suppliedBytes.length !== expectedBytes.length ||
    !timingSafeEqual(suppliedBytes, expectedBytes)
  ) {
    throw new Error('Invalid OAuth state signature.');
  }

  const decoded = JSON.parse(
    Buffer.from(payload, 'base64url').toString('utf8'),
  ) as Partial<OAuthState>;
  if (
    decoded.provider !== 'mendeley' ||
    typeof decoded.userId !== 'string' ||
    !decoded.userId ||
    typeof decoded.nonce !== 'string' ||
    decoded.nonce.length < 16 ||
    typeof decoded.expiresAt !== 'number' ||
    decoded.expiresAt <= Date.now() ||
    typeof decoded.returnPath !== 'string'
  ) {
    throw new Error('Expired or malformed OAuth state.');
  }

  const returnOrigin =
    typeof decoded.returnOrigin === 'string'
      ? normalizeReturnOrigin(decoded.returnOrigin)
      : undefined;
  if (decoded.returnOrigin !== undefined && !returnOrigin) {
    throw new Error('OAuth state contains an unsupported return origin.');
  }

  return {
    provider: 'mendeley',
    userId: decoded.userId,
    nonce: decoded.nonce,
    expiresAt: decoded.expiresAt,
    returnPath: safeReturnPath(decoded.returnPath),
    ...(returnOrigin ? { returnOrigin } : {}),
  };
}

function sign(value: string): string {
  return createHmac(
    'sha256',
    Buffer.from(env.INTEGRATION_MASTER_KEY, 'hex'),
  )
    .update(value)
    .digest('base64url');
}

function normalizeReturnOrigin(
  value: string | undefined,
): OAuthReturnOrigin | undefined {
  if (!value) return undefined;
  const normalized = value.replace(/\/$/, '');
  if (normalized === 'https://app.openmanuscript.org/auth/orcid') {
    return 'https://app.openmanuscript.org/auth/orcid';
  }
  if (normalized === 'openmanuscript://auth') {
    return 'openmanuscript://auth';
  }
  return undefined;
}

function safeReturnPath(value: string | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/';
  return value;
}

function redirectResult(
  response: import('express').Response,
  state: OAuthState,
  result: { status: 'connected' | 'error'; error?: string },
): void {
  const params = new URLSearchParams({
    referenceManagerOAuth: result.status,
    provider: 'mendeley',
  });
  if (result.error) params.set('referenceManagerOAuthError', result.error);

  if (state.returnOrigin === 'https://app.openmanuscript.org/auth/orcid') {
    response.redirect(
      302,
      `https://app.openmanuscript.org/auth/orcid/#${params.toString()}`,
    );
    return;
  }
  if (state.returnOrigin === 'openmanuscript://auth') {
    response.redirect(
      302,
      `openmanuscript://auth/#${params.toString()}`,
    );
    return;
  }

  const url = new URL(env.FRONTEND_ORIGIN);
  url.pathname = state.returnPath;
  url.searchParams.set('referenceManagerOAuth', result.status);
  url.searchParams.set('provider', 'mendeley');
  if (result.error) {
    url.searchParams.set('referenceManagerOAuthError', result.error);
  }
  response.redirect(302, url.toString());
}
