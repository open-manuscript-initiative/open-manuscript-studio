import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const script = new URL('../scripts/production-rollback.sh', import.meta.url).pathname;
const onLinux = process.platform === 'linux';

function git(repo, ...args) {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
}

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'omi-deploy-rollback-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const repo = join(root, 'repo');
  const web = join(root, 'web');
  const snapshot = join(root, 'snapshot');
  mkdirSync(join(repo, 'server', 'dist'), { recursive: true });
  mkdirSync(join(repo, 'server', 'node_modules'), { recursive: true });
  mkdirSync(web);
  git(repo, 'init', '-q');
  writeFileSync(join(repo, 'version.txt'), 'v1');
  git(repo, 'add', '.');
  git(repo, '-c', 'user.email=ci@example.invalid', '-c', 'user.name=CI', 'commit', '-qm', 'v1');
  const previous = git(repo, 'rev-parse', 'HEAD');
  writeFileSync(join(repo, 'version.txt'), 'v2');
  git(repo, 'add', '.');
  git(repo, '-c', 'user.email=ci@example.invalid', '-c', 'user.name=CI', 'commit', '-qm', 'v2');
  const current = git(repo, 'rev-parse', 'HEAD');
  writeFileSync(join(web, 'index.html'), '<p>previous published web</p>');
  writeFileSync(join(repo, 'server', 'dist', 'server.js'), 'previous compiled API');
  writeFileSync(join(repo, 'server', 'node_modules', 'runtime.txt'), 'previous runtime modules');
  const env = {
    ...process.env,
    STUDIO_REPOSITORY_DIR: repo,
    STUDIO_WEB_ROOT: web,
    STUDIO_PREVIOUS_SHA: previous,
    STUDIO_TARGET_SHA: current,
    STUDIO_ROLLBACK_SKIP_RESTART: '1',
  };
  return { root, repo, web, snapshot, env, previous, current };
}

test('production beta snapshot restores previous binaries and code without reverting user data', { skip: !onLinux }, (t) => {
  const f = fixture(t);
  const snapshot = spawnSync('bash', [script, 'snapshot', f.snapshot], { env: f.env, encoding: 'utf8' });
  assert.equal(snapshot.status, 0, snapshot.stderr || snapshot.stdout);
  assert.ok(existsSync(join(f.snapshot, 'snapshot-complete')));
  assert.equal(readFileSync(join(f.snapshot, 'previous-sha'), 'utf8').trim(), f.previous);

  writeFileSync(join(f.web, 'index.html'), '<p>failed update</p>');
  writeFileSync(join(f.repo, 'server', 'dist', 'server.js'), 'failed compiled API');
  writeFileSync(join(f.repo, 'server', 'node_modules', 'runtime.txt'), 'failed runtime modules');
  writeFileSync(join(f.root, 'user-data.txt'), 'edits made during the trial');

  const restore = spawnSync('bash', [join(f.snapshot, 'rollback.sh'), 'restore', f.snapshot], {
    env: f.env, encoding: 'utf8',
  });
  assert.equal(restore.status, 0, restore.stderr || restore.stdout);
  assert.equal(git(f.repo, 'rev-parse', 'HEAD'), f.previous);
  assert.equal(readFileSync(join(f.web, 'index.html'), 'utf8'), '<p>previous published web</p>');
  assert.equal(readFileSync(join(f.repo, 'server', 'dist', 'server.js'), 'utf8'), 'previous compiled API');
  assert.equal(readFileSync(join(f.repo, 'server', 'node_modules', 'runtime.txt'), 'utf8'), 'previous runtime modules');
  assert.equal(readFileSync(join(f.root, 'user-data.txt'), 'utf8'), 'edits made during the trial');
});

test('automatic code-only rollback refuses database migrations without a separate backup plan', { skip: !onLinux }, (t) => {
  const f = fixture(t);
  mkdirSync(join(f.repo, 'server', 'prisma', 'migrations', '20261101_test'), { recursive: true });
  writeFileSync(join(f.repo, 'server', 'prisma', 'migrations', '20261101_test', 'migration.sql'),
    'ALTER TABLE manuscript ADD COLUMN test_only TEXT;');
  git(f.repo, 'add', '.');
  git(f.repo, '-c', 'user.email=ci@example.invalid', '-c', 'user.name=CI', 'commit', '-qm', 'unsafe migration');

  const denied = spawnSync('bash', [script, 'snapshot', f.snapshot], {
    env: { ...f.env, STUDIO_TARGET_SHA: git(f.repo, 'rev-parse', 'HEAD') }, encoding: 'utf8',
  });
  assert.notEqual(denied.status, 0);
  assert.match(denied.stderr, /Migration changes require a reviewed database backup/);
  assert.equal(existsSync(join(f.snapshot, 'snapshot-complete')), false);
});


function reviewedMigration(f, sql = readFileSync(
  new URL('../server/prisma/migrations/20261109060000_android_closed_test_signups/migration.sql', import.meta.url),
  'utf8',
)) {
  const dir = join(f.repo, 'server/prisma/migrations/20261109060000_android_closed_test_signups');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'migration.sql'), sql);
  git(f.repo, 'add', '.');
  git(f.repo, '-c', 'user.email=ci@example.invalid', '-c', 'user.name=CI', 'commit', '-qm', 'migration');
  return git(f.repo, 'rev-parse', 'HEAD');
}

