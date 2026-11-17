import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import pg from '../server/node_modules/pg/lib/index.js';

const url = process.env.OMI_TEST_POSTGRES_URL;
if (!url)
  throw new Error(
    'OMI_TEST_POSTGRES_URL is required for the real production migration gate.',
  );

test('production migration preserves submissions, enforces CAS and scopes files on PostgreSQL', async (t) => {
  const schema = 'production_' + randomUUID().replaceAll('-', '');
  const admin = new pg.Client({ connectionString: url });
  await admin.connect();
  await admin.query(`CREATE SCHEMA ${schema}`);
  const scoped = new URL(url);
  scoped.searchParams.set('options', `-csearch_path=${schema}`);
  const sql = new pg.Client({ connectionString: scoped.href });
  const concurrent = new pg.Client({ connectionString: scoped.href });
  await sql.connect();
  await concurrent.connect();
  t.after(async () => {
    await sql.end();
    await concurrent.end();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  });
  const submissionId = randomUUID(),
    productionId = randomUUID(),
    fileId = randomUUID(),
    userId = randomUUID();
  await sql.query(
    'CREATE TABLE native_editorial_submissions(id UUID PRIMARY KEY, title TEXT NOT NULL, status TEXT NOT NULL, manuscript_id TEXT NOT NULL)',
  );
  await sql.query(
    'INSERT INTO native_editorial_submissions VALUES($1,$2,$3,$4)',
    [submissionId, 'Accepted source', 'ACCEPTED', 'manuscript'],
  );
  await sql.query(
    await readFile(
      new URL(
        '../server/prisma/migrations/20261116010000_add_editorial_production/migration.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  assert.equal(
    (await sql.query('SELECT title FROM native_editorial_submissions')).rows[0]
      .title,
    'Accepted source',
  );
  const state = {
    model: 'omi-editorial-production/1',
    stage: 'COPYEDITING',
    assignments: [{ userId, role: 'COPYEDITOR' }],
  };
  await sql.query(
    'INSERT INTO editorial_productions(id,submission_id,state,updated_at) VALUES($1,$2,$3,now())',
    [productionId, submissionId, state],
  );
  const updates = await Promise.all(
    [sql, concurrent].map((client) =>
      client.query(
        "UPDATE editorial_productions SET version=version+1, state=jsonb_set(state,'{stage}','\"LAYOUT\"') WHERE id=$1 AND version=1",
        [productionId],
      ),
    ),
  );
  assert.equal(
    updates.reduce((n, result) => n + result.rowCount, 0),
    1,
    'Only one stale-tab update may succeed',
  );
  const tasks = await sql.query(
    "SELECT p.submission_id FROM editorial_productions p JOIN native_editorial_submissions s ON s.id=p.submission_id WHERE s.status='ACCEPTED' AND p.state->'assignments' @> $1::jsonb",
    [JSON.stringify([{ userId }])],
  );
  assert.equal(tasks.rowCount, 1);
  assert.equal(
    (
      await sql.query(
        "SELECT id FROM editorial_productions WHERE state->'assignments' @> $1::jsonb",
        [JSON.stringify([{ userId: randomUUID() }])],
      )
    ).rowCount,
    0,
  );
  await assert.rejects(
    sql.query(
      'INSERT INTO editorial_productions(id,submission_id,state,updated_at) VALUES($1,$2,$3,now())',
      [randomUUID(), submissionId, state],
    ),
    (e) => e.code === '23505',
  );
  await sql.query(
    'INSERT INTO editorial_production_files(id,production_id,kind,revision_id,state_digest,sha256,file_name,media_type,bytes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
    [
      fileId,
      productionId,
      'PROOF',
      'rev1',
      'a'.repeat(64),
      'b'.repeat(64),
      'article.pdf',
      'application/pdf',
      Buffer.from('%PDF-proof'),
    ],
  );
  await assert.rejects(
    sql.query('UPDATE editorial_production_files SET sha256=$1 WHERE id=$2', [
      'invalid',
      fileId,
    ]),
    (e) => e.code === '23514',
  );
  assert.equal(
    (
      await sql.query(
        'SELECT bytes FROM editorial_production_files WHERE id=$1',
        [fileId],
      )
    ).rows[0].bytes.toString(),
    '%PDF-proof',
  );
  await sql.query('DELETE FROM native_editorial_submissions WHERE id=$1', [
    submissionId,
  ]);
  assert.equal(
    (
      await sql.query(
        'SELECT count(*)::int AS n FROM editorial_production_files',
      )
    ).rows[0].n,
    0,
  );
  assert.equal(
    (await sql.query('SELECT count(*)::int AS n FROM editorial_productions'))
      .rows[0].n,
    0,
  );
});
