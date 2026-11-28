import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import pg from '../server/node_modules/pg/lib/index.js';

const url = process.env.OMI_TEST_POSTGRES_URL;
if (!url) throw new Error('OMI_TEST_POSTGRES_URL is required for the translation migration gate.');

async function scopedDatabase(t) {
  const schema = 'translation_' + randomUUID().replaceAll('-', '');
  const admin = new pg.Client({ connectionString: url });
  await admin.connect();
  const scoped = new URL(url);
  scoped.searchParams.set('options', '-csearch_path=' + schema);
  const sql = new pg.Client({ connectionString: scoped.href });
  t.after(async () => {
    try { await sql.end(); }
    finally {
      try { await admin.query('DROP SCHEMA IF EXISTS ' + schema + ' CASCADE'); }
      finally { await admin.end(); }
    }
  });
  await admin.query('CREATE SCHEMA ' + schema);
  await sql.connect();
  return sql;
}

async function apply(sql, path) {
  await sql.query(await readFile(new URL('../server/prisma/' + path + '/migration.sql', import.meta.url), 'utf8'));
}

test('Studio OJS and translation SQL preserves task payloads and enforces the intended historical backfill', async (t) => {
  const sql = await scopedDatabase(t);
  await sql.query(`
    CREATE TYPE "ReviewAssignmentType" AS ENUM ('SCIENTIFIC_REVIEW','LANGUAGE_REVIEW','TRANSLATION','EDITORIAL_REVISION');
    CREATE TYPE "ReviewAnonymityMode" AS ENUM ('DOUBLE_BLIND','SINGLE_BLIND','OPEN');
    CREATE TABLE peer_review_assignments (
      id INTEGER PRIMARY KEY, assignment_type "ReviewAssignmentType" NOT NULL,
      anonymity_mode "ReviewAnonymityMode" NOT NULL, source_language VARCHAR(32),
      target_language VARCHAR(32), status TEXT NOT NULL, manuscript_snapshot JSONB NOT NULL
    );
    CREATE TABLE ojs_review_writeback_contexts (id INTEGER PRIMARY KEY, external_assignment_id TEXT NOT NULL);
    INSERT INTO peer_review_assignments VALUES
      (1,'SCIENTIFIC_REVIEW','OPEN','hu',NULL,'SUBMITTED','{"preserve":1}'),
      (2,'LANGUAGE_REVIEW','DOUBLE_BLIND','hu','en','COMPLETED','{"preserve":2}'),
      (3,'TRANSLATION','DOUBLE_BLIND','hu','de','IN_PROGRESS','{"preserve":3}'),
      (4,'TRANSLATION','SINGLE_BLIND',NULL,'en','INVITED','{"preserve":4}'),
      (5,'EDITORIAL_REVISION','SINGLE_BLIND','hu',NULL,'ACCEPTED','{"preserve":5}');
    INSERT INTO ojs_review_writeback_contexts VALUES (1,'external-123');
  `);
  const legacyColumns = 'id, assignment_type, source_language, target_language, status, manuscript_snapshot';
  const before = (await sql.query('SELECT ' + legacyColumns + ' FROM peer_review_assignments ORDER BY id')).rows;
  await apply(sql, 'migrations/20261128040000_ojs_role_writeback');
  await apply(sql, 'migrations/20261128050000_translation_assignment_languages');
  assert.deepEqual((await sql.query('SELECT ' + legacyColumns + ' FROM peer_review_assignments ORDER BY id')).rows, before);
  const rows = (await sql.query('SELECT id, anonymity_mode, publication_languages FROM peer_review_assignments ORDER BY id')).rows;
  assert.deepEqual(rows.map(r => r.anonymity_mode), ['DOUBLE_BLIND','OPEN','OPEN','OPEN','SINGLE_BLIND']);
  assert.deepEqual(rows.map(r => r.publication_languages), [[],[],['hu'],[],[]]);
  assert.deepEqual((await sql.query('SELECT * FROM ojs_review_writeback_contexts')).rows, [
    { id: 1, external_assignment_id: 'external-123', assignment_token: null, receipt: null, last_error: null, synced_at: null },
  ]);
  await sql.query("UPDATE ojs_review_writeback_contexts SET assignment_token='opaque', receipt='{\"ok\":true}', synced_at=now() WHERE id=1");
  assert.deepEqual((await sql.query('SELECT receipt FROM ojs_review_writeback_contexts')).rows[0].receipt, { ok: true });
});

test('Identity translation profile SQL preserves existing users and validates the new JSON array', async (t) => {
  const sql = await scopedDatabase(t);
  await sql.query("CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL); INSERT INTO users VALUES (1,'existing@example.invalid')");
  await apply(sql, 'identity/migrations/20261128050000_translation_profile_languages');
  assert.deepEqual((await sql.query('SELECT * FROM users')).rows, [
    { id: 1, email: 'existing@example.invalid', translation_language_pairs: [] },
  ]);
  await sql.query("INSERT INTO users(id,email) VALUES (2,'new@example.invalid')");
  assert.deepEqual((await sql.query('SELECT translation_language_pairs FROM users WHERE id=2')).rows[0].translation_language_pairs, []);
  const pairs = [{ source: 'hu', target: 'en' }, { source: 'hu', target: 'de' }];
  await sql.query('UPDATE users SET translation_language_pairs=$1::jsonb WHERE id=1', [JSON.stringify(pairs)]);
  assert.deepEqual((await sql.query('SELECT translation_language_pairs FROM users WHERE id=1')).rows[0].translation_language_pairs, pairs);
  await assert.rejects(sql.query("UPDATE users SET translation_language_pairs='{}'::jsonb WHERE id=1"), e => e.code === '23514');
  await assert.rejects(sql.query('UPDATE users SET translation_language_pairs=NULL WHERE id=1'), e => e.code === '23502');
});
