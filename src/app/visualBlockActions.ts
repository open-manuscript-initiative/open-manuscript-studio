import { synchronizeCrossReferenceLabels } from '../model/crossReferences.ts';
import { getExternalIdentifierValue } from '../model/identity';
import { extractManuscriptState } from '../model/versioning';
import { stagePendingChanges } from '../model/workingState';
import {
  getCurrentUser,
  useAuthStore,
} from '../store/authStore';
import type {
  OmiBlock,
  OmiManuscript,
  OmiSection,
  OmiVisualBlockData,
} from '../types/omi';
import { useStudioStore } from './useStudioStore';

const VISUAL_CHECKPOINT_DELAY_MS = 2500;
let visualCheckpointTimer: ReturnType<typeof setTimeout> | null = null;

export function stageInsertBlocks(
  sectionId: string,
  gapIndex: number,
  blocks: OmiBlock[],
  summary = 'Inserted manuscript elements',
): boolean {
  if (blocks.length === 0) return false;
  let changed = false;

  useStudioStore.setState((state) => {
    const sectionIndex = state.manuscript.sections.findIndex(
      (section) => section.id === sectionId,
    );
    if (sectionIndex < 0) return state;

    const existingIds = new Set(
      state.manuscript.sections.flatMap((section) =>
        section.blocks.map((block) => block.id),
      ),
    );
    if (blocks.some((block) => existingIds.has(block.id))) {
      throw new Error(
        'Cannot insert a block whose stable identifier already exists.',
      );
    }

    const section = state.manuscript.sections[sectionIndex];
    if (!section) return state;
    const insertionIndex = clampGap(gapIndex, section.blocks.length);
    const nextBlocks = [...section.blocks];
    nextBlocks.splice(insertionIndex, 0, ...blocks);
    const unsynchronizedSections = state.manuscript.sections.map(
      (candidate, index) =>
        index === sectionIndex
          ? { ...candidate, blocks: nextBlocks }
          : candidate,
    );
    const nextSections = synchronizeForManuscript(
      state.manuscript,
      unsynchronizedSections,
    );
    const timestamp = new Date().toISOString();
    const contentEvents = collectBlockContentChanges(
      state.manuscript.sections,
      nextSections,
    );
    const pendingChangeSet = stagePendingChanges(
      state.pendingChangeSet,
      {
        baseRevisionId: state.manuscript.headRevisionId,
        summary,
        events: [
          ...blocks.map((block, index) => ({
            operation: 'block.create' as never,
            targetId: block.id,
            path: `/sections/${sectionId}/blocks/${insertionIndex + index}`,
            nextValue: block,
          })),
          ...contentEvents,
        ],
        actorAgentId: resolveCurrentActorAgentId(state.manuscript),
        timestamp,
      },
    );
    const portableState = extractManuscriptState(state.manuscript);

    changed = true;
    return {
      manuscript: {
        ...state.manuscript,
        ...portableState,
        sections: nextSections,
        updatedAt: timestamp,
      },
      pendingChangeSet,
      selectedSectionId: sectionId,
    };
  });

  if (changed) scheduleVisualCheckpoint();
  return changed;
}

export function stageUpdateVisualBlock(
  blockId: string,
  visual: OmiVisualBlockData,
): boolean {
  let changed = false;

  useStudioStore.setState((state) => {
    const located = findBlock(state.manuscript, blockId);
    if (!located || !located.block.visual) return state;

    if (JSON.stringify(located.block.visual) === JSON.stringify(visual)) {
      return state;
    }

    const nextBlock: OmiBlock = {
      ...located.block,
      type: visual.kind,
      visual,
    };
    const unsynchronizedSections = state.manuscript.sections.map(
      (section) =>
        section.id === located.sectionId
          ? {
              ...section,
              blocks: section.blocks.map((block) =>
                block.id === blockId ? nextBlock : block,
              ),
            }
          : section,
    );
    const nextSections = synchronizeForManuscript(
      state.manuscript,
      unsynchronizedSections,
    );
    const timestamp = new Date().toISOString();
    const contentEvents = collectBlockContentChanges(
      state.manuscript.sections,
      nextSections,
    );
    const pendingChangeSet = stagePendingChanges(
      state.pendingChangeSet,
      {
        baseRevisionId: state.manuscript.headRevisionId,
        summary: `Changed ${visual.kind} block`,
        events: [
          {
            operation: 'block.update' as never,
            targetId: blockId,
            path: `/sections/${located.sectionId}/blocks/${located.blockIndex}`,
            previousValue: located.block,
            nextValue: nextBlock,
          },
          ...contentEvents,
        ],
        actorAgentId: resolveCurrentActorAgentId(state.manuscript),
        timestamp,
      },
    );
    const portableState = extractManuscriptState(state.manuscript);

    changed = true;
    return {
      manuscript: {
        ...state.manuscript,
        ...portableState,
        sections: nextSections,
        updatedAt: timestamp,
      },
      pendingChangeSet,
    };
  });

  if (changed) scheduleVisualCheckpoint();
  return changed;
}

