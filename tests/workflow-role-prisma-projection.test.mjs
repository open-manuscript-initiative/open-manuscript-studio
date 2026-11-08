import assert from 'node:assert/strict';
import { mock, test } from 'node:test';

process.env.IDENTITY_DATABASE_URL = 'postgresql://synthetic:synthetic@127.0.0.1:1/synthetic';
delete globalThis.identityPrisma;
const queries = [];

// Run the real generated Prisma client/compiler, substituting only the SQL
// transport. This verifies the emitted projection without a production database.
mock.module(new URL('../server/node_modules/@prisma/adapter-pg/dist/index.mjs', import.meta.url).href, {
  namedExports: { PrismaPg: class SyntheticSqlTransport {
    provider = 'postgres';
    adapterName = 'synthetic-read-only';
    async connect() {
      return {
        provider: this.provider, adapterName: this.adapterName,
        queryRaw: async (query) => { queries.push(query.sql); return { columnNames: [], columnTypes: [], rows: [] }; },
        executeRaw: async () => { throw new Error('Writes are not part of this test.'); },
        executeScript: async () => {}, dispose: async () => {},
        startTransaction: async () => { throw new Error('Transactions are not part of this test.'); },
      };
    }
  } },
});
const { identityPrisma } = await import('../server/dist/lib/identityPrisma.js');

test('real Prisma account SQL omits the optional column while explicit preference reads opt in', async (t) => {
  t.after(() => identityPrisma.$disconnect());
  assert.equal(await identityPrisma.user.findUnique({ where: { email: 'owner@example.test' } }), null);
  assert.equal(queries.length, 1);
  assert.match(queries[0], /password_hash/);
  assert.doesNotMatch(queries[0], /workflow_role/);
  await identityPrisma.user.findUnique({ where: { id: '00000000-0000-4000-8000-000000000001' }, select: { workflowRole: true } });
  assert.match(queries.at(-1), /workflow_role/);
});
