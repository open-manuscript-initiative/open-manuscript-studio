import { collectReferencedAssetIdsInSections, sha256Hex } from '../model/assets';
import type { OmiManuscript } from '../types/omi';
import { getAssetPayload, putAssetPayload } from './assetRepository';
import { inspectOmiContainer } from './omiContainerImport';

export interface MissingManuscriptAsset {
  id: string;
  fileName: string;
  reason: 'missing' | 'corrupt' | 'metadata-missing';
}

export async function inspectMissingManuscriptAssets(
  manuscript: OmiManuscript,
): Promise<MissingManuscriptAsset[]> {
  const assets = new Map((manuscript.assets ?? []).map((asset) => [asset.id, asset]));
  const missing: MissingManuscriptAsset[] = [];
  for (const id of collectReferencedAssetIdsInSections(manuscript.sections)) {
    const asset = assets.get(id);
    if (!asset) {
      missing.push({ id, fileName: id, reason: 'metadata-missing' });
      continue;
    }
    let bytes: Uint8Array | undefined;
    try {
      bytes = await getAssetPayload(manuscript.id, id);
    } catch {
      missing.push({ id, fileName: asset.originalFileName || asset.fileName, reason: 'missing' });
      continue;
    }
    if (!bytes) {
      missing.push({ id, fileName: asset.originalFileName || asset.fileName, reason: 'missing' });
    } else if (
      bytes.byteLength !== asset.size ||
      (await sha256Hex(bytes)).toLowerCase() !== asset.checksum.value.toLowerCase()
    ) {
      missing.push({ id, fileName: asset.originalFileName || asset.fileName, reason: 'corrupt' });
    }
  }
  return missing;
}

/**
 * Only restore byte-identical assets from an independently verified OMI package.
 * Do not replace the manuscript, revision history, or valid local payloads.
 */
export async function restoreMissingAssetsFromVerifiedPackage(
  manuscript: OmiManuscript,
  packageBytes: Uint8Array,
): Promise<number> {
  const plan = await inspectOmiContainer(packageBytes);
  if (!plan.validForImport || !plan.manuscript || plan.manuscript.id !== manuscript.id) {
    throw new Error('The recovery package is invalid or belongs to another manuscript.');
  }
  const missing = await inspectMissingManuscriptAssets(manuscript);
  const candidates = new Map(plan.assets.map((asset) => [asset.metadata.id, asset]));
  const metadata = new Map((manuscript.assets ?? []).map((asset) => [asset.id, asset]));
  const verified: Array<{ id: string; bytes: Uint8Array }> = [];
  for (const item of missing) {
    const expected = metadata.get(item.id);
    const candidate = candidates.get(item.id);
    if (!expected || !candidate) continue;
    if (expected.size !== candidate.bytes.byteLength ||
        expected.mediaType !== candidate.metadata.mediaType ||
        expected.checksum.value.toLowerCase() !== candidate.metadata.checksum.value.toLowerCase() ||
        (await sha256Hex(candidate.bytes)).toLowerCase() !== expected.checksum.value.toLowerCase()) {
      continue;
    }
    verified.push({ id: item.id, bytes: candidate.bytes });
  }
  for (const asset of verified) {
    await putAssetPayload(manuscript.id, asset.id, asset.bytes);
  }
  return verified.length;
}
