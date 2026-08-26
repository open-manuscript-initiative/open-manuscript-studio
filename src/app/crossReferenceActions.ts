import { useStudioStore } from './useStudioStore';
import {
  collectCrossReferenceAnchors,
  collectCrossReferenceTargets,
  removeCrossReferenceAnchorFromSections,
  synchronizeCrossReferenceLabels,
} from '../model/crossReferences.ts';
import { getExternalIdentifierValue } from '../model/identity';
import { stagePendingChanges } from '../model/workingState';
import {
  getCurrentUser,
  useAuthStore,
} from '../store/authStore';
import type {
  OmiCrossReference,
  OmiCrossReferenceDisplayStyle,
  OmiCrossReferenceNumbering,
  OmiCrossReferenceTargetKind,
  OmiManuscript,
  OmiSection,
} from '../types/omi';

const CROSS_REFERENCE_CHECKPOINT_DELAY_MS = 2500;
let crossReferenceCheckpointTimer: ReturnType<typeof setTimeout> | null = null;

export interface CrossReferenceUpdateInput {
  targetId?: string;
  targetKind?: OmiCrossReferenceTargetKind;
  displayStyle?: OmiCrossReferenceDisplayStyle;
}

export function stageCreateCrossReference(
  crossReference: OmiCrossReference,
): boolean {
  let changed = false;

  useStudioStore.setState((state) => {
    const existing = state.manuscript.crossReferences ?? [];
    if (existing.some((item) => item.id === crossReference.id)) {
      return state;
    }

    const target = collectCrossReferenceTargets(state.manuscript).find(
      (candidate) => candidate.id === crossReference.targetId,
    );
    if (!target || target.kind !== crossReference.targetKind) {
      return state;
    }

    const timestamp = new Date().toISOString();
    const nextReference: OmiCrossReference = {
      ...crossReference,
      createdAt: crossReference.createdAt ?? timestamp,
      modifiedAt: timestamp,
    };
    const nextReferences = [...existing, nextReference];
    const nextSections = synchronizeCrossReferenceLabels(
      state.manuscript.sections,
      nextReferences,
      state.manuscript.crossReferenceNumbering,
      state.manuscript.locale,
      state.manuscript.namedAnchors ?? [],
    );
    const blockEvents = collectBlockContentChanges(
      state.manuscript.sections,
      nextSections,
    );
    const pendingChangeSet = stagePendingChanges(
      state.pendingChangeSet,
      {
        baseRevisionId: state.manuscript.headRevisionId,
        summary: 'Added internal cross-reference',
        events: [
          {
            operation: 'cross-reference.create' as never,
            targetId: nextReference.id,
            path: '/crossReferences/-',
            nextValue: nextReference,
          },
          ...blockEvents,
        ],
        actorAgentId: resolveCurrentActorAgentId(state.manuscript),
        timestamp,
      },
    );

    changed = true;
    return {
      manuscript: {
        ...state.manuscript,
        crossReferences: nextReferences,
        sections: nextSections,
        updatedAt: timestamp,
      },
      pendingChangeSet,
    };
  });

  if (changed) scheduleCrossReferenceCheckpoint();
  return changed;
}

