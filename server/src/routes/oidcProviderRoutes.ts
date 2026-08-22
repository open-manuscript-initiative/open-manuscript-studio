import { randomBytes } from 'node:crypto';

import { Router, type Request, type Response } from 'express';

import { env } from '../config/env.js';
import { ensureStudioPrincipal } from '../identity/studioPrincipalBridge.js';
import {
  buildNativeAuthReturnUrl,
  normalizeNativeReturnOrigin,
} from '../integrations/nativeAuthHandoff.js';
import {
  buildOidcAuthorization,
  createPkceVerifier,
  exchangeOidcCode,
  getOidcProviderConfig,
  hash,
  validateOidcToken,
  type OidcProfile,
  type OidcProviderConfig,
  type OidcProviderKey,
} from '../integrations/oidcProvider.js';
import { identityPrisma } from '../lib/identityPrisma.js';
import { getUserIdForSession } from '../services/authService.js';

export const oidcProviderRouter = Router();

const COOKIE_NAME = 'omi_session';
const STATE_TTL_MINUTES = 10;
const NATIVE_HANDOFF_TTL_MINUTES = 2;

type OidcStateMetadata = {
  providerKey: OidcProviderKey;
  expectedNonceHash: string;
  codeVerifier: string;
  nativeReturnOrigin?: string;
  locale?: string;
};

oidcProviderRouter.get('/oidc/:provider/start', async (request, response) => {
  const provider = getOidcProviderConfig(request.params.provider);
  if (!provider) {
    response.status(404).json({
      error: { code: 'OIDC_PROVIDER_NOT_CONFIGURED', message: 'This sign-in provider is not configured.' },
    });
    return;
  }

  const nativeRequested = request.query.native === '1';
  const nativeReturnOrigin = nativeRequested
    ? normalizeNativeReturnOrigin(
        typeof request.query.return_origin === 'string' ? request.query.return_origin : undefined,
      )
    : undefined;
  if (nativeRequested && !nativeReturnOrigin) {
    response.status(400).json({
      error: {
        code: 'INVALID_NATIVE_RETURN_ORIGIN',
        message: 'The native authentication return origin is not supported.',
      },
    });
    return;
  }

  try {
    const authorizeUrl = await issueOidcState({
      provider,
      mode: 'login',
      nativeReturnOrigin,
      locale: normalizeLocale(request.query.locale),
    });
    response.redirect(302, authorizeUrl);
  } catch (error) {
    console.error(`[OMI OIDC ${provider.key}] start failed`, error);
    response.status(502).json({
      error: { code: 'OIDC_START_FAILED', message: 'The external sign-in provider could not be opened.' },
    });
  }
});

oidcProviderRouter.post('/oidc/:provider/link/start', async (request, response) => {
  const provider = getOidcProviderConfig(request.params.provider);
  if (!provider) {
    response.status(404).json({
      error: { code: 'OIDC_PROVIDER_NOT_CONFIGURED', message: 'This sign-in provider is not configured.' },
    });
    return;
  }

  const sessionToken = readSessionToken(request);
  const userId = sessionToken ? await getUserIdForSession(sessionToken) : null;
  if (!userId) {
    response.status(401).json({
      error: { code: 'AUTHENTICATION_REQUIRED', message: 'Sign in before linking an external account.' },
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
      error: { code: 'INVALID_NATIVE_RETURN_ORIGIN', message: 'The native authentication return origin is not supported.' },
    });
    return;
  }

  try {
    const authorizeUrl = await issueOidcState({
      provider,
      mode: 'link',
      userId,
      nativeReturnOrigin,
      locale: normalizeLocale(request.body?.locale),
    });
    response.status(200).json({ authorizeUrl });
  } catch (error) {
    console.error(`[OMI OIDC ${provider.key}] link start failed`, error);
    response.status(502).json({
      error: { code: 'OIDC_START_FAILED', message: 'The external sign-in provider could not be opened.' },
    });
  }
});

