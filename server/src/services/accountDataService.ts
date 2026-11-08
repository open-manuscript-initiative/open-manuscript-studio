import { accountOverviewSchema, accountOverviewLimit, accountSectionNames, type AccountOverview } from '../contracts/privacyContract.js';
import type { WorkflowRolePreference } from './workflowRolePreference.js';

type StoredDates<T> = { [K in keyof T]: K extends 'createdAt' | 'updatedAt' | 'expiresAt' ? Date
  : K extends 'lastLoginAt' | 'lastUsedAt' ? Date | null : T[K] };
export type AccountDataRecord = StoredDates<Omit<AccountOverview['profile'], 'workflowRole'>> & {
  [K in typeof accountSectionNames[number]]: Array<StoredDates<AccountOverview[K][number]>>;
};
/** Application port; the adapter alone owns Prisma and optional-column compatibility. */
export interface AccountDataRepository {
  findAccount(userId: string): Promise<AccountDataRecord | null>;
  readWorkflowRole(userId: string): Promise<WorkflowRolePreference>;
}
export function createAccountDataService(repository: AccountDataRepository) {
  return async function exportAccountOverview(userId: string): Promise<AccountOverview | null> {
    const user = await repository.findAccount(userId);
    if (!user) return null;
    const { profileEmails, identities, institutionMemberships, sessions, passkeys, ...profile } = user;
    const sections = { profileEmails, identities, institutionMemberships, sessions, passkeys };
    // Serialization is part of the wire boundary. Strict validation also rejects
    // accidental secret fields added to the adapter or use case in the future.
    return accountOverviewSchema.parse({
      schema: 'omi-account-overview/1', exportedAt: new Date().toISOString(),
      scope: 'Account profile, sign-in metadata and institution memberships only. Not a complete subject access response or manuscript backup.',
      omitted: ['Manuscripts, review contents, collaboration history, operational logs and external provider copies. Request a full response from this server operator. Authentication secrets are never exported.'],
      incompleteSections: accountSectionNames.filter(name => sections[name].length > accountOverviewLimit),
      profile: { ...profile, createdAt: profile.createdAt.toISOString(), updatedAt: profile.updatedAt.toISOString(),
        lastLoginAt: profile.lastLoginAt?.toISOString() ?? null, workflowRole: await repository.readWorkflowRole(userId) },
      profileEmails: profileEmails.slice(0, accountOverviewLimit).map(row => ({ ...row, createdAt: row.createdAt.toISOString() })),
      identities: identities.slice(0, accountOverviewLimit).map(row => ({ ...row, createdAt: row.createdAt.toISOString(), lastUsedAt: row.lastUsedAt?.toISOString() ?? null })),
      institutionMemberships: institutionMemberships.slice(0, accountOverviewLimit).map(row => ({ ...row, createdAt: row.createdAt.toISOString() })),
      sessions: sessions.slice(0, accountOverviewLimit).map(row => ({ ...row, createdAt: row.createdAt.toISOString(), expiresAt: row.expiresAt.toISOString() })),
      passkeys: passkeys.slice(0, accountOverviewLimit).map(row => ({ ...row, createdAt: row.createdAt.toISOString(), lastUsedAt: row.lastUsedAt?.toISOString() ?? null })),
    });
  };
}
