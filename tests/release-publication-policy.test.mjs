import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { shouldAttemptPublication } from '../scripts/release-publication-policy.mjs';

test('RC and 1.0 main/tag builds remain evidence-only until explicit main dispatch', () => {
  for (const version of ['1.0.0-rc.1', '1.0.0-rc.12', '1.0.0']) {
    const context = { version, eventName: 'push', ref: 'refs/heads/main' };
    assert.equal(shouldAttemptPublication(context), false);
    assert.equal(shouldAttemptPublication({ ...context, ref: `refs/tags/v${version}` }), false);
    assert.equal(shouldAttemptPublication({ ...context, eventName: 'workflow_dispatch' }), false);
    const request = { ...context, eventName: 'workflow_dispatch', releaseTag: `v${version}` };
    assert.equal(shouldAttemptPublication(request), true);
    assert.equal(shouldAttemptPublication({ ...request, candidateOnly: true }), false);
    assert.equal(shouldAttemptPublication({ ...request, ref: 'refs/heads/unreviewed' }), false);
    assert.equal(shouldAttemptPublication({ ...request, releaseTag: 'v0.3.0-beta.13' }), false);
  }
});

test('beta publication and PR/candidate isolation retain their existing behavior', () => {
  const context = { version: '0.3.0-beta.13', eventName: 'push', ref: 'refs/heads/main' };
  assert.equal(shouldAttemptPublication(context), true);
  assert.equal(shouldAttemptPublication({ ...context, ref: 'refs/tags/v0.3.0-beta.13' }), true);
  assert.equal(shouldAttemptPublication({ ...context, eventName: 'pull_request' }), false);
  assert.equal(shouldAttemptPublication({ ...context, candidateOnly: true }), false);
  assert.equal(shouldAttemptPublication({ ...context, ref: 'refs/heads/unreviewed' }), false);
});

test('policy CLI and workflow gate retain the separate exact-source/manual release guard', () => {
  const directory = mkdtempSync(join(tmpdir(), 'rc-policy-'));
  try {
    const output = join(directory, 'output');
    execFileSync(process.execPath, ['scripts/release-publication-policy.mjs'], {
      env: { ...process.env, GITHUB_EVENT_NAME: 'push', GITHUB_REF: 'refs/heads/main',
        INPUT_TAG: '', INPUT_CANDIDATE_ONLY: '', GITHUB_OUTPUT: output },
    });
    assert.equal(readFileSync(output, 'utf8'), 'publish=false\n');
    const workflow = readFileSync('.github/workflows/tauri-desktop.yml', 'utf8');
    assert.match(workflow, /if: \$\{\{ needs\.publication-policy\.outputs\.publish == 'true' \}\}/);
    for (const guard of ['APPROVE_1_0_RELEASE', 'INPUT_REVIEWED_SHA', 'scripts/rc-evidence.mjs', '--strict-local --strict-release']) {
      assert.ok(workflow.includes(guard), guard);
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('actual promotion shell preserves RC prerelease while beta and stable remain promotable', () => {
  const workflow = readFileSync('.github/workflows/promote-current-release.yml', 'utf8');
  const block = workflow.match(/ {8}run: \|\n([\s\S]*?)\n {2}promote:/)?.[1];
  assert.ok(block, 'promotion verification shell exists');
  const script = block.split('\n').map(line => line.replace(/^ {10}/, '')).join('\n');
  const directory = mkdtempSync(join(tmpdir(), 'rc-promotion-'));
  try {
    // Exercise the committed shell with a local GitHub stub, no credentials
    // or requests. Dispatch mode covers the manual promotion entry point too.
    writeFileSync(join(directory, 'gh'), '#!/bin/sh\ncase "$*" in\n  *".object.sha"*) printf "%s\\n" aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa ;;\n  *".object.type"*) printf "%s\\n" commit ;;\n  *"releases/tags/"*) exit 0 ;;\n  *) exit 90 ;;\nesac\n', { mode: 0o755 });
    for (const [tag, expected] of [['v1.0.0-rc.1', false], ['v1.0.0-rc.12', false], ['v0.3.0-beta.13', true], ['v1.0.0', true]]) {
      const output = join(directory, 'output');
      writeFileSync(output, '');
      execFileSync('bash', ['-c', script], { env: { ...process.env,
        PATH: directory + ':' + process.env.PATH, GITHUB_EVENT_NAME: 'workflow_dispatch',
        GITHUB_REPOSITORY: 'synthetic/studio', INPUT_TAG: tag, GITHUB_OUTPUT: output },
      });
      assert.ok(readFileSync(output, 'utf8').includes(`promote=${expected}\n`), tag);
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
