import { createHash } from 'node:crypto';

import { Router } from 'express';

import { env } from '../config/env.js';
import { ensureStudioPrincipal } from '../identity/studioPrincipalBridge.js';
import { identityPrisma } from '../lib/identityPrisma.js';

export const federatedAuthRouter = Router();

const COOKIE_NAME = 'omi_session';
const ORCID_ISSUER = new URL(env.ORCID_BASE_URL).origin;

federatedAuthRouter.get('/providers', async (request, response) => {
  const userId = await currentUserId(request.headers.cookie);
  const linkedOrcid = userId
    ? await identityPrisma.userIdentity.findFirst({
        where: { userId, provider: 'ORCID', issuer: ORCID_ISSUER },
        select: { id: true, subject: true, displayName: true, createdAt: true },
      })
    : null;

  response.status(200).json({
    providers: {
      orcid: {
        enabled: orcidConfigured(),
        label: 'ORCID',
        environment: env.ORCID_ENVIRONMENT,
        issuer: ORCID_ISSUER,
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

federatedAuthRouter.delete('/orcid/link', async (request, response) => {
  const userId = await currentUserId(request.headers.cookie);
  if (!userId) {
    response.status(401).json({
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Sign in before disconnecting an ORCID iD.',
      },
    });
    return;
  }

  const linkedIdentities = await identityPrisma.userIdentity.findMany({
    where: { userId, provider: 'ORCID', issuer: ORCID_ISSUER },
    select: { id: true, subject: true },
  });

  if (linkedIdentities.length === 0) {
    response.status(204).end();
    return;
  }

  const subjects = new Set(linkedIdentities.map((identity) => identity.subject));
  const user = await identityPrisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    response.status(401).json({
      error: { code: 'AUTHENTICATION_REQUIRED', message: 'The Identity account could not be resolved.' },
    });
    return;
  }

  await identityPrisma.$transaction([
    identityPrisma.userIdentity.deleteMany({
      where: { userId, provider: 'ORCID', issuer: ORCID_ISSUER },
    }),
    ...(user.orcid && subjects.has(user.orcid)
      ? [identityPrisma.user.update({ where: { id: userId }, data: { orcid: null } })]
      : []),
  ]);

  const updated = await identityPrisma.user.findUnique({ where: { id: userId } });
  if (updated) {
    await ensureStudioPrincipal({
      id: updated.id,
      email: updated.email,
      fullName: updated.fullName,
      affiliation: updated.affiliation,
      affiliationRorId: updated.affiliationRorId,
      orcid: updated.orcid,
      interfaceLanguage: updated.interfaceLanguage,
      status: updated.status,
      lastLoginAt: updated.lastLoginAt,
    });
  }

  response.status(204).end();
});

function orcidConfigured(): boolean {
  return Boolean(env.ORCID_CLIENT_ID && env.ORCID_CLIENT_SECRET);
}

async function currentUserId(cookieHeader: string | undefined): Promise<string | undefined> {
  if (!cookieHeader) return undefined;
  const token = cookieHeader
    .split(';')
    .map((part) => part.trim().split('='))
    .find(([name]) => name === COOKIE_NAME)?.slice(1).join('=');
  if (!token) return undefined;

  const session = await identityPrisma.userSession.findUnique({
    where: { tokenHash: hash(decodeURIComponent(token)) },
    include: { user: true },
  });
  if (!session || session.expiresAt <= new Date() || session.user.status !== 'ACTIVE') return undefined;
  return session.userId;
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
