import { useStudioStore } from '../app/useStudioStore';
import { applyOmiContainerImportPlan } from '../app/omiContainerImportActions';
import { inspectMissingManuscriptAssets } from './assetRecovery';
import { inspectOmiContainer } from './omiContainerImport';

/** Restore the same verified OMI package from a local file or cloud backup. */
export async function restoreOmiContainerBytes(
  bytes: ArrayBuffer | Uint8Array,
  expectedManuscriptId?: string,
): Promise<string> {
  const plan = await inspectOmiContainer(bytes);
  if (!plan.validForImport || !plan.manuscript) {
    const detail = plan.diagnostics
      .filter((diagnostic) => diagnostic.severity === 'error')
      .map((diagnostic) => diagnostic.message)
      .join(' ');
    throw new Error(detail || 'The OMI package failed integrity verification.');
  }
  if (expectedManuscriptId && plan.manuscript.id !== expectedManuscriptId) {
    throw new Error('The OMI package does not match the selected document.');
  }
  const id = await applyOmiContainerImportPlan(plan);
  const missing = await inspectMissingManuscriptAssets(useStudioStore.getState().manuscript);
  if (missing.length > 0) {
    throw new Error(`Restored document has ${missing.length} unavailable media asset(s).`);
  }
  return id;
}
