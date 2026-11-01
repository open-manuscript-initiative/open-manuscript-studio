import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
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
