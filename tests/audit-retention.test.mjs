import assert from 'node:assert/strict';
import { mock, test } from 'node:test';

const operations = [];
const counters = {};
function auditStore(name) {
  return {
    count: async (args) => { operations.push({ name, op: 'count', args }); return 2; },
    findMany: async (args) => {
      operations.push({ name, op: 'find', args });
      const current = counters[name] ?? 0;
      counters[name] = current + 1;
      return current === 0 ? [{ id: 'record-a' }, { id: 'record-b' }] : [];
    },
    deleteMany: async (args) => {
      operations.push({ name, op: 'delete', args });
      return { count: args.where.id.in.length };
    },
  };
}
const prisma = {
  studioModuleAuditEvent: auditStore('modules'),
  collaborationAuditEvent: auditStore('collaboration'),
  $queryRaw: async (strings, ...args) => {
    operations.push({ name: 'integration', op: 'count', sql: strings.join('?'), args });
    return [{ count: 3n }];
  },
  $executeRaw: async (strings, ...args) => {
    operations.push({ name: 'integration', op: 'delete', sql: strings.join('?'), args });
    return 3;
  },
};
const identityPrisma = { adminAuditEvent: auditStore('administration') };
mock.module(new URL('../server/dist/lib/prisma.js', import.meta.url).href, { namedExports: { prisma } });
mock.module(new URL('../server/dist/lib/identityPrisma.js', import.meta.url).href, { namedExports: { identityPrisma } });
const { AUDIT_RETENTION_DAYS, auditRetentionCutoffs, cleanupAuditRetention } =
  await import('../server/dist/services/auditRetentionCleanup.js');

test('technical audit classes have explicit finite 90/180-day retention boundaries', () => {
  assert.deepEqual(AUDIT_RETENTION_DAYS, {
    integrationEvents: 90, moduleEvents: 90, adminEvents: 180, collaborationAccessEvents: 180,
  });
  const cutoffs = auditRetentionCutoffs(new Date('2026-11-16T00:00:00.000Z'));
  assert.equal(cutoffs.integrationEvents.toISOString(), '2026-08-18T00:00:00.000Z');
  assert.equal(cutoffs.adminEvents.toISOString(), '2026-05-20T00:00:00.000Z');
});

test('dry-run counts each class, without mutating any audit record', async () => {
  operations.length = 0;
  const report = await cleanupAuditRetention(false, new Date('2026-11-16T00:00:00.000Z'));
  assert.equal(report.mode, 'dry-run');
  assert.equal(report.candidates.integrationEvents, 3);
  assert.equal(report.candidates.moduleEvents, 2);
  assert.equal(report.candidates.adminEvents, 2);
  assert.equal(report.candidates.collaborationAccessEvents, 2);
  assert.equal(operations.length, 4);
  assert.ok(operations.every((operation) => operation.op === 'count'));
  assert.doesNotMatch(JSON.stringify(report), /record-a|record-b|userId|ipAddress|digest/);
});

test('explicit apply deletes only aged audit IDs in bounded batches', async () => {
  operations.length = 0;
  const report = await cleanupAuditRetention(true, new Date('2026-11-16T00:00:00.000Z'));
  assert.equal(report.mode, 'apply');
  assert.deepEqual(report.removed, {
    integrationEvents: 3, moduleEvents: 2, adminEvents: 2, collaborationAccessEvents: 2,
  });
  assert.equal(report.backlog, false);
  const integrationDelete = operations.find((operation) => operation.name === 'integration' && operation.op === 'delete');
  assert.match(integrationDelete.sql, /DELETE FROM integration_audit_events/);
  assert.match(integrationDelete.sql, /FOR UPDATE SKIP LOCKED/);
  assert.match(integrationDelete.sql, /created_at/);
  for (const eventType of ['modules', 'administration', 'collaboration']) {
    const deletion = operations.find((operation) => operation.name === eventType && operation.op === 'delete');
    assert.ok(deletion, `missing audit deletion: ${eventType}`);
    assert.deepEqual(deletion.args.where.id.in, ['record-a', 'record-b']);
    assert.ok(deletion.args.where.createdAt.lt instanceof Date);
  }
  assert.equal(operations.some((operation) => /manuscript|submission|review/i.test(operation.name)), false);
});
