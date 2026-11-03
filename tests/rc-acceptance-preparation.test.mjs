import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { REQUIRED_WORKFLOWS } from '../scripts/aggregate-rc-evidence.mjs';
import { RC_MANUAL_GATES, validateRcEvidence } from '../scripts/rc-evidence.mjs';
import { RELEASE_ASSETS, hashReleaseAssets, prepareReleaseAssets } from '../scripts/prepare-release-assets.mjs';
import { createRcAcceptanceDraft, prepareRcAcceptance, selectAcceptanceBuild } from '../scripts/prepare-rc-acceptance.mjs';

const sha = 'a'.repeat(40);
const report = () => ({ schemaVersion: 1, kind: 'studio-1.0-rc-evidence-inventory',
  repository: 'synthetic/studio', reviewedSha: sha, status: 'ready-for-manual-review', failures: [],
  workflows: REQUIRED_WORKFLOWS.map((spec, index) => ({ workflow: spec.id, status: 'pass', sha, runId: 100 + index })),
});

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'synthetic-rc-acceptance-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const input = join(root, 'input'), output = join(root, 'assets');
  const paths = [], hashes = {};
  for (const [index, [platform, suffix, name]] of RELEASE_ASSETS.entries()) {
    const directory = join(input, 'open-manuscript-studio-' + platform, 'bundle');
    await mkdir(directory, { recursive: true });
    const path = join(directory, suffix.startsWith('.') ? 'synthetic-installer' + suffix : suffix);
    const content = Buffer.from('synthetic installer bytes ' + index);
    await writeFile(path, content); paths.push(path);
    hashes[name] = createHash('sha256').update(content).digest('hex');
  }
  return { root, input, output, paths, hashes };
}

test('one shared preparation hashes all seven exact bytes with platform-specific names', async t => {
  const f = await fixture(t);
  assert.deepEqual(await prepareReleaseAssets(f.input, f.output), f.hashes);
  assert.deepEqual((await readdir(f.output)).sort(), [...Object.keys(f.hashes), 'SHA256SUMS.txt'].sort());
  assert.deepEqual(await hashReleaseAssets(f.output), f.hashes);
  const manifest = await readFile(join(f.output, 'SHA256SUMS.txt'), 'utf8');
  for (const [name, hash] of Object.entries(f.hashes)) assert.ok(manifest.includes(hash + '  ' + name + '\n'));
});

test('ambiguous or missing native assets fail before any review output is created', async t => {
  const f = await fixture(t);
  await writeFile(join(f.input, 'open-manuscript-studio-windows-x86_64', 'duplicate.exe'), 'duplicate');
  await assert.rejects(prepareReleaseAssets(f.input, f.output), /MISSING_OR_AMBIGUOUS/);
  await assert.rejects(readdir(f.output), { code: 'ENOENT' });
  await rm(join(f.input, 'open-manuscript-studio-windows-x86_64', 'duplicate.exe'));
  await rm(f.paths[0]);
  await assert.rejects(prepareReleaseAssets(f.input, f.output), /MISSING_OR_AMBIGUOUS/);
});

test('previously staged installer bytes cannot be overwritten', async t => {
  const f = await fixture(t);
  await prepareReleaseAssets(f.input, f.output);
  await writeFile(f.paths[0], 'different later bytes');
  await assert.rejects(prepareReleaseAssets(f.input, f.output), { code: 'EEXIST' });
  assert.deepEqual(await hashReleaseAssets(f.output), f.hashes);
});

test('empty, extra and non-regular staged files never become receipt hashes', async t => {
  const f = await fixture(t);
  await prepareReleaseAssets(f.input, f.output);
  const file = join(f.output, RELEASE_ASSETS[0][2]);
  await writeFile(file, '');
  await assert.rejects(hashReleaseAssets(f.output), /EMPTY_RELEASE_ASSET/);
  await writeFile(file, 'bytes');
  await mkdir(join(f.output, 'unexpected'));
  await assert.rejects(hashReleaseAssets(f.output), /ASSET_SET_MISMATCH/);
});

test('symbolic links cannot substitute for an installer', { skip: process.platform === 'win32' }, async t => {
  const f = await fixture(t);
  await rm(f.paths[0]);
  const target = join(f.root, 'outside.AppImage'); await writeFile(target, 'outside bytes');
  await symlink(target, f.paths[0]);
  await assert.rejects(prepareReleaseAssets(f.input, f.output), /MISSING_OR_AMBIGUOUS/);
});

