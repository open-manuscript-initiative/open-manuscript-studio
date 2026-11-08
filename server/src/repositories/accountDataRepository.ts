import { identityPrisma } from '../lib/identityPrisma.js';
import { accountOverviewLimit } from '../contracts/privacyContract.js';
import { readWorkflowRolePreference } from './workflowRoleRepository.js';
import type { AccountDataRepository } from '../services/accountDataService.js';

/** Only this adapter selects identity records; never return complete Prisma users. */
export const accountDataRepository: AccountDataRepository = {
  async findAccount(userId) {
    return await identityPrisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, fullName: true, affiliation: true, affiliationRorId: true,
        country: true, website: true, orcid: true, bio: true, timeZone: true,
        interfaceLanguage: true, status: true, createdAt: true, updatedAt: true, lastLoginAt: true,
        profileEmails: { take: accountOverviewLimit + 1, orderBy: { id: 'asc' }, select: { email: true, isPrimary: true, createdAt: true } },
        identities: { take: accountOverviewLimit + 1, orderBy: { id: 'asc' }, select: { provider: true, issuer: true, subject: true, displayName: true, createdAt: true, lastUsedAt: true } },
        institutionMemberships: { take: accountOverviewLimit + 1, orderBy: { id: 'asc' }, select: { role: true, createdAt: true, institution: { select: { name: true } } } },
        sessions: { take: accountOverviewLimit + 1, orderBy: { id: 'asc' }, select: { createdAt: true, expiresAt: true } },
        passkeys: { take: accountOverviewLimit + 1, orderBy: { id: 'asc' }, select: { label: true, deviceType: true, backedUp: true, createdAt: true, lastUsedAt: true } },
      },
    });
  },
  readWorkflowRole: readWorkflowRolePreference,
};
