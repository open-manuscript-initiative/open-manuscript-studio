import { env } from '../config/env.js';
import { identityPrisma } from '../lib/identityPrisma.js';

export type InstitutionRole = 'MEMBER' | 'ADMIN' | 'OWNER';

export async function getInstitutionAdminMemberships(userId: string) {
  await provisionConfiguredInstitutionOwner(userId);
  return identityPrisma.institutionMembership.findMany({
    where: {
      userId,
      role: { in: ['ADMIN', 'OWNER'] },
      institution: { status: 'ACTIVE' },
    },
    include: { institution: true },
    orderBy: [{ role: 'desc' }, { createdAt: 'asc' }],
  });
}

export async function hasInstitutionAdminAccess(userId: string): Promise<boolean> {
  const memberships = await getInstitutionAdminMemberships(userId);
  return memberships.length > 0;
}

export async function requireInstitutionRole(
  userId: string,
  institutionId: string,
  allowed: InstitutionRole[],
) {
  await provisionConfiguredInstitutionOwner(userId);
  const membership = await identityPrisma.institutionMembership.findUnique({
    where: { userId_institutionId: { userId, institutionId } },
    include: { institution: true },
  });
  if (
    !membership ||
    membership.institution.status !== 'ACTIVE' ||
    !allowed.includes(membership.role)
  ) {
    throw new Error('Institution administrator permission is required.');
  }
  return membership;
}

/**
 * Bootstrap the first managed-deployment owner without trusting a local
 * password-only account. The configured e-mail must match the Studio account
 * and that account must already have an OIDC/SAML identity linked.
 */
export async function provisionConfiguredInstitutionOwner(userId: string): Promise<void> {
  if (env.DEPLOYMENT_MODE !== 'institutional') return;
  const institutionName = env.INSTITUTIONAL_NAME?.trim();
  if (!institutionName) return;

  const allowedEmails = configuredAdminEmails();
  if (allowedEmails.size === 0) return;

  const user = await identityPrisma.user.findUnique({
    where: { id: userId },
    include: { identities: true },
  });
  if (!user || !allowedEmails.has(user.email.trim().toLowerCase())) return;

  const federatedIdentity = user.identities.find(
    (identity) => identity.provider === 'OIDC' || identity.provider === 'SAML',
  );
  if (!federatedIdentity) return;

  const configuredRor = env.INSTITUTIONAL_ROR_ID?.trim() || null;
  let institution = configuredRor
    ? await identityPrisma.institution.findUnique({ where: { rorId: configuredRor } })
    : null;
  institution ??= await identityPrisma.institution.findFirst({
    where: { name: { equals: institutionName, mode: 'insensitive' } },
  });
  institution ??= await identityPrisma.institution.create({
    data: {
      name: institutionName,
      rorId: configuredRor,
      status: 'ACTIVE',
    },
  });

  const existing = await identityPrisma.institutionMembership.findUnique({
    where: {
      userId_institutionId: {
        userId,
        institutionId: institution.id,
      },
    },
  });

  if (!existing) {
    const hasDefault = await identityPrisma.institutionMembership.count({
      where: { userId, isDefault: true },
    });
    await identityPrisma.institutionMembership.create({
      data: {
        userId,
        institutionId: institution.id,
        identityId: federatedIdentity.id,
        role: 'OWNER',
        isDefault: hasDefault === 0,
        institutionalEmail: user.email,
        emailVerified: true,
      },
    });
    return;
  }

  if (existing.role !== 'OWNER' || !existing.identityId) {
    await identityPrisma.institutionMembership.update({
      where: { id: existing.id },
      data: {
        role: 'OWNER',
        identityId: existing.identityId ?? federatedIdentity.id,
        institutionalEmail: existing.institutionalEmail ?? user.email,
        emailVerified: existing.emailVerified || true,
      },
    });
  }
}

function configuredAdminEmails(): Set<string> {
  return new Set(
    env.INSTITUTIONAL_ADMIN_EMAILS
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  );
}
