import 'dotenv/config';
import { identityPrisma } from '../lib/identityPrisma.js';
import { prisma } from '../lib/prisma.js';
import { cleanupExpiredAuthentication } from '../services/expiredAuthCleanup.js';
import { cleanupAuditRetention } from '../services/auditRetentionCleanup.js';

try {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--apply') || args.length > 1) throw new Error('invalid arguments');
  const apply = args[0] === '--apply';
  const authentication = await cleanupExpiredAuthentication(apply);
  const audit = await cleanupAuditRetention(apply);
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', authentication, audit }));
  if (audit.backlog && apply) {
    console.error('Audit cleanup has remaining expired records; rerun the maintenance task.');
    process.exitCode = 2;
  }
} catch {
  console.error('Privacy cleanup failed. Some stores may already have been processed; inspect the run and retry safely. No account or manuscript content is targeted.');
  process.exitCode = 1;
} finally {
  await Promise.all([identityPrisma.$disconnect(), prisma.$disconnect()]);
}