export function stageUpdateCrossReference(
  crossReferenceId: string,
  input: CrossReferenceUpdateInput,
): boolean {
  let changed = false;

  useStudioStore.setState((state) => {
    const references = state.manuscript.crossReferences ?? [];
    const previous = references.find(
      (reference) => reference.id === crossReferenceId,
    );
    if (!previous) return state;

    const targetId = input.targetId ?? previous.targetId;
    const target = collectCrossReferenceTargets(state.manuscript).find(
      (candidate) => candidate.id === targetId,
    );
    if (!target) return state;

    const timestamp = new Date().toISOString();
    const nextReference: OmiCrossReference = {
      ...previous,
      targetId,
      targetKind: input.targetKind ?? target.kind,
      displayStyle: input.displayStyle ?? previous.displayStyle,
      modifiedAt: timestamp,
    };

    if (
      nextReference.targetKind !== target.kind ||
      JSON.stringify(previous) === JSON.stringify(nextReference)
    ) {
      return state;
    }

    const nextReferences = references.map((reference) =>
      reference.id === crossReferenceId ? nextReference : reference,
    );
    const nextSections = synchronizeCrossReferenceLabels(
      state.manuscript.sections,
      nextReferences,
      state.manuscript.crossReferenceNumbering,
      state.manuscript.locale,
      state.manuscript.namedAnchors ?? [],
    );
    const blockEvents = collectBlockContentChanges(
      state.manuscript.sections,
      nextSections,
    );
    const pendingChangeSet = stagePendingChanges(
      state.pendingChangeSet,
      {
        baseRevisionId: state.manuscript.headRevisionId,
        summary: 'Changed internal cross-reference',
        events: [
          {
            operation: 'cross-reference.update' as never,
            targetId: crossReferenceId,
            path: `/crossReferences/${crossReferenceId}`,
            previousValue: previous,
            nextValue: nextReference,
          },
          ...blockEvents,
        ],
        actorAgentId: resolveCurrentActorAgentId(state.manuscript),
        timestamp,
      },
    );

    changed = true;
    return {
      manuscript: {
        ...state.manuscript,
        crossReferences: nextReferences,
        sections: nextSections,
        updatedAt: timestamp,
      },
      pendingChangeSet,
    };
  });

  if (changed) scheduleCrossReferenceCheckpoint();
  return changed;
}

export function stageRemoveCrossReference(
  crossReferenceId: string,
): boolean {
  let changed = false;

  useStudioStore.setState((state) => {
    const references = state.manuscript.crossReferences ?? [];
    const previous = references.find(
      (reference) => reference.id === crossReferenceId,
    );
    if (!previous) return state;

    const nextReferences = references.filter(
      (reference) => reference.id !== crossReferenceId,
    );
    const removedSections = removeCrossReferenceAnchorFromSections(
      state.manuscript.sections,
      crossReferenceId,
    );
    const nextSections = synchronizeCrossReferenceLabels(
      removedSections,
      nextReferences,
      state.manuscript.crossReferenceNumbering,
      state.manuscript.locale,
      state.manuscript.namedAnchors ?? [],
    );
    const blockEvents = collectBlockContentChanges(
      state.manuscript.sections,
      nextSections,
    );
    const timestamp = new Date().toISOString();
    const pendingChangeSet = stagePendingChanges(
      state.pendingChangeSet,
      {
        baseRevisionId: state.manuscript.headRevisionId,
        summary: 'Removed internal cross-reference',
        events: [
          {
            operation: 'cross-reference.remove' as never,
            targetId: crossReferenceId,
            path: `/crossReferences/${crossReferenceId}`,
            previousValue: previous,
          },
          ...blockEvents,
        ],
        actorAgentId: resolveCurrentActorAgentId(state.manuscript),
        timestamp,
      },
    );

    changed = true;
    return {
      manuscript: {
        ...state.manuscript,
        crossReferences: nextReferences,
        sections: nextSections,
        updatedAt: timestamp,
      },
      pendingChangeSet,
    };
  });

  if (changed) scheduleCrossReferenceCheckpoint();
  return changed;
}

export function stageSetCrossReferenceNumbering(
  numbering: OmiCrossReferenceNumbering,
): boolean {
  let changed = false;

  useStudioStore.setState((state) => {
    const previous =
      state.manuscript.crossReferenceNumbering ?? 'document';
    if (previous === numbering) return state;

    const nextSections = synchronizeCrossReferenceLabels(
      state.manuscript.sections,
      state.manuscript.crossReferences ?? [],
      numbering,
      state.manuscript.locale,
      state.manuscript.namedAnchors ?? [],
    );
    const blockEvents = collectBlockContentChanges(
      state.manuscript.sections,
      nextSections,
    );
    const timestamp = new Date().toISOString();
    const pendingChangeSet = stagePendingChanges(
      state.pendingChangeSet,
      {
        baseRevisionId: state.manuscript.headRevisionId,
        summary: 'Changed internal object numbering',
        events: [
          {
            operation: 'cross-reference.numbering.set' as never,
            targetId: state.manuscript.id,
            path: '/crossReferenceNumbering',
            previousValue: previous,
            nextValue: numbering,
          },
          ...blockEvents,
        ],
        actorAgentId: resolveCurrentActorAgentId(state.manuscript),
        timestamp,
      },
    );

    changed = true;
    return {
      manuscript: {
        ...state.manuscript,
        crossReferenceNumbering: numbering,
        sections: nextSections,
        updatedAt: timestamp,
      },
      pendingChangeSet,
    };
  });

  if (changed) scheduleCrossReferenceCheckpoint();
  return changed;
}

