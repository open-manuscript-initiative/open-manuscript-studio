import { Router, type Request } from 'express';
import { z } from 'zod';

import { identityPrisma } from '../lib/identityPrisma.js';
import { getUserIdForSession } from '../services/authService.js';
import {
  createInstitutionApiCredential,
  getCentralAdminGrant,
  INSTITUTION_API_SCOPES,
  requireCentralAdmin,
  requireFederatedCentralAdminCandidate,
  revokeInstitutionApiCredential,
  writeAdminAuditEvent,
} from '../services/centralAdminService.js';

export const centralAdminRouter = Router();

const COOKIE_NAME = 'omi_session';

const createInstitutionSchema = z.object({
  name: z.string().trim().min(1).max(300),
  rorId: z.string().trim().max(128).nullable().optional(),
});

const updateInstitutionSchema = z.object({
  name: z.string().trim().min(1).max(300).optional(),
  rorId: z.string().trim().max(128).nullable().optional(),
  status: z.enum(['ACTIVE', 'DISABLED']).optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'At least one institution field is required.',
});

const operatorSchema = z.object({
  email: z.string().trim().email(),
  role: z.enum(['ADMIN', 'OWNER']).default('ADMIN'),
});

const roleSchema = z.object({
  role: z.enum(['ADMIN', 'OWNER']),
});

const createInstitutionAdminSchema = z.object({
  email: z.string().trim().email(),
  role: z.enum(['ADMIN', 'OWNER']).default('ADMIN'),
});

const createCredentialSchema = z.object({
  label: z.string().trim().min(1).max(160),
  scopes: z.array(z.enum(INSTITUTION_API_SCOPES)).min(1),
  expiresInDays: z.number().int().positive().max(3650).optional(),
});

centralAdminRouter.get('/context', async (request, response) => {
  const userId = await currentUserId(request);
  if (!userId) {
    response.status(401).json({ error: { code: 'AUTHENTICATION_REQUIRED', message: 'Authentication is required.' } });
    return;
  }

  const grant = await getCentralAdminGrant(userId);
  response.status(200).json({
    centralAdmin: Boolean(grant),
    role: grant?.role ?? null,
  });
});

centralAdminRouter.get('/institutions', async (request, response) => {
  const actorUserId = await requireCentralActor(request, response);
  if (!actorUserId) return;

  const query = typeof request.query.q === 'string' ? request.query.q.trim() : '';
  const status = request.query.status === 'ACTIVE' || request.query.status === 'DISABLED'
    ? request.query.status
    : undefined;

  const institutions = await identityPrisma.institution.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { rorId: { contains: query, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    include: {
      _count: { select: { memberships: true, apiCredentials: true } },
    },
    orderBy: [{ status: 'asc' }, { name: 'asc' }],
    take: 250,
  });

  response.status(200).json({
    institutions: institutions.map((institution) => ({
      id: institution.id,
      name: institution.name,
      rorId: institution.rorId,
      status: institution.status,
      memberCount: institution._count.memberships,
      apiCredentialCount: institution._count.apiCredentials,
      createdAt: institution.createdAt.toISOString(),
      updatedAt: institution.updatedAt.toISOString(),
    })),
  });
});

centralAdminRouter.post('/institutions', async (request, response) => {
  const actorUserId = await requireCentralActor(request, response);
  if (!actorUserId) return;

  try {
    const input = createInstitutionSchema.parse(request.body);
    const rorId = cleanNullable(input.rorId);
    if (rorId) {
      const duplicate = await identityPrisma.institution.findUnique({ where: { rorId } });
      if (duplicate) throw new Error('An institution with this ROR identifier already exists.');
    }

    const institution = await identityPrisma.institution.create({
      data: { name: input.name, rorId, status: 'ACTIVE' },
    });
    await audit(request, {
      actorUserId,
      institutionId: institution.id,
      action: 'central.institution.create',
      targetType: 'institution',
      targetId: institution.id,
      details: { name: institution.name, rorId: institution.rorId ?? null },
    });
    response.status(201).json({ institution: serializeInstitution(institution) });
  } catch (error) {
    response.status(400).json({ error: { code: 'INSTITUTION_CREATE_FAILED', message: errorMessage(error) } });
  }
});