test('draft selection rejects blocked, foreign-SHA, missing, duplicate and failed workflow evidence', () => {
  assert.equal(selectAcceptanceBuild(report(), sha), 105);
  for (const mutate of [
    x => { x.status = 'blocked'; },
    x => { x.reviewedSha = 'b'.repeat(40); },
    x => { x.failures.push({ code: 'FAILED' }); },
    x => { x.workflows.pop(); },
    x => { x.workflows[0] = x.workflows[1]; },
    x => { x.workflows[0].status = 'fail'; },
    x => { x.workflows[0].sha = 'b'.repeat(40); },
    x => { x.workflows[0].runId = 'shell-input'; },
  ]) { const r = report(); mutate(r); assert.throws(() => selectAcceptanceBuild(r, sha), /E02_NOT_READY/); }
});

test('generated receipt uses the existing v1 schema and remains unpublishable with all 13 gates pending', async t => {
  const f = await fixture(t); await prepareReleaseAssets(f.input, f.output);
  const destination = join(f.root, 'evidence'); await mkdir(destination);
  const draft = await prepareRcAcceptance(report(), sha, f.output, destination);
  assert.deepEqual(draft, createRcAcceptanceDraft(report(), sha, f.hashes));
  assert.equal(draft.owner, ''); assert.equal(draft.reviewedAt, '');
  assert.deepEqual(draft.gates.map(gate => gate.id), RC_MANUAL_GATES);
  assert.ok(draft.gates.every(gate => gate.status === 'pending' && gate.observedAt === '' && gate.evidenceRef === ''));
  assert.equal(draft.workflows.length, 5);
  assert.deepEqual(JSON.parse(await readFile(join(destination, 'acceptance-draft.json'), 'utf8')), draft);
  assert.throws(() => validateRcEvidence(draft, sha, f.hashes), /SUBJECT_INVALID/);
  draft.owner = 'synthetic reviewer'; draft.reviewedAt = '2026-11-04T00:00:00Z';
  assert.throws(() => validateRcEvidence(draft, sha, f.hashes), /MANUAL_GATE_NOT_PASSED/);
  await assert.rejects(prepareRcAcceptance(report(), sha, f.output, destination), { code: 'EEXIST' });
});

test('workflow CLI selects the numeric build ID and writes an unapproved content-free bundle', async t => {
  const f = await fixture(t), r = report();
  const reportPath = join(f.root, 'report.json'), outputPath = join(f.root, 'github-output');
  await writeFile(reportPath, JSON.stringify(r));
  execFileSync(process.execPath, ['scripts/prepare-rc-acceptance.mjs', '--select-build', reportPath, sha], {
    env: { ...process.env, GITHUB_OUTPUT: outputPath },
  });
  assert.equal(await readFile(outputPath, 'utf8'), 'build_run_id=105\n');
  execFileSync(process.execPath, ['scripts/prepare-release-assets.mjs', f.input, f.output]);
  const destination = join(f.root, 'receipt'); await mkdir(destination);
  execFileSync(process.execPath, ['scripts/prepare-rc-acceptance.mjs', reportPath, sha, f.output, destination]);
  const draft = JSON.parse(await readFile(join(destination, 'acceptance-draft.json'), 'utf8'));
  assert.equal(draft.sourceSha, sha); assert.equal(draft.buildRunId, 105);
  assert.ok(draft.gates.every(gate => gate.status === 'pending'));
  r.status = 'blocked'; await writeFile(reportPath, JSON.stringify(r));
  assert.throws(() => execFileSync(process.execPath, ['scripts/prepare-rc-acceptance.mjs', '--select-build', reportPath, sha], {
    env: { ...process.env, GITHUB_OUTPUT: outputPath }, stdio: 'pipe',
  }));
  assert.equal(await readFile(outputPath, 'utf8'), 'build_run_id=105\n');
});

test('evidence preparation and publication use the same staging implementation without approval shortcuts', async () => {
  const publication = await readFile('.github/workflows/tauri-desktop.yml', 'utf8');
  const evidence = await readFile('.github/workflows/rc-e02-evidence.yml', 'utf8');
  assert.ok(publication.includes('node scripts/prepare-release-assets.mjs release-input release-assets'));
  assert.ok(evidence.includes('node scripts/prepare-release-assets.mjs'));
  assert.ok(evidence.includes('run-id: ${{ steps.candidate.outputs.build_run_id }}'));
  assert.ok(publication.includes('--strict-local --strict-release'));
  assert.ok(publication.includes('APPROVE_1_0_RELEASE'));
  assert.ok(!evidence.includes('contents: write'));
});
