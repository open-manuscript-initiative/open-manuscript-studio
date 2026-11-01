import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * E02 exact-commit cross-workflow gate. Pure assessment is exported for
 * synthetic tests; only the CLI retrieves GitHub API evidence.
 *
 * All selected workflow runs must be successful MAIN push/manual runs on
 * precisely the reviewed SHA. An older green run may not mask a later red run.
 * Digests identify immutable GitHub artifact archives, NOT signatures or
 * independent verification of each installer inside them.
 */
export const REQUIRED_WORKFLOWS = Object.freeze([
  {
    id: 'ci.yml',
    jobs: ['Build', 'Collaboration demo checks', 'Integration state PostgreSQL gate'],
    artifacts: [],
  },
  {
    id: '1.0-readiness.yml',
    jobs: ['Build release evidence'],
    artifacts: ['omi-1.0-readiness-{attempt}'],
  },
  {
    id: 'codeql.yml',
    jobs: [/^Analyze \(/],
    artifacts: [],
  },
  {
    id: 'omi-spec-320-conformance.yml',
    jobs: ['conformance'],
    artifacts: [],
  },
  {
    id: 'pkp-integration-environment.yml',
    jobs: [
      'Select PKP acceptance targets',
      'ojs 3_5_0-4 (stable) workflow E2E',
      'ojs 3_5_0-5 (stable) workflow E2E',
      'omp 3_5_0-4 (preview) workflow E2E',
    ],
    artifacts: [
      'pkp-ojs-3_5_0-4-stable-diagnostics-{attempt}',
      'pkp-ojs-3_5_0-5-stable-diagnostics-{attempt}',
      'pkp-omp-3_5_0-4-preview-diagnostics-{attempt}',
    ],
  },
  {
    id: 'tauri-desktop.yml',
    jobs: [
      'Desktop (linux-x86_64)',
      'Desktop (windows-x86_64)',
      'Desktop (macos-aarch64)',
      'Desktop (macos-x86_64)',
      'Android universal APK',
    ],
    artifacts: [
      'open-manuscript-studio-linux-x86_64',
      'open-manuscript-studio-windows-x86_64',
      'open-manuscript-studio-macos-aarch64',
      'open-manuscript-studio-macos-x86_64',
      'open-manuscript-studio-android',
    ],
  },
]);

const EXACT_SHA = /^[0-9a-f]{40}$/;
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const MAX_AGE_DAYS = 14;

function error(code, workflow, detail) {
  return { code, workflow, detail };
}
const runTime = (run) => Date.parse(run?.created_at || '');
function recentEnough(run, now, maxAgeDays) {
  const when = runTime(run);
  const milliseconds = maxAgeDays * 24 * 60 * 60 * 1000;
  return Number.isFinite(when) && when <= now + 5 * 60 * 1000 && now - when <= milliseconds;
}
function sortedRuns(runs) {
  return [...runs].sort((a, b) =>
    runTime(b) - runTime(a) ||
    (Number(b.run_attempt ?? 0) - Number(a.run_attempt ?? 0)) ||
    (Number(b.id ?? 0) - Number(a.id ?? 0)));
}
function expectedArtifact(template, run) {
  return template.replace('{attempt}', String(run.run_attempt));
}
function mandatoryJobFound(jobs, wanted) {
  return jobs.some(job =>
    (typeof wanted === 'string' ? job.name === wanted : wanted.test(job.name || ''))
      && job.status === 'completed'
      && job.conclusion === 'success');
}

export function assessRcEvidence({
  sha, repository, now = Date.now(), maxAgeDays = MAX_AGE_DAYS,
  workflows, required = REQUIRED_WORKFLOWS,
}) {
  if (!EXACT_SHA.test(sha || '')) throw new Error('Reviewed commit must be a full 40-character lowercase Git SHA.');
  if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repository || '')) {
    throw new Error('Invalid GitHub repository name.');
  }
  if (!Number.isFinite(now) || !Number.isSafeInteger(maxAgeDays) || maxAgeDays <= 0 || maxAgeDays > 30) {
    throw new Error('Invalid evidence review window.');
  }

  const results = [], failures = [];
  for (const spec of required) {
    const data = workflows?.[spec.id];
    if (!data || !Array.isArray(data.runs)) {
      failures.push(error('MISSING_WORKFLOW_EVIDENCE', spec.id, 'Workflow evidence was not supplied.'));
      results.push({ workflow: spec.id, status: 'missing' });
      continue;
    }
    const matching = data.runs.filter(run =>
      run.head_sha === sha
      && run.head_branch === 'main'
      && ['push', 'workflow_dispatch'].includes(run.event)
    );
    const run = sortedRuns(matching)[0];
    if (!run) {
      failures.push(error('MISSING_EXACT_SHA_RUN', spec.id, 'No main-branch push/dispatch workflow run matches the reviewed SHA.'));
      results.push({ workflow: spec.id, status: 'missing' });
      continue;
    }

    const record = {
      workflow: spec.id, status: 'fail',
      runId: run.id, runAttempt: run.run_attempt,
      sha: run.head_sha, event: run.event, createdAt: run.created_at,
      url: run.html_url ?? null, artifacts: [],
    };
    results.push(record);
    let bad = false;
    const fail = (code, detail) => {
      failures.push(error(code, spec.id, detail));
      bad = true;
    };

    if (!recentEnough(run, now, maxAgeDays)) {
      fail('STALE_RUN', 'Run predates the maximum evidence age or has an invalid/future timestamp.');
    }
    if (run.status !== 'completed' || run.conclusion !== 'success') {
      fail('INCOMPLETE_OR_FAILED_RUN', 'Newest matching workflow attempt is not completed successfully.');
    }
    if (!Number.isSafeInteger(run.run_attempt) || run.run_attempt < 1) {
      fail('INVALID_RUN_ATTEMPT', 'No valid attempt number to bind artifact names.');
    }

    // These arrays must be fetched for the precise selected run, never
    // inherited from an older successful attempt or another branch.
    const jobs = data.jobs;
    if (!Array.isArray(jobs)) {
      fail('MISSING_JOB_EVIDENCE', 'Job list for selected run is missing.');
    } else {
      for (const wanted of spec.jobs) {
        if (!mandatoryJobFound(jobs, wanted)) {
          fail('MISSING_OR_SKIPPED_JOB', 'Mandatory job not successful: ' + String(wanted));
        }
      }
    }

    const artifacts = data.artifacts;
    if (!Array.isArray(artifacts)) {
      fail('MISSING_ARTIFACT_EVIDENCE', 'Artifact list for selected run is missing.');
    } else {
      for (const template of spec.artifacts) {
        const name = expectedArtifact(template, run);
        const matchingArtifacts = artifacts.filter(artifact => artifact.name === name);
        if (matchingArtifacts.length !== 1) {
          fail('MISSING_OR_DUPLICATE_ARTIFACT', 'Expected exactly one immutable archive: ' + name);
          continue;
        }
        const item = matchingArtifacts[0];
        if (item.expired === true || !DIGEST.test(item.digest || '') ||
            !Number.isSafeInteger(item.size_in_bytes) || item.size_in_bytes <= 0) {
          fail('INVALID_ARTIFACT', 'Archive must be non-expired, nonempty and SHA-256-addressed: ' + name);
          continue;
        }
        record.artifacts.push({
          id: item.id, name, digest: item.digest, bytes: item.size_in_bytes,
        });
      }
    }
    if (!bad) record.status = 'pass';
  }
  return {
    schemaVersion: 1,
    kind: 'studio-1.0-rc-evidence-inventory',
    repository, reviewedSha: sha,
    generatedAt: new Date(now).toISOString(),
    maxEvidenceAgeDays: maxAgeDays,
    status: failures.length === 0 ? 'ready-for-manual-review' : 'blocked',
    counts: { required: required.length, passed: results.filter(item => item.status === 'pass').length },
    workflows: results, failures,
    independentSecurityReviewVerified: false,
    publisherWorkflowPluginCommitPinned: false,
    deviceAcceptanceVerified: false,
    ownerGoNoGoApproved: false,
    caveat: 'Workflow/archive evidence only; neither binary signatures, artifact contents, the deployed server, third-party plugin commits, physical devices nor normative conformance are independently verified by this report.',
  };
}

