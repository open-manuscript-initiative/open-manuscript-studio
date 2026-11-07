import { identityPrisma } from '../lib/identityPrisma.js';

const limit = 1000;

/** Deliberately scoped account overview. A full Art.15 response is an operator
 * workflow: shared manuscripts/reviews need third-party-rights review. */
export async function exportAccountOverview(userId: string) {
  const user = await identityPrisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, email: true, fullName: true, affiliation: true, affiliationRorId: true,
      country: true, website: true, orcid: true, bio: true, timeZone: true,
      interfaceLanguage: true, status: true, createdAt: true, updatedAt: true, lastLoginAt: true,
      profileEmails: { take: limit + 1, orderBy: { id: 'asc' }, select: { email: true, isPrimary: true, createdAt: true } },
      identities: { take: limit + 1, orderBy: { id: 'asc' }, select: { provider: true, issuer: true, subject: true, displayName: true, createdAt: true, lastUsedAt: true } },
      institutionMemberships: { take: limit + 1, orderBy: { id: 'asc' }, select: { role: true, createdAt: true, institution: { select: { name: true } } } },
      sessions: { take: limit + 1, orderBy: { id: 'asc' }, select: { createdAt: true, expiresAt: true } },
      passkeys: { take: limit + 1, orderBy: { id: 'asc' }, select: { label: true, deviceType: true, backedUp: true, createdAt: true, lastUsedAt: true } },
    },
  });
  if (!user) return null;
  const { profileEmails, identities, institutionMemberships, sessions, passkeys, ...profile } = user;
  const sections = { profileEmails, identities, institutionMemberships, sessions, passkeys };
  return {
    schema: 'omi-account-overview/1', exportedAt: new Date().toISOString(),
    scope: 'Account profile, sign-in metadata and institution memberships only. Not a complete subject access response or manuscript backup.',
    omitted: ['Manuscripts, review contents, collaboration history, operational logs and external provider copies. Request a full response from this server operator. Authentication secrets are never exported.'],
    incompleteSections: Object.entries(sections).filter(([, rows]) => rows.length > limit).map(([name]) => name),
    profile,
    ...Object.fromEntries(Object.entries(sections).map(([name, rows]) => [name, rows.slice(0, limit)])),
  };
}
