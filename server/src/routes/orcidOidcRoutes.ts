import { createHash, randomBytes } from 'node:crypto';

import { Router, type Response } from 'express';

import { env } from '../config/env.js';
import { ensureStudioPrincipal } from '../identity/studioPrincipalBridge.js';
import { validateOrcidIdToken, type OrcidOidcTokenResponse } from '../integrations/orcidOidc.js';
import { identityPrisma } from '../lib/identityPrisma.js';
import { prisma } from '../lib/prisma.js';
import { consumeAssignmentInvitation } from '../services/assignmentInvitationService.js';

export const orcidOidcRouter = Router();

const COOKIE_NAME = 'omi_session';
const SESSION_TTL_DAYS = 30;
const STATE_TTL_MINUTES = 10;
const ORCID_ISSUER = new URL(env.ORCID_BASE_URL).origin;
const NONCE_PREFIX = 'oidc-nonce:';

orcidOidcRouter.get('/orcid/start', async (request, response) => {
  if (!orcidConfigured()) {
    response.status(503).json({ error: { code: 'ORCID_NOT_CONFIGURED', message: 'ORCID sign-in is not configured.' } });
    return;
  }

  const requestedMode = typeof request.query.mode === 'string' ? request.query.mode : 'login';
  const mode = requestedMode === 'invite' || requestedMode === 'link' ? requestedMode : 'login';
  const invitationToken = mode === 'invite' && typeof request.query.invite === 'string'
    ? request.query.invite.trim()
    : undefined;
  const userId = mode === 'link' ? await currentUserId(request.headers.cookie) : undefined;

  if (mode === 'invite' && !invitationToken) {
    response.status(400).json({ error: { code: 'INVITATION_REQUIRED', message: 'An invitation token is required.' } });
    return;
  }
  if (mode === 'link' && !userId) {
    response.status(401).json({ error: { code: 'AUTHENTICATION_REQUIRED', message: 'Sign in before linking an ORCID iD.' } });
    return;
  }

  const state = randomBytes(32).toString('base64url');
  const nonce = randomBytes(32).toString('base64url');
  await identityPrisma.oAuthLoginState.create({
    data: {
      stateHash: hash(state),
      provider: 'ORCID',
      mode,
      userId: userId ?? null,
      invitationToken: invitationToken ?? null,
      returnPath: `${NONCE_PREFIX}${hash(nonce)}`,
      expiresAt: new Date(Date.now() + STATE_TTL_MINUTES * 60 * 1000),
    },
  });

  const authorizeUrl = new URL('/oauth/authorize', env.ORCID_BASE_URL);
  authorizeUrl.searchParams.set('client_id', env.ORCID_CLIENT_ID!);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('scope', 'openid');
  authorizeUrl.searchParams.set('redirect_uri', redirectUri());
  authorizeUrl.searchParams.set('state', state);
  authorizeUrl.searchParams.set('nonce', nonce);
  response.redirect(302, authorizeUrl.toString());
});

