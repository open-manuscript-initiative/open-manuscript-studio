import 'dotenv/config';
import { identityPrisma } from '../lib/identityPrisma.js';
import { prisma } from '../lib/prisma.js';
import { cleanupExpiredAuthentication } from '../services/expiredAuthCleanup.js';

try {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--apply') || args.length > 1) throw new Error('invalid arguments');
  console.log(JSON.stringify(await cleanupExpiredAuthentication(args[0] === '--apply')));
} catch {
  console.error('Expired authentication cleanup failed; no account, manuscript or audit retention policy was applied.');
  process.exitCode = 1;
} finally {
  await Promise.all([identityPrisma.$disconnect(), prisma.$disconnect()]);
}
