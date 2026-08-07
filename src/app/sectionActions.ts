import { useStudioStore } from './useStudioStore';
import { getExternalIdentifierValue } from '../model/identity';
import {
  arraysHaveSameOrder,
  createEmptySection,
  insertSectionAtGap,
  moveSectionToGap,
  moveSectionToIndex,
  sectionOrder,
} from '../model/sectionStructure.ts';
import type { OmiSectionNumberingStyle } from '../types/omi';
import { extractManuscriptState } from '../model/versioning';
import { stagePendingChanges } from '../model/workingState';
import {
  getCurrentUser,
  useAuthStore,
} from '../store/authStore';
import type { OmiManuscript } from '../types/omi';

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

    const timestamp = new Date().toISOString();
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
        sections: state.manuscript.sections.map((candidate) =>
          candidate.id === sectionId
            ? { ...candidate, title }
            : candidate,
        ),
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
    const sections = insertSectionAtGap(
      state.manuscript.sections,
      section,
      gapIndex,
    );
    const insertedIndex = sections.findIndex(
      (candidate) => candidate.id === section.id,
    );
    const timestamp = new Date().toISOString();
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
        sections,
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
  reorder: (sections: OmiManuscript['sections']) => OmiManuscript['sections'],
): boolean {
  let changed = false;

  useStudioStore.setState((state) => {
    const previousSections = state.manuscript.sections;
    const nextSections = reorder(previousSections);

    if (arraysHaveSameOrder(previousSections, nextSections)) {
      return state;
    }

    const timestamp = new Date().toISOString();
    const previousOrder = sectionOrder(previousSections);
    const nextOrder = sectionOrder(nextSections);
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