orcidOidcRouter.get('/orcid/callback', async (request, response) => {
  const code = typeof request.query.code === 'string' ? request.query.code.trim() : '';
  const state = typeof request.query.state === 'string' ? request.query.state.trim() : '';
  if (!code || !state || !orcidConfigured()) {
    redirectError(response, 'orcid_callback_invalid');
    return;
  }

  const loginState = await identityPrisma.oAuthLoginState.findUnique({ where: { stateHash: hash(state) } });
  if (!loginState || loginState.expiresAt <= new Date() || loginState.provider !== 'ORCID') {
    redirectError(response, 'orcid_state_expired');
    return;
  }

  const expectedNonceHash = loginState.returnPath?.startsWith(NONCE_PREFIX)
    ? loginState.returnPath.slice(NONCE_PREFIX.length)
    : '';
  await identityPrisma.oAuthLoginState.delete({ where: { id: loginState.id } }).catch(() => undefined);

  if (!expectedNonceHash) {
    redirectError(response, 'orcid_nonce_missing');
    return;
  }

  try {
    const token = await exchangeOrcidCode(code);
    if (!token.id_token) throw new Error('ORCID did not return an OpenID Connect ID token.');

    const claims = await validateOrcidIdToken({
      baseUrl: env.ORCID_BASE_URL,
      clientId: env.ORCID_CLIENT_ID!,
      idToken: token.id_token,
      expectedNonceHash,
      hash,
    });

    const orcid = normalizeOrcid(typeof claims.sub === 'string' ? claims.sub : token.orcid);
    if (!orcid) throw new Error('ORCID did not return a valid authenticated iD.');
    const displayName = typeof token.name === 'string' && token.name.trim() ? token.name.trim() : undefined;
    const amr = Array.isArray(claims.amr) ? claims.amr.filter((value): value is string => typeof value === 'string') : undefined;

    let userId: string | undefined;

    if (loginState.mode === 'link') {
      if (!loginState.userId) throw new Error('The Studio account to link could not be resolved.');
      const existingIdentity = await identityPrisma.userIdentity.findUnique({
        where: { provider_issuer_subject: { provider: 'ORCID', issuer: ORCID_ISSUER, subject: orcid } },
      });
      if (existingIdentity && existingIdentity.userId !== loginState.userId) {
        throw new Error('This ORCID iD is already linked to another Studio account.');
      }
      const user = await identityPrisma.user.findUnique({ where: { id: loginState.userId } });
      if (!user || user.status !== 'ACTIVE') throw new Error('The Studio account is not active.');
      const updated = await identityPrisma.user.update({ where: { id: user.id }, data: { orcid } });
      await identityPrisma.userIdentity.upsert({
        where: { provider_issuer_subject: { provider: 'ORCID', issuer: ORCID_ISSUER, subject: orcid } },
        create: identityCreate(user.id, orcid, displayName || user.fullName, token.scope, amr),
        update: { displayName: displayName || user.fullName, profile: identityProfile(token.scope, amr), lastUsedAt: new Date() },
      });
      await ensureStudioPrincipal(toPrincipalSnapshot(updated));
      response.redirect(302, env.FRONTEND_ORIGIN);
      return;
    }

    if (loginState.mode === 'invite' && loginState.invitationToken) {
      const invitation = await consumeAssignmentInvitation(loginState.invitationToken);
      if (!invitation) throw new Error('The invitation is invalid or has expired.');
      const pending = await prisma.user.findUnique({ where: { id: invitation.userId } });
      if (!pending || pending.status !== 'PENDING') throw new Error('The invitation is no longer available.');

      const existingIdentity = await identityPrisma.userIdentity.findUnique({
        where: { provider_issuer_subject: { provider: 'ORCID', issuer: ORCID_ISSUER, subject: orcid } },
      });
      if (existingIdentity && existingIdentity.userId !== pending.id) {
        throw new Error('This ORCID iD is already linked to another Studio account.');
      }

      const existingUser = await identityPrisma.user.findUnique({ where: { email: pending.email } });
      if (existingUser && existingUser.id !== pending.id) {
        throw new Error('This e-mail address is already linked to another Identity account.');
      }
      const now = new Date();
      const identityUser = existingUser
        ? await identityPrisma.user.update({
            where: { id: existingUser.id },
            data: { status: 'ACTIVE', orcid, fullName: displayName || pending.fullName, lastLoginAt: now },
          })
        : await identityPrisma.user.create({
            data: {
              id: pending.id,
              email: pending.email,
              passwordHash: `orcid-only:${randomBytes(32).toString('hex')}`,
              fullName: displayName || pending.fullName,
              affiliation: pending.affiliation,
              affiliationRorId: pending.affiliationRorId,
              orcid,
              interfaceLanguage: pending.interfaceLanguage,
              status: 'ACTIVE',
              createdAt: pending.createdAt,
              lastLoginAt: now,
            },
          });
      await identityPrisma.userIdentity.upsert({
        where: { provider_issuer_subject: { provider: 'ORCID', issuer: ORCID_ISSUER, subject: orcid } },
        create: identityCreate(identityUser.id, orcid, displayName || identityUser.fullName, token.scope, amr),
        update: { lastUsedAt: now, displayName: displayName || identityUser.fullName, profile: identityProfile(token.scope, amr) },
      });
      await ensureStudioPrincipal(toPrincipalSnapshot(identityUser));
      await prisma.userInvitation.update({ where: { id: invitation.invitationId }, data: { usedAt: now } });
      userId = identityUser.id;
    } else {
      const identity = await identityPrisma.userIdentity.findUnique({
        where: { provider_issuer_subject: { provider: 'ORCID', issuer: ORCID_ISSUER, subject: orcid } },
      });
      if (identity) {
        userId = identity.userId;
      } else {
        const legacyUser = await prisma.user.findUnique({ where: { orcid } });
        if (legacyUser) {
          const identityUser = await ensureLegacyIdentityUser(legacyUser);
          await identityPrisma.userIdentity.create({
            data: identityCreate(identityUser.id, orcid, displayName || identityUser.fullName, token.scope, amr),
          });
          userId = identityUser.id;
        }
      }
    }

    if (!userId) {
      redirectError(response, 'orcid_not_linked');
      return;
    }

    const user = await identityPrisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== 'ACTIVE') throw new Error('The Studio account is not active.');
    const updated = await identityPrisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date(), orcid } });
    await identityPrisma.userIdentity.updateMany({
      where: { userId: user.id, provider: 'ORCID', issuer: ORCID_ISSUER, subject: orcid },
      data: { lastUsedAt: new Date(), profile: identityProfile(token.scope, amr) },
    });
    await ensureStudioPrincipal(toPrincipalSnapshot(updated));

    const session = await createSession(user.id);
    response.cookie(COOKIE_NAME, session.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.NODE_ENV === 'production',
      expires: session.expiresAt,
      path: '/',
    });
    response.redirect(302, env.FRONTEND_ORIGIN);
  } catch (error) {
    console.error('[OMI ORCID OpenID Connect]', error);
    redirectError(response, 'orcid_signin_failed');
  }
});