function fakePostgres(f, fail = false) {
  const bin = join(f.root, 'bin');
  mkdirSync(bin);
  writeFileSync(join(bin, 'pg_dump'), fail ? '#!/bin/sh\nexit 1\n' :
    [
      '#!/bin/sh',
      'set -eu',
      "archive=''",
      'for arg in "$@"; do',
      '  case "$arg" in --file=*) archive=$(echo "$arg" | cut -d= -f2-) ;; esac',
      'done',
      'test -n "$archive"',
      'test -n "$PGPASSWORD"',
      "printf 'fake custom-format archive\\n' > \"$archive\"",
    ].join('\n') + '\n');
  writeFileSync(join(bin, 'pg_restore'), '#!/bin/sh\nset -eu\nfor arg in "$@"; do :; done\ntest -s "$arg"\n');
  chmodSync(join(bin, 'pg_dump'), 0o700);
  chmodSync(join(bin, 'pg_restore'), 0o700);
  writeFileSync(join(f.repo, 'server', '.env'),
    'DATABASE_URL=postgresql://test:secret@127.0.0.1:5432/omi_ci?schema=public\n' +
    'IDENTITY_DATABASE_URL=postgresql://test:secret@127.0.0.1:5432/identity_ci?schema=public\n');
  return { ...f.env, PATH: bin + ':' + process.env.PATH };
}

test('reviewed additive migration creates two validated backups before runtime snapshot', { skip: !onLinux }, (t) => {
  const f = fixture(t);
  const target = reviewedMigration(f);
  const env = { ...fakePostgres(f), STUDIO_TARGET_SHA: target };
  const snapshot = spawnSync('bash', [script, 'snapshot', f.snapshot], { env, encoding: 'utf8' });
  assert.equal(snapshot.status, 0, snapshot.stderr || snapshot.stdout);
  assert.ok(existsSync(join(f.snapshot, 'snapshot-complete')));
  assert.ok(existsSync(join(f.snapshot, 'reviewed-migration')));
  for (const db of ['studio', 'identity']) {
    assert.ok(readFileSync(join(f.snapshot, 'database', db + '.dump')).length > 0);
  }
  const manifest = JSON.parse(readFileSync(join(f.snapshot, 'database', 'manifest.json'), 'utf8'));
  assert.equal(manifest.restoreWasTested, false);
  assert.equal(manifest.archives.length, 2);
  assert.doesNotMatch(JSON.stringify(manifest), /secret|postgresql:\/\//);
  writeFileSync(join(f.web, 'index.html'), '<p>failed deploy</p>');
  const restored = spawnSync('bash', [join(f.snapshot, 'rollback.sh'), 'restore', f.snapshot], {
    env, encoding: 'utf8',
  });
  assert.equal(restored.status, 0, restored.stderr || restored.stdout);
  assert.equal(readFileSync(join(f.web, 'index.html'), 'utf8'), '<p>previous published web</p>');
  assert.ok(existsSync(join(f.snapshot, 'database', 'studio.dump')));
});

test('reviewed migration refuses deployment when backup fails', { skip: !onLinux }, (t) => {
  const f = fixture(t);
  const target = reviewedMigration(f);
  const snapshot = spawnSync('bash', [script, 'snapshot', f.snapshot], {
    env: { ...fakePostgres(f, true), STUDIO_TARGET_SHA: target }, encoding: 'utf8',
  });
  assert.notEqual(snapshot.status, 0);
  assert.match(snapshot.stderr, /backup blocked/i);
  assert.equal(existsSync(join(f.snapshot, 'snapshot-complete')), false);
});

test('modifying approved SQL prevents automatic migration', { skip: !onLinux }, (t) => {
  const f = fixture(t);
  const target = reviewedMigration(f, 'DROP TABLE manuscripts;\n');
  const snapshot = spawnSync('bash', [script, 'snapshot', f.snapshot], {
    env: { ...f.env, STUDIO_TARGET_SHA: target }, encoding: 'utf8',
  });
  assert.notEqual(snapshot.status, 0);
  assert.match(snapshot.stderr, /Migration changes require a reviewed database backup/);
});

test('an accompanying identity migration always blocks automatic rollout', { skip: !onLinux }, (t) => {
  const f = fixture(t);
  reviewedMigration(f);
  const dir = join(f.repo, 'server/prisma/identity/migrations/20261109_unreviewed');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'migration.sql'), 'ALTER TABLE users ADD COLUMN test TEXT;\n');
  git(f.repo, 'add', '.');
  git(f.repo, '-c', 'user.email=ci@example.invalid', '-c', 'user.name=CI', 'commit', '-qm', 'identity migration');
  const snapshot = spawnSync('bash', [script, 'snapshot', f.snapshot], {
    env: { ...f.env, STUDIO_TARGET_SHA: git(f.repo, 'rev-parse', 'HEAD') }, encoding: 'utf8',
  });
  assert.notEqual(snapshot.status, 0);
  assert.equal(existsSync(join(f.snapshot, 'snapshot-complete')), false);
});