oidcProviderRouter.get('/oidc/:provider/callback', async (request, response) => {
  const provider = getOidcProviderConfig(request.params.provider);
  const code = typeof request.query.code === 'string' ? request.query.code.trim() : '';
  const state = typeof request.query.state === 'string' ? request.query.state.trim() : '';
  if (!provider || !code || !state) {
    redirectError(response, 'oidc_callback_invalid');
    return;
  }

  const loginState = await identityPrisma.oAuthLoginState.findUnique({
    where: { stateHash: hash(state) },
  });
  if (!loginState || loginState.provider !== 'OIDC' || loginState.expiresAt <= new Date()) {
    redirectError(response, 'oidc_state_expired');
    return;
  }

  const metadata = decodeStateMetadata(loginState.returnPath);
  const expectedMode = `${provider.key}-${loginState.mode.endsWith('-link') ? 'link' : 'login'}`;
  if (!metadata || metadata.providerKey !== provider.key || loginState.mode !== expectedMode) {
    await identityPrisma.oAuthLoginState.delete({ where: { id: loginState.id } }).catch(() => undefined);
    redirectError(response, 'oidc_state_expired', metadata?.nativeReturnOrigin);
    return;
  }

  await identityPrisma.oAuthLoginState.delete({ where: { id: loginState.id } }).catch(() => undefined);

  try {
    const token = await exchangeOidcCode({
      provider,
      code,
      codeVerifier: metadata.codeVerifier,
    });
    const profile = await validateOidcToken({
      provider,
      token,
      expectedNonceHash: metadata.expectedNonceHash,
    });

    if (loginState.mode.endsWith('-link')) {
      if (!loginState.userId) throw new Error('The Studio account to link could not be resolved.');
      await linkOidcIdentity(loginState.userId, provider, profile);
      if (metadata.nativeReturnOrigin) {
        await redirectNativeHandoff(response, loginState.userId, metadata.nativeReturnOrigin);
      } else {
        response.redirect(302, env.FRONTEND_ORIGIN);
      }
      return;
    }

    const userId = await resolveLoginUser(provider, profile, metadata.locale);
    if (!userId) {
      redirectError(response, 'oidc_account_exists', metadata.nativeReturnOrigin);
      return;
    }

    const user = await identityPrisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== 'ACTIVE') throw new Error('The Studio account is not active.');

    const updated = await identityPrisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    await identityPrisma.userIdentity.updateMany({
      where: {
        userId: updated.id,
        provider: 'OIDC',
        issuer: profile.issuer,
        subject: profile.subject,
      },
      data: {
        lastUsedAt: new Date(),
        displayName: profile.displayName ?? updated.fullName,
        profile: identityProfile(provider, profile),
      },
    });
    await ensureStudioPrincipal(toPrincipalSnapshot(updated));

    if (metadata.nativeReturnOrigin) {
      await redirectNativeHandoff(response, updated.id, metadata.nativeReturnOrigin);
      return;
    }

    const session = await createSession(updated.id);
    setSessionCookie(response, session.token, session.expiresAt);
    response.redirect(302, env.FRONTEND_ORIGIN);
  } catch (error) {
    console.error(`[OMI OIDC ${provider.key}] callback failed`, error);
    redirectError(response, 'oidc_signin_failed', metadata.nativeReturnOrigin);
  }
});

async function issueOidcState(input: {
  provider: OidcProviderConfig;
  mode: 'login' | 'link';
  userId?: string;
  nativeReturnOrigin?: string;
  locale?: string;
}): Promise<string> {
  const state = randomBytes(32).toString('base64url');
  const nonce = randomBytes(32).toString('base64url');
  const codeVerifier = createPkceVerifier();
  const metadata: OidcStateMetadata = {
    providerKey: input.provider.key,
    expectedNonceHash: hash(nonce),
    codeVerifier,
    ...(input.nativeReturnOrigin ? { nativeReturnOrigin: input.nativeReturnOrigin } : {}),
    ...(input.locale ? { locale: input.locale } : {}),
  };

  await identityPrisma.oAuthLoginState.create({
    data: {
      stateHash: hash(state),
      provider: 'OIDC',
      mode: `${input.provider.key}-${input.mode}`,
      userId: input.userId ?? null,
      returnPath: JSON.stringify(metadata),
      expiresAt: new Date(Date.now() + STATE_TTL_MINUTES * 60 * 1000),
    },
  });

  return buildOidcAuthorization({
    provider: input.provider,
    state,
    nonce,
    codeVerifier,
  });
}

async function resolveLoginUser(
  provider: OidcProviderConfig,
  profile: OidcProfile,
  locale?: string,
): Promise<string | null> {
  const identity = await identityPrisma.userIdentity.findUnique({
    where: {
      provider_issuer_subject: {
        provider: 'OIDC',
        issuer: profile.issuer,
        subject: profile.subject,
      },
    },
  });
  if (identity) return identity.userId;

  if (!profile.email) throw new Error('The external identity provider did not return an e-mail address.');
  if (provider.requireVerifiedEmail && !profile.emailVerified) {
    throw new Error('The external identity provider did not verify the e-mail address.');
  }

  // Never silently attach a newly seen external identity to an existing local
  // account based on e-mail alone. The user must sign in locally and explicitly
  // link the provider from Account settings.
  const existingByEmail = await identityPrisma.user.findUnique({ where: { email: profile.email } });
  if (existingByEmail) return null;

  const now = new Date();
  const created = await identityPrisma.user.create({
    data: {
      email: profile.email,
      passwordHash: `oidc-only:${randomBytes(32).toString('hex')}`,
      fullName: profile.displayName || profile.email,
      interfaceLanguage: normalizeLocale(locale) ?? 'en',
      status: 'ACTIVE',
      lastLoginAt: now,
    },
  });
  await identityPrisma.userIdentity.create({
    data: {
      userId: created.id,
      provider: 'OIDC',
      issuer: profile.issuer,
      subject: profile.subject,
      displayName: profile.displayName || created.fullName,
      profile: identityProfile(provider, profile),
      lastUsedAt: now,
    },
  });
  await ensureStudioPrincipal(toPrincipalSnapshot(created));
  return created.id;
}