async function ensureLegacyIdentityUser(legacy: {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  affiliation: string | null;
  affiliationRorId: string | null;
  orcid: string | null;
  interfaceLanguage: string;
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'DISABLED';
  createdAt: Date;
  lastLoginAt: Date | null;
}) {
  const existing = await identityPrisma.user.findUnique({ where: { id: legacy.id } });
  if (existing) return existing;
  return identityPrisma.user.create({
    data: {
      id: legacy.id,
      email: legacy.email,
      passwordHash: legacy.passwordHash,
      fullName: legacy.fullName,
      affiliation: legacy.affiliation,
      affiliationRorId: legacy.affiliationRorId,
      orcid: legacy.orcid,
      interfaceLanguage: legacy.interfaceLanguage,
      status: legacy.status,
      createdAt: legacy.createdAt,
      lastLoginAt: legacy.lastLoginAt,
    },
  });
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

function identityProfile(scope?: string, amr?: string[]) {
  return { scope: scope ?? 'openid', protocol: 'openid-connect', ...(amr?.length ? { amr } : {}) };
}

function identityCreate(userId: string, orcid: string, displayName: string, scope?: string, amr?: string[]) {
  return {
    userId,
    provider: 'ORCID' as const,
    issuer: ORCID_ISSUER,
    subject: orcid,
    displayName,
    profile: identityProfile(scope, amr),
    lastUsedAt: new Date(),
  };
}

function orcidConfigured(): boolean {
  return Boolean(env.ORCID_CLIENT_ID && env.ORCID_CLIENT_SECRET);
}

function redirectUri(): string {
  return env.ORCID_REDIRECT_URI || `${env.FRONTEND_ORIGIN.replace(/\/$/, '')}/api/auth/orcid/callback`;
}

async function exchangeOrcidCode(code: string): Promise<OrcidOidcTokenResponse> {
  const body = new URLSearchParams({
    client_id: env.ORCID_CLIENT_ID!,
    client_secret: env.ORCID_CLIENT_SECRET!,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri(),
  });
  const response = await fetch(new URL('/oauth/token', env.ORCID_BASE_URL), {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(20_000),
  });
  const payload = await response.json() as OrcidOidcTokenResponse;
  if (!response.ok) throw new Error(`ORCID token exchange failed with HTTP ${response.status}.`);
  return payload;
}

async function currentUserId(cookieHeader: string | undefined): Promise<string | undefined> {
  if (!cookieHeader) return undefined;
  const token = cookieHeader.split(';').map((part) => part.trim().split('='))
    .find(([name]) => name === COOKIE_NAME)?.slice(1).join('=');
  if (!token) return undefined;
  const session = await identityPrisma.userSession.findUnique({
    where: { tokenHash: hash(decodeURIComponent(token)) },
    include: { user: true },
  });
  if (!session || session.expiresAt <= new Date() || session.user.status !== 'ACTIVE') return undefined;
  return session.userId;
}

async function createSession(userId: string) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await identityPrisma.userSession.create({ data: { userId, tokenHash: hash(token), expiresAt } });
  return { token, expiresAt };
}

function normalizeOrcid(value: string | undefined): string | undefined {
  const normalized = value?.trim().replace(/^https?:\/\/(?:www\.)?orcid\.org\//i, '').toUpperCase();
  return normalized && /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(normalized) ? normalized : undefined;
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function redirectError(response: Response, code: string): void {
  const url = new URL(env.FRONTEND_ORIGIN);
  url.searchParams.set('authError', code);
  response.redirect(302, url.toString());
}
