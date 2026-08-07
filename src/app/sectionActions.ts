import { useStudioStore } from './useStudioStore';
import { synchronizeCrossReferenceLabels } from '../model/crossReferences.ts';
import { getExternalIdentifierValue } from '../model/identity';
import {
  arraysHaveSameOrder,
  createEmptySection,
  insertSectionAtGap,
  moveSectionToGap,
  moveSectionToIndex,
  sectionOrder,
} from '../model/sectionStructure.ts';
import { extractManuscriptState } from '../model/versioning';
import { stagePendingChanges } from '../model/workingState';
import {
  getCurrentUser,
  useAuthStore,
} from '../store/authStore';
import type {
  OmiManuscript,
  OmiSection,
  OmiSectionNumberingStyle,
} from '../types/omi';

const SECTION_CHECKPOINT_DELAY_MS = 2500;
let sectionCheckpointTimer: ReturnType<typeof setTimeout> | null = null;

export function stageSectionTitleChange(
  sectionId: string,
  title: string,
): void {
  let changed = false;

  useStudioStore.setState((state) => {
    const section = state.manuscript.sections.find(
      (candidate) => candidate.id === sectionId,
    );

    if (!section || section.title === title) {
      return state;
    }

    const unsynchronizedSections = state.manuscript.sections.map(
      (candidate) =>
        candidate.id === sectionId
          ? { ...candidate, title }
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
        summary: 'Changed section title',
        events: [
          {
            operation: 'section.title.set' as never,
            targetId: sectionId,
            path: `/sections/${sectionId}/title`,
            previousValue: section.title,
            nextValue: title,
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

  if (changed) {
    scheduleSectionCheckpoint();
  }
}

/**
 * Inserts a new empty section into an explicit structural gap.
 * Gap 0 is before the first section and gap N is after the last section.
 */
export function stageInsertSectionAtGap(
  gapIndex: number,
): string | undefined {
  let insertedSectionId: string | undefined;
  let changed = false;

  useStudioStore.setState((state) => {
    const section = createEmptySection();
    const insertedSections = insertSectionAtGap(
      state.manuscript.sections,
      section,
      gapIndex,
    );
    const insertedIndex = insertedSections.findIndex(
      (candidate) => candidate.id === section.id,
    );
    const nextSections = synchronizeForManuscript(
      state.manuscript,
      insertedSections,
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
        summary: 'Inserted manuscript section',
        events: [
          {
            operation: 'section.create',
            targetId: section.id,
            path: `/sections/${insertedIndex}`,
            nextValue: section,
          },
          ...contentEvents,
        ],
        actorAgentId: resolveCurrentActorAgentId(state.manuscript),
        timestamp,
      },
    );
    const portableState = extractManuscriptState(state.manuscript);

    insertedSectionId = section.id;
    changed = true;

    return {
      manuscript: {
        ...state.manuscript,
        ...portableState,
        sections: nextSections,
        updatedAt: timestamp,
      },
      pendingChangeSet,
      selectedSectionId: section.id,
    };
  });

  if (changed) {
    scheduleSectionCheckpoint();
  }

  return insertedSectionId;
}

/**
 * Moves a section to a structural gap while preserving the section object and
 * every stable descendant identifier it contains.
 */
export function stageMoveSectionToGap(
  sectionId: string,
  gapIndex: number,
): boolean {
  return stageSectionReorder(sectionId, (sections) =>
    moveSectionToGap(sections, sectionId, gapIndex),
  );
}

/**
 * Accessible alternative to drag-and-drop. `targetIndex` is the final zero-
 * based position of the section after the move.
 */
export function stageMoveSectionToIndex(
  sectionId: string,
  targetIndex: number,
): boolean {
  return stageSectionReorder(sectionId, (sections) =>
    moveSectionToIndex(sections, sectionId, targetIndex),
  );
}

export function stageSectionNumberingStyleChange(
  style: OmiSectionNumberingStyle,
): void {
  let changed = false;

  useStudioStore.setState((state) => {
    const previousStyle = state.manuscript.sectionNumberingStyle ?? 'none';

    if (previousStyle === style) {
      return state;
    }

    const timestamp = new Date().toISOString();
    const pendingChangeSet = stagePendingChanges(
      state.pendingChangeSet,
      {
        baseRevisionId: state.manuscript.headRevisionId,
        summary: 'Changed section numbering style',
        events: [
          {
            operation: 'manuscript.sectionNumbering.set' as never,
            targetId: state.manuscript.id,
            path: '/sectionNumberingStyle',
            previousValue: previousStyle,
            nextValue: style,
          },
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
        sectionNumberingStyle: style,
        updatedAt: timestamp,
      },
      pendingChangeSet,
    };
  });

  if (changed) {
    scheduleSectionCheckpoint();
  }
}

function stageSectionReorder(
  sectionId: string,
  reorder: (
    sections: OmiManuscript['sections'],
  ) => OmiManuscript['sections'],
): boolean {
  let changed = false;

  useStudioStore.setState((state) => {
    const previousSections = state.manuscript.sections;
    const reorderedSections = reorder(previousSections);

    if (arraysHaveSameOrder(previousSections, reorderedSections)) {
      return state;
    }

    const nextSections = synchronizeForManuscript(
      state.manuscript,
      reorderedSections,
    );
    const timestamp = new Date().toISOString();
    const previousOrder = sectionOrder(previousSections);
    const nextOrder = sectionOrder(reorderedSections);
    const contentEvents = collectBlockContentChanges(
      previousSections,
      nextSections,
    );
    const pendingChangeSet = stagePendingChanges(
      state.pendingChangeSet,
      {
        baseRevisionId: state.manuscript.headRevisionId,
        summary: 'Reordered manuscript sections',
        events: [
          {
            operation: 'section.reorder' as never,
            targetId: sectionId,
            path: '/sections',
            previousValue: previousOrder,
            nextValue: nextOrder,
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

  if (changed) {
    scheduleSectionCheckpoint();
  }

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

function scheduleSectionCheckpoint(): void {
  if (sectionCheckpointTimer !== null) {
    clearTimeout(sectionCheckpointTimer);
  }

  sectionCheckpointTimer = setTimeout(() => {
    sectionCheckpointTimer = null;
    useStudioStore.getState().checkpoint('idle');
  }, SECTION_CHECKPOINT_DELAY_MS);
}

function resolveCurrentActorAgentId(
  manuscript: OmiManuscript,
): string | undefined {
  const currentUser = getCurrentUser(useAuthStore.getState());

  if (!currentUser) {
    return undefined;
  }

  if (
    currentUser.agentId &&
    manuscript.agents.some(
      (agent) => agent.id === currentUser.agentId,
    )
  ) {
    return currentUser.agentId;
  }

  const accountOrcid = normalizeOrcidForComparison(
    currentUser.profile.orcid,
  );

  if (!accountOrcid) {
    return undefined;
  }

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