async function linkOidcIdentity(
  userId: string,
  provider: OidcProviderConfig,
  profile: OidcProfile,
): Promise<void> {
  const user = await identityPrisma.user.findUnique({ where: { id: userId } });
  if (!user || user.status !== 'ACTIVE') throw new Error('The Studio account is not active.');

  const existing = await identityPrisma.userIdentity.findUnique({
    where: {
      provider_issuer_subject: {
        provider: 'OIDC',
        issuer: profile.issuer,
        subject: profile.subject,
      },
    },
  });
  if (existing && existing.userId !== userId) {
    throw new Error('This external account is already linked to another Studio account.');
  }

  await identityPrisma.userIdentity.upsert({
    where: {
      provider_issuer_subject: {
        provider: 'OIDC',
        issuer: profile.issuer,
        subject: profile.subject,
      },
    },
    create: {
      userId,
      provider: 'OIDC',
      issuer: profile.issuer,
      subject: profile.subject,
      displayName: profile.displayName || user.fullName,
      profile: identityProfile(provider, profile),
      lastUsedAt: new Date(),
    },
    update: {
      displayName: profile.displayName || user.fullName,
      profile: identityProfile(provider, profile),
      lastUsedAt: new Date(),
    },
  });
}

async function redirectNativeHandoff(
  response: Response,
  userId: string,
  nativeReturnOrigin: string,
): Promise<void> {
  const handoffCode = randomBytes(32).toString('base64url');
  await identityPrisma.oAuthLoginState.create({
    data: {
      stateHash: hash(handoffCode),
      provider: 'OIDC',
      mode: 'native_handoff',
      userId,
      returnPath: null,
      expiresAt: new Date(Date.now() + NATIVE_HANDOFF_TTL_MINUTES * 60 * 1000),
    },
  });
  response.redirect(302, buildNativeAuthReturnUrl(nativeReturnOrigin, { handoffCode }));
}

function identityProfile(provider: OidcProviderConfig, profile: OidcProfile) {
  return {
    providerKey: provider.key,
    label: provider.label,
    email: profile.email ?? null,
    emailVerified: profile.emailVerified,
  };
}

function encodeStateMetadata(value: OidcStateMetadata): string {
  return JSON.stringify(value);
}

function decodeStateMetadata(value: string | null | undefined): OidcStateMetadata | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<OidcStateMetadata>;
    if (
      (parsed.providerKey !== 'google' && parsed.providerKey !== 'microsoft' && parsed.providerKey !== 'oidc') ||
      typeof parsed.expectedNonceHash !== 'string' || !/^[0-9a-f]{64}$/i.test(parsed.expectedNonceHash) ||
      typeof parsed.codeVerifier !== 'string' || parsed.codeVerifier.length < 43
    ) {
      return null;
    }
    const nativeReturnOrigin = typeof parsed.nativeReturnOrigin === 'string'
      ? normalizeNativeReturnOrigin(parsed.nativeReturnOrigin)
      : undefined;
    return {
      providerKey: parsed.providerKey,
      expectedNonceHash: parsed.expectedNonceHash,
      codeVerifier: parsed.codeVerifier,
      ...(nativeReturnOrigin ? { nativeReturnOrigin } : {}),
      ...(typeof parsed.locale === 'string' ? { locale: normalizeLocale(parsed.locale) } : {}),
    };
  } catch {
    return null;
  }
}

function normalizeLocale(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const locale = value.trim().toLowerCase();
  return locale === 'hu' || locale === 'de' || locale === 'en' ? locale : undefined;
}

function readSessionToken(request: Request): string | undefined {
  const authorization = request.headers.authorization?.trim();
  if (authorization?.toLowerCase().startsWith('bearer ')) {
    return authorization.slice(7).trim() || undefined;
  }
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === COOKIE_NAME) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

async function createSession(userId: string) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await identityPrisma.userSession.create({
    data: { userId, tokenHash: hash(token), expiresAt },
  });
  return { token, expiresAt };
}

function setSessionCookie(response: Response, token: string, expiresAt: Date): void {
  response.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    expires: expiresAt,
    path: '/',
  });
}

function redirectError(response: Response, code: string, nativeReturnOrigin?: string): void {
  if (nativeReturnOrigin) {
    response.redirect(302, buildNativeAuthReturnUrl(nativeReturnOrigin, { errorCode: code }));
    return;
  }
  const target = new URL(env.FRONTEND_ORIGIN);
  target.searchParams.set('authError', code);
  response.redirect(302, target.toString());
}

function toPrincipalSnapshot(user: {
  id: string;
  email: string;
  fullName: string;
  affiliation: string | null;
  affiliationRorId: string | null;
  orcid: string | null;
  interfaceLanguage: string;
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'DISABLED';
  lastLoginAt: Date | null;
}) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    affiliation: user.affiliation,
    affiliationRorId: user.affiliationRorId,
    orcid: user.orcid,
    interfaceLanguage: user.interfaceLanguage,
    status: user.status,
    lastLoginAt: user.lastLoginAt,
  };
}
