import { createHash, randomBytes } from 'node:crypto';

import { Router, type Request } from 'express';

import { env } from '../config/env.js';
import { ensureStudioPrincipal } from '../identity/studioPrincipalBridge.js';
import { listOidcProviderConfigs, type OidcProviderKey } from '../integrations/oidcProvider.js';
import { identityPrisma } from '../lib/identityPrisma.js';
import { getUserForSession, getUserIdForSession } from '../services/authService.js';

export const federatedAuthRouter = Router();

const COOKIE_NAME = 'omi_session';
const NATIVE_HEADER = 'x-omi-native-client';
const ORCID_ISSUER = new URL(env.ORCID_BASE_URL).origin;

federatedAuthRouter.get('/providers', async (request, response) => {
  const userId = await currentUserId(request);
  const linkedOrcid = userId
    ? await identityPrisma.userIdentity.findFirst({
        where: { userId, provider: 'ORCID', issuer: ORCID_ISSUER },
        select: { id: true, subject: true, displayName: true, createdAt: true },
      })
    : null;
  const linkedOidc = userId
    ? await identityPrisma.userIdentity.findMany({
        where: { userId, provider: 'OIDC' },
        select: { profile: true },
      })
    : [];
  const linkedKeys = new Set<OidcProviderKey>();
  for (const identity of linkedOidc) {
    const profile = identity.profile;
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)) continue;
    const key = (profile as Record<string, unknown>).providerKey;
    if (key === 'google' || key === 'microsoft' || key === 'oidc') linkedKeys.add(key);
  }
  const configuredOidc = new Map(listOidcProviderConfigs().map((provider) => [provider.key, provider]));

  const externalProvider = (key: OidcProviderKey, fallbackLabel: string) => {
    const provider = configuredOidc.get(key);
    return {
      enabled: Boolean(provider),
      label: provider?.label ?? fallbackLabel,
      ...(provider ? { issuer: provider.issuer } : {}),
      linked: linkedKeys.has(key),
    };
  };

  response.status(200).json({
    deployment: {
      mode: env.DEPLOYMENT_MODE,
      label: env.DEPLOYMENT_MODE === 'institutional' ? 'Institutional' : 'Personal',
    },
    providers: {
      orcid: {
        enabled: orcidConfigured(),
        label: 'ORCID',
        environment: env.ORCID_ENVIRONMENT,
        issuer: ORCID_ISSUER,
        credentialSource: env.ORCID_CREDENTIAL_SOURCE,
        ...(env.ORCID_CREDENTIAL_SOURCE === 'institutional'
          ? { apiType: env.ORCID_API_TYPE ?? 'public' }
          : {}),
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
      google: externalProvider('google', 'Google'),
      microsoft: externalProvider('microsoft', 'Microsoft'),
      oidc: externalProvider('oidc', 'Institutional sign-in'),
      saml: { enabled: false, label: 'SAML' },
    },
  });
});

// Shared one-time native handoff exchange. ORCID and all OpenID Connect
// providers use the same verified App Link/custom-scheme return mechanism.
federatedAuthRouter.post('/native/exchange', async (request, response) => {
  if (request.headers[NATIVE_HEADER] !== '1') {
    response.status(403).json({
      error: { code: 'NATIVE_CLIENT_REQUIRED', message: 'This endpoint is available only to native Studio clients.' },
    });
    return;
  }

  const code = typeof request.body?.code === 'string' ? request.body.code.trim() : '';
  if (!code || code.length > 256) {
    response.status(400).json({
      error: { code: 'INVALID_NATIVE_HANDOFF', message: 'The native authentication handoff code is invalid.' },
    });
    return;
  }

  const stateHash = hash(code);
  const handoff = await identityPrisma.oAuthLoginState.findUnique({ where: { stateHash } });
  if (
    !handoff ||
    (handoff.provider !== 'ORCID' && handoff.provider !== 'OIDC') ||
    handoff.mode !== 'native_handoff' ||
    !handoff.userId ||
    handoff.expiresAt <= new Date()
  ) {
    if (handoff) {
      await identityPrisma.oAuthLoginState.delete({ where: { id: handoff.id } }).catch(() => undefined);
    }
    response.status(401).json({
      error: { code: 'NATIVE_HANDOFF_EXPIRED', message: 'The native authentication handoff has expired or was already used.' },
    });
    return;
  }

  const consumed = await identityPrisma.oAuthLoginState.deleteMany({
    where: { id: handoff.id, stateHash, mode: 'native_handoff' },
  });
  if (consumed.count !== 1) {
    response.status(401).json({
      error: { code: 'NATIVE_HANDOFF_EXPIRED', message: 'The native authentication handoff has expired or was already used.' },
    });
    return;
  }

  const user = await identityPrisma.user.findUnique({ where: { id: handoff.userId } });
  if (!user || user.status !== 'ACTIVE') {
    response.status(401).json({
      error: { code: 'ACCOUNT_NOT_ACTIVE', message: 'The Studio account is not active.' },
    });
    return;
  }

  const session = await createSession(user.id);
  const serializedUser = await getUserForSession(session.token);
  if (!serializedUser) {
    response.status(401).json({
      error: { code: 'SESSION_CREATION_FAILED', message: 'The native Studio session could not be created.' },
    });
    return;
  }

  response.status(200).json({
    user: serializedUser,
    token: session.token,
    expiresAt: session.expiresAt.toISOString(),
  });
});

federatedAuthRouter.delete('/orcid/link', async (request, response) => {
  const userId = await currentUserId(request);
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

async function createSession(userId: string) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await identityPrisma.userSession.create({
    data: { userId, tokenHash: hash(token), expiresAt },
  });
  return { token, expiresAt };
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
