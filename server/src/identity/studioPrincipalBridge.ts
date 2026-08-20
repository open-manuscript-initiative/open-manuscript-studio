import { prisma } from '../lib/prisma.js';

export interface IdentityPrincipalSnapshot {
  id: string;
  email: string;
  fullName: string;
  affiliation: string | null;
  affiliationRorId: string | null;
  orcid: string | null;
  interfaceLanguage: string;
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'DISABLED';
  lastLoginAt: Date | null;
}

const IDENTITY_MANAGED_PASSWORD = 'identity-managed';

/**
 * Keep a minimal Studio-side principal with the same UUID as the authoritative
 * Identity user. Studio-domain tables keep their existing PostgreSQL foreign
 * keys while credentials and sessions live exclusively in the Identity DB.
 */
export async function ensureStudioPrincipal(
  identity: IdentityPrincipalSnapshot,
): Promise<void> {
  const byId = await prisma.user.findUnique({ where: { id: identity.id } });
  const byEmail = await prisma.user.findUnique({ where: { email: identity.email } });

  if (byEmail && byEmail.id !== identity.id) {
    throw new Error(
      `Studio principal mismatch for ${identity.email}: existing UUID ${byEmail.id} differs from Identity UUID ${identity.id}.`,
    );
  }

  const data = {
    email: identity.email,
    fullName: identity.fullName,
    affiliation: identity.affiliation,
    affiliationRorId: identity.affiliationRorId,
    orcid: identity.orcid,
    interfaceLanguage: identity.interfaceLanguage,
    status: identity.status,
    lastLoginAt: identity.lastLoginAt,
  } as const;

  if (byId) {
    await prisma.user.update({
      where: { id: identity.id },
      data,
    });
    return;
  }

  await prisma.user.create({
    data: {
      id: identity.id,
      passwordHash: IDENTITY_MANAGED_PASSWORD,
      ...data,
    },
  });
}

export async function getStudioPrincipalByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}
