import type {
  ReviewRecommendationOption,
  ReviewRecommendationStorage,
} from '../../services/peerReviewService.js';

export interface OjsReviewRecommendations {
  storage: ReviewRecommendationStorage;
  options: ReviewRecommendationOption[];
  selectedExternalId: string | null;
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
