import { assertNoInvalidRevisionStateDigests } from '../../model/revisionIntegrity';
import type { OmiContainerImportPlan } from '../../services/omiContainerImport';
import type { OmiManuscript } from '../../types/omi';
import { isSameOmpVolume, type OmpVolumeHandoff } from './importOmpVolume';
import { compareOmpVolume } from './reimportOmpVolume';

/** Do not trust a profile link, filename, title or a copied publication version.
 * Validate the package and its exact native lineage before restoring any assets.
 */
export function validateSavedOmpVolume(plan: OmiContainerImportPlan, launch: OmpVolumeHandoff,
  openDocuments: readonly OmiManuscript[], expectedManuscriptId?: string): OmiManuscript {
  const document = plan.manuscript;
  if (!plan.validForImport || !document) throw new Error('Invalid OMI package.');
  if (expectedManuscriptId !== undefined && document.id !== expectedManuscriptId)
    throw new Error('The saved document link does not match the OMI package.');
  if (!isSameOmpVolume(document, launch)) throw new Error('The saved document belongs to another OMP volume.');
  if (openDocuments.some(open => open.id === document.id || isSameOmpVolume(open, launch)))
    throw new Error('A copy of this volume or manuscript is already open.');
  assertNoInvalidRevisionStateDigests(document);
  // Also verify the incoming source set before committing to the restore.
  compareOmpVolume(document, launch);
  return document;
}
