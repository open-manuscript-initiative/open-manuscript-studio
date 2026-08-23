import { createHash, randomBytes } from 'node:crypto';

import { env } from '../config/env.js';
import { identityPrisma } from '../lib/identityPrisma.js';

export type CentralAdminRole = 'ADMIN' | 'OWNER';

export const INSTITUTION_API_SCOPES = [
  'institution:read',
  'members:read',
  'members:write',
  'integrations:read',
  'integrations:write',
] as const;

export type InstitutionApiScope = (typeof INSTITUTION_API_SCOPES)[number];

export async function provisionConfiguredCentralAdmin(userId: string): Promise<void> {
  const allowed = configuredCentralAdminEmails();
  if (allowed.size === 0) return;

  const user = await identityPrisma.user.findUnique({
    where: { id: userId },
    include: { identities: true, centralAdminGrant: true },
  });
  if (!user || !allowed.has(user.email.trim().toLowerCase())) return;

  const hasFederatedIdentity = user.identities.some(
    (identity) => identity.provider === 'OIDC' || identity.provider === 'SAML',
  );
  if (!hasFederatedIdentity) return;

  if (!user.centralAdminGrant) {
    await identityPrisma.centralAdminGrant.create({
      data: {
        userId,
        role: 'OWNER',
      },
    });
  }
}

export async function getCentralAdminGrant(userId: string) {
  await provisionConfiguredCentralAdmin(userId);
  return identityPrisma.centralAdminGrant.findUnique({
    where: { userId },
    include: { user: true },
  });
}

export async function requireCentralAdmin(
  userId: string,
  allowed: CentralAdminRole[] = ['ADMIN', 'OWNER'],
) {
  const grant = await getCentralAdminGrant(userId);
  if (!grant || grant.user.status !== 'ACTIVE' || !allowed.includes(grant.role)) {
    throw new Error('Central administrator permission is required.');
  }
  return grant;
}

export async function requireFederatedCentralAdminCandidate(userId: string) {
  const user = await identityPrisma.user.findUnique({
    where: { id: userId },
    include: { identities: true },
  });
  if (!user || user.status !== 'ACTIVE') {
    throw new Error('The Studio account is not active.');
  }
  if (!user.identities.some((identity) => identity.provider === 'OIDC' || identity.provider === 'SAML')) {
    throw new Error('Central administrators must have a linked OIDC or SAML identity.');
  }
  return user;
}

export async function createInstitutionApiCredential(input: {
  institutionId: string;
  label: string;
  scopes: string[];
  createdByUserId: string;
  expiresInDays?: number;
}) {
  const scopes = normalizeInstitutionApiScopes(input.scopes);
  if (scopes.length === 0) {
    throw new Error('At least one institution API scope is required.');
  }

  const institution = await identityPrisma.institution.findUnique({
    where: { id: input.institutionId },
  });
  if (!institution) throw new Error('Institution not found.');
  if (institution.status !== 'ACTIVE') {
    throw new Error('API credentials cannot be issued for a disabled institution.');
  }

  const prefix = randomBytes(6).toString('hex');
  const rawToken = `omi_ia_${prefix}.${randomBytes(32).toString('base64url')}`;
  const expiresInDays = input.expiresInDays ?? env.INSTITUTION_API_TOKEN_TTL_DAYS;
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

  const credential = await identityPrisma.institutionApiCredential.create({
    data: {
      institutionId: input.institutionId,
      label: input.label.trim(),
      tokenPrefix: `omi_ia_${prefix}`,
      tokenHash: hashApiToken(rawToken),
      scopes,
      status: 'ACTIVE',
      expiresAt,
      createdByUserId: input.createdByUserId,
    },
  });

  return { credential, token: rawToken };
}

export async function verifyInstitutionApiToken(
  rawToken: string,
  requiredScopes: InstitutionApiScope[] = [],
) {
  if (!rawToken.startsWith('omi_ia_')) return null;

  const credential = await identityPrisma.institutionApiCredential.findUnique({
    where: { tokenHash: hashApiToken(rawToken) },
    include: { institution: true },
  });
  if (
    !credential ||
    credential.status !== 'ACTIVE' ||
    credential.institution.status !== 'ACTIVE' ||
    (credential.expiresAt !== null && credential.expiresAt <= new Date())
  ) {
    return null;
  }

  if (requiredScopes.some((scope) => !credential.scopes.includes(scope))) {
    return null;
  }

  await identityPrisma.institutionApiCredential.update({
    where: { id: credential.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => undefined);

  return credential;
}

export async function revokeInstitutionApiCredential(
  credentialId: string,
  institutionId: string,
): Promise<boolean> {
  const credential = await identityPrisma.institutionApiCredential.findFirst({
    where: { id: credentialId, institutionId },
  });
  if (!credential) return false;
  if (credential.status !== 'REVOKED') {
    await identityPrisma.institutionApiCredential.update({
      where: { id: credential.id },
      data: { status: 'REVOKED', revokedAt: new Date() },
    });
  }
  return true;
}

export async function writeAdminAuditEvent(input: {
  actorUserId?: string;
  apiCredentialId?: string;
  institutionId?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, string | number | boolean | null>;
  ipAddress?: string;
}): Promise<void> {
  await identityPrisma.adminAuditEvent.create({
    data: {
      ...(input.actorUserId ? { actorUserId: input.actorUserId } : {}),
      ...(input.apiCredentialId ? { apiCredentialId: input.apiCredentialId } : {}),
      ...(input.institutionId ? { institutionId: input.institutionId } : {}),
      action: input.action,
      ...(input.targetType ? { targetType: input.targetType } : {}),
      ...(input.targetId ? { targetId: input.targetId } : {}),
      ...(input.details ? { details: input.details } : {}),
      ...(input.ipAddress ? { ipAddress: input.ipAddress.slice(0, 64) } : {}),
    },
  });
}

export function normalizeInstitutionApiScopes(scopes: string[]): InstitutionApiScope[] {
  const allowed = new Set<string>(INSTITUTION_API_SCOPES);
  return [...new Set(scopes.map((scope) => scope.trim()).filter((scope) => allowed.has(scope)))] as InstitutionApiScope[];
}

function configuredCentralAdminEmails(): Set<string> {
  return new Set(
    env.CENTRAL_ADMIN_EMAILS
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
}

function hashApiToken(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
