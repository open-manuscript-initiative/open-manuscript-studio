import { Router } from 'express';
import { z } from 'zod';

import {
  consumeCloudOAuthState,
  createCloudOAuthAuthorization,
  exchangeCloudOAuthCode,
  getCloudOAuthProviderConfig,
  isCloudOAuthConfigured,
  listPublicCloudOAuthProviders,
  type CloudOAuthProviderKey,
} from '../cloud/oauth/cloudOAuth.js';
import { OAuthCloudProvider } from '../cloud/providers/oauth/OAuthCloudProvider.js';
import { env } from '../config/env.js';
import { encryptSecret } from '../integrations/secretCrypto.js';
import { prisma } from '../lib/prisma.js';
import {
  requireSession,
  type AuthenticatedRequest,
} from '../middleware/requireSession.js';

export const cloudOAuthRouter = Router();

const startSchema = z.object({
  accountType: z.enum(['personal', 'business']).default('personal'),
  displayName: z.string().trim().max(200).optional(),
  returnPath: z.string().trim().max(1024).optional(),
  returnOrigin: z.string().trim().max(2048).optional(),
});

const providerSchema = z.enum(['google-drive', 'onedrive', 'dropbox']);

cloudOAuthRouter.get(
  '/cloud/oauth/providers',
  requireSession,
  (_request, response) => {
    response.status(200).json({ providers: listPublicCloudOAuthProviders() });
  },
);

cloudOAuthRouter.post(
  '/cloud/oauth/:provider/start',
  requireSession,
  (request: AuthenticatedRequest, response) => {
    const parsedProvider = providerSchema.safeParse(request.params.provider);
    const parsedBody = startSchema.safeParse(request.body ?? {});
    if (!parsedProvider.success || !parsedBody.success) {
      response.status(400).json({
        error: {
          code: 'INVALID_CLOUD_OAUTH_REQUEST',
          message: 'The cloud OAuth 2.0 authorization request is invalid.',
        },
      });
      return;
    }

    const provider = getCloudOAuthProviderConfig(parsedProvider.data);
    if (!provider || !isCloudOAuthConfigured(provider)) {
      response.status(503).json({
        error: {
          code: 'CLOUD_OAUTH_NOT_CONFIGURED',
          message: `${provider?.label ?? parsedProvider.data} OAuth 2.0 is not configured on this Studio server.`,
        },
      });
      return;
    }

    const returnOrigin = normalizeReturnOrigin(parsedBody.data.returnOrigin);
    try {
      const authorization = createCloudOAuthAuthorization({
        provider,
        userId: request.authUserId!,
        accountType: parsedBody.data.accountType,
        displayName: parsedBody.data.displayName,
        native: Boolean(returnOrigin),
        returnPath: parsedBody.data.returnPath,
        returnOrigin,
      });
      response.status(200).json(authorization);
    } catch (error) {
      console.error('Cloud OAuth start failed:', error);
      response.status(500).json({
        error: {
          code: 'CLOUD_OAUTH_START_FAILED',
          message: 'The cloud OAuth 2.0 authorization could not be started.',
        },
      });
    }
  },
);

cloudOAuthRouter.get(
  '/cloud/oauth/:provider/callback',
  async (request, response) => {
    const parsedProvider = providerSchema.safeParse(request.params.provider);
    const stateValue = typeof request.query.state === 'string' ? request.query.state : '';
    if (!parsedProvider.success || !stateValue) {
      response.status(400).send('Invalid cloud OAuth callback.');
      return;
    }

    let state: ReturnType<typeof consumeCloudOAuthState>;
    try {
      state = consumeCloudOAuthState(stateValue);
    } catch (error) {
      console.error('Cloud OAuth state validation failed:', error);
      response.status(400).send('Cloud OAuth authorization state is invalid or expired.');
      return;
    }

    if (state.provider !== parsedProvider.data) {
      response.status(400).send('Cloud OAuth provider does not match the authorization state.');
      return;
    }

    const provider = getCloudOAuthProviderConfig(state.provider);
    if (!provider || !isCloudOAuthConfigured(provider)) {
      redirectResult(response, state.returnOrigin, state.returnPath, {
        status: 'error',
        provider: state.provider,
        error: 'not_configured',
      });
      return;
    }

    const providerError = typeof request.query.error === 'string' ? request.query.error : '';
    const code = typeof request.query.code === 'string' ? request.query.code.trim() : '';
    if (providerError || !code) {
      redirectResult(response, state.returnOrigin, state.returnPath, {
        status: 'error',
        provider: state.provider,
        error: providerError === 'access_denied' ? 'access_denied' : 'authorization_failed',
      });
      return;
    }

    try {
      const credentials = await exchangeCloudOAuthCode({
        provider,
        code,
        codeVerifier: state.codeVerifier,
      });
      const runtimeProvider = new OAuthCloudProvider(credentials);
      const connectionStatus = await runtimeProvider.getStatus();
      if (connectionStatus.state !== 'connected') {
        throw new Error(connectionStatus.message ?? 'Cloud connection test failed after OAuth authorization.');
      }

      const encrypted = encryptSecret(JSON.stringify(credentials));
      await prisma.cloudConnection.create({
        data: {
          userId: state.userId,
          providerType: databaseProviderType(state.provider),
          displayName: state.displayName,
          status: 'CONNECTED',
          encryptedCredentials: JSON.stringify(encrypted),
          lastVerifiedAt: new Date(),
        },
      });

      redirectResult(response, state.returnOrigin, state.returnPath, {
        status: 'connected',
        provider: state.provider,
      });
    } catch (error) {
      console.error('Cloud OAuth callback failed:', error);
      redirectResult(response, state.returnOrigin, state.returnPath, {
        status: 'error',
        provider: state.provider,
        error: 'exchange_failed',
      });
    }
  },
);

function databaseProviderType(
  provider: CloudOAuthProviderKey,
): 'GOOGLE_DRIVE' | 'ONEDRIVE' | 'DROPBOX' {
  if (provider === 'google-drive') return 'GOOGLE_DRIVE';
  if (provider === 'onedrive') return 'ONEDRIVE';
  return 'DROPBOX';
}

function normalizeReturnOrigin(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.replace(/\/$/, '');
  if (
    normalized === 'https://app.openmanuscript.org/auth/orcid' ||
    normalized === 'openmanuscript://auth'
  ) {
    return normalized;
  }
  return undefined;
}

function redirectResult(
  response: import('express').Response,
  returnOrigin: string | undefined,
  returnPath: string,
  result: {
    status: 'connected' | 'error';
    provider: CloudOAuthProviderKey;
    error?: string;
  },
): void {
  const params = new URLSearchParams({
    cloudOAuth: result.status,
    provider: result.provider,
  });
  if (result.error) params.set('cloudOAuthError', result.error);

  if (returnOrigin) {
    response.redirect(302, `${returnOrigin}/#${params.toString()}`.replace('auth//#', 'auth/#'));
    return;
  }

  const base = new URL(env.FRONTEND_ORIGIN);
  const safePath = returnPath.startsWith('/') && !returnPath.startsWith('//') ? returnPath : '/';
  base.pathname = safePath;
  base.searchParams.set('cloudOAuth', result.status);
  base.searchParams.set('provider', result.provider);
  if (result.error) base.searchParams.set('cloudOAuthError', result.error);
  response.redirect(302, base.toString());
}
