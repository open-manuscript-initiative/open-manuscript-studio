import { prisma } from '../lib/prisma.js';
/** Repository adapter returns connection facts, never a Prisma row or a secret. */
export async function findEditorialConnection(
  userId: string,
  connectionId: string,
) {
  const row = await prisma.userIntegration.findFirst({
    where: {
      id: connectionId,
      userId,
      enabled: true,
      providerId: { in: ['ojs', 'omp'] },
    },
  });
  if (
    !row ||
    !row.config ||
    typeof row.config !== 'object' ||
    Array.isArray(row.config)
  )
    return null;
  const baseUrl = row.config.baseUrl;
  if (
    typeof baseUrl !== 'string' ||
    (row.providerId !== 'ojs' && row.providerId !== 'omp')
  )
    return null;
  return { provider: row.providerId, baseUrl };
}
