import assert from 'node:assert/strict';
import test from 'node:test';
import {
  REQUIRED_WORKFLOWS, assessRcEvidence, renderRcEvidence,
} from '../scripts/aggregate-rc-evidence.mjs';

const SHA = 'a'.repeat(40);
const OLD_SHA = 'b'.repeat(40);
const NOW = Date.parse('2026-11-01T12:00:00Z');
const REPO = 'open-manuscript-initiative/open-manuscript-studio';

function complete() {
  const workflows = {};
  let id = 1000;
  for (const spec of REQUIRED_WORKFLOWS) {
    id += 1;
    const run = {
      id, run_attempt: 1, run_number: 50, head_sha: SHA, head_branch: 'main',
      event: 'workflow_dispatch', created_at: '2026-11-01T08:00:00Z',
      run_started_at: '2026-11-01T08:01:00Z',
      status: 'completed', conclusion: 'success',
      html_url: 'https://github.com/open-manuscript-initiative/open-manuscript-studio/actions/runs/' + id,
    };
    const jobs = spec.jobs.map((wanted, index) => ({
      name: typeof wanted === 'string' ? wanted : 'Analyze (javascript-typescript)',
      status: 'completed', conclusion: 'success', id: index + 1,
    }));
    const artifacts = spec.artifacts.map((template, index) => ({
      id: id * 10 + index, name: template.replace('{attempt}', '1'),
      digest: 'sha256:' + 'f'.repeat(64), expired: false,
      size_in_bytes: 1024, created_at: '2026-11-01T09:00:00Z',
    }));
    workflows[spec.id] = { runs: [run], jobs, artifacts };
  }
  return workflows;
}
function assess(workflows = complete(), extra = {}) {
  return assessRcEvidence({ sha: SHA, repository: REPO, now: NOW, workflows, ...extra });
}
function failureCodes(report) { return report.failures.map(item => item.code); }

test('six complete same-SHA workflows yield only readiness for a later manual review', () => {
  const report = assess();
  assert.equal(report.status, 'ready-for-manual-review');
  assert.equal(report.counts.required, 6);
  assert.equal(report.counts.passed, 6);
  assert.deepEqual(report.failures, []);
  assert.equal(report.ownerGoNoGoApproved, false);
  assert.equal(report.deviceAcceptanceVerified, false);
  assert.equal(report.publisherWorkflowPluginCommitPinned, false);
  assert.equal(report.independentSecurityReviewVerified, false);
  assert.ok(renderRcEvidence(report).includes(SHA));
  assert.ok(renderRcEvidence(report).includes('not a per-installer signature'));
});

test('missing a required workflow or valid main SHA fails closed', () => {
  const workflows = complete();
  delete workflows['codeql.yml'];
  assert.ok(failureCodes(assess(workflows)).includes('MISSING_WORKFLOW_EVIDENCE'));
  const wrong = complete();
  wrong['ci.yml'].runs[0].head_sha = OLD_SHA;
  assert.ok(failureCodes(assess(wrong)).includes('MISSING_EXACT_SHA_RUN'));
  const prRun = complete();
  prRun['ci.yml'].runs[0].event = 'pull_request';
  assert.ok(failureCodes(assess(prRun)).includes('MISSING_EXACT_SHA_RUN'));
  const branch = complete();
  branch['ci.yml'].runs[0].head_branch = 'feature/other';
  assert.ok(failureCodes(assess(branch)).includes('MISSING_EXACT_SHA_RUN'));
});

test('newer red or cancelled same-SHA run cannot be hidden by older green attempt', () => {
  const workflows = complete();
  const older = workflows['ci.yml'].runs[0];
  workflows['ci.yml'].runs.push({
    ...older, id: 9999, created_at: '2026-11-01T11:00:00Z',
    conclusion: 'failure',
  });
  assert.ok(failureCodes(assess(workflows)).includes('INCOMPLETE_OR_FAILED_RUN'));
  workflows['ci.yml'].runs[1].status = 'in_progress';
  workflows['ci.yml'].runs[1].conclusion = null;
  assert.ok(failureCodes(assess(workflows)).includes('INCOMPLETE_OR_FAILED_RUN'));
  workflows['ci.yml'].runs[1].status = 'completed';
  workflows['ci.yml'].runs[1].conclusion = 'cancelled';
  assert.ok(failureCodes(assess(workflows)).includes('INCOMPLETE_OR_FAILED_RUN'));
});

