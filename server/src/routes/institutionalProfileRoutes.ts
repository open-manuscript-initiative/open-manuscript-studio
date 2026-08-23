import { Router, type Request } from 'express';
import { z } from 'zod';

import { ensureStudioPrincipal } from '../identity/studioPrincipalBridge.js';
import { identityPrisma } from '../lib/identityPrisma.js';
import {
  getInstitutionAdminMemberships,
  requireInstitutionRole,
} from '../services/institutionAccessService.js';
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

const updateProfileSchema = z.object({
  department: z.string().trim().max(300).nullable().optional(),
  positionTitle: z.string().trim().max(200).nullable().optional(),
  institutionalEmail: z.string().trim().email().max(320).nullable().optional(),
  identityId: z.string().uuid().nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'At least one institutional profile field is required.',
});

const updateRoleSchema = z.object({
  role: z.enum(['MEMBER', 'ADMIN', 'OWNER']),
});

institutionalProfileRouter.get('/profiles/institutions', async (request, response) => {
  const userId = await currentUserId(request);
  if (!userId) {
    response.status(401).json({ error: { code: 'AUTHENTICATION_REQUIRED', message: 'Sign in to manage institutional profiles.' } });
    return;
  }

  try {
    await materializeLegacyProfile(userId);
    const memberships = await identityPrisma.institutionMembership.findMany({
      where: { userId },
      include: { institution: true, identity: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    response.status(200).json({ profiles: memberships.map(serializeMembership) });
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
    const institution = await findOrCreateInstitution(input.organizationName, input.rorId);
    const count = await identityPrisma.institutionMembership.count({ where: { userId } });
    const makeDefault = input.isDefault === true || count === 0;

    const membership = await identityPrisma.$transaction(async (tx) => {
      const existing = await tx.institutionMembership.findUnique({
        where: { userId_institutionId: { userId, institutionId: institution.id } },
      });
      if (existing) throw new Error('This institution is already linked to your account.');

      if (makeDefault) {
        await tx.institutionMembership.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.institutionMembership.create({
        data: {
          userId,
          institutionId: institution.id,
          role: 'MEMBER',
          department: cleanNullable(input.department),
          positionTitle: cleanNullable(input.positionTitle),
          institutionalEmail: normalizeNullableEmail(input.institutionalEmail),
          identityId,
          isDefault: makeDefault,
        },
        include: { institution: true, identity: true },
      });
    });

    if (makeDefault) await syncLegacyAffiliation(userId);
    response.status(201).json({ profile: serializeMembership(membership) });
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
    const existing = await identityPrisma.institutionMembership.findFirst({ where: { id: profileId, userId } });
    if (!existing) {
      response.status(404).json({ error: { code: 'PROFILE_NOT_FOUND', message: 'Institutional profile not found.' } });
      return;
    }

    const data: {
      department?: string | null;
      positionTitle?: string | null;
      institutionalEmail?: string | null;
      identityId?: string | null;
    } = {};
    if (input.department !== undefined) data.department = cleanNullable(input.department);
    if (input.positionTitle !== undefined) data.positionTitle = cleanNullable(input.positionTitle);
    if (input.institutionalEmail !== undefined) data.institutionalEmail = normalizeNullableEmail(input.institutionalEmail);
    if (input.identityId !== undefined) data.identityId = await validateIdentityLink(userId, input.identityId);

    const membership = await identityPrisma.institutionMembership.update({
      where: { id: profileId },
      data,
      include: { institution: true, identity: true },
    });
    response.status(200).json({ profile: serializeMembership(membership) });
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
    const existing = await identityPrisma.institutionMembership.findFirst({ where: { id: profileId, userId } });
    if (!existing) {
      response.status(404).json({ error: { code: 'PROFILE_NOT_FOUND', message: 'Institutional profile not found.' } });
      return;
    }

    await identityPrisma.$transaction([
      identityPrisma.institutionMembership.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      }),
      identityPrisma.institutionMembership.update({
        where: { id: profileId },
        data: { isDefault: true },
      }),
    ]);
    await syncLegacyAffiliation(userId);
    const membership = await identityPrisma.institutionMembership.findUnique({
      where: { id: profileId },
      include: { institution: true, identity: true },
    });
    response.status(200).json({ profile: membership ? serializeMembership(membership) : null });
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
    const existing = await identityPrisma.institutionMembership.findFirst({ where: { id: profileId, userId } });
    if (!existing) {
      response.status(204).end();
      return;
    }

    if (existing.role === 'OWNER') {
      const ownerCount = await identityPrisma.institutionMembership.count({
        where: { institutionId: existing.institutionId, role: 'OWNER' },
      });
      if (ownerCount <= 1) throw new Error('The last institutional owner cannot remove their membership.');
    }

    await identityPrisma.institutionMembership.delete({ where: { id: profileId } });
    if (existing.isDefault) {
      const replacement = await identityPrisma.institutionMembership.findFirst({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      });
      if (replacement) {
        await identityPrisma.institutionMembership.update({
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

institutionalProfileRouter.get('/institutions/admin-context', async (request, response) => {
  const userId = await currentUserId(request);
  if (!userId) {
    response.status(401).json({ error: { code: 'AUTHENTICATION_REQUIRED', message: 'Authentication is required.' } });
    return;
  }

  const memberships = await getInstitutionAdminMemberships(userId);
  response.status(200).json({
    institutions: memberships.map((membership) => ({
      membershipId: membership.id,
      institutionId: membership.institutionId,
      name: membership.institution.name,
      rorId: membership.institution.rorId,
      role: membership.role,
    })),
  });
});

institutionalProfileRouter.get('/institutions/:institutionId/members', async (request, response) => {
  const userId = await currentUserId(request);
  if (!userId) {
    response.status(401).json({ error: { code: 'AUTHENTICATION_REQUIRED', message: 'Authentication is required.' } });
    return;
  }

  try {
    const institutionId = z.string().uuid().parse(request.params.institutionId);
    await requireInstitutionRole(userId, institutionId, ['ADMIN', 'OWNER']);
    const members = await identityPrisma.institutionMembership.findMany({
      where: { institutionId },
      include: { user: true, identity: true },
      orderBy: [{ role: 'desc' }, { createdAt: 'asc' }],
    });
    response.status(200).json({
      members: members.map((member) => ({
        id: member.id,
        userId: member.userId,
        fullName: member.user.fullName,
        email: member.user.email,
        role: member.role,
        department: member.department,
        positionTitle: member.positionTitle,
        institutionalEmail: member.institutionalEmail,
        identityId: member.identityId,
        identityDisplayName: member.identity?.displayName ?? null,
        createdAt: member.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Institution members could not be loaded.';
    response.status(403).json({ error: { code: 'INSTITUTION_ADMIN_REQUIRED', message } });
  }
});

institutionalProfileRouter.patch('/institutions/:institutionId/members/:membershipId/role', async (request, response) => {
  const userId = await currentUserId(request);
  if (!userId) {
    response.status(401).json({ error: { code: 'AUTHENTICATION_REQUIRED', message: 'Authentication is required.' } });
    return;
  }

  try {
    const institutionId = z.string().uuid().parse(request.params.institutionId);
    const membershipId = z.string().uuid().parse(request.params.membershipId);
    const { role } = updateRoleSchema.parse(request.body);
    const actor = await requireInstitutionRole(userId, institutionId, ['ADMIN', 'OWNER']);
    const target = await identityPrisma.institutionMembership.findFirst({ where: { id: membershipId, institutionId } });
    if (!target) throw new Error('Institution member not found.');

    if (actor.role !== 'OWNER' && (target.role === 'OWNER' || role === 'OWNER')) {
      throw new Error('Only an institutional owner can change owner roles.');
    }
    if (target.role === 'OWNER' && role !== 'OWNER') {
      const owners = await identityPrisma.institutionMembership.count({ where: { institutionId, role: 'OWNER' } });
      if (owners <= 1) throw new Error('The institution must keep at least one owner.');
    }

    const updated = await identityPrisma.institutionMembership.update({
      where: { id: membershipId },
      data: { role },
      include: { user: true, identity: true },
    });
    response.status(200).json({
      member: {
        id: updated.id,
        userId: updated.userId,
        fullName: updated.user.fullName,
        email: updated.user.email,
        role: updated.role,
        department: updated.department,
        positionTitle: updated.positionTitle,
        institutionalEmail: updated.institutionalEmail,
        identityId: updated.identityId,
        identityDisplayName: updated.identity?.displayName ?? null,
        createdAt: updated.createdAt.toISOString(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Institution role could not be changed.';
    response.status(403).json({ error: { code: 'INSTITUTION_ROLE_UPDATE_FAILED', message } });
  }
});

async function materializeLegacyProfile(userId: string): Promise<void> {
  const existingCount = await identityPrisma.institutionMembership.count({ where: { userId } });
  if (existingCount > 0) return;

  const user = await identityPrisma.user.findUnique({
    where: { id: userId },
    select: { affiliation: true, affiliationRorId: true },
  });
  const organizationName = user?.affiliation?.trim();
  if (!organizationName) return;

  const institution = await findOrCreateInstitution(organizationName, user?.affiliationRorId);
  await identityPrisma.institutionMembership.create({
    data: {
      userId,
      institutionId: institution.id,
      role: 'MEMBER',
      isDefault: true,
    },
  });
}

async function findOrCreateInstitution(name: string, rorId: string | null | undefined) {
  const cleanRor = cleanNullable(rorId);
  if (cleanRor) {
    const byRor = await identityPrisma.institution.findUnique({ where: { rorId: cleanRor } });
    if (byRor) return byRor;
  }

  const normalizedName = name.trim();
  const byName = await identityPrisma.institution.findFirst({
    where: { name: { equals: normalizedName, mode: 'insensitive' } },
  });
  if (byName) return byName;

  return identityPrisma.institution.create({
    data: { name: normalizedName, rorId: cleanRor, status: 'ACTIVE' },
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
  const membership = await identityPrisma.institutionMembership.findFirst({
    where: { userId, isDefault: true },
    include: { institution: true },
    orderBy: { createdAt: 'asc' },
  });
  const user = await identityPrisma.user.update({
    where: { id: userId },
    data: {
      affiliation: membership?.institution.name ?? null,
      affiliationRorId: membership?.institution.rorId ?? null,
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

function serializeMembership(membership: {
  id: string;
  institutionId: string;
  role: 'MEMBER' | 'ADMIN' | 'OWNER';
  department: string | null;
  positionTitle: string | null;
  institutionalEmail: string | null;
  emailVerified: boolean;
  identityId: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
  institution: { name: string; rorId: string | null };
  identity: null | {
    id: string;
    provider: 'ORCID' | 'OIDC' | 'SAML';
    issuer: string;
    subject: string;
    displayName: string | null;
    profile: unknown;
  };
}) {
  return {
    id: membership.id,
    institutionId: membership.institutionId,
    organizationName: membership.institution.name,
    rorId: membership.institution.rorId,
    role: membership.role,
    department: membership.department,
    positionTitle: membership.positionTitle,
    institutionalEmail: membership.institutionalEmail,
    emailVerified: membership.emailVerified,
    identityId: membership.identityId,
    isDefault: membership.isDefault,
    createdAt: membership.createdAt.toISOString(),
    updatedAt: membership.updatedAt.toISOString(),
    identity: membership.identity
      ? {
          id: membership.identity.id,
          provider: membership.identity.provider,
          providerKey: readProviderKey(membership.identity.profile),
          issuer: membership.identity.issuer,
          subject: membership.identity.subject,
          displayName: membership.identity.displayName,
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
  return cleanNullable(value)?.toLowerCase() ?? null;
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
