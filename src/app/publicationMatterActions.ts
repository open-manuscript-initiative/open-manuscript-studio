import { useStudioStore } from './useStudioStore';
import { PUBLICATION_MATTER_EXTENSION, validatePublicationMatter, type PublicationMatter } from '../model/publicationMatter';
import { createAssetMetadata } from '../model/assets';
import { stagePendingChanges } from '../model/workingState';
import { putAssetPayload } from '../services/assetRepository';
import type { OmiAsset } from '../types/assets';

let checkpointTimer: ReturnType<typeof setTimeout> | undefined;
export function stagePublicationMatter(model: PublicationMatter, addedAsset?: OmiAsset, manuscriptId?: string): void {
  validatePublicationMatter(model);
  useStudioStore.setState((state) => {
    if (manuscriptId && state.manuscript.id !== manuscriptId) return state;
    const previous = state.manuscript.extensions?.[PUBLICATION_MATTER_EXTENSION];
    if (!addedAsset && JSON.stringify(previous) === JSON.stringify(model)) return state;
    const timestamp = new Date().toISOString();
    const assets = addedAsset ? [...(state.manuscript.assets ?? []), addedAsset] : state.manuscript.assets;
    const next = structuredClone(model);
    return {
      manuscript: { ...state.manuscript, assets, extensions: { ...state.manuscript.extensions, [PUBLICATION_MATTER_EXTENSION]: next }, updatedAt: timestamp },
      pendingChangeSet: stagePendingChanges(state.pendingChangeSet, {
        baseRevisionId: state.manuscript.headRevisionId, summary: 'Changed publication covers and title pages', timestamp,
        events: [{ operation: 'publication.matter.set', targetId: state.manuscript.id,
          path: `/extensions/${PUBLICATION_MATTER_EXTENSION}`, previousValue: previous, nextValue: next }],
      }),
    };
  });
  clearTimeout(checkpointTimer);
  checkpointTimer = setTimeout(() => useStudioStore.getState().checkpoint('idle'), 2500);
}

export async function importPublicationMatterImage(file: File, manuscriptId: string): Promise<OmiAsset> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 16 * 1024 * 1024) {
    throw new Error('Use a PNG, JPEG or WebP image up to 16 MiB.');
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const asset = await createAssetMetadata(bytes, { mediaType: file.type, fileName: file.name, role: 'figure' });
  await putAssetPayload(manuscriptId, asset.id, bytes);
  return asset;
}
