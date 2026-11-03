import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const file = (name) => new URL(name, import.meta.url).pathname;
const source = (name) => readFileSync(file(name), 'utf8');

test('stage-only API outage runner has valid syntax and transient isolation', () => {
  const script = '../scripts/acceptance/run-pdf-api-failclosed-staging.sh';
  const result = spawnSync('bash', ['-n', file(script)], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const bash = source(script);
  assert.match(bash, /systemd-run --wait --pipe --collect/);
  assert.match(bash, /PrivateNetwork=yes/);
  assert.match(bash, /stage_user=omi-rc-builder/);
  assert.match(bash, /--property="User=\$stage_user"/);
  assert.match(bash, /--property="Group=\$stage_user"/);
  assert.match(bash, /InaccessiblePaths=.*\/var\/www\/vhosts.*\/opt\/omi-pdf-worker/);
  assert.match(bash, /test "\$stage_user" != "\$api_user"/);
  assert.doesNotMatch(bash, /--property="User=\$api_user"/);
  assert.match(bash, /PrivateTmp=yes/);
  assert.match(bash, /NoNewPrivileges=yes/);
  assert.match(bash, /omi-pdf-api-stage-/);
  assert.match(bash, /\/var\/www\/vhosts\/\*/);
  assert.match(bash, /\/run\/omi-pdf-worker\.sock|PDF_WORKER_SOCKET|server\/dist\/services\/vivliostylePdfRenderer/);
  assert.doesNotMatch(bash, /\bsystemctl\s+(?:stop|start|restart|disable|enable)\b/);
  assert.doesNotMatch(bash, /\bnft\s+(?:add|delete|flush)\b/);
});

test('staged API and worker are separate synthetic AF_UNIX endpoints', () => {
  const parent = source('./pdf-worker-api-failclosed.test.mjs');
  const child = source('./fixtures/pdf-worker-staging-stub.mjs');
  assert.match(parent, /staging-api\.sock/);
  assert.match(parent, /synthetic-worker\.sock/);
  assert.match(parent, /spawn\(process\.execPath/);
  assert.match(parent, /PDF_RENDERER_UNAVAILABLE/);
  assert.match(parent, /assert\.equal\(missing\.status, 503\)/);
  assert.match(parent, /assert\.equal\(recovered\.status, 200\)/);
  assert.match(child, /createPdfWorkerServer/);
  assert.doesNotMatch(child, /\/run\/omi-pdf-worker\.sock.*listen/);
  for (const fileName of ['./pdf-worker-api-failclosed.test.mjs', './fixtures/pdf-worker-staging-stub.mjs']) {
    const syntax = spawnSync(process.execPath, ['--check', file(fileName)], { encoding: 'utf8' });
    assert.equal(syntax.status, 0, syntax.stderr);
  }
});
