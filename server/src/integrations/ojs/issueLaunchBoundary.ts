import type { LaunchClaims } from './launchVerifier.js';

function positiveId(value: unknown): value is string {
  return typeof value === 'string' && /^[1-9][0-9]*$/.test(value);
}

export function validateOjsLaunchTarget(claims: LaunchClaims, target: 'submission' | 'issue'): void {
  if (target === 'submission') {
    if (claims.issue !== undefined || claims.scope?.includes('issue.import.read')) {
      throw new Error('Issue grants cannot launch a single submission.');
    }
    return;
  }
  if (
    claims.profile !== 'omi-integration/1/ojs' ||
    claims.actorMode !== 'editor' ||
    !positiveId(claims.issue?.externalId) ||
    !positiveId(claims.context?.externalId) ||
    !positiveId(claims.actor?.externalId) ||
    claims.submission !== undefined ||
    claims.reviewAssignment !== undefined ||
    claims.scope?.length !== 1 ||
    claims.scope[0] !== 'issue.import.read' ||
    !claims.apiBaseUrl
  ) {
    throw new Error('An issue-only editorial read assertion is required.');
  }
}
