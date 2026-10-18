import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import pg from '../server/node_modules/pg/lib/index.js';

// This command is deliberately separate from mocked tests and fails if PostgreSQL is absent.
const databaseUrl = process.env.OMI_TEST_POSTGRES_URL;
if (!databaseUrl) throw new Error('OMI_TEST_POSTGRES_URL is required for the real PostgreSQL gate.');
const schema = 'integration_boundary_' + crypto.randomUUID().replaceAll('-', '');
const admin = new pg.Client({ connectionString: databaseUrl });
await admin.connect();
await admin.query(`CREATE SCHEMA ${schema}`);
const scoped = new URL(databaseUrl);
scoped.searchParams.set('options', `-csearch_path=${schema}`);
process.env.DATABASE_URL = scoped.href;
const client = new pg.Client({ connectionString: scoped.href });
await client.connect();
let prisma;

test('migration, concurrent callback CAS, immutable recovery and execution uniqueness on PostgreSQL', async t => {
  t.after(async () => {
    await prisma?.$disconnect(); await client.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end();
  });
  // Exact pre-migration boundary tables, isolated from production data.
  await client.query(`CREATE TABLE users (id UUID PRIMARY KEY);
    CREATE TABLE plain_documents (id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, title VARCHAR(300) NOT NULL,
      content BYTEA NOT NULL, revision INTEGER NOT NULL DEFAULT 1, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE eurooffice_sessions (id UUID PRIMARY KEY, document_id UUID NOT NULL REFERENCES plain_documents(id) ON DELETE CASCADE, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash VARCHAR(64) NOT NULL UNIQUE, document_key VARCHAR(128) NOT NULL, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());`);
  const userId = crypto.randomUUID(), documentId = crypto.randomUUID();
  await client.query('INSERT INTO users(id) VALUES($1)', [userId]);
  await client.query('INSERT INTO plain_documents(id,user_id,title,content) VALUES($1,$2,$3,$4)', [documentId,userId,'Synthetic document',Buffer.from('initial')]);
  await client.query("INSERT INTO eurooffice_sessions(id,document_id,user_id,token_hash,document_key,expires_at) VALUES($1,$2,$3,$4,$5,now()+interval '1 hour')", [crypto.randomUUID(),documentId,userId,'a'.repeat(64),documentId+'-1']);
  const migration = await readFile(new URL('../server/prisma/migrations/20261018120000_integration_execution_boundaries/migration.sql', import.meta.url), 'utf8');
  await client.query(migration);
  assert.equal((await client.query('SELECT count(*)::int AS n FROM eurooffice_sessions WHERE expires_at > now()')).rows[0].n, 0);
  ({ prisma } = await import('../server/dist/lib/prisma.js'));
  const { euroOfficeRepository } = await import('../server/dist/repositories/euroOfficeRepository.js');
  const base = { documentId, userId, documentKey: documentId+'-1', baseRevision: 1 };
  await euroOfficeRepository.save({ ...base, callbackDigest:'f'.repeat(64), status:6, bytes:Buffer.from('force') });
  assert.equal((await prisma.plainDocument.findUnique({ where:{ id:documentId } })).revision, 1);
  const results = await Promise.all(['a','b'].map(value => euroOfficeRepository.save({ ...base, callbackDigest:value.repeat(64), status:2, bytes:Buffer.from(value) })));
  assert.equal(results.filter(result => result.applied).length, 1);
  const head = await prisma.plainDocument.findUnique({ where:{ id:documentId } });
  assert.equal(head.revision, 2);
  await euroOfficeRepository.save({ ...base, callbackDigest:'c'.repeat(64), status:6, bytes:Buffer.from('late') });
  assert.deepEqual((await prisma.plainDocument.findUnique({ where:{ id:documentId } })).content, head.content);
  await euroOfficeRepository.save({ ...base, callbackDigest:'a'.repeat(64), status:2, bytes:Buffer.from('duplicate') });
  assert.equal((await prisma.plainDocument.findUnique({ where:{ id:documentId } })).revision, 2);
  assert.ok((await prisma.euroOfficeSave.findMany({ where:{ documentId } })).some(save => Buffer.from(save.content).toString() === 'initial'));
  const data = { userId, workspaceId:'synthetic', requestKey:crypto.randomUUID(), connectionId:crypto.randomUUID(), providerOrigin:'https://api.transkribus.org', modelId:1, imageDigest:'a'.repeat(64), grantId:crypto.randomUUID(), expiresAt:new Date(Date.now()+300000), status:'SUBMITTING' };
  const intents = await Promise.allSettled([prisma.recognitionExecution.create({data}),prisma.recognitionExecution.create({data})]);
  assert.equal(intents.filter(item => item.status==='fulfilled').length, 1);
  await client.query('DELETE FROM users WHERE id=$1', [userId]);
  assert.equal(await prisma.recognitionExecution.count(), 0);
});
