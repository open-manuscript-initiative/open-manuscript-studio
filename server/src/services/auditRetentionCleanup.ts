import { identityPrisma } from '../lib/identityPrisma.js';
import { prisma } from '../lib/prisma.js';

/**
 * Technical security and integration audit trail only. Manuscripts, editorial
 * decisions, review provenance and content-bearing research records are NOT
 * subject to this generic retention schedule.
 *
 * This policy is not a legal hold facility. Operators must document and
 * separately preserve any records they are legally required to retain before
 * enabling scheduled deletion.
 */
export const AUDIT_RETENTION_DAYS = {
  integrationEvents: 90,
  moduleEvents: 90,
  adminEvents: 180,
  collaborationAccessEvents: 180,
} as const;

const BATCH_SIZE = 1000;
const MAX_BATCHES = 50;

export function auditRetentionCutoffs(now = new Date()) {
  if (!Number.isFinite(now.getTime())) throw new Error('Invalid audit cleanup date.');
  const cutoff = (days: number) => new Date(now.getTime() - days * 86_400_000);
  return {
    integrationEvents: cutoff(AUDIT_RETENTION_DAYS.integrationEvents),
    moduleEvents: cutoff(AUDIT_RETENTION_DAYS.moduleEvents),
    adminEvents: cutoff(AUDIT_RETENTION_DAYS.adminEvents),
    collaborationAccessEvents: cutoff(AUDIT_RETENTION_DAYS.collaborationAccessEvents),
  };
}

type RecordDelegate = {
  count(args: { where: { createdAt: { lt: Date } } }): Promise<number>;
  findMany(args: {
    where: { createdAt: { lt: Date } };
    select: { id: true };
    orderBy: { createdAt: 'asc' };
    take: number;
  }): Promise<Array<{ id: string }>>;
  deleteMany(args: { where: { id: { in: string[] }; createdAt: { lt: Date } } }): Promise<{ count: number }>;
};

async function purgePrismaAuditRecords(delegate: RecordDelegate, cutoff: Date): Promise<number> {
  let deleted = 0;
  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    const rows = await delegate.findMany({
      where: { createdAt: { lt: cutoff } },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
      take: BATCH_SIZE,
    });
    if (rows.length === 0) break;
    deleted += (await delegate.deleteMany({
      where: { id: { in: rows.map((row) => row.id) }, createdAt: { lt: cutoff } },
    })).count;
    if (rows.length < BATCH_SIZE) break;
  }
  return deleted;
}

/** Count-only by default; --apply is required for destructive database operations. */
export async function cleanupAuditRetention(apply = false, now = new Date()) {
  const cutoffs = auditRetentionCutoffs(now);
  const [integrationCountRows, moduleCount, adminCount, collaborationCount] = await Promise.all([
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM integration_audit_events
      WHERE created_at < ${cutoffs.integrationEvents}
    `,
    prisma.studioModuleAuditEvent.count({ where: { createdAt: { lt: cutoffs.moduleEvents } } }),
    identityPrisma.adminAuditEvent.count({ where: { createdAt: { lt: cutoffs.adminEvents } } }),
    prisma.collaborationAuditEvent.count({ where: { createdAt: { lt: cutoffs.collaborationAccessEvents } } }),
  ]);
  const candidates = {
    integrationEvents: Number(integrationCountRows[0]?.count ?? 0n),
    moduleEvents: moduleCount,
    adminEvents: adminCount,
    collaborationAccessEvents: collaborationCount,
  };
  const removed = { integrationEvents: 0, moduleEvents: 0, adminEvents: 0, collaborationAccessEvents: 0 };
  if (apply) {
    // Bounded batches avoid holding table locks across a large historic backlog.
    for (let batch = 0; batch < MAX_BATCHES; batch++) {
      const deleted = await prisma.$executeRaw`
        WITH expired AS (
          SELECT id FROM integration_audit_events
          WHERE created_at < ${cutoffs.integrationEvents}
          ORDER BY created_at, id
          LIMIT ${BATCH_SIZE}
          FOR UPDATE SKIP LOCKED
        )
        DELETE FROM integration_audit_events AS audit
        USING expired
        WHERE audit.id = expired.id
      `;
      removed.integrationEvents += deleted;
      if (deleted < BATCH_SIZE) break;
    }
    removed.moduleEvents = await purgePrismaAuditRecords(
      prisma.studioModuleAuditEvent as unknown as RecordDelegate, cutoffs.moduleEvents,
    );
    removed.adminEvents = await purgePrismaAuditRecords(
      identityPrisma.adminAuditEvent as unknown as RecordDelegate, cutoffs.adminEvents,
    );
    removed.collaborationAccessEvents = await purgePrismaAuditRecords(
      prisma.collaborationAuditEvent as unknown as RecordDelegate, cutoffs.collaborationAccessEvents,
    );
  }
  const remaining = {
    integrationEvents: Math.max(0, candidates.integrationEvents - removed.integrationEvents),
    moduleEvents: Math.max(0, candidates.moduleEvents - removed.moduleEvents),
    adminEvents: Math.max(0, candidates.adminEvents - removed.adminEvents),
    collaborationAccessEvents: Math.max(0, candidates.collaborationAccessEvents - removed.collaborationAccessEvents),
  };
  return {
    mode: apply ? 'apply' : 'dry-run',
    observedAt: now.toISOString(),
    retentionDays: AUDIT_RETENTION_DAYS,
    cutoffs: Object.fromEntries(Object.entries(cutoffs).map(([key, value]) => [key, value.toISOString()])),
    candidates,
    removed,
    remaining,
    backlog: Object.values(remaining).some((count) => count > 0),
    // This report deliberately contains no user IDs, IPs, text, digests or per-event details.
  };
}
