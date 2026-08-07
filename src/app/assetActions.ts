import { useStudioStore } from './useStudioStore';
import { externalizeImageBlock } from '../model/assets';
import { extractManuscriptState } from '../model/versioning';
import { stagePendingChanges } from '../model/workingState';
import { putAssetPayload } from '../services/assetRepository';
import type { OmiAsset } from '../types/assets';
import type { OmiBlock, OmiSection } from '../types/omi';

export interface ExternalizedBlockBatch {
  blocks: OmiBlock[];
  assets: OmiAsset[];
}

/**
 * Converts embedded image data URIs into stable asset references and stores the
 * corresponding bytes outside manuscript JSON.
 */
export async function externalizeBlocksForManuscript(
  manuscriptId: string,
  blocks: readonly OmiBlock[],
): Promise<ExternalizedBlockBatch> {
  const assets: OmiAsset[] = [];
  const nextBlocks: OmiBlock[] = [];

  for (const block of blocks) {
    const externalized = await externalizeImageBlock(block);
    if (!externalized) {
      nextBlocks.push(block);
      continue;
    }

    await putAssetPayload(manuscriptId, externalized.asset.id, externalized.bytes);
    assets.push(externalized.asset);
    nextBlocks.push(externalized.block);
  }

  return { blocks: nextBlocks, assets };
}

/** Adds asset metadata to the active working state without embedding bytes. */
export function stageAssetAttachments(assets: readonly OmiAsset[]): void {
  if (assets.length === 0) return;

  useStudioStore.setState((state) => {
    const existing = new Map((state.manuscript.assets ?? []).map((asset) => [asset.id, asset]));
    const attached = assets.filter((asset) => !existing.has(asset.id));
    if (attached.length === 0) return state;

    for (const asset of attached) existing.set(asset.id, asset);
    const timestamp = new Date().toISOString();
    const portableState = extractManuscriptState(state.manuscript);
    const pendingChangeSet = stagePendingChanges(
      state.pendingChangeSet,
      {
        baseRevisionId: state.manuscript.headRevisionId,
        summary: attached.length === 1 ? 'Attached manuscript asset' : 'Attached manuscript assets',
        events: attached.map((asset) => ({
          operation: 'asset.attach' as never,
          targetId: asset.id,
          path: '/assets/-',
          nextValue: asset,
        })),
        timestamp,
      },
    );

    return {
      manuscript: {
        ...state.manuscript,
        ...portableState,
        assets: [...existing.values()],
        updatedAt: timestamp,
      },
      pendingChangeSet,
    };
  });
}

/**
 * Migrates every currently embedded data-URI image in one working-state batch.
 * Existing stable block identities are preserved.
 */
export async function externalizeActiveManuscriptAssets(): Promise<number> {
  const current = useStudioStore.getState().manuscript;
  const changes: Array<{ previous: OmiBlock; next: OmiBlock; sectionId: string }> = [];
  const assets: OmiAsset[] = [];
  const nextSections: OmiSection[] = [];

  for (const section of current.sections) {
    const nextBlocks: OmiBlock[] = [];
    for (const block of section.blocks) {
      const externalized = await externalizeImageBlock(block);
      if (!externalized) {
        nextBlocks.push(block);
        continue;
      }

      await putAssetPayload(current.id, externalized.asset.id, externalized.bytes);
      assets.push(externalized.asset);
      changes.push({ previous: block, next: externalized.block, sectionId: section.id });
      nextBlocks.push(externalized.block);
    }
    nextSections.push({ ...section, blocks: nextBlocks });
  }

  if (changes.length === 0) return 0;

  useStudioStore.setState((state) => {
    if (state.manuscript.id !== current.id) return state;

    const existing = new Map((state.manuscript.assets ?? []).map((asset) => [asset.id, asset]));
    for (const asset of assets) existing.set(asset.id, asset);
    const timestamp = new Date().toISOString();
    const portableState = extractManuscriptState(state.manuscript);
    const pendingChangeSet = stagePendingChanges(
      state.pendingChangeSet,
      {
        baseRevisionId: state.manuscript.headRevisionId,
        summary: changes.length === 1
          ? 'Externalized embedded image asset'
          : 'Externalized embedded image assets',
        events: [
          ...assets.map((asset) => ({
            operation: 'asset.attach' as never,
            targetId: asset.id,
            path: '/assets/-',
            nextValue: asset,
          })),
          ...changes.map(({ previous, next, sectionId }) => ({
            operation: 'block.update' as never,
            targetId: previous.id,
            path: `/sections/${sectionId}/blocks/${previous.id}`,
            previousValue: previous,
            nextValue: next,
          })),
        ],
        timestamp,
      },
    );

    return {
      manuscript: {
        ...state.manuscript,
        ...portableState,
        sections: nextSections,
        assets: [...existing.values()],
        updatedAt: timestamp,
      },
      pendingChangeSet,
    };
  });

  return changes.length;
}
