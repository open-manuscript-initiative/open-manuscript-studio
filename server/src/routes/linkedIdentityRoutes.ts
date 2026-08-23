import { Router, type Request } from 'express';

import { env } from '../config/env.js';
import { ensureStudioPrincipal } from '../identity/studioPrincipalBridge.js';
import { identityPrisma } from '../lib/identityPrisma.js';
import { getUserIdForSession } from '../services/authService.js';

export const linkedIdentityRouter = Router();

const COOKIE_NAME = 'omi_session';
const ORCID_ISSUER = new URL(env.ORCID_BASE_URL).origin;

type IdentityProfile = Record<string, unknown>;

linkedIdentityRouter.get('/identities', async (request, response) => {
  const userId = await currentUserId(request);
  if (!userId) {
    response.status(401).json({
      error: { code: 'AUTHENTICATION_REQUIRED', message: 'Sign in to manage linked identities.' },
    });
    return;
  }

  const user = await identityPrisma.user.findUnique({
    where: { id: userId },
    include: {
      identities: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!user) {
    response.status(401).json({
      error: { code: 'AUTHENTICATION_REQUIRED', message: 'The Identity account could not be resolved.' },
    });
    return;
  }

  const passwordEnabled = hasUsablePassword(user.passwordHash);
  const signInMethodCount = user.identities.length + (passwordEnabled ? 1 : 0);

  response.status(200).json({
    localCredential: {
      type: 'password',
      email: user.email,
      enabled: passwordEnabled,
    },
    identities: user.identities.map((identity) => {
      const profile = asProfile(identity.profile);
      const providerKey = readProviderKey(identity.provider, profile);
      return {
        id: identity.id,
        provider: identity.provider,
        providerKey,
        label: readIdentityLabel(identity.provider, profile),
        issuer: identity.issuer,
        subject: identity.subject,
        displayName: identity.displayName,
        email: readOptionalString(profile?.email),
        connectedAt: identity.createdAt.toISOString(),
        lastUsedAt: identity.lastUsedAt?.toISOString() ?? null,
        canUnlink: signInMethodCount > 1,
      };
    }),
  });
});

linkedIdentityRouter.delete('/identities/:identityId', async (request, response) => {
  const userId = await currentUserId(request);
  if (!userId) {
    response.status(401).json({
      error: { code: 'AUTHENTICATION_REQUIRED', message: 'Sign in to manage linked identities.' },
    });
    return;
  }

  const identityId = typeof request.params.identityId === 'string'
    ? request.params.identityId.trim()
    : '';
  if (!identityId) {
    response.status(400).json({
      error: { code: 'INVALID_IDENTITY', message: 'The linked identity is invalid.' },
    });
    return;
  }

  const [user, identity, identityCount] = await Promise.all([
    identityPrisma.user.findUnique({ where: { id: userId } }),
    identityPrisma.userIdentity.findFirst({ where: { id: identityId, userId } }),
    identityPrisma.userIdentity.count({ where: { userId } }),
  ]);

  if (!user) {
    response.status(401).json({
      error: { code: 'AUTHENTICATION_REQUIRED', message: 'The Identity account could not be resolved.' },
    });
    return;
  }
  if (!identity) {
    response.status(404).json({
      error: { code: 'IDENTITY_NOT_FOUND', message: 'The linked identity was not found.' },
    });
    return;
  }

  const remainingSignInMethods =
    (hasUsablePassword(user.passwordHash) ? 1 : 0) + identityCount - 1;
  if (remainingSignInMethods < 1) {
    response.status(409).json({
      error: {
        code: 'LAST_SIGNIN_METHOD',
        message: 'Add another sign-in method or set a password before disconnecting this identity.',
      },
    });
    return;
  }

  await identityPrisma.userIdentity.delete({ where: { id: identity.id } });

  if (
    identity.provider === 'ORCID'
    && identity.issuer === ORCID_ISSUER
    && user.orcid === identity.subject
  ) {
    const replacement = await identityPrisma.userIdentity.findFirst({
      where: { userId, provider: 'ORCID', issuer: ORCID_ISSUER },
      orderBy: { lastUsedAt: 'desc' },
      select: { subject: true },
    });
    const updated = await identityPrisma.user.update({
      where: { id: userId },
      data: { orcid: replacement?.subject ?? null },
    });
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

function hasUsablePassword(passwordHash: string): boolean {
  return passwordHash.startsWith('scrypt:');
}

function asProfile(value: unknown): IdentityProfile | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as IdentityProfile
    : null;
}

function readProviderKey(
  provider: 'ORCID' | 'OIDC' | 'SAML',
  profile: IdentityProfile | null,
): 'orcid' | 'google' | 'microsoft' | 'oidc' | 'saml' {
  if (provider === 'ORCID') return 'orcid';
  if (provider === 'SAML') return 'saml';
  const key = profile?.providerKey;
  if (key === 'google' || key === 'microsoft' || key === 'oidc') return key;
  return 'oidc';
}

function readIdentityLabel(
  provider: 'ORCID' | 'OIDC' | 'SAML',
  profile: IdentityProfile | null,
): string {
  if (provider === 'ORCID') return 'ORCID';
  if (provider === 'SAML') return 'SAML';
  return readOptionalString(profile?.label) ?? 'Institutional sign-in';
}

function readOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

async function currentUserId(request: Request): Promise<string | undefined> {
  const token = readSessionToken(request);
  if (!token) return undefined;
  return (await getUserIdForSession(token)) ?? undefined;
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