centralAdminRouter.patch('/institutions/:institutionId', async (request, response) => {
  const actorUserId = await requireCentralActor(request, response);
  if (!actorUserId) return;

  try {
    const institutionId = z.string().uuid().parse(request.params.institutionId);
    const input = updateInstitutionSchema.parse(request.body);
    const institution = await identityPrisma.institution.update({
      where: { id: institutionId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.rorId !== undefined ? { rorId: cleanNullable(input.rorId) } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
    });
    await audit(request, {
      actorUserId,
      institutionId,
      action: 'central.institution.update',
      targetType: 'institution',
      targetId: institutionId,
      details: {
        name: institution.name,
        rorId: institution.rorId ?? null,
        status: institution.status,
      },
    });
    response.status(200).json({ institution: serializeInstitution(institution) });
  } catch (error) {
    response.status(400).json({ error: { code: 'INSTITUTION_UPDATE_FAILED', message: errorMessage(error) } });
  }
});

centralAdminRouter.get('/operators', async (request, response) => {
  const actorUserId = await requireCentralActor(request, response, ['OWNER']);
  if (!actorUserId) return;

  const grants = await identityPrisma.centralAdminGrant.findMany({
    include: { user: true },
    orderBy: [{ role: 'desc' }, { createdAt: 'asc' }],
  });
  response.status(200).json({
    operators: grants.map((grant) => ({
      id: grant.id,
      userId: grant.userId,
      email: grant.user.email,
      fullName: grant.user.fullName,
      role: grant.role,
      createdAt: grant.createdAt.toISOString(),
    })),
  });
});

centralAdminRouter.post('/operators', async (request, response) => {
  const actorUserId = await requireCentralActor(request, response, ['OWNER']);
  if (!actorUserId) return;

  try {
    const input = operatorSchema.parse(request.body);
    const user = await identityPrisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (!user) throw new Error('Studio account not found.');
    await requireFederatedCentralAdminCandidate(user.id);

    const grant = await identityPrisma.centralAdminGrant.upsert({
      where: { userId: user.id },
      create: { userId: user.id, role: input.role, createdByUserId: actorUserId },
      update: { role: input.role },
      include: { user: true },
    });
    await audit(request, {
      actorUserId,
      action: 'central.operator.upsert',
      targetType: 'central_admin_grant',
      targetId: grant.id,
      details: { targetEmail: user.email, role: grant.role },
    });
    response.status(200).json({ operator: serializeOperator(grant) });
  } catch (error) {
    response.status(400).json({ error: { code: 'CENTRAL_OPERATOR_UPDATE_FAILED', message: errorMessage(error) } });
  }
});

centralAdminRouter.patch('/operators/:grantId', async (request, response) => {
  const actorUserId = await requireCentralActor(request, response, ['OWNER']);
  if (!actorUserId) return;

  try {
    const grantId = z.string().uuid().parse(request.params.grantId);
    const { role } = roleSchema.parse(request.body);
    const existing = await identityPrisma.centralAdminGrant.findUnique({ where: { id: grantId } });
    if (!existing) throw new Error('Central administrator not found.');
    if (existing.role === 'OWNER' && role !== 'OWNER') await ensureAnotherCentralOwner(existing.id);
    const updated = await identityPrisma.centralAdminGrant.update({
      where: { id: grantId },
      data: { role },
      include: { user: true },
    });
    await audit(request, {
      actorUserId,
      action: 'central.operator.role',
      targetType: 'central_admin_grant',
      targetId: grantId,
      details: { targetEmail: updated.user.email, role },
    });
    response.status(200).json({ operator: serializeOperator(updated) });
  } catch (error) {
    response.status(400).json({ error: { code: 'CENTRAL_OPERATOR_UPDATE_FAILED', message: errorMessage(error) } });
  }
});

centralAdminRouter.delete('/operators/:grantId', async (request, response) => {
  const actorUserId = await requireCentralActor(request, response, ['OWNER']);
  if (!actorUserId) return;

  try {
    const grantId = z.string().uuid().parse(request.params.grantId);
    const existing = await identityPrisma.centralAdminGrant.findUnique({
      where: { id: grantId },
      include: { user: true },
    });
    if (!existing) {
      response.status(204).end();
      return;
    }
    if (existing.role === 'OWNER') await ensureAnotherCentralOwner(existing.id);
    await identityPrisma.centralAdminGrant.delete({ where: { id: grantId } });
    await audit(request, {
      actorUserId,
      action: 'central.operator.remove',
      targetType: 'central_admin_grant',
      targetId: grantId,
      details: { targetEmail: existing.user.email },
    });
    response.status(204).end();
  } catch (error) {
    response.status(400).json({ error: { code: 'CENTRAL_OPERATOR_REMOVE_FAILED', message: errorMessage(error) } });
  }
});

centralAdminRouter.get('/institutions/:institutionId/admins', async (request, response) => {
  const actorUserId = await requireCentralActor(request, response);
  if (!actorUserId) return;

  try {
    const institutionId = z.string().uuid().parse(request.params.institutionId);
    const admins = await identityPrisma.institutionMembership.findMany({
      where: { institutionId, role: { in: ['ADMIN', 'OWNER'] } },
      include: { user: true, identity: true },
      orderBy: [{ role: 'desc' }, { createdAt: 'asc' }],
    });
    response.status(200).json({ admins: admins.map(serializeInstitutionAdmin) });
  } catch (error) {
    response.status(400).json({ error: { code: 'INSTITUTION_ADMINS_FAILED', message: errorMessage(error) } });
  }
});

centralAdminRouter.post('/institutions/:institutionId/admins', async (request, response) => {
  const actorUserId = await requireCentralActor(request, response);
  if (!actorUserId) return;

  try {
    const institutionId = z.string().uuid().parse(request.params.institutionId);
    const input = createInstitutionAdminSchema.parse(request.body);
    const institution = await identityPrisma.institution.findUnique({ where: { id: institutionId } });
    if (!institution) throw new Error('Institution not found.');
    const user = await identityPrisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (!user || user.status !== 'ACTIVE') throw new Error('Active Studio account not found.');

    const membership = await identityPrisma.institutionMembership.upsert({
      where: { userId_institutionId: { userId: user.id, institutionId } },
      create: {
        userId: user.id,
        institutionId,
        role: input.role,
        institutionalEmail: user.email,
        emailVerified: true,
      },
      update: { role: input.role },
      include: { user: true, identity: true },
    });
    await audit(request, {
      actorUserId,
      institutionId,
      action: 'central.institution_admin.upsert',
      targetType: 'institution_membership',
      targetId: membership.id,
      details: { targetEmail: user.email, role: membership.role },
    });
    response.status(200).json({ admin: serializeInstitutionAdmin(membership) });
  } catch (error) {
    response.status(400).json({ error: { code: 'INSTITUTION_ADMIN_UPDATE_FAILED', message: errorMessage(error) } });
  }
});

centralAdminRouter.patch('/institutions/:institutionId/admins/:membershipId', async (request, response) => {
  const actorUserId = await requireCentralActor(request, response);
  if (!actorUserId) return;

  try {
    const institutionId = z.string().uuid().parse(request.params.institutionId);
    const membershipId = z.string().uuid().parse(request.params.membershipId);
    const { role } = roleSchema.parse(request.body);
    const existing = await identityPrisma.institutionMembership.findFirst({ where: { id: membershipId, institutionId } });
    if (!existing) throw new Error('Institution administrator not found.');
    if (existing.role === 'OWNER' && role !== 'OWNER') await ensureAnotherInstitutionOwner(institutionId, existing.id);
    const membership = await identityPrisma.institutionMembership.update({
      where: { id: membershipId },
      data: { role },
      include: { user: true, identity: true },
    });
    await audit(request, {
      actorUserId,
      institutionId,
      action: 'central.institution_admin.role',
      targetType: 'institution_membership',
      targetId: membership.id,
      details: { targetEmail: membership.user.email, role },
    });
    response.status(200).json({ admin: serializeInstitutionAdmin(membership) });
  } catch (error) {
    response.status(400).json({ error: { code: 'INSTITUTION_ADMIN_UPDATE_FAILED', message: errorMessage(error) } });
  }
});

centralAdminRouter.delete('/institutions/:institutionId/admins/:membershipId', async (request, response) => {
  const actorUserId = await requireCentralActor(request, response);
  if (!actorUserId) return;

  try {
    const institutionId = z.string().uuid().parse(request.params.institutionId);
    const membershipId = z.string().uuid().parse(request.params.membershipId);
    const existing = await identityPrisma.institutionMembership.findFirst({
      where: { id: membershipId, institutionId },
      include: { user: true },
    });
    if (!existing) {
      response.status(204).end();
      return;
    }
    if (existing.role === 'OWNER') await ensureAnotherInstitutionOwner(institutionId, existing.id);
    await identityPrisma.institutionMembership.update({
      where: { id: membershipId },
      data: { role: 'MEMBER' },
    });
    await audit(request, {
      actorUserId,
      institutionId,
      action: 'central.institution_admin.remove',
      targetType: 'institution_membership',
      targetId: membershipId,
      details: { targetEmail: existing.user.email },
    });
    response.status(204).end();
  } catch (error) {
    response.status(400).json({ error: { code: 'INSTITUTION_ADMIN_REMOVE_FAILED', message: errorMessage(error) } });
  }
});

centralAdminRouter.get('/institutions/:institutionId/api-credentials', async (request, response) => {
  const actorUserId = await requireCentralActor(request, response);
  if (!actorUserId) return;

  try {
    const institutionId = z.string().uuid().parse(request.params.institutionId);
    const credentials = await identityPrisma.institutionApiCredential.findMany({
      where: { institutionId },
      orderBy: { createdAt: 'desc' },
    });
    response.status(200).json({ credentials: credentials.map(serializeCredential) });
  } catch (error) {
    response.status(400).json({ error: { code: 'API_CREDENTIAL_LIST_FAILED', message: errorMessage(error) } });
  }
});

centralAdminRouter.post('/institutions/:institutionId/api-credentials', async (request, response) => {
  const actorUserId = await requireCentralActor(request, response);
  if (!actorUserId) return;

  try {
    const institutionId = z.string().uuid().parse(request.params.institutionId);
    const input = createCredentialSchema.parse(request.body);
    const result = await createInstitutionApiCredential({
      institutionId,
      label: input.label,
      scopes: input.scopes,
      createdByUserId: actorUserId,
      ...(input.expiresInDays !== undefined ? { expiresInDays: input.expiresInDays } : {}),
    });
    await audit(request, {
      actorUserId,
      institutionId,
      action: 'central.api_credential.create',
      targetType: 'institution_api_credential',
      targetId: result.credential.id,
      details: {
        label: result.credential.label,
        scopes: result.credential.scopes.join(','),
        expiresAt: result.credential.expiresAt?.toISOString() ?? null,
      },
    });
    response.status(201).json({
      credential: serializeCredential(result.credential),
      token: result.token,
      tokenVisibleOnce: true,
    });
  } catch (error) {
    response.status(400).json({ error: { code: 'API_CREDENTIAL_CREATE_FAILED', message: errorMessage(error) } });
  }
});

centralAdminRouter.delete('/institutions/:institutionId/api-credentials/:credentialId', async (request, response) => {
  const actorUserId = await requireCentralActor(request, response);
  if (!actorUserId) return;

  try {
    const institutionId = z.string().uuid().parse(request.params.institutionId);
    const credentialId = z.string().uuid().parse(request.params.credentialId);
    const revoked = await revokeInstitutionApiCredential(credentialId, institutionId);
    if (revoked) {
      await audit(request, {
        actorUserId,
        institutionId,
        action: 'central.api_credential.revoke',
        targetType: 'institution_api_credential',
        targetId: credentialId,
      });
    }
    response.status(204).end();
  } catch (error) {
    response.status(400).json({ error: { code: 'API_CREDENTIAL_REVOKE_FAILED', message: errorMessage(error) } });
  }
});

centralAdminRouter.get('/audit', async (request, response) => {
  const actorUserId = await requireCentralActor(request, response);
  if (!actorUserId) return;

  const institutionId = typeof request.query.institutionId === 'string'
    ? request.query.institutionId.trim()
    : '';
  const limitInput = typeof request.query.limit === 'string' ? Number(request.query.limit) : 100;
  const limit = Number.isFinite(limitInput) ? Math.min(Math.max(Math.trunc(limitInput), 1), 250) : 100;

  const events = await identityPrisma.adminAuditEvent.findMany({
    where: institutionId ? { institutionId } : undefined,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  response.status(200).json({
    events: events.map((event) => ({
      id: event.id,
      actorUserId: event.actorUserId,
      apiCredentialId: event.apiCredentialId,
      institutionId: event.institutionId,
      action: event.action,
      targetType: event.targetType,
      targetId: event.targetId,
      details: event.details,
      ipAddress: event.ipAddress,
      createdAt: event.createdAt.toISOString(),
    })),
  });
});

async function requireCentralActor(
  request: Request,
  response: Parameters<Parameters<typeof centralAdminRouter.get>[1]>[1],
  roles: Array<'ADMIN' | 'OWNER'> = ['ADMIN', 'OWNER'],
): Promise<string | null> {
  const userId = await currentUserId(request);
  if (!userId) {
    response.status(401).json({ error: { code: 'AUTHENTICATION_REQUIRED', message: 'Authentication is required.' } });
    return null;
  }
  try {
    await requireCentralAdmin(userId, roles);
    return userId;
  } catch (error) {
    response.status(403).json({ error: { code: 'CENTRAL_ADMIN_REQUIRED', message: errorMessage(error) } });
    return null;
  }
}

async function ensureAnotherCentralOwner(excludedGrantId: string): Promise<void> {
  const owners = await identityPrisma.centralAdminGrant.count({
    where: { role: 'OWNER', id: { not: excludedGrantId } },
  });
  if (owners < 1) throw new Error('The central administration must keep at least one owner.');
}

async function ensureAnotherInstitutionOwner(institutionId: string, excludedMembershipId: string): Promise<void> {
  const owners = await identityPrisma.institutionMembership.count({
    where: { institutionId, role: 'OWNER', id: { not: excludedMembershipId } },
  });
  if (owners < 1) throw new Error('The institution must keep at least one owner.');
}

async function audit(
  request: Request,
  input: Omit<Parameters<typeof writeAdminAuditEvent>[0], 'ipAddress'>,
): Promise<void> {
  await writeAdminAuditEvent({
    ...input,
    ...(request.ip ? { ipAddress: request.ip } : {}),
  });
}

async function currentUserId(request: Request): Promise<string | null> {
  const token = readSessionToken(request);
  return token ? getUserIdForSession(token) : null;
}

function readSessionToken(request: Request): string | undefined {
  const authorization = request.headers.authorization?.trim();
  if (authorization?.toLowerCase().startsWith('bearer ')) {
    const token = authorization.slice(7).trim();
    if (token && !token.startsWith('omi_ia_')) return token;
  }
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === COOKIE_NAME) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

function serializeInstitution(institution: {
  id: string;
  name: string;
  rorId: string | null;
  status: 'ACTIVE' | 'DISABLED';
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: institution.id,
    name: institution.name,
    rorId: institution.rorId,
    status: institution.status,
    createdAt: institution.createdAt.toISOString(),
    updatedAt: institution.updatedAt.toISOString(),
  };
}

function serializeOperator(grant: {
  id: string;
  userId: string;
  role: 'ADMIN' | 'OWNER';
  createdAt: Date;
  user: { email: string; fullName: string };
}) {
  return {
    id: grant.id,
    userId: grant.userId,
    email: grant.user.email,
    fullName: grant.user.fullName,
    role: grant.role,
    createdAt: grant.createdAt.toISOString(),
  };
}

function serializeInstitutionAdmin(member: {
  id: string;
  userId: string;
  role: 'MEMBER' | 'ADMIN' | 'OWNER';
  institutionalEmail: string | null;
  identityId: string | null;
  createdAt: Date;
  user: { email: string; fullName: string };
  identity: { provider: 'ORCID' | 'OIDC' | 'SAML'; displayName: string | null } | null;
}) {
  return {
    id: member.id,
    userId: member.userId,
    email: member.user.email,
    fullName: member.user.fullName,
    role: member.role,
    institutionalEmail: member.institutionalEmail,
    identityId: member.identityId,
    identityProvider: member.identity?.provider ?? null,
    identityDisplayName: member.identity?.displayName ?? null,
    createdAt: member.createdAt.toISOString(),
  };
}

function serializeCredential(credential: {
  id: string;
  institutionId: string;
  label: string;
  tokenPrefix: string;
  scopes: string[];
  status: 'ACTIVE' | 'REVOKED';
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
  revokedAt: Date | null;
}) {
  return {
    id: credential.id,
    institutionId: credential.institutionId,
    label: credential.label,
    tokenPrefix: credential.tokenPrefix,
    scopes: credential.scopes,
    status: credential.status,
    expiresAt: credential.expiresAt?.toISOString() ?? null,
    lastUsedAt: credential.lastUsedAt?.toISOString() ?? null,
    createdAt: credential.createdAt.toISOString(),
    revokedAt: credential.revokedAt?.toISOString() ?? null,
  };
}

function cleanNullable(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return value.trim() || null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Central administration request failed.';
}