export function renderRcEvidence(report) {
  const rows = report.workflows.map(item =>
    '| `' + item.workflow + '` | ' + item.status + ' | ' +
    (item.runId ? '`' + item.runId + '` attempt ' + item.runAttempt : 'missing') + ' | ' +
    item.artifacts.length + ' |');
  const problems = report.failures.map(item =>
    '- **' + item.code + '** (`' + item.workflow + '`): ' + item.detail.replaceAll('|', '\\|'));
  return [
    '# OMI Studio RC E02 cross-workflow evidence',
    '',
    '**Status:** ' + report.status,
    '**Reviewed commit:** `' + report.reviewedSha + '`',
    '**Generated:** ' + report.generatedAt,
    '**Required workflows:** ' + report.counts.passed + '/' + report.counts.required,
    '',
    '| Workflow | Result | Run | Valid artifact archives |',
    '|---|---|---|---:|',
    ...rows, '',
    ...(problems.length ? ['## Blocking evidence gaps', '', ...problems, ''] : []),
    '## Boundaries of this automated check',
    '',
    '- Each listed archive digest is the GitHub Actions **archive** digest, not a per-installer signature.',
    '- Plugin checkouts from external main branches are not yet pinned to independently recorded commits.',
    '- Host egress/PDF sandbox, reference hardware, signed installers and owner Go/No-Go must be accepted separately.',
    '- No private manuscripts, GitHub tokens or personal benchmark titles belong in evidence artifacts.',
    '',
  ].join('\n');
}

