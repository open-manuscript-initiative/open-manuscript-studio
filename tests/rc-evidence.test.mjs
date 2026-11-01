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

test('aggregator verifies live workflow subjects and refuses skipped/foreign results', async t => {
  const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { createHash } = await import('node:crypto');
  const { verifyRcEvidence } = await import('../scripts/rc-evidence.mjs');
  const directory = await mkdtemp(join(tmpdir(), 'synthetic-rc-evidence-'));
  const originalFetch = globalThis.fetch;
  const originalToken = process.env.GITHUB_TOKEN;
  const originalRepo = process.env.GITHUB_REPOSITORY;
  process.env.GITHUB_TOKEN = 'synthetic-test-only'; process.env.GITHUB_REPOSITORY = 'synthetic/studio';
  t.after(async () => {
    globalThis.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.GITHUB_TOKEN; else process.env.GITHUB_TOKEN = originalToken;
    if (originalRepo === undefined) delete process.env.GITHUB_REPOSITORY; else process.env.GITHUB_REPOSITORY = originalRepo;
    await rm(directory, { recursive: true, force: true });
  });
  const e = receipt(); e.artifacts = {};
  for (const name of Object.keys(artifacts)) {
    await writeFile(join(directory, name), name);
    e.artifacts[name] = createHash('sha256').update(name).digest('hex');
  }
  let foreignSha = false, skipped = false;
  globalThis.fetch = async url => {
    const runId = Number(String(url).match(/actions\/runs\/(\d+)/)?.[1]);
    const record = e.workflows.find(item => item.runId === runId);
    if (String(url).includes('/jobs')) {
      const jobs = runId === e.buildRunId
        ? ['Desktop (linux-x86_64)', 'Desktop (windows-x86_64)', 'Desktop (macos-aarch64)', 'Desktop (macos-x86_64)', 'Android universal APK']
        : ['Mandatory acceptance'];
      return Response.json({ jobs: jobs.map(name => ({ name, status: 'completed', conclusion: skipped && record ? 'skipped' : 'success' })) });
    }
    return Response.json({ head_sha: foreignSha && record ? 'c'.repeat(40) : sha, head_repository: { full_name: 'synthetic/studio' },
      path: record?.path ?? '.github/workflows/tauri-desktop.yml', head_branch: 'main', event: 'workflow_dispatch', status: 'completed', conclusion: 'success' });
  };
  await assert.doesNotReject(verifyRcEvidence(e, sha, directory));
  foreignSha = true;
  await assert.rejects(verifyRcEvidence(e, sha, directory), /SUBJECT_OR_RESULT_MISMATCH/);
  foreignSha = false; skipped = true;
  await assert.rejects(verifyRcEvidence(e, sha, directory), /JOBS_INCOMPLETE/);
  skipped = false;
  await writeFile(join(directory, 'android-apk'), 'different rebuilt bytes');
  await assert.rejects(verifyRcEvidence(e, sha, directory), /DIGEST_MISMATCH/);
});
