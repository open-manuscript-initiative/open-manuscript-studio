import { useStudioStore } from './useStudioStore';
import { assertNoInvalidRevisionStateDigests } from '../model/revisionIntegrity';
import { putAssetPayload } from '../services/assetRepository';
import type { OmiContainerImportPlan } from '../services/omiContainerImport';

/**
 * Loads a verified OMI container without creating a new manuscript identity or
 * revision root. Binary asset payloads are restored before the manuscript is
 * handed to the normal Studio migration/load path.
 */
export async function applyOmiContainerImportPlan(
  plan: OmiContainerImportPlan,
): Promise<string> {
  if (!plan.validForImport || !plan.manuscript) {
    throw new Error('The OMI package has not passed integrity verification.');
  }

  const manuscript = plan.manuscript;
  assertNoInvalidRevisionStateDigests(manuscript);

  for (const asset of plan.assets) {
    await putAssetPayload(manuscript.id, asset.metadata.id, asset.bytes);
  }

  useStudioStore.getState().loadManuscript(manuscript);
  const loaded = useStudioStore.getState().manuscript;
  if (
    loaded.id !== manuscript.id ||
    loaded.headRevisionId !== manuscript.headRevisionId
  ) {
    throw new Error('Studio could not preserve the imported manuscript or head revision identity.');
  }

  return loaded.id;
}
