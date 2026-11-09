/** Export only double-confirmed Google Play test applications, one address per CSV row.
 * Run through a trusted server console; never expose this output as a public endpoint.
 * The Google Play Console import replaces the entire selected email list: first
 * reconcile existing testers, or use a dedicated list for this intake.
 */
import { prisma } from '../lib/prisma.js';
type EmailRow = { email: string };
try {
  // Retention applies even when there has been no public signup traffic.
  await prisma.$executeRaw`
    DELETE FROM "android_closed_test_signups"
    WHERE ("verified_at" IS NULL AND "created_at" < NOW() - INTERVAL '7 days')
       OR ("verified_at" IS NOT NULL AND "verified_at" < NOW() - INTERVAL '180 days')
  `;
  const emails = await prisma.$queryRaw<EmailRow[]>`
    SELECT "email" FROM "android_closed_test_signups"
    WHERE "verified_at" IS NOT NULL
      AND "verified_at" > NOW() - INTERVAL '180 days'
    ORDER BY "email" ASC
  `;
  for (const row of emails) {
    // Conservative ASCII format accepted by Play Console, without UTF-8 BOM.
    if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(row.email)) {
      throw new Error('An invalid stored email address prevents exporting a safe CSV.');
    }
    process.stdout.write(row.email + '\n');
  }
} catch (error) {
  console.error('Tester export failed; verify migration and database connection.');
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
