#!/usr/bin/env node
// A pre-migration, private PostgreSQL backup for an explicitly reviewed additive
// deployment. Never prints connection strings, passwords or SQL data.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const [repoArg, snapshotArg] = process.argv.slice(2);
if (!repoArg || !snapshotArg) {
  console.error('Usage: node backup-reviewed-migration.mjs <repo> <snapshot-dir>');
  process.exit(2);
}
process.umask(0o077);
const repo = resolve(repoArg);
const backupDir = join(resolve(snapshotArg), 'database');
const envFile = join(repo, 'server', '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

function connection(input) {
  if (!input) throw Error('Required database connection is not configured.');
  let url;
  try { url = new URL(input); } catch { throw Error('Database URL is invalid.'); }
  if (!['postgresql:', 'postgres:'].includes(url.protocol) || !url.hostname || !url.pathname || url.pathname === '/') {
    throw Error('Database URL is missing a PostgreSQL host or name.');
  }
  const password = decodeURIComponent(url.password);
  if (!password) throw Error('Database URL must include an authentication password for unattended backup.');
  url.password = '';
  // Prisma-only connection settings are not accepted by libpq's pg_dump.
  for (const key of [...url.searchParams.keys()]) {
    if (['schema', 'connection_limit', 'pool_timeout', 'pgbouncer'].includes(key)) {
      url.searchParams.delete(key);
    } else if (!['sslmode', 'sslrootcert', 'sslcert', 'sslkey', 'connect_timeout',
      'application_name', 'options', 'channel_binding', 'target_session_attrs',
      'hostaddr', 'sslnegotiation'].includes(key)) {
      throw Error('Database URL has an unsupported connection option.');
    }
  }
  return { database: url.toString(), password };
}

function checked(program, args, env) {
  const result = spawnSync(program, args, {
    env, stdio: 'ignore', timeout: 20 * 60 * 1000,
  });
  if (result.error || result.status !== 0) {
    throw Error('A required backup utility failed: ' + program + ' (details suppressed to protect credentials).');
  }
}

async function sha256(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

try {
  if (existsSync(backupDir)) throw Error('Snapshot database backup directory already exists.');
  mkdirSync(backupDir, { recursive: true, mode: 0o700 });
  chmodSync(backupDir, 0o700);

  const archives = [];
  for (const [name, envName] of [
    ['studio', 'DATABASE_URL'],
    ['identity', 'IDENTITY_DATABASE_URL'],
  ]) {
    const { database, password } = connection(process.env[envName]);
    const archive = join(backupDir, name + '.dump');
    const pgEnv = { ...process.env, PGPASSWORD: password, PGCONNECT_TIMEOUT: '10' };
    // The password is passed in the child's environment, never argv or logs.
    checked('pg_dump', ['--no-password', '--format=custom', '--file=' + archive,
      '--dbname=' + database], pgEnv);
    chmodSync(archive, 0o600);
    const info = statSync(archive);
    if (!info.isFile() || info.size === 0) throw Error('Database archive is empty.');
    // Verify archive TOC and decompress its data without connecting to or
    // modifying any DB. This is not a full restore drill.
    checked('pg_restore', ['--list', archive], pgEnv);
    checked('pg_restore', ['--file=/dev/null', archive], pgEnv);
    archives.push({ name, bytes: info.size, sha256: await sha256(archive) });
  }
  const manifest = join(backupDir, 'manifest.json');
  writeFileSync(manifest, JSON.stringify({
    kind: 'omi-pre-reviewed-migration-postgresql-backup',
    createdAt: new Date().toISOString(),
    archives,
    restoreWasTested: false,
  }, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  console.log('Verified custom-format PostgreSQL backups (studio and identity) stored in private rollback directory.');
} catch (error) {
  console.error('Reviewed migration backup blocked: ' + (error instanceof Error ? error.message : 'unknown error'));
  process.exitCode = 1;
}
