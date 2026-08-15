import { createHash, randomBytes } from 'node:crypto';

import { Router, type Response } from 'express';

import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { consumeAssignmentInvitation } from '../services/assignmentInvitationService.js';

export const federatedAuthRouter = Router();

const COOKIE_NAME = 'omi_session';
const SESSION_TTL_DAYS = 30;
const STATE_TTL_MINUTES = 10;
const ORCID_ISSUER = new URL(env.ORCID_BASE_URL).origin;

federatedAuthRouter.get('/providers', async (request, response) => {
  const userId = await currentUserId(request.headers.cookie);
  const linkedOrcid = userId
    ? await prisma.userIdentity.findFirst({
        where: { userId, provider: 'ORCID', issuer: ORCID_ISSUER },
        select: { id: true, subject: true, displayName: true, createdAt: true },
      })
    : null;

  response.status(200).json({
    providers: {
      orcid: {
        enabled: orcidConfigured(),
        label: 'ORCID',
        linked: Boolean(linkedOrcid),
        identity: linkedOrcid
          ? {
              id: linkedOrcid.id,
              providerUserId: linkedOrcid.subject,
              displayName: linkedOrcid.displayName,
              connectedAt: linkedOrcid.createdAt.toISOString(),
            }
          : null,
      },
      oidc: { enabled: false, label: 'OpenID Connect' },
      saml: { enabled: false, label: 'SAML' },
    },
  });
});

federatedAuthRouter.get('/orcid/start', async (request, response) => {
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
  await prisma.oAuthLoginState.create({
    data: {
      stateHash: hash(state),
      provider: 'ORCID',
      mode,
      userId: userId ?? null,
      invitationToken: invitationToken ?? null,
      returnPath: '/',
      expiresAt: new Date(Date.now() + STATE_TTL_MINUTES * 60 * 1000),
    },
  });

  const authorizeUrl = new URL('/oauth/authorize', env.ORCID_BASE_URL);
  authorizeUrl.searchParams.set('client_id', env.ORCID_CLIENT_ID!);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('scope', '/authenticate');
  authorizeUrl.searchParams.set('redirect_uri', redirectUri());
  authorizeUrl.searchParams.set('state', state);
  response.redirect(302, authorizeUrl.toString());
});

