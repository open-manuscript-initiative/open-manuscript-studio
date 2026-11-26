import assert from 'node:assert/strict';
import test from 'node:test';
import { validateOjsLaunchTarget } from '../server/src/integrations/ojs/issueLaunchBoundary.ts';
import { createOjsIssueHandoff, consumeOjsIssueHandoff } from '../server/src/integrations/ojs/issueHandoffStore.ts';
import type { LaunchClaims } from '../server/src/integrations/ojs/launchVerifier.ts';

const claims: LaunchClaims = {
  protocol: 'omi-integration/1', profile: 'omi-integration/1/ojs',
  installationId: 'journal-1', context: { externalId: '1' },
  issue: { externalId: '41' }, actor: { externalId: '3' },
  actorMode: 'editor', scope: ['issue.import.read'],
  iat: 1, exp: 301, nonce: 'test',
  apiBaseUrl: 'https://journal.example/api/v1/omi-integration',
};

test('issue grant is accepted only for issue launch, never single submission', () => {
  assert.doesNotThrow(() => validateOjsLaunchTarget(claims, 'issue'));
  assert.throws(() => validateOjsLaunchTarget(claims, 'submission'));
  const { issue, ...rest } = claims;
  const article: LaunchClaims = { ...rest, scope: ['metadata.read'], submission: { externalId: '2' } };
  assert.doesNotThrow(() => validateOjsLaunchTarget(article, 'submission'));
  assert.throws(() => validateOjsLaunchTarget(article, 'issue'));
});

test('issue launch rejects mixed scope, role and identifier confusion', () => {
  for (const invalid of [
    { ...claims, actorMode: 'author' as const },
    { ...claims, scope: ['issue.import.read', 'files.write'] },
    { ...claims, submission: { externalId: '2' } },
    { ...claims, reviewAssignment: { externalId: '3' } },
    { ...claims, issue: { externalId: '../41' } },
    { ...claims, context: {} },
    { ...claims, actor: {} },
    { ...claims, apiBaseUrl: '' },
  ]) assert.throws(() => validateOjsLaunchTarget(invalid, 'issue'));
});

test('issue handoff is private, unguessable and single-use', () => {
  const data = { issue: '41', sections: [{ articles: ['1', '2'] }] };
  const token = createOjsIssueHandoff(data);
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(consumeOjsIssueHandoff('unknown'), undefined);
  assert.deepEqual(JSON.parse(consumeOjsIssueHandoff(token)!), data);
  assert.equal(consumeOjsIssueHandoff(token), undefined);
});

test('pending issue handoffs have a count limit and release capacity on consume', () => {
  const tokens = Array.from({ length: 8 }, (_, i) => createOjsIssueHandoff({ i }));
  try {
    assert.throws(() => createOjsIssueHandoff({ overflow: true }), /Too many pending/);
    consumeOjsIssueHandoff(tokens[0]!);
    const extra = createOjsIssueHandoff({ retry: true });
    consumeOjsIssueHandoff(extra);
  } finally {
    tokens.forEach(consumeOjsIssueHandoff);
  }
});
