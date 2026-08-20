import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/identity-prisma/client.js';

const connectionString = process.env.IDENTITY_DATABASE_URL;

if (!connectionString) {
  throw new Error('IDENTITY_DATABASE_URL is required.');
}

const globalForIdentityPrisma = globalThis as unknown as {
  identityPrisma: PrismaClient | undefined;
};

const adapter = new PrismaPg({
  connectionString,
});

export const identityPrisma =
  globalForIdentityPrisma.identityPrisma ??
  new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForIdentityPrisma.identityPrisma = identityPrisma;
}