federatedAuthRouter.get('/orcid/callback', async (request, response) => {
  const code = typeof request.query.code === 'string' ? request.query.code.trim() : '';
  const state = typeof request.query.state === 'string' ? request.query.state.trim() : '';
  if (!code || !state || !orcidConfigured()) {
    redirectError(response, 'orcid_callback_invalid');
    return;
  }

  const loginState = await prisma.oAuthLoginState.findUnique({
    where: { stateHash: hash(state) },
  });
  if (!loginState || loginState.expiresAt <= new Date() || loginState.provider !== 'ORCID') {
    redirectError(response, 'orcid_state_expired');
    return;
  }

  await prisma.oAuthLoginState.delete({ where: { id: loginState.id } }).catch(() => undefined);

  try {
    const token = await exchangeOrcidCode(code);
    const orcid = normalizeOrcid(token.orcid);
    if (!orcid) throw new Error('ORCID did not return an authenticated iD.');

    let userId: string | undefined;

    if (loginState.mode === 'link') {
      if (!loginState.userId) throw new Error('The Studio account to link could not be resolved.');
      const existingIdentity = await prisma.userIdentity.findUnique({
        where: { provider_issuer_subject: { provider: 'ORCID', issuer: ORCID_ISSUER, subject: orcid } },
      });
      if (existingIdentity && existingIdentity.userId !== loginState.userId) {
        throw new Error('This ORCID iD is already linked to another Studio account.');
      }
      const user = await prisma.user.findUnique({ where: { id: loginState.userId } });
      if (!user || user.status !== 'ACTIVE') throw new Error('The Studio account is not active.');
      await prisma.$transaction([
        prisma.user.update({ where: { id: user.id }, data: { orcid } }),
        prisma.userIdentity.upsert({
          where: { provider_issuer_subject: { provider: 'ORCID', issuer: ORCID_ISSUER, subject: orcid } },
          create: identityCreate(user.id, orcid, token.name || user.fullName, token.scope),
          update: { displayName: token.name || user.fullName, lastUsedAt: new Date() },
        }),
      ]);
      response.redirect(302, env.FRONTEND_ORIGIN);
      return;
    }

    if (loginState.mode === 'invite' && loginState.invitationToken) {
      const invitation = await consumeAssignmentInvitation(loginState.invitationToken);
      if (!invitation) throw new Error('The invitation is invalid or has expired.');
      const pending = await prisma.user.findUnique({ where: { id: invitation.userId } });
      if (!pending || pending.status !== 'PENDING') throw new Error('The invitation is no longer available.');
      const existingIdentity = await prisma.userIdentity.findUnique({
        where: { provider_issuer_subject: { provider: 'ORCID', issuer: ORCID_ISSUER, subject: orcid } },
      });
      if (existingIdentity && existingIdentity.userId !== pending.id) {
        throw new Error('This ORCID iD is already linked to another Studio account.');
      }
      await prisma.$transaction([
        prisma.user.update({
          where: { id: pending.id },
          data: { status: 'ACTIVE', orcid, fullName: token.name || pending.fullName, lastLoginAt: new Date() },
        }),
        prisma.userIdentity.upsert({
          where: { provider_issuer_subject: { provider: 'ORCID', issuer: ORCID_ISSUER, subject: orcid } },
          create: identityCreate(pending.id, orcid, token.name || pending.fullName, token.scope),
          update: { lastUsedAt: new Date(), displayName: token.name || pending.fullName },
        }),
        prisma.userInvitation.update({ where: { id: invitation.invitationId }, data: { usedAt: new Date() } }),
      ]);
      userId = pending.id;
    } else {
      const identity = await prisma.userIdentity.findUnique({
        where: { provider_issuer_subject: { provider: 'ORCID', issuer: ORCID_ISSUER, subject: orcid } },
      });
      if (identity) {
        userId = identity.userId;
      } else {
        const legacyUser = await prisma.user.findUnique({ where: { orcid } });
        if (legacyUser) {
          await prisma.userIdentity.create({
            data: identityCreate(legacyUser.id, orcid, token.name || legacyUser.fullName, token.scope),
          });
          userId = legacyUser.id;
        }
      }
    }

    if (!userId) {
      redirectError(response, 'orcid_not_linked');
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== 'ACTIVE') throw new Error('The Studio account is not active.');
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date(), orcid } });
    await prisma.userIdentity.updateMany({
      where: { userId: user.id, provider: 'ORCID', issuer: ORCID_ISSUER, subject: orcid },
      data: { lastUsedAt: new Date() },
    });

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
    console.error('[OMI ORCID OAuth]', error);
    redirectError(response, 'orcid_signin_failed');
  }
});

function identityCreate(userId: string, orcid: string, displayName: string, scope?: string) {
  return {
    userId,
    provider: 'ORCID' as const,
    issuer: ORCID_ISSUER,
    subject: orcid,
    displayName,
    profile: { scope: scope ?? '/authenticate' },
    lastUsedAt: new Date(),
  };
}

function orcidConfigured(): boolean {
  return Boolean(env.ORCID_CLIENT_ID && env.ORCID_CLIENT_SECRET);
}

function redirectUri(): string {
  return env.ORCID_REDIRECT_URI || `${env.FRONTEND_ORIGIN.replace(/\/$/, '')}/api/auth/orcid/callback`;
}

async function exchangeOrcidCode(code: string): Promise<{
  orcid: string | undefined;
  name: string | undefined;
  scope: string | undefined;
}> {
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
  const payload = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error(`ORCID token exchange failed with HTTP ${response.status}.`);
  return {
    orcid: typeof payload.orcid === 'string' ? payload.orcid : undefined,
    name: typeof payload.name === 'string' ? payload.name : undefined,
    scope: typeof payload.scope === 'string' ? payload.scope : undefined,
  };
}

async function currentUserId(cookieHeader: string | undefined): Promise<string | undefined> {
  if (!cookieHeader) return undefined;
  const token = cookieHeader
    .split(';')
    .map((part) => part.trim().split('='))
    .find(([name]) => name === COOKIE_NAME)?.slice(1).join('=');
  if (!token) return undefined;
  const session = await prisma.userSession.findUnique({
    where: { tokenHash: hash(decodeURIComponent(token)) },
    include: { user: true },
  });
  if (!session || session.expiresAt <= new Date() || session.user.status !== 'ACTIVE') return undefined;
  return session.userId;
}

async function createSession(userId: string) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.userSession.create({ data: { userId, tokenHash: hash(token), expiresAt } });
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
