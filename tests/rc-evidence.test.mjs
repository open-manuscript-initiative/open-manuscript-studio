import assert from 'node:assert/strict';
import test from 'node:test';
import { RC_MANUAL_GATES, RC_WORKFLOWS, validateRcEvidence, validateBuildRun } from '../scripts/rc-evidence.mjs';
const sha = 'a'.repeat(40);
const artifacts = Object.fromEntries(['web-proof', 'windows-msi', 'windows-exe', 'linux-deb', 'android-apk'].map(name => [name, 'b'.repeat(64)]));
const receipt = () => ({ format: 'omi-studio-rc-evidence', version: '1', sourceSha: sha, buildRunId: 123,
  owner: 'synthetic-owner', reviewedAt: '2026-11-01T12:00:00Z', artifacts: { ...artifacts },
  workflows: RC_WORKFLOWS.map((path, index) => ({ path, runId: 1000 + index })),
  gates: RC_MANUAL_GATES.map(id => ({ id, status: 'pass', sourceSha: sha, observedAt: '2026-11-01T11:00:00Z', evidenceRef: 'https://example.test/redacted/pass-fail' })),
});
test('candidate evidence requires every manual gate, exact subject and actual artifact bytes', () => {
  assert.doesNotThrow(() => validateRcEvidence(receipt(), sha, artifacts));
  for (const mutate of [
    x => { x.sourceSha = 'c'.repeat(40); },
    x => { x.gates.pop(); },
    x => { x.gates[0].status = 'not-tested'; },
    x => { x.gates[0].sourceSha = 'c'.repeat(40); },
    x => { x.artifacts['windows-msi'] = 'd'.repeat(64); },
    x => { x.workflows.pop(); },
    x => { x.gates[0].evidenceRef = ''; },
    x => { x.gates[0] = x.gates[1]; },
  ]) { const x = receipt(); mutate(x); assert.throws(() => validateRcEvidence(x, sha, artifacts)); }
});
test('prior native build must be trusted main source and all platform builds successful', () => {
  const run = { head_sha: sha, path: '.github/workflows/tauri-desktop.yml', head_repository: { full_name: 'synthetic/studio' }, head_branch: 'main', event: 'push' };
  const jobs = ['Desktop (linux-x86_64)', 'Desktop (windows-x86_64)', 'Desktop (macos-aarch64)', 'Desktop (macos-x86_64)', 'Android universal APK'].map(name => ({ name, status: 'completed', conclusion: 'success' }));
  assert.doesNotThrow(() => validateBuildRun(run, jobs, sha, 'synthetic/studio'));
  assert.throws(() => validateBuildRun({ ...run, event: 'pull_request' }, jobs, sha, 'synthetic/studio'));
  assert.throws(() => validateBuildRun(run, jobs.slice(1), sha, 'synthetic/studio'));
  assert.throws(() => validateBuildRun(run, jobs, 'c'.repeat(40), 'synthetic/studio'));
});

test('publication reuses E02, omits only its own run, and binds newest candidate and actual bytes', async t => {
  const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { createHash } = await import('node:crypto');
  const { verifyRcEvidence } = await import('../scripts/rc-evidence.mjs');
  const { REQUIRED_WORKFLOWS } = await import('../scripts/aggregate-rc-evidence.mjs');
  const directory = await mkdtemp(join(tmpdir(), 'synthetic-rc-evidence-'));
  const originalFetch = globalThis.fetch;
  const prior = Object.fromEntries(['GITHUB_TOKEN', 'GITHUB_REPOSITORY', 'GITHUB_RUN_ID'].map(key => [key, process.env[key]]));
  process.env.GITHUB_TOKEN = 'synthetic-test-only'; process.env.GITHUB_REPOSITORY = 'synthetic/studio'; process.env.GITHUB_RUN_ID = '999';
  t.after(async () => {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    await rm(directory, { recursive: true, force: true });
  });
  const e = receipt(); e.artifacts = {};
  for (const name of Object.keys(artifacts)) {
    await writeFile(join(directory, name), name);
    e.artifacts[name] = createHash('sha256').update(name).digest('hex');
  }
  const now = Date.now();
  const runFor = spec => ({
    id: spec.id === 'tauri-desktop.yml' ? e.buildRunId : e.workflows.find(item => item.path.endsWith('/' + spec.id)).runId,
    head_sha: sha, head_repository: { full_name: 'synthetic/studio' }, path: '.github/workflows/' + spec.id,
    head_branch: 'main', event: 'workflow_dispatch', status: 'completed', conclusion: 'success', run_attempt: 1,
    created_at: new Date(now - 60_000).toISOString(), run_started_at: new Date(now - 60_000).toISOString(),
  });
  let foreignSha = false, skipped = false, newerRed = false;
  globalThis.fetch = async url => {
    const workflow = String(url).match(/actions\/workflows\/([^/]+)\/runs/);
    const runId = Number(String(url).match(/actions\/runs\/(\d+)/)?.[1]);
    const spec = workflow ? REQUIRED_WORKFLOWS.find(item => item.id === decodeURIComponent(workflow[1]))
      : REQUIRED_WORKFLOWS.find(item => runFor(item).id === runId || (runId === 124 && item.id === 'tauri-desktop.yml'));
    if (!spec) throw new Error('Unexpected synthetic request: ' + url);
    const run = runFor(spec);
    if (workflow) {
      const runs = [{ ...run, head_sha: foreignSha ? 'c'.repeat(40) : sha }];
      if (spec.id === 'tauri-desktop.yml') {
        runs.push({ ...run, id: 999, status: 'in_progress', conclusion: null, created_at: new Date(now).toISOString() });
        if (newerRed) runs.push({ ...run, id: 124, conclusion: 'failure', created_at: new Date(now - 1000).toISOString() });
      }
      return Response.json({ workflow_runs: runs, total_count: runs.length });
    }
    if (String(url).includes('/jobs')) {
      const jobs = spec.jobs.map(wanted => ({ name: typeof wanted === 'string' ? wanted : 'Analyze (javascript-typescript)', status: 'completed', conclusion: skipped ? 'skipped' : 'success' }));
      return Response.json({ jobs, total_count: jobs.length });
    }
    if (String(url).includes('/artifacts')) {
      const result = spec.artifacts.map((name, index) => ({ id: run.id * 10 + index, name: name.replace('{attempt}', '1'), digest: 'sha256:' + 'b'.repeat(64), size_in_bytes: 123, expired: false, created_at: run.created_at }));
      return Response.json({ artifacts: result, total_count: result.length });
    }
    return Response.json(run);
  };
  await assert.doesNotReject(verifyRcEvidence(e, sha, directory));
  foreignSha = true;
  await assert.rejects(verifyRcEvidence(e, sha, directory), /RC_E02_EVIDENCE_BLOCKED/);
  foreignSha = false; skipped = true;
  await assert.rejects(verifyRcEvidence(e, sha, directory), /RC_BUILD_JOB_NOT_PASSED/);
  skipped = false; newerRed = true;
  await assert.rejects(verifyRcEvidence(e, sha, directory), /RC_E02_EVIDENCE_BLOCKED.*INCOMPLETE_OR_FAILED_RUN/);
  newerRed = false;
  await writeFile(join(directory, 'android-apk'), 'different rebuilt bytes');
  await assert.rejects(verifyRcEvidence(e, sha, directory), /DIGEST_MISMATCH/);
});
