import {
  formatCrossReferenceLabel, removeCrossReferenceAnchorFromSections,
  synchronizeCrossReferenceLabels,
} from '../model/crossReferences.ts';
import { assertObjectIdentifierAvailable } from '../model/tombstone.ts';
import { findManuscriptBlock, removeManuscriptBlock } from '../model/manuscriptTreeTraversal';
import { tableRowsToParagraphBlocks } from '../model/visualBlocks';
import { getExternalIdentifierValue } from '../model/identity';
import { extractManuscriptState } from '../model/versioning';
import { stagePendingChanges } from '../model/workingState';
import {
  getCurrentUser,
  useAuthStore,
} from '../store/authStore';
import type {
  OmiAnnotation,
  OmiBlock,
  OmiManuscript,
  OmiSection,
  OmiVisualBlockData,
  OmiBibliographicRecord,
  OmiSourceAttribution,
} from '../types/omi';
import { useStudioStore } from './useStudioStore';

const VISUAL_CHECKPOINT_DELAY_MS = 2500;
let visualCheckpointTimer: ReturnType<typeof setTimeout> | null = null;

export function stageInsertBlocks(
  sectionId: string,
  gapIndex: number,
  blocks: OmiBlock[],
  summary = 'Inserted manuscript elements',
  originAnnotations: readonly OmiAnnotation[] = [],
  sourceAttributions: readonly OmiSourceAttribution[] = [],
  bibliographicRecords: readonly OmiBibliographicRecord[] = [],
): boolean {
  if (blocks.length === 0) return false;
  let changed = false;

  useStudioStore.setState((state) => {
    const sectionIndex = state.manuscript.sections.findIndex(
      (section) => section.id === sectionId,
    );
    if (sectionIndex < 0) return state;

    const existingIds = new Set(collectBlockIds(state.manuscript.sections.flatMap(section => section.blocks)));
    const incomingIds = collectBlockIds(blocks);
    for (const id of incomingIds) {
      assertObjectIdentifierAvailable(state.manuscript.tombstones ?? [], id);
      if (state.pendingChangeSet?.events.some(event => event.operation === 'block.remove' && event.targetId === id)) {
        throw new Error(`Object identifier ${id} is reserved by deletion history in pending changes.`);
      }
    }
    const insertedIds = new Set(incomingIds);
    if (insertedIds.size !== incomingIds.length || incomingIds.some(id => existingIds.has(id))) {
      throw new Error('Cannot insert a block whose stable identifier already exists.');
    }

    if (originAnnotations.some((annotation) =>
      !insertedIds.has(annotation.targetBlockId) ||
      state.manuscript.annotations.some((current) => current.id === annotation.id))) {
      throw new Error('Origin declaration must target a newly inserted object.');
    }

    if (sourceAttributions.some((relation) =>
      !insertedIds.has(relation.sourceObjectId) ||
      (!bibliographicRecords.some((record) => record.id === relation.targetBibliographicRecordId)
        && !state.manuscript.bibliographicRecords?.some((record) => record.id === relation.targetBibliographicRecordId)))) {
      throw new Error('Source attribution must resolve to a newly inserted object and bibliographic record.');
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
          ...(bibliographicRecords.length || sourceAttributions.length ? [{
            operation: 'manuscript.structure.set' as const,
            targetId: state.manuscript.id,
            path: '/bibliography-and-source-attributions',
            previousValue: { bibliographicRecords: state.manuscript.bibliographicRecords ?? [], sourceAttributions: state.manuscript.sourceAttributions ?? [] },
            nextValue: {
              bibliographicRecords: [...(state.manuscript.bibliographicRecords ?? []), ...bibliographicRecords],
              sourceAttributions: [...(state.manuscript.sourceAttributions ?? []), ...sourceAttributions],
            },
          }] : []),
          ...originAnnotations.map((annotation) => ({
            operation: 'annotation.create' as const,
            targetId: annotation.id,
            path: `/annotations/${annotation.id}`,
            nextValue: annotation,
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
        annotations: [...state.manuscript.annotations, ...originAnnotations],
        bibliographicRecords: [...(state.manuscript.bibliographicRecords ?? []), ...bibliographicRecords],
        sourceAttributions: [...(state.manuscript.sourceAttributions ?? []), ...sourceAttributions],
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

export function stageConvertTableToText(blockId: string): boolean {
  let changed = false;

  useStudioStore.setState((state) => {
    const located = findBlock(state.manuscript, blockId);
    if (!located || located.block.visual?.kind !== 'table') return state;

    const replacement = tableRowsToParagraphBlocks(
      located.block.visual.cells,
      located.block.id,
    );
    const section = state.manuscript.sections.find(
      (candidate) => candidate.id === located.sectionId,
    );
    if (!section) return state;

    const nextBlocks = [...section.blocks];
    nextBlocks.splice(located.blockIndex, 1, ...replacement);
    const unsynchronizedSections = state.manuscript.sections.map(
      (candidate) => candidate.id === located.sectionId
        ? { ...candidate, blocks: nextBlocks }
        : candidate,
    );
    const nextSections = synchronizeForManuscript(
      state.manuscript,
      unsynchronizedSections,
    );
    const timestamp = new Date().toISOString();
    const firstReplacement = replacement[0];
    const events = [
      ...(firstReplacement ? [{
        operation: 'block.update' as never,
        targetId: blockId,
        path: `/sections/${located.sectionId}/blocks/${located.blockIndex}`,
        previousValue: located.block,
        nextValue: firstReplacement,
      }] : []),
      ...replacement.slice(1).map((block, index) => ({
        operation: 'block.create' as never,
        targetId: block.id,
        path: `/sections/${located.sectionId}/blocks/${located.blockIndex + index + 1}`,
        nextValue: block,
      })),
      ...collectBlockContentChanges(
        state.manuscript.sections,
        nextSections,
      ),
    ];
    const pendingChangeSet = stagePendingChanges(
      state.pendingChangeSet,
      {
        baseRevisionId: state.manuscript.headRevisionId,
        summary: 'Converted manuscript table to text',
        events,
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
      selectedSectionId: located.sectionId,
    };
  });

  if (changed) scheduleVisualCheckpoint();
  return changed;
}

export function stageRemoveBlock(blockId: string): boolean {
  let changed = false;

  useStudioStore.setState((state) => {
    const entry = findManuscriptBlock(state.manuscript.sections, blockId);
    if (!entry) return state;
    const located = { block: entry.block, sectionId: entry.section.id,
      blockIndex: entry.section.blocks.findIndex(block => block.id === blockId) };
    const removedObjectIds = new Set(collectBlockIds([located.block]));
    const annotations = state.manuscript.annotations.filter(item => !removedObjectIds.has(item.targetBlockId));
    const citations = state.manuscript.citations.filter(item => !removedObjectIds.has(item.targetBlockId));
    const namedAnchors = (state.manuscript.namedAnchors ?? []).filter(item => !removedObjectIds.has(item.targetId));
    for (const item of state.manuscript.annotations) if (removedObjectIds.has(item.targetBlockId)) removedObjectIds.add(item.id);
    for (const item of state.manuscript.citations) if (removedObjectIds.has(item.targetBlockId)) removedObjectIds.add(item.id);
    for (const item of state.manuscript.namedAnchors ?? []) if (removedObjectIds.has(item.targetId)) removedObjectIds.add(item.id);
    const crossReferences = (state.manuscript.crossReferences ?? []).filter(item =>
      !removedObjectIds.has(item.sourceBlockId) && !removedObjectIds.has(item.targetId));
    const relationships = {
      annotations, citations, namedAnchors, crossReferences,
      citationClusters: (state.manuscript.citationClusters ?? [])
        .filter(item => !removedObjectIds.has(item.targetBlockId))
        .map(item => ({ ...item, citationIds: item.citationIds.filter(id => !removedObjectIds.has(id)) })),
      contributions: state.manuscript.contributions.filter(item => !removedObjectIds.has(item.targetId)),
      sourceAttributions: (state.manuscript.sourceAttributions ?? []).filter(item => !removedObjectIds.has(item.sourceObjectId)),
    };
    const unsynchronizedSections = removeManuscriptBlock(state.manuscript.sections, blockId);
    let cleanedSections = unsynchronizedSections;
    for (const reference of state.manuscript.crossReferences ?? []) {
      if (!removedObjectIds.has(reference.sourceBlockId) && !removedObjectIds.has(reference.targetId)) continue;
      // Keep a visible warning in surviving prose; retain the semantic relation
      // in the change event and prior revision rather than emitting an unsavable dangling reference.
      cleanedSections = removeCrossReferenceAnchorFromSections(cleanedSections, reference.id,
        formatCrossReferenceLabel(reference, undefined, state.manuscript.locale));
    }
    const nextSections = synchronizeCrossReferenceLabels(
      cleanedSections, crossReferences, state.manuscript.crossReferenceNumbering,
      state.manuscript.locale, namedAnchors,
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
          ...collectBlockObjects([located.block]).map(block => ({
            operation: 'block.remove' as const, targetId: block.id,
            path: block.id === blockId && located.blockIndex >= 0
              ? `/sections/${located.sectionId}/blocks/${located.blockIndex}` : `/blocks/${block.id}`,
            previousValue: block,
          })),
          ...state.manuscript.annotations.filter(item => removedObjectIds.has(item.id)).map(item => ({
            operation: 'annotation.remove' as const, targetId: item.id, path: `/annotations/${item.id}`, previousValue: item,
          })),
          ...state.manuscript.citations.filter(item => removedObjectIds.has(item.id)).map(item => ({
            operation: 'citation.remove' as const, targetId: item.id, path: `/citations/${item.id}`, previousValue: item,
          })),
          ...state.manuscript.contributions.filter(item => removedObjectIds.has(item.targetId)).map(item => ({
            operation: 'contribution.remove' as const, targetId: item.id, path: `/contributions/${item.id}`, previousValue: item,
          })),
          ...Object.entries(relationships).flatMap(([key, nextValue]) => {
            const previousValue = state.manuscript[key as keyof typeof relationships] ?? [];
            if (JSON.stringify(previousValue) === JSON.stringify(nextValue)) return [];
            return [{ operation: 'manuscript.structure.set' as const, targetId: state.manuscript.id,
              path: `/${key}`, previousValue, nextValue }];
          }),
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
        ...relationships,
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

function collectBlockIds(blocks: readonly OmiBlock[]): string[] {
  return collectBlockObjects(blocks).map(block => block.id);
}

function collectBlockObjects(blocks: readonly OmiBlock[]): OmiBlock[] {
  return blocks.flatMap(block => [block, ...collectBlockObjects(block.children ?? [])]);
}
