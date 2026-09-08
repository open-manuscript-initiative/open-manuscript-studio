import { randomBytes } from 'node:crypto';

import { identityPrisma } from '../lib/identityPrisma.js';
import { prisma } from '../lib/prisma.js';

export class AccountDeletionBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccountDeletionBlockedError';
  }
}

export async function deleteStudioAccount(
  userId: string,
  confirmationEmail: string,
): Promise<void> {
  const identityUser = await identityPrisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, status: true },
  });

  if (!identityUser || identityUser.status !== 'ACTIVE') {
    throw new Error('The Studio account is not active or no longer exists.');
  }

  if (normalizeEmail(confirmationEmail) !== normalizeEmail(identityUser.email)) {
    throw new AccountDeletionBlockedError(
      'Enter the current account e-mail address to confirm deletion.',
    );
  }

  await assertOwnershipCanBeReleased(userId);

  // Freeze the Identity account first so no new session can race with deletion.
  await identityPrisma.user.update({
    where: { id: userId },
    data: { status: 'DISABLED' },
  });

  try {
    await anonymizeStudioPrincipal(userId);
  } catch (error) {
    // The Identity record still exists at this point. Re-enable it if the
    // Studio-side transaction failed so the user can retry safely.
    await identityPrisma.user.update({
      where: { id: userId },
      data: { status: 'ACTIVE' },
    }).catch(() => undefined);
    throw error;
  }

  // Identity-side relations are configured with ON DELETE CASCADE. Audit
  // events authored by this account are removed before the identity itself so
  // they cannot retain an IP address or account identifier after deletion.
  await identityPrisma.$transaction([
    identityPrisma.adminAuditEvent.deleteMany({ where: { actorUserId: userId } }),
    identityPrisma.user.delete({ where: { id: userId } }),
  ]);
}

async function assertOwnershipCanBeReleased(userId: string): Promise<void> {
  const ownedMemberships = await identityPrisma.institutionMembership.findMany({
    where: { userId, role: 'OWNER' },
    select: {
      institutionId: true,
      institution: { select: { name: true } },
    },
  });

  for (const membership of ownedMemberships) {
    const ownerCount = await identityPrisma.institutionMembership.count({
      where: { institutionId: membership.institutionId, role: 'OWNER' },
    });
    if (ownerCount <= 1) {
      throw new AccountDeletionBlockedError(
        `Transfer ownership of ${membership.institution.name} before deleting this account.`,
      );
    }
  }

  const centralGrant = await identityPrisma.centralAdminGrant.findUnique({
    where: { userId },
    select: { role: true },
  });
  if (centralGrant?.role === 'OWNER') {
    const centralOwnerCount = await identityPrisma.centralAdminGrant.count({
      where: { role: 'OWNER' },
    });
    if (centralOwnerCount <= 1) {
      throw new AccountDeletionBlockedError(
        'Transfer central OMI ownership before deleting this account.',
      );
    }
  }
}

async function anonymizeStudioPrincipal(userId: string): Promise<void> {
  const deletedAddress = `deleted-${randomBytes(16).toString('hex')}@deleted.invalid`;
  const unusablePasswordHash = `deleted:${randomBytes(32).toString('hex')}`;

  await prisma.$transaction([
    prisma.directSubmission.deleteMany({ where: { userId } }),
    prisma.cloudBackup.deleteMany({ where: { userId } }),
    prisma.cloudConnection.deleteMany({ where: { userId } }),
    prisma.userIntegration.deleteMany({ where: { userId } }),
    prisma.reviewWorkspaceAccess.deleteMany({ where: { userId } }),
    prisma.oAuthLoginState.deleteMany({ where: { userId } }),
    prisma.userIdentity.deleteMany({ where: { userId } }),
    prisma.userInvitation.deleteMany({ where: { userId } }),
    prisma.userSession.deleteMany({ where: { userId } }),
    prisma.user.updateMany({
      where: { id: userId },
      data: {
        email: deletedAddress,
        passwordHash: unusablePasswordHash,
        fullName: 'Deleted account',
        affiliation: null,
        affiliationRorId: null,
        orcid: null,
        interfaceLanguage: 'en',
        status: 'DISABLED',
        lastLoginAt: null,
      },
    }),
  ]);
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}