export function stageRemoveBlock(blockId: string): boolean {
  let changed = false;

  useStudioStore.setState((state) => {
    const located = findBlock(state.manuscript, blockId);
    if (!located) return state;
    const unsynchronizedSections = state.manuscript.sections.map(
      (section) =>
        section.id === located.sectionId
          ? {
              ...section,
              blocks: section.blocks.filter(
                (block) => block.id !== blockId,
              ),
            }
          : section,
    );
    const nextSections = synchronizeForManuscript(
      state.manuscript,
      unsynchronizedSections,
    );
    const timestamp = new Date().toISOString();
    const contentEvents = collectBlockContentChanges(
      state.manuscript.sections,
      nextSections,
    );
    const pendingChangeSet = stagePendingChanges(
      state.pendingChangeSet,
      {
        baseRevisionId: state.manuscript.headRevisionId,
        summary: 'Removed manuscript block',
        events: [
          {
            operation: 'block.remove',
            targetId: blockId,
            path: `/sections/${located.sectionId}/blocks/${located.blockIndex}`,
            previousValue: located.block,
          },
          ...contentEvents,
        ],
        actorAgentId: resolveCurrentActorAgentId(state.manuscript),
        timestamp,
      },
    );
    const portableState = extractManuscriptState(state.manuscript);

    changed = true;
    return {
      manuscript: {
        ...state.manuscript,
        ...portableState,
        sections: nextSections,
        updatedAt: timestamp,
      },
      pendingChangeSet,
    };
  });

  if (changed) scheduleVisualCheckpoint();
  return changed;
}

function synchronizeForManuscript(
  manuscript: OmiManuscript,
  sections: OmiSection[],
): OmiSection[] {
  return synchronizeCrossReferenceLabels(
    sections,
    manuscript.crossReferences ?? [],
    manuscript.crossReferenceNumbering,
    manuscript.locale,
  );
}

function collectBlockContentChanges(
  previousSections: readonly OmiSection[],
  nextSections: readonly OmiSection[],
) {
  const previousBlocks = new Map(
    previousSections
      .flatMap((section) => section.blocks)
      .map((block) => [block.id, block]),
  );

  return nextSections
    .flatMap((section) => section.blocks)
    .flatMap((block) => {
      const previous = previousBlocks.get(block.id);
      if (!previous || previous.content === block.content) return [];

      return [
        {
          operation: 'block.content.set' as const,
          targetId: block.id,
          path: `/blocks/${block.id}/content`,
          previousValue: previous.content,
          nextValue: block.content,
        },
      ];
    });
}

function findBlock(
  manuscript: OmiManuscript,
  blockId: string,
): { sectionId: string; blockIndex: number; block: OmiBlock } | undefined {
  for (const section of manuscript.sections) {
    const blockIndex = section.blocks.findIndex(
      (block) => block.id === blockId,
    );
    if (blockIndex >= 0) {
      const block = section.blocks[blockIndex];
      if (block) return { sectionId: section.id, blockIndex, block };
    }
  }
  return undefined;
}

function clampGap(index: number, count: number): number {
  if (!Number.isFinite(index)) return count;
  return Math.max(0, Math.min(count, Math.trunc(index)));
}

function scheduleVisualCheckpoint(): void {
  if (visualCheckpointTimer !== null) clearTimeout(visualCheckpointTimer);
  visualCheckpointTimer = setTimeout(() => {
    visualCheckpointTimer = null;
    useStudioStore.getState().checkpoint('idle');
  }, VISUAL_CHECKPOINT_DELAY_MS);
}

function resolveCurrentActorAgentId(
  manuscript: OmiManuscript,
): string | undefined {
  const currentUser = getCurrentUser(useAuthStore.getState());
  if (!currentUser) return undefined;

  if (
    currentUser.agentId &&
    manuscript.agents.some((agent) => agent.id === currentUser.agentId)
  ) {
    return currentUser.agentId;
  }

  const accountOrcid = normalizeOrcidForComparison(
    currentUser.profile.orcid,
  );
  if (!accountOrcid) return undefined;

  const matches = manuscript.agents.filter(
    (agent) =>
      normalizeOrcidForComparison(
        getExternalIdentifierValue(agent, 'orcid'),
      ) === accountOrcid,
  );
  return matches.length === 1 ? matches[0]?.id : undefined;
}

function normalizeOrcidForComparison(value: string | undefined): string {
  return (value ?? '')
    .trim()
    .replace(/^https?:\/\/orcid\.org\//i, '')
    .toUpperCase();
}
