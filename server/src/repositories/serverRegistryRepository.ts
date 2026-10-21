import { prisma } from '../lib/prisma.js';

export interface RegistryRegistration {
  name: string; origin: string; hostname: string; domainChallengeHash: string;
  registrationTokenHash: string; challengeExpiresAt: Date; heartbeatTokenHash: string;
  softwareVersion?: string; capabilities: string[];
}
export const serverRegistryRepository = {
  findById: (id: string) => prisma.studioServerDirectoryEntry.findUnique({ where: { id } }),
  findByOrigin: (origin: string) => prisma.studioServerDirectoryEntry.findUnique({ where: { origin } }),
  async register(id: string, data: RegistryRegistration, replace: boolean) {
    const values = { ...data, status: 'PENDING' as const, verifiedAt: null, lastHeartbeatAt: null, githubIssueUrl: null };
    try {
      if (replace) return (await prisma.studioServerDirectoryEntry.updateMany({ where: { id, OR: [{ status: 'REVOKED' }, { status: 'PENDING', challengeExpiresAt: { lte: new Date() } }] }, data: values })).count === 1;
      await prisma.studioServerDirectoryEntry.create({ data: { id, ...values } });
      return true;
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') return false;
      throw error;
    }
  },
  async claim(id: string, proofHash: string) {
    return (await prisma.studioServerDirectoryEntry.updateMany({
      where: { id, status: 'PENDING', registrationTokenHash: proofHash, challengeExpiresAt: { gt: new Date() } },
      data: { status: 'VERIFYING' },
    })).count === 1;
  },
  async activate(id: string, proofHash: string, tokenHash: string, githubIssueUrl: string) {
    return (await prisma.studioServerDirectoryEntry.updateMany({
      where: { id, status: 'VERIFYING', registrationTokenHash: proofHash },
      data: { status: 'ACTIVE', verifiedAt: new Date(), githubIssueUrl, heartbeatTokenHash: tokenHash, registrationTokenHash: null, challengeExpiresAt: null },
    })).count === 1;
  },
  async heartbeat(id: string, tokenHash: string, softwareVersion?: string, capabilities?: string[]) {
    return (await prisma.studioServerDirectoryEntry.updateMany({ where: { id, status: 'ACTIVE', heartbeatTokenHash: tokenHash },
      data: { lastHeartbeatAt: new Date(), ...(softwareVersion === undefined ? {} : { softwareVersion }), ...(capabilities ? { capabilities } : {}) },
    })).count === 1;
  },
  async rotate(id: string, oldHash: string, newHash: string) {
    return (await prisma.studioServerDirectoryEntry.updateMany({ where: { id, status: 'ACTIVE', heartbeatTokenHash: oldHash }, data: { heartbeatTokenHash: newHash } })).count === 1;
  },
  async revoke(id: string, oldHash: string, newHash: string) {
    return (await prisma.studioServerDirectoryEntry.updateMany({ where: { id, status: 'ACTIVE', heartbeatTokenHash: oldHash }, data: { status: 'REVOKED', heartbeatTokenHash: newHash } })).count === 1;
  },
  list: () => prisma.studioServerDirectoryEntry.findMany({ where: { status: 'ACTIVE' }, orderBy: { name: 'asc' },
    select: { id: true, name: true, origin: true, softwareVersion: true, capabilities: true, lastHeartbeatAt: true } }),
};
