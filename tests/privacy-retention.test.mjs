import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
const operations = [];
function store(name) {
  return {
    count: async (args) => { operations.push({ name, type: 'count', args }); return 2; },
    deleteMany: async (args) => { operations.push({ name, type: 'delete', args }); return { count: 2 }; },
  };
}
const identityPrisma = Object.fromEntries(['userSession', 'userInvitation', 'passwordResetToken', 'passkeyChallenge', 'oAuthLoginState'].map((key) => [key, store(`identity:${key}`)]));
const prisma = Object.fromEntries(['userSession', 'userInvitation', 'oAuthLoginState'].map((key) => [key, store(`studio:${key}`)]));
mock.module(new URL('../server/dist/lib/identityPrisma.js', import.meta.url).href, { namedExports: { identityPrisma } });
mock.module(new URL('../server/dist/lib/prisma.js', import.meta.url).href, { namedExports: { prisma } });
const { cleanupExpiredAuthentication } = await import('../server/dist/services/expiredAuthCleanup.js');

test('expiry cleanup defaults to dry-run and never invents manuscript/audit retention', async () => {
  const cutoff = new Date('2026-11-07T10:00:00Z');
  assert.equal((await cleanupExpiredAuthentication(false, cutoff)).mode, 'dry-run');
  assert.equal(operations.length, 8);
  assert.ok(operations.every((operation) => operation.type === 'count'));
  operations.length = 0;
  assert.equal((await cleanupExpiredAuthentication(true, cutoff)).mode, 'apply');
  assert.equal(operations.length, 8);
  for (const operation of operations) {
    assert.equal(operation.type, 'delete');
    assert.deepEqual(operation.args, { where: { expiresAt: { lt: cutoff } } });
    assert.doesNotMatch(operation.name, /manuscript|audit|user$/i);
  }
});
