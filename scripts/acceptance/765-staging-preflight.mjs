#!/usr/bin/env node
/**
 * #765: one-command, read-only staging preflight.
 * NOT a live egress negative-path test, not production acceptance.
 * No arbitrary URL input, no production service modification, no secrets.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { request } from 'node:http';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ports = [3301, 3302];
const sha256 = path => 'sha256:' + createHash('sha256').update(readFileSync(path)).digest('hex');

function health(port) {
  return new Promise(resolveResult => {
    const req = request({
      hostname: '127.0.0.1', port, path: '/api/health',
      method: 'GET', agent: false, timeout: 3000,
      headers: { host: '127.0.0.1' },
    }, res => {
      // Do not follow redirects or print response bodies.
      res.resume();
      resolveResult(res.statusCode === 200 ? 'PASS' : 'FAIL');
    });
    req.on('timeout', () => req.destroy());
    req.on('error', () => resolveResult('FAIL'));
    req.end();
  });
}

export function summarize({ tests, healthChecks, sourceSha, buildDigest, harnessSha }) {
  const ready = tests === 'PASS' && healthChecks.every(x => x === 'PASS');
  return {
    schemaVersion: 1,
    scope: 'isolated-staging-preflight',
    status: ready ? 'PREFLIGHT_PASS' : 'PREFLIGHT_FAIL',
    sourceSha, buildDigest, harnessSha,
    offlineReceiptUnitTests: tests,
    stagingHealth3301: healthChecks[0],
    stagingHealth3302: healthChecks[1],
    liveApiNegativePath: 'NOT_VERIFIED',
    dnsRebindingAndRedirect: 'NOT_VERIFIED',
    productionLiveApiNegative: 'NOT_VERIFIED',
    hostEgressReceipt: 'NOT_APPROVED',
    rcDecision: 'NO_GO',
  };
}

async function main() {
  if (process.getuid?.() === 0) {
    console.error('Refusing root execution; run as an unprivileged staging operator.');
    process.exitCode = 2;
    return;
  }
  if (process.argv.length !== 2) {
    console.error('No arguments accepted. Fixed localhost staging ports only.');
    process.exitCode = 2;
    return;
  }
  const test = spawnSync(process.execPath, [
    '--test', 'tests/765-staging-receipt.test.mjs',
  ], { cwd: root, timeout: 20000, encoding: 'utf8', stdio: 'pipe',
    env: { PATH: process.env.PATH ?? '/usr/bin:/bin', HOME: process.env.HOME ?? '/tmp' },
  });
  const source = spawnSync('git', ['rev-parse', '--verify', 'HEAD'], {
    cwd: root, timeout: 3000, encoding: 'utf8',
  });
  const sourceSha = source.status === 0 && /^[a-f0-9]{40}$/.test(source.stdout.trim())
    ? source.stdout.trim() : 'NOT_VERIFIED';
  let buildDigest = 'NOT_VERIFIED';
  try { buildDigest = sha256('/var/lib/omi-staging-api/app/server/dist/server.js'); } catch {}
  const harnessSha = sha256(fileURLToPath(import.meta.url));
  const healthChecks = await Promise.all(ports.map(health));
  const result = summarize({
    tests: test.status === 0 && !test.error ? 'PASS' : 'FAIL',
    healthChecks, sourceSha, buildDigest, harnessSha,
  });
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'PREFLIGHT_PASS') process.exitCode = 2;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => { console.error('Preflight could not complete'); process.exitCode = 2; });
}
