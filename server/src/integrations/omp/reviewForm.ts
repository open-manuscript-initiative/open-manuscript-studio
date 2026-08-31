import { assertTrustedIntegrationUrl } from '../security/trustedRemoteUrl.js';
import {
  getOjsReviewFormContext,
  rememberOjsReviewForm,
  saveOjsReviewFormResponses,
  validateOjsReviewFormComplete,
  type OjsReviewFormDefinition,
  type OjsReviewFormResponse,
} from '../ojs/reviewForm.js';
import type { OmpLaunchClaims } from './launchVerifier.js';

export type OmpReviewFormDefinition = OjsReviewFormDefinition;
export type OmpReviewFormResponse = OjsReviewFormResponse;

export async function loadOmpReviewForm(
  claims: OmpLaunchClaims,
  payload: string,
  signature: string,
  installationBaseUrl: string,
): Promise<OmpReviewFormDefinition | null> {
  if (claims.actorMode !== 'review') return null;
  if (!claims.scope?.includes('review.form.read')) {
    throw new Error('The OMP reviewer launch does not grant review.form.read.');
  }
  if (!claims.apiBaseUrl) {
    throw new Error('The OMP reviewer launch does not include apiBaseUrl.');
  }

  const trustedBase = await assertTrustedIntegrationUrl(claims.apiBaseUrl, installationBaseUrl);
  const target = new URL(`${trustedBase.toString().replace(/\/$/, '')}/review-form`);
  if (target.origin !== new URL(installationBaseUrl).origin || target.search || target.hash) {
    throw new Error('The OMP review form URL is not trusted.');
  }

  const response = await fetch(target, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `OMI ${payload}.${signature}`,
    },
    redirect: 'error',
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    const text = (await response.text()).slice(0, 500);
    throw new Error(
      `OMP review form request failed with HTTP ${response.status}${text ? `: ${text}` : ''}`,
    );
  }

  const data = await response.json() as { reviewForm?: unknown };
  if (data.reviewForm === null || data.reviewForm === undefined) return null;
  if (!isReviewFormDefinition(data.reviewForm)) {
    throw new Error('OMP returned an invalid native review form definition.');
  }
  return data.reviewForm;
}

function isReviewFormDefinition(value: unknown): value is OmpReviewFormDefinition {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.externalId === 'string' && Array.isArray(record.elements);
}

// Review-form persistence is platform-neutral at the assignment level. These
// aliases keep the OMP call sites explicit while preserving the existing DB
// schema used by the shared reviewer workspace.
export const rememberOmpReviewForm = rememberOjsReviewForm;
export const getOmpReviewFormContext = getOjsReviewFormContext;
export const saveOmpReviewFormResponses = saveOjsReviewFormResponses;
export const validateOmpReviewFormComplete = validateOjsReviewFormComplete;
