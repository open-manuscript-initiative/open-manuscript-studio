import { identityPrisma } from '../lib/identityPrisma.js';
import { prisma } from '../lib/prisma.js';

export async function cleanupExpiredAuthentication(apply = false, now = new Date()) {
  const where = { expiresAt: { lt: now } };
  const stores = {
    identitySessions: identityPrisma.userSession,
    identityInvitations: identityPrisma.userInvitation,
    passwordResetTokens: identityPrisma.passwordResetToken,
    passkeyChallenges: identityPrisma.passkeyChallenge,
    identityOAuthStates: identityPrisma.oAuthLoginState,
    legacySessions: prisma.userSession,
    legacyInvitations: prisma.userInvitation,
    legacyOAuthStates: prisma.oAuthLoginState,
  };
  const counts: Record<string, number> = {};
  // Individual calls preserve each generated Prisma delegate's type signature.
  for (const [name, store] of Object.entries(stores)) {
    const delegate = store as unknown as {
      count(args: { where: typeof where }): Promise<number>;
      deleteMany(args: { where: typeof where }): Promise<{ count: number }>;
    };
    counts[name] = apply ? (await delegate.deleteMany({ where })).count : await delegate.count({ where });
  }
  return { mode: apply ? 'apply' : 'dry-run', observedAt: now.toISOString(), counts };
}
