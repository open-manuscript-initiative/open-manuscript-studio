import { assertTrustedIntegrationUrl } from '../security/trustedRemoteUrl.js';
import type { LaunchClaims } from './launchVerifier.js';
import {
  parseOjsReviewRecommendations,
  type OjsReviewRecommendations,
} from './reviewRecommendationModel.js';
export { parseOjsReviewRecommendations } from './reviewRecommendationModel.js';
export type { OjsReviewRecommendations } from './reviewRecommendationModel.js';

function hasScope(claims: LaunchClaims, scope: string): boolean {
  return claims.scope?.includes(scope) ?? false;
}

export async function loadOjsReviewRecommendations(
  claims: LaunchClaims,
  payload: string,
  signature: string,
  installationBaseUrl: string,
): Promise<OjsReviewRecommendations | null> {
  if (claims.actorMode !== 'review') {
    throw new Error('OJS reviewer recommendations require a reviewer launch.');
  }
  if (!hasScope(claims, 'review.form.read')) {
    throw new Error('The reviewer launch does not grant review.form.read.');
  }
  if (!claims.apiBaseUrl) {
    throw new Error('The OJS reviewer launch does not include apiBaseUrl.');
  }

  const trustedBase = await assertTrustedIntegrationUrl(claims.apiBaseUrl, installationBaseUrl);
  const target = new URL(trustedBase.toString().replace(/\/$/, '') + '/review-recommendations');
  if (target.origin !== new URL(installationBaseUrl).origin || target.search || target.hash) {
    throw new Error('The OJS reviewer recommendation URL is not trusted.');
  }

  const response = await fetch(target, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: 'OMI ' + payload + '.' + signature,
    },
    redirect: 'error',
    signal: AbortSignal.timeout(30_000),
  });

  if (response.status === 404 || response.status === 405) {
    // Older OJS plugins do not expose this route. Leave the assignment on the
    // pre-native legacy string path until the paired plugin is deployed.
    return null;
  }
  if (!response.ok) {
    const text = (await response.text()).slice(0, 500);
    throw new Error(
      'OJS reviewer recommendation request failed with HTTP ' + response.status + (text ? ': ' + text : ''),
    );
  }

  return parseOjsReviewRecommendations(await response.json());
}