test('a skipped mandatory PKP version or Android native build is a release block', () => {
  const workflows = complete();
  const jobs = workflows['pkp-integration-environment.yml'].jobs;
  jobs.find(job => job.name.includes('ojs 3_5_0-5')).conclusion = 'skipped';
  assert.ok(failureCodes(assess(workflows)).includes('MISSING_OR_SKIPPED_JOB'));
  const other = complete();
  other['tauri-desktop.yml'].jobs.find(job => job.name === 'Android universal APK').conclusion = 'skipped';
  assert.ok(failureCodes(assess(other)).includes('MISSING_OR_SKIPPED_JOB'));
});

test('missing, duplicate, expired, empty or unhashed GitHub archives fail closed', () => {
  for (const mutate of [
    artifacts => artifacts.pop(),
    artifacts => artifacts.push({ ...artifacts[0] }),
    artifacts => { artifacts[0].expired = true; },
    artifacts => { artifacts[0].digest = ''; },
    artifacts => { artifacts[0].size_in_bytes = 0; },
  ]) {
    const workflows = complete();
    mutate(workflows['1.0-readiness.yml'].artifacts);
    const report = assess(workflows);
    assert.equal(report.status, 'blocked');
    assert.ok(failureCodes(report).some(code =>
      ['MISSING_OR_DUPLICATE_ARTIFACT', 'INVALID_ARTIFACT'].includes(code)));
  }
});

test('rerun attempts cannot borrow artifacts uploaded on an earlier attempt', () => {
  const workflows = complete();
  const target = workflows['tauri-desktop.yml'];
  target.runs[0].run_attempt = 2;
  target.runs[0].run_started_at = '2026-11-01T11:00:00Z';
  assert.ok(failureCodes(assess(workflows)).includes('INVALID_ARTIFACT'));
  target.artifacts.forEach(item => { item.created_at = '2026-11-01T11:10:00Z'; });
  assert.equal(assess(workflows).status, 'ready-for-manual-review');
});

test('attempt-bound PKP and readiness archive names must match the selected run attempt', () => {
  const workflows = complete();
  const r = workflows['1.0-readiness.yml'];
  r.runs[0].run_attempt = 2;
  r.runs[0].run_started_at = '2026-11-01T10:00:00Z';
  r.artifacts[0].created_at = '2026-11-01T10:15:00Z';
  assert.ok(failureCodes(assess(workflows)).includes('MISSING_OR_DUPLICATE_ARTIFACT'));
  r.artifacts[0].name = 'omi-1.0-readiness-2';
  assert.equal(assess(workflows).status, 'ready-for-manual-review');
});

test('stale, missing or future timestamps never create an RC-ready result', () => {
  const workflows = complete();
  workflows['ci.yml'].runs[0].created_at = '2026-10-01T08:00:00Z';
  assert.ok(failureCodes(assess(workflows)).includes('STALE_RUN'));
  workflows['ci.yml'].runs[0].created_at = 'garbled';
  assert.ok(failureCodes(assess(workflows)).includes('STALE_RUN'));
  workflows['ci.yml'].runs[0].created_at = '2026-11-03T08:00:00Z';
  assert.ok(failureCodes(assess(workflows)).includes('STALE_RUN'));
});

test('no incomplete job list, artifact list or invalid SHA can silently pass', () => {
  const workflows = complete();
  delete workflows['ci.yml'].jobs;
  assert.ok(failureCodes(assess(workflows)).includes('MISSING_JOB_EVIDENCE'));
  const missingArtifacts = complete();
  delete missingArtifacts['ci.yml'].artifacts;
  assert.ok(failureCodes(assess(missingArtifacts)).includes('MISSING_ARTIFACT_EVIDENCE'));
  assert.throws(() => assess(complete(), { sha: 'abc' }), /full 40-character/);
  assert.throws(() => assess(complete(), { repository: 'evil/../repository' }), /repository name/);
});

test('the report contains only content-neutral run identifiers and archive checksums', () => {
  const report = assess();
  const serialized = JSON.stringify(report);
  assert.equal(serialized.includes('GITHUB_TOKEN'), false);
  assert.equal(serialized.includes('manuscriptTitle'), false);
  assert.match(serialized, /sha256:[a-f0-9]{64}/);
  assert.equal(report.workflows.find(w => w.workflow === 'pkp-integration-environment.yml').artifacts.length, 3);
});
