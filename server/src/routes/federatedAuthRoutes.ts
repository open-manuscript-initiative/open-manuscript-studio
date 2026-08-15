import { createHash, randomBytes } from 'node:crypto';

import { Router } from 'express';

import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { consumeAssignmentInvitation } from '../services/assignmentInvitationService.js';

export const federatedAuthRouter = Router();

const COOKIE_NAME = 'omi_session';
const SESSION_TTL_DAYS = 30;
const STATE_TTL_MINUTES = 10;
const ORCID_ISSUER = 'https://orcid.org';

federatedAuthRouter.get('/providers', (_request, response) => {
  response.status(200).json({
    providers: {
      orcid: {
        enabled: orcidConfigured(),
        label: 'ORCID',
      },
    },
  });
});

federatedAuthRouter.get('/orcid/start', async (request, response) => {
  if (!orcidConfigured()) {
    response.status(503).json({ error: { code: 'ORCID_NOT_CONFIGURED', message: 'ORCID sign-in is not configured.' } });
    return;
  }

  const mode = request.query.mode === 'invite' ? 'invite' : 'login';
  const invitationToken = mode === 'invite' && typeof request.query.invite === 'string'
    ? request.query.invite.trim()
    : undefined;

  if (mode === 'invite' && !invitationToken) {
    response.status(400).json({ error: { code: 'INVITATION_REQUIRED', message: 'An invitation token is required.' } });
    return;
  }

  const state = randomBytes(32).toString('base64url');
  await prisma.oAuthLoginState.create({
    data: {
      stateHash: hash(state),
      provider: 'ORCID',
      mode,
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
          data: {
            status: 'ACTIVE',
            orcid,
            fullName: pending.fullName || token.name || pending.email,
            lastLoginAt: new Date(),
          },
        }),
        prisma.userIdentity.upsert({
          where: { provider_issuer_subject: { provider: 'ORCID', issuer: ORCID_ISSUER, subject: orcid } },
          create: {
            userId: pending.id,
            provider: 'ORCID',
            issuer: ORCID_ISSUER,
            subject: orcid,
            displayName: token.name || pending.fullName,
            profile: { scope: token.scope ?? '/authenticate' },
            lastUsedAt: new Date(),
          },
          update: { lastUsedAt: new Date(), displayName: token.name || pending.fullName },
        }),
        prisma.userInvitation.update({
          where: { id: invitation.invitationId },
          data: { usedAt: new Date() },
        }),
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
            data: {
              userId: legacyUser.id,
              provider: 'ORCID',
              issuer: ORCID_ISSUER,
              subject: orcid,
              displayName: token.name || legacyUser.fullName,
              profile: { scope: token.scope ?? '/authenticate' },
              lastUsedAt: new Date(),
            },
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

function orcidConfigured(): boolean {
  return Boolean(env.ORCID_CLIENT_ID && env.ORCID_CLIENT_SECRET);
}

function redirectUri(): string {
  return env.ORCID_REDIRECT_URI || `${env.FRONTEND_ORIGIN.replace(/\/$/, '')}/api/auth/orcid/callback`;
}

async function exchangeOrcidCode(code: string): Promise<{ orcid?: string; name?: string; scope?: string }> {
  const body = new URLSearchParams({
    client_id: env.ORCID_CLIENT_ID!,
    client_secret: env.ORCID_CLIENT_SECRET!,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri(),
  });
  const response = await fetch(new URL('/oauth/token', env.ORCID_BASE_URL), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
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

async function createSession(userId: string) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await prisma.userSession.create({
    data: { userId, tokenHash: hash(token), expiresAt },
  });
  return { token, expiresAt };
}

function normalizeOrcid(value: string | undefined): string | undefined {
  const normalized = value?.trim().replace(/^https?:\/\/(?:www\.)?orcid\.org\//i, '').toUpperCase();
  return normalized && /^\d{4}-\d{4}-\d{4}-[\dX]{4}$/.test(normalized) ? normalized : undefined;
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function redirectError(response: Parameters<typeof federatedAuthRouter.get>[1] extends never ? never : any, code: string): void {
  const url = new URL(env.FRONTEND_ORIGIN);
  url.searchParams.set('authError', code);
  response.redirect(302, url.toString());
}
