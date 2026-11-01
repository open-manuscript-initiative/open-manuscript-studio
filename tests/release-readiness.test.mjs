import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  evaluateLocalReadiness,
  summarizeGitHubIssues,
  evaluateStrictRcGate,
} from '../scripts/release-readiness.mjs';

test('the committed Route A release-readiness files pass local structural gates', async () => {
  const result = await evaluateLocalReadiness();

  assert.equal(result.route, 'A');
  assert.equal(result.local.passed, true, JSON.stringify(result.local.gates, null, 2));
  assert.equal(
    result.local.gates.every((gate) => gate.status === 'pass'),
    true,
  );
});

test('a missing required file is a failed local gate', async () => {
  const result = await evaluateLocalReadiness(undefined, {
    schemaVersion: 1,
    targetVersion: '1.0.0',
    route: 'A',
    minimumScore: 90,
    requiredFiles: ['does-not-exist'],
    workflowMarkers: {},
  });

  assert.equal(
    result.local.gates.find((gate) => gate.id === 'required-files')?.status,
    'fail',
  );
});

test('GitHub evidence counts red blockers but ignores pull requests', () => {
  const result = summarizeGitHubIssues([
    {
      number: 10,
      title: 'Data loss',
      html_url: 'https://example.invalid/issues/10',
      labels: [{ name: 'release-blocker' }],
    },
    {
      number: 11,
      title: 'Ordinary issue',
      html_url: 'https://example.invalid/issues/11',
      labels: ['bug'],
    },
    {
      number: 12,
      title: 'A pull request',
      html_url: 'https://example.invalid/pull/12',
      labels: [{ name: 'release-blocker' }],
      pull_request: {},
    },
  ], ['release-blocker']);

  assert.equal(result.openIssues, 2);
  assert.equal(result.openPullRequests, 1);
  assert.deepEqual(result.blockers.map((issue) => issue.number), [10]);
});

test('strict RC gate denies open release-blockers even if all automated local tests pass', () => {
  const decision = evaluateStrictRcGate({
    local: { passed: true },
    github: {
      available: true, passed: false, missingLabels: [],
      blockers: [
        { number: 765, title: 'Production egress not verified' },
        { number: 774, title: 'PDF worker deployment not verified' },
      ],
    },
  });
  assert.equal(decision.passed, false);
  assert.match(decision.reasons.join('; '), /#765, #774/);
  assert.equal(decision.manualSignoffRequired, true);
});

test('strict RC gate refuses unavailable GitHub evidence rather than passing open-blocker check', () => {
  const result = evaluateStrictRcGate({ local: { passed: true }, github: { available: false } });
  assert.equal(result.passed, false);
  assert.match(result.reasons.join(' '), /GitHub release issue evidence is unavailable/);
});

test('strict RC gate refuses missing labels or local failures', () => {
  const result = evaluateStrictRcGate({
    local: { passed: false },
    github: { available: true, passed: false, blockers: [], missingLabels: ['release-blocker'] },
  });
  assert.equal(result.passed, false);
  assert.equal(result.reasons.length, 2);
});

test('strict RC can pass documented automated criteria but still needs owner and real devices', () => {
  const result = evaluateStrictRcGate({
    local: { passed: true },
    github: { available: true, passed: true, blockers: [], missingLabels: [] },
  });
  assert.equal(result.passed, true);
  assert.equal(result.manualSignoffRequired, true);
});

test('1.0 RC/stable tag creation requires exact SHA owner approval and the strict release gate', () => {
  const workflow = readFileSync(
    new URL('../.github/workflows/tauri-desktop.yml', import.meta.url), 'utf8',
  );
  const versions = workflow.match(/if \[\[ "\$version" =~ \^1\\\.0\\\.0\(-rc/g);
  assert.ok(versions?.length, '1.0 stable and RC versions require a dedicated publish guard');
  assert.match(workflow, /INPUT_REVIEWED_SHA/);
  assert.match(workflow, /INPUT_RELEASE_APPROVAL/);
  assert.match(workflow, /APPROVE_1_0_RELEASE/);
  assert.match(workflow, /GITHUB_EVENT_NAME.*workflow_dispatch/);
  assert.match(workflow, /node scripts\/release-readiness\.mjs[\s\\\n]*--strict-local --strict-release/);
  assert.match(workflow, /No tag was created/);
});
