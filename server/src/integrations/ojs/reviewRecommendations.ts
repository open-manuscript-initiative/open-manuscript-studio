import { assertTrustedIntegrationUrl } from '../security/trustedRemoteUrl.js';
import type { LaunchClaims } from './launchVerifier.js';
import type {
  ReviewRecommendationOption,
  ReviewRecommendationStorage,
} from '../../services/peerReviewService.js';

export interface OjsReviewRecommendations {
  storage: ReviewRecommendationStorage;
  options: ReviewRecommendationOption[];
  selectedExternalId: string | null;
}

function hasScope(claims: LaunchClaims, scope: string): boolean {
  return claims.scope?.includes(scope) ?? false;
}

export function parseOjsReviewRecommendations(value: unknown): OjsReviewRecommendations {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('OJS returned an invalid reviewer recommendation response.');
  }

  const record = value as Record<string, unknown>;
  const storage = record.recommendationStorage;
  if (storage !== 'native' && storage !== 'legacy' && storage !== 'unavailable') {
    throw new Error('OJS returned an unsupported reviewer recommendation storage mode.');
  }

  const options: ReviewRecommendationOption[] = [];
  const seen = new Set<string>();
  for (const item of Array.isArray(record.options) ? record.options : []) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const option = item as Record<string, unknown>;
    const externalId = typeof option.externalId === 'string'
      ? option.externalId.trim()
      : typeof option.externalId === 'number' && Number.isInteger(option.externalId)
        ? String(option.externalId)
        : '';
    const label = typeof option.label === 'string' ? option.label.trim() : '';
    if (!externalId || externalId.length > 128 || !label || label.length > 500 || seen.has(externalId)) continue;
    seen.add(externalId);
    options.push({ externalId, label });
  }

  const rawSelected = record.selectedExternalId;
  const selectedExternalId = typeof rawSelected === 'string' && options.some((option) => option.externalId === rawSelected)
    ? rawSelected
    : null;

  return { storage, options, selectedExternalId };
}

export async function loadOjsReviewRecommendations(
  claims: LaunchClaims,
  payload: string,
  signature: string,
  installationBaseUrl: string,
): Promise<OjsReviewRecommendations> {
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
    return { storage: 'unavailable', options: [], selectedExternalId: null };
  }
  if (!response.ok) {
    const text = (await response.text()).slice(0, 500);
    throw new Error(
      'OJS reviewer recommendation request failed with HTTP ' + response.status + (text ? ': ' + text : ''),
    );
  }

  return parseOjsReviewRecommendations(await response.json());
}