async function getJson(repository, path, token) {
  const url = 'https://api.github.com/repos/' + repository + '/' + path;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + token,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'omi-studio-rc-e02-evidence',
    },
  });
  if (!response.ok) throw new Error('GitHub evidence request failed (HTTP ' + response.status + ') for ' + path.split('?')[0]);
  return response.json();
}

export async function collectRcWorkflowEvidence(repository, sha, token) {
  const results = {};
  for (const spec of REQUIRED_WORKFLOWS) {
    const path = 'actions/workflows/' + encodeURIComponent(spec.id) +
      '/runs?branch=main&head_sha=' + sha + '&per_page=100';
    const data = await getJson(repository, path, token);
    if (!Array.isArray(data.workflow_runs) || (data.total_count ?? 0) > 100) {
      throw new Error('Incomplete GitHub workflow pagination for ' + spec.id);
    }
    const matching = data.workflow_runs.filter(run =>
      run.head_sha === sha && run.head_branch === 'main' &&
      ['push', 'workflow_dispatch'].includes(run.event));
    const selected = sortedRuns(matching)[0];
    if (!selected) {
      results[spec.id] = { runs: data.workflow_runs, jobs: [], artifacts: [] };
      continue;
    }
    const id = selected.id;
    const [jobs, artifacts] = await Promise.all([
      getJson(repository, 'actions/runs/' + id + '/jobs?per_page=100', token),
      getJson(repository, 'actions/runs/' + id + '/artifacts?per_page=100', token),
    ]);
    if (!Array.isArray(jobs.jobs) || !Array.isArray(artifacts.artifacts) ||
        (jobs.total_count ?? 0) > 100 || (artifacts.total_count ?? 0) > 100) {
      throw new Error('Incomplete GitHub job/artifact pagination for ' + spec.id);
    }
    results[spec.id] = { runs: data.workflow_runs, jobs: jobs.jobs, artifacts: artifacts.artifacts };
  }
  return results;
}

async function main(argv = process.argv.slice(2)) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!['--sha', '--json', '--markdown'].includes(name) || !value) {
      throw new Error('Usage: aggregate-rc-evidence.mjs --sha <40-hex> --json <path> --markdown <path>');
    }
    options[name.slice(2)] = value;
  }
  if (!options.sha || !options.json || !options.markdown || !EXACT_SHA.test(options.sha)) {
    throw new Error('Exact reviewed SHA and both output paths are mandatory.');
  }
  const repository = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  if (!repository || !token) throw new Error('GITHUB_REPOSITORY and GITHUB_TOKEN are required.');
  const workflows = await collectRcWorkflowEvidence(repository, options.sha, token);
  const report = assessRcEvidence({ sha: options.sha, repository, workflows });
  for (const [outputPath, content] of [
    [options.json, JSON.stringify(report, null, 2) + '\n'],
    [options.markdown, renderRcEvidence(report)],
  ]) {
    const destination = resolve(outputPath);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, content);
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    const { appendFile } = await import('node:fs/promises');
    await appendFile(process.env.GITHUB_STEP_SUMMARY, renderRcEvidence(report));
  }
  console.log('E02 evidence: ' + report.status + ' (' + report.counts.passed + '/' + report.counts.required + ')');
  if (report.failures.length > 0) process.exitCode = 1;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : 'RC evidence collection failed');
    process.exitCode = 1;
  });
}