/**
 * Reconciles semantic xref objects after a normal Tiptap edit. Deleting the
 * inline atom deletes only the reference occurrence, never its target object.
 */
export function reconcileCrossReferencesAfterBlockEdit(): void {
  let changed = false;

  useStudioStore.setState((state) => {
    const references = state.manuscript.crossReferences ?? [];
    if (references.length === 0) return state;

    const timestamp = new Date().toISOString();
    const anchors = collectCrossReferenceAnchors(
      state.manuscript.sections,
    );
    const anchorMap = new Map(
      anchors.map((anchor) => [anchor.crossReferenceId, anchor]),
    );
    const removed = references.filter(
      (reference) => !anchorMap.has(reference.id),
    );
    const updated: Array<{
      previous: OmiCrossReference;
      next: OmiCrossReference;
    }> = [];
    const nextReferences = references.flatMap((reference) => {
      const anchor = anchorMap.get(reference.id);
      if (!anchor) return [];

      if (
        reference.anchorId === anchor.anchorId &&
        reference.sourceBlockId === anchor.sourceBlockId
      ) {
        return [reference];
      }

      const next: OmiCrossReference = {
        ...reference,
        anchorId: anchor.anchorId,
        sourceBlockId: anchor.sourceBlockId,
        modifiedAt: timestamp,
      };
      updated.push({ previous: reference, next });
      return [next];
    });
    const nextSections = synchronizeCrossReferenceLabels(
      state.manuscript.sections,
      nextReferences,
      state.manuscript.crossReferenceNumbering,
      state.manuscript.locale,
      state.manuscript.namedAnchors ?? [],
    );
    const blockEvents = collectBlockContentChanges(
      state.manuscript.sections,
      nextSections,
    );
    const semanticEvents = [
      ...removed.map((reference) => ({
        operation: 'cross-reference.remove' as never,
        targetId: reference.id,
        path: `/crossReferences/${reference.id}`,
        previousValue: reference,
      })),
      ...updated.map(({ previous, next }) => ({
        operation: 'cross-reference.update' as never,
        targetId: next.id,
        path: `/crossReferences/${next.id}`,
        previousValue: previous,
        nextValue: next,
      })),
      ...blockEvents,
    ];

    if (semanticEvents.length === 0) return state;

    const pendingChangeSet = stagePendingChanges(
      state.pendingChangeSet,
      {
        baseRevisionId: state.manuscript.headRevisionId,
        summary:
          removed.length > 0
            ? 'Removed internal cross-reference anchor'
            : 'Synchronized internal cross-reference anchors',
        events: semanticEvents,
        actorAgentId: resolveCurrentActorAgentId(state.manuscript),
        timestamp,
      },
    );

    changed = true;
    return {
      manuscript: {
        ...state.manuscript,
        crossReferences: nextReferences,
        sections: nextSections,
        updatedAt: timestamp,
      },
      pendingChangeSet,
    };
  });

  if (changed) scheduleCrossReferenceCheckpoint();
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

function scheduleCrossReferenceCheckpoint(): void {
  if (crossReferenceCheckpointTimer !== null) {
    clearTimeout(crossReferenceCheckpointTimer);
  }

  crossReferenceCheckpointTimer = setTimeout(() => {
    crossReferenceCheckpointTimer = null;
    useStudioStore.getState().checkpoint('idle');
  }, CROSS_REFERENCE_CHECKPOINT_DELAY_MS);
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

function normalizeOrcidForComparison(
  value: string | undefined,
): string {
  return (value ?? '')
    .trim()
    .replace(/^https?:\/\/orcid\.org\//i, '')
    .toUpperCase();
}
