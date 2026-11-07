import { parseOmiJson } from './omiPortableFormat';
import { inspectOmiContainer, MAX_OMI_IMPORT_BYTES } from './omiContainerImport';
import { putAssetPayload } from './assetRepository';
import { assertNoInvalidRevisionStateDigests } from '../model/revisionIntegrity';
import type { OmiManuscript } from '../types/omi';

/** All local open surfaces use the same content checks, independent of MIME/name. */
export async function readLocalManuscriptBytes(bytes: Uint8Array): Promise<{
  manuscript: OmiManuscript;
  isContainer: boolean;
}> {
  if (bytes.byteLength === 0) throw new Error('The selected file is empty (0 bytes). Save a new copy from the original document.');
  if (bytes.byteLength > MAX_OMI_IMPORT_BYTES) throw new Error('The selected file exceeds the OMI import size limit.');
  const isContainer = bytes.length >= 4
    && bytes[0] === 0x50 && bytes[1] === 0x4b
    && bytes[2] === 0x03 && bytes[3] === 0x04;
  if (!isContainer) {
    const manuscript = parseOmiJson(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    assertNoInvalidRevisionStateDigests(manuscript);
    return { manuscript, isContainer };
  }
  const plan = await inspectOmiContainer(bytes);
  if (!plan.validForImport || !plan.manuscript) {
    throw new Error(plan.diagnostics.filter((item) => item.severity === 'error')
      .map((item) => item.message).join(' ') || 'The selected OMI container failed integrity validation.');
  }
  assertNoInvalidRevisionStateDigests(plan.manuscript);
  for (const asset of plan.assets) {
    await putAssetPayload(plan.manuscript.id, asset.metadata.id, asset.bytes);
  }
  return { manuscript: plan.manuscript, isContainer };
}
