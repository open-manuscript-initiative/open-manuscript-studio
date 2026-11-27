import type { OmiManuscriptState } from '../types/omi';
export function ompVolumeMetadataTarget(state: OmiManuscriptState) {
  const raw = state.extensions?.['org.openmanuscript.omp.volume'];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const origin = raw as Record<string, unknown>;
  const id = (value: unknown) => typeof value === 'string' && /^[1-9][0-9]*$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : undefined;
  const contextId = id(origin.contextExternalId), submissionId = id(origin.submissionExternalId), publicationId = id(origin.publicationExternalId);
  if (origin.version !== 1 || (origin.mode !== 'chapters' && origin.mode !== 'full-manuscript') ||
      typeof origin.installationId !== 'string' || !origin.installationId.trim() || origin.installationId.length > 255 ||
      !contextId || !submissionId || !publicationId) return undefined;
  return { installationId: origin.installationId, contextId, submissionId, publicationId };
}
