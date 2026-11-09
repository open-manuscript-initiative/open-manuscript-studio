#!/usr/bin/env node
// Check live Prisma migration state when an earlier manual checkout already
// moved the repository to the target commit without applying its migration.
// This is a fail-closed, read-only preflight. It must never print database URLs.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = process.argv[2] ? resolve(process.argv[2]) : '';
const approved = '20261109060000_android_closed_test_signups';
if (!root) {
  console.error('Usage: node reviewed-migration-status.mjs <repository-root>');
  process.exit(2);
}
const server = join(root, 'server');
const prisma = join(server, 'node_modules', '.bin', 'prisma');
if (!existsSync(prisma)) {
  console.error('Unable to verify migration state: Prisma CLI is not installed.');
  process.exit(1);
}

function status(config) {
  const result = spawnSync(prisma, ['migrate', 'status', '--config', config], {
    cwd: server,
    env: process.env,
    encoding: 'utf8',
    timeout: 60000,
    maxBuffer: 256 * 1024,
  });
  if (result.error) throw new Error('Prisma status check could not complete.');
  const output = (result.stdout || '') + '\n' + (result.stderr || '');
  if (result.status === 0 && /Database schema is up to date/i.test(output)) return 'applied';
  // Prisma's migration-status command returns nonzero if pending. Only the
  // explicitly reviewed single migration is allowed through this path.
  const match = output.match(/Following migrations? have not yet been applied:\s*\r?\n([\s\S]*?)(?=\r?\n\s*To apply migrations|\r?\n\s*Run \S+|$)/i);
  if (result.status !== 0 && match) {
    const names = match[1].split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    if (names.length === 1 && names[0] === approved) return 'pending';
  }
  throw new Error('Migration status is unavailable, divergent or contains unreviewed changes.');
}

try {
  const studio = status('prisma.config.ts');
  const identity = status('prisma.identity.config.ts');
  if (identity !== 'applied') throw new Error('Identity database has unapplied migrations.');
  process.stdout.write(studio + '\n');
} catch (error) {
  console.error('Reviewed migration preflight blocked: ' +
    (error instanceof Error ? error.message : 'unknown error'));
  process.exitCode = 1;
}
