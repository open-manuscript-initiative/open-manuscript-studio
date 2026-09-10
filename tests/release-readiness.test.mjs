import assert from 'node:assert/strict';
import test from 'node:test';

import {
  evaluateLocalReadiness,
  summarizeGitHubIssues,
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
