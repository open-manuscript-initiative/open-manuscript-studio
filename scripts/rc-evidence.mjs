import { collectRcWorkflowEvidence, assessRcEvidence, REQUIRED_WORKFLOWS } from './aggregate-rc-evidence.mjs';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const RC_MANUAL_GATES = [
  'host-egress', 'host-pdf-sandbox', 'private-manuscript-preservation',
  'windows-device', 'linux-device', 'android-device', 'ojs-3.5.0-4', 'ojs-3.5.0-5',
  'security-review', 'accessibility', 'performance', 'recovery', 'owner-go-no-go',
];
export const RC_WORKFLOWS = REQUIRED_WORKFLOWS.filter(item => item.id !== 'tauri-desktop.yml').map(item => '.github/workflows/' + item.id);
const BUILD_WORKFLOW = '.github/workflows/tauri-desktop.yml';
const sha = /^[a-f0-9]{40}$/;
const hash = /^[a-f0-9]{64}$/;
const requiredJobs = ['Desktop (linux-x86_64)', 'Desktop (windows-x86_64)', 'Desktop (macos-aarch64)', 'Desktop (macos-x86_64)', 'Android universal APK'];

export function validateBuildRun(run, jobs, expectedSha, repository) {
  if (!sha.test(expectedSha) || run?.head_sha !== expectedSha || run?.path !== BUILD_WORKFLOW ||
    run?.head_repository?.full_name !== repository || run?.head_branch !== 'main' ||
    !['push', 'workflow_dispatch'].includes(run?.event)) throw new Error('RC_BUILD_SUBJECT_MISMATCH');
  for (const name of requiredJobs) {
    if (!jobs.some(job => job.name === name && job.status === 'completed' && job.conclusion === 'success')) {
      throw new Error('RC_BUILD_JOB_NOT_PASSED: ' + name);
    }
  }
}

/** Owner attestations are explicit human evidence, never called independent certification. */
export function validateRcEvidence(evidence, expectedSha, artifactDigests) {
  if (!sha.test(expectedSha) || evidence?.format !== 'omi-studio-rc-evidence' || evidence.version !== '1' ||
    evidence.sourceSha !== expectedSha || !Number.isSafeInteger(evidence.buildRunId) || evidence.buildRunId < 1 ||
    typeof evidence.owner !== 'string' || !evidence.owner.trim() || !Number.isFinite(Date.parse(evidence.reviewedAt))) {
    throw new Error('RC_EVIDENCE_SUBJECT_INVALID');
  }
  if (!Array.isArray(evidence.gates) || evidence.gates.length !== RC_MANUAL_GATES.length ||
    new Set(evidence.gates.map(item => item.id)).size !== RC_MANUAL_GATES.length) throw new Error('RC_EVIDENCE_GATES_INCOMPLETE');
  for (const id of RC_MANUAL_GATES) {
    const gate = evidence.gates.find(item => item.id === id);
    if (!gate || gate.status !== 'pass' || gate.sourceSha !== expectedSha ||
      typeof gate.evidenceRef !== 'string' || !/^https:\/\//u.test(gate.evidenceRef) ||
      !Number.isFinite(Date.parse(gate.observedAt))) throw new Error('RC_MANUAL_GATE_NOT_PASSED: ' + id);
  }
  if (!Array.isArray(evidence.workflows) || evidence.workflows.length !== RC_WORKFLOWS.length ||
    new Set(evidence.workflows.map(item => item.path)).size !== RC_WORKFLOWS.length ||
    RC_WORKFLOWS.some(path => !evidence.workflows.some(item => item.path === path && Number.isSafeInteger(item.runId) && item.runId > 0))) {
    throw new Error('RC_WORKFLOW_EVIDENCE_INCOMPLETE');
  }
  const declared = evidence.artifacts;
  const names = Object.keys(artifactDigests).sort();
  if (!declared || names.length < 5 || JSON.stringify(Object.keys(declared).sort()) !== JSON.stringify(names) ||
    names.some(name => !hash.test(declared[name]) || declared[name] !== artifactDigests[name])) throw new Error('RC_ARTIFACT_DIGEST_MISMATCH');
}

async function api(path) {
  if (!process.env.GITHUB_TOKEN) throw new Error('RC_GITHUB_TOKEN_REQUIRED');
  const response = await fetch('https://api.github.com/repos/' + process.env.GITHUB_REPOSITORY + '/' + path, {
    headers: { Authorization: 'Bearer ' + process.env.GITHUB_TOKEN, Accept: 'application/vnd.github+json' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error('RC_GITHUB_EVIDENCE_UNAVAILABLE: ' + response.status);
  return response.json();
}
async function jobsFor(runId) {
  const jobs = [];
  for (let page = 1; page <= 20; page++) {
    const result = await api(`actions/runs/${runId}/jobs?filter=latest&per_page=100&page=${page}`);
    jobs.push(...result.jobs);
    if (result.jobs.length < 100) return jobs;
  }
  throw new Error('RC_JOB_EVIDENCE_TRUNCATED');
}
export async function verifyBuild(runId, expectedSha) {
  if (!/^\d+$/u.test(String(runId))) throw new Error('RC_BUILD_RUN_REQUIRED');
  validateBuildRun(await api(`actions/runs/${runId}`), await jobsFor(runId), expectedSha, process.env.GITHUB_REPOSITORY);
}
export async function verifyRcEvidence(evidence, expectedSha, artifactDirectory) {
  const digests = {};
  for (const name of await readdir(artifactDirectory)) {
    if (name === 'SHA256SUMS.txt') continue;
    digests[name] = createHash('sha256').update(await readFile(resolve(artifactDirectory, name))).digest('hex');
  }
  validateRcEvidence(evidence, expectedSha, digests);
  await verifyBuild(evidence.buildRunId, expectedSha);
  const current = process.env.GITHUB_RUN_ID;
  const options = current ? { publishingRunId: Number(current) } : {};
  const workflows = await collectRcWorkflowEvidence(process.env.GITHUB_REPOSITORY, expectedSha, process.env.GITHUB_TOKEN, options);
  const report = assessRcEvidence({ sha: expectedSha, repository: process.env.GITHUB_REPOSITORY, workflows });
  if (report.status !== 'ready-for-manual-review') {
    throw new Error('RC_E02_EVIDENCE_BLOCKED: ' + report.failures.map(item => item.code + '/' + item.workflow).join(', '));
  }
  const selectedBuild = report.workflows.find(item => item.workflow === 'tauri-desktop.yml');
  if (selectedBuild?.runId !== evidence.buildRunId) throw new Error('RC_APPROVED_BUILD_IS_NOT_NEWEST_CANDIDATE');
  for (const item of evidence.workflows) {
    if (!report.workflows.some(actual => '.github/workflows/' + actual.workflow === item.path && actual.runId === item.runId)) {
      throw new Error('RC_RECEIPT_WORKFLOW_RUN_MISMATCH: ' + item.path);
    }
  }
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    if (process.argv[2] === '--build') await verifyBuild(process.argv[3], process.env.GITHUB_SHA);
    else {
      const evidence = JSON.parse(await readFile(process.argv[2], 'utf8'));
      if (String(evidence.buildRunId) !== process.env.INPUT_BUILD_RUN_ID) throw new Error('RC_APPROVED_BUILD_RUN_MISMATCH');
      await verifyRcEvidence(evidence, process.env.GITHUB_SHA, process.argv[3]);
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
