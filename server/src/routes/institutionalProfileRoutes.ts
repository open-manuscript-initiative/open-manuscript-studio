import { Router, type Request } from 'express';
import { z } from 'zod';

import { ensureStudioPrincipal } from '../identity/studioPrincipalBridge.js';
import { identityPrisma } from '../lib/identityPrisma.js';
import { getUserIdForSession } from '../services/authService.js';

export const institutionalProfileRouter = Router();

const COOKIE_NAME = 'omi_session';

const createProfileSchema = z.object({
  organizationName: z.string().trim().min(1).max(300),
  rorId: z.string().trim().max(128).nullable().optional(),
  department: z.string().trim().max(300).nullable().optional(),
  positionTitle: z.string().trim().max(200).nullable().optional(),
  institutionalEmail: z.string().trim().email().max(320).nullable().optional(),
  identityId: z.string().uuid().nullable().optional(),
  isDefault: z.boolean().optional(),
});

const updateProfileSchema = createProfileSchema
  .omit({ isDefault: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one institutional profile field is required.',
  });

institutionalProfileRouter.get('/profiles/institutions', async (request, response) => {
  const userId = await currentUserId(request);
  if (!userId) {
    response.status(401).json({ error: { code: 'AUTHENTICATION_REQUIRED', message: 'Sign in to manage institutional profiles.' } });
    return;
  }

  try {
    await materializeLegacyProfile(userId);
    const profiles = await identityPrisma.institutionalProfile.findMany({
      where: { userId },
      include: { identity: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    response.status(200).json({ profiles: profiles.map(serializeProfile) });
  } catch (error) {
    console.error('[OMI institutional profiles] list failed', error);
    response.status(500).json({ error: { code: 'PROFILE_LIST_FAILED', message: 'Institutional profiles could not be loaded.' } });
  }
});

institutionalProfileRouter.post('/profiles/institutions', async (request, response) => {
  const userId = await currentUserId(request);
  if (!userId) {
    response.status(401).json({ error: { code: 'AUTHENTICATION_REQUIRED', message: 'Sign in to manage institutional profiles.' } });
    return;
  }

  try {
    const input = createProfileSchema.parse(request.body);
    const identityId = await validateIdentityLink(userId, input.identityId);
    const count = await identityPrisma.institutionalProfile.count({ where: { userId } });
    const makeDefault = input.isDefault === true || count === 0;

    const profile = await identityPrisma.$transaction(async (tx) => {
      if (makeDefault) {
        await tx.institutionalProfile.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }
      return tx.institutionalProfile.create({
        data: {
          userId,
          organizationName: input.organizationName,
          rorId: cleanNullable(input.rorId),
          department: cleanNullable(input.department),
          positionTitle: cleanNullable(input.positionTitle),
          institutionalEmail: normalizeNullableEmail(input.institutionalEmail),
          identityId,
          isDefault: makeDefault,
        },
        include: { identity: true },
      });
    });

    if (makeDefault) await syncLegacyAffiliation(userId);
    response.status(201).json({ profile: serializeProfile(profile) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Institutional profile creation failed.';
    response.status(400).json({ error: { code: 'PROFILE_CREATE_FAILED', message } });
  }
});

institutionalProfileRouter.patch('/profiles/institutions/:profileId', async (request, response) => {
  const userId = await currentUserId(request);
  if (!userId) {
    response.status(401).json({ error: { code: 'AUTHENTICATION_REQUIRED', message: 'Sign in to manage institutional profiles.' } });
    return;
  }

  try {
    const profileId = z.string().uuid().parse(request.params.profileId);
    const input = updateProfileSchema.parse(request.body);
    const existing = await identityPrisma.institutionalProfile.findFirst({ where: { id: profileId, userId } });
    if (!existing) {
      response.status(404).json({ error: { code: 'PROFILE_NOT_FOUND', message: 'Institutional profile not found.' } });
      return;
    }

    const data: {
      organizationName?: string;
      rorId?: string | null;
      department?: string | null;
      positionTitle?: string | null;
      institutionalEmail?: string | null;
      identityId?: string | null;
    } = {};
    if (input.organizationName !== undefined) data.organizationName = input.organizationName;
    if (input.rorId !== undefined) data.rorId = cleanNullable(input.rorId);
    if (input.department !== undefined) data.department = cleanNullable(input.department);
    if (input.positionTitle !== undefined) data.positionTitle = cleanNullable(input.positionTitle);
    if (input.institutionalEmail !== undefined) data.institutionalEmail = normalizeNullableEmail(input.institutionalEmail);
    if (input.identityId !== undefined) data.identityId = await validateIdentityLink(userId, input.identityId);

    const profile = await identityPrisma.institutionalProfile.update({
      where: { id: profileId },
      data,
      include: { identity: true },
    });
    if (profile.isDefault) await syncLegacyAffiliation(userId);
    response.status(200).json({ profile: serializeProfile(profile) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Institutional profile update failed.';
    response.status(400).json({ error: { code: 'PROFILE_UPDATE_FAILED', message } });
  }
});

institutionalProfileRouter.post('/profiles/institutions/:profileId/default', async (request, response) => {
  const userId = await currentUserId(request);
  if (!userId) {
    response.status(401).json({ error: { code: 'AUTHENTICATION_REQUIRED', message: 'Sign in to manage institutional profiles.' } });
    return;
  }

  try {
    const profileId = z.string().uuid().parse(request.params.profileId);
    const existing = await identityPrisma.institutionalProfile.findFirst({ where: { id: profileId, userId } });
    if (!existing) {
      response.status(404).json({ error: { code: 'PROFILE_NOT_FOUND', message: 'Institutional profile not found.' } });
      return;
    }

    await identityPrisma.$transaction([
      identityPrisma.institutionalProfile.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      }),
      identityPrisma.institutionalProfile.update({
        where: { id: profileId },
        data: { isDefault: true },
      }),
    ]);
    await syncLegacyAffiliation(userId);
    const profile = await identityPrisma.institutionalProfile.findUnique({
      where: { id: profileId },
      include: { identity: true },
    });
    response.status(200).json({ profile: profile ? serializeProfile(profile) : null });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Default institutional profile could not be changed.';
    response.status(400).json({ error: { code: 'PROFILE_DEFAULT_FAILED', message } });
  }
});

institutionalProfileRouter.delete('/profiles/institutions/:profileId', async (request, response) => {
  const userId = await currentUserId(request);
  if (!userId) {
    response.status(401).json({ error: { code: 'AUTHENTICATION_REQUIRED', message: 'Sign in to manage institutional profiles.' } });
    return;
  }

  try {
    const profileId = z.string().uuid().parse(request.params.profileId);
    const existing = await identityPrisma.institutionalProfile.findFirst({ where: { id: profileId, userId } });
    if (!existing) {
      response.status(204).end();
      return;
    }

    await identityPrisma.institutionalProfile.delete({ where: { id: profileId } });
    if (existing.isDefault) {
      const replacement = await identityPrisma.institutionalProfile.findFirst({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      });
      if (replacement) {
        await identityPrisma.institutionalProfile.update({
          where: { id: replacement.id },
          data: { isDefault: true },
        });
      }
      await syncLegacyAffiliation(userId);
    }
    response.status(204).end();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Institutional profile deletion failed.';
    response.status(400).json({ error: { code: 'PROFILE_DELETE_FAILED', message } });
  }
});

async function materializeLegacyProfile(userId: string): Promise<void> {
  const existingCount = await identityPrisma.institutionalProfile.count({ where: { userId } });
  if (existingCount > 0) return;

  const user = await identityPrisma.user.findUnique({
    where: { id: userId },
    select: { affiliation: true, affiliationRorId: true },
  });
  const organizationName = user?.affiliation?.trim();
  if (!organizationName) return;

  await identityPrisma.institutionalProfile.create({
    data: {
      userId,
      organizationName,
      rorId: cleanNullable(user?.affiliationRorId),
      isDefault: true,
    },
  });
}

async function validateIdentityLink(userId: string, identityId: string | null | undefined): Promise<string | null> {
  if (!identityId) return null;
  const identity = await identityPrisma.userIdentity.findFirst({
    where: { id: identityId, userId },
    select: { id: true, provider: true },
  });
  if (!identity) throw new Error('The selected connected identity does not belong to this account.');
  if (identity.provider !== 'OIDC' && identity.provider !== 'SAML') {
    throw new Error('Only an institutional OIDC or SAML identity can be assigned to an institutional profile.');
  }
  return identity.id;
}

async function syncLegacyAffiliation(userId: string): Promise<void> {
  const profile = await identityPrisma.institutionalProfile.findFirst({
    where: { userId, isDefault: true },
    orderBy: { createdAt: 'asc' },
  });
  const user = await identityPrisma.user.update({
    where: { id: userId },
    data: {
      affiliation: profile?.organizationName ?? null,
      affiliationRorId: profile?.rorId ?? null,
    },
  });
  await ensureStudioPrincipal({
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    affiliation: user.affiliation,
    affiliationRorId: user.affiliationRorId,
    orcid: user.orcid,
    interfaceLanguage: user.interfaceLanguage,
    status: user.status,
    lastLoginAt: user.lastLoginAt,
  });
}

function serializeProfile(profile: {
  id: string;
  organizationName: string;
  rorId: string | null;
  department: string | null;
  positionTitle: string | null;
  institutionalEmail: string | null;
  emailVerified: boolean;
  identityId: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
  identity: null | {
    id: string;
    provider: 'ORCID' | 'OIDC' | 'SAML';
    issuer: string;
    subject: string;
    displayName: string | null;
    profile: unknown;
  };
}) {
  const providerKey = readProviderKey(profile.identity?.profile);
  return {
    id: profile.id,
    organizationName: profile.organizationName,
    rorId: profile.rorId,
    department: profile.department,
    positionTitle: profile.positionTitle,
    institutionalEmail: profile.institutionalEmail,
    emailVerified: profile.emailVerified,
    identityId: profile.identityId,
    isDefault: profile.isDefault,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
    identity: profile.identity
      ? {
          id: profile.identity.id,
          provider: profile.identity.provider,
          providerKey,
          issuer: profile.identity.issuer,
          subject: profile.identity.subject,
          displayName: profile.identity.displayName,
        }
      : null,
  };
}

function readProviderKey(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const providerKey = (value as Record<string, unknown>).providerKey;
  return typeof providerKey === 'string' ? providerKey : null;
}

function cleanNullable(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return value.trim() || null;
}

function normalizeNullableEmail(value: string | null | undefined): string | null {
  const email = cleanNullable(value)?.toLowerCase() ?? null;
  return email;
}

async function currentUserId(request: Request): Promise<string | null> {
  const token = readSessionToken(request);
  return token ? getUserIdForSession(token) : null;
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
