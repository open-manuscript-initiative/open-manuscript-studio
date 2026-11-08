import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/identity-prisma/client.js';

const connectionString = process.env.IDENTITY_DATABASE_URL;

if (!connectionString) {
  throw new Error('IDENTITY_DATABASE_URL is required.');
}

const adapter = new PrismaPg({
  connectionString,
});

function createIdentityPrisma() {
  return new PrismaClient({
    adapter,
    // This optional UI preference must not be included in implicit User
    // projections (including nested session users) before its migration lands.
    // The preference service reads it explicitly with a narrow compatibility fallback.
    omit: { user: { workflowRole: true } },
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['warn', 'error'],
  });
}

const globalForIdentityPrisma = globalThis as unknown as {
  identityPrisma: ReturnType<typeof createIdentityPrisma> | undefined;
};

export const identityPrisma = globalForIdentityPrisma.identityPrisma ?? createIdentityPrisma();

if (process.env.NODE_ENV !== 'production') {
  globalForIdentityPrisma.identityPrisma = identityPrisma;
}
