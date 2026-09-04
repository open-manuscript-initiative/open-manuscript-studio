import { useStudioStore } from './useStudioStore';
import { synchronizeCrossReferenceLabels } from '../model/crossReferences.ts';
import { getExternalIdentifierValue } from '../model/identity';
import {
  createEmptySection,
  createEmptyStudy,
  getParentSectionId,
  hierarchiesAreEqual,
  indentSection,
  insertSectionAfter,
  insertSectionAtGap,
  insertSubsection,
  insertTopLevelSectionAtEnd,
  moveSectionAmongSiblings,
  outdentSection,
  reparentSection,
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
    if (!section || section.title === title) return state;

    const unsynchronizedSections = state.manuscript.sections.map(
      (candidate) =>
        candidate.id === sectionId ? { ...candidate, title } : candidate,
    );
    const nextSections = synchronizeForManuscript(
      state.manuscript,
      unsynchronizedSections,
    );
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
          ...collectBlockContentChanges(
            state.manuscript.sections,
            nextSections,
          ),
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

  if (changed) scheduleSectionCheckpoint();
}

/** Legacy-compatible top-level insertion into a raw flat gap. */
export function stageInsertSectionAtGap(
  gapIndex: number,
): string | undefined {
  return stageCreateSection((sections, section) =>
    insertSectionAtGap(sections, section, gapIndex),
  );
}

export function stageInsertTopLevelSection(): string | undefined {
  return stageCreateSection(
    (sections, section) => insertTopLevelSectionAtEnd(sections, section),
    undefined,
    'Inserted manuscript study',
    'study',
  );
}

export function stageInsertSubsection(
  parentSectionId: string,
): string | undefined {
  return stageCreateSection(
    (sections, section) => insertSubsection(sections, parentSectionId, section),
    parentSectionId,
    'Inserted manuscript subsection',
  );
}

export function stageInsertSectionAfter(
  siblingSectionId: string,
): string | undefined {
  const sibling = useStudioStore
    .getState()
    .manuscript.sections.find((section) => section.id === siblingSectionId);
  return stageCreateSection(
    (sections, section) => insertSectionAfter(sections, siblingSectionId, section),
    sibling ? getParentSectionId(sibling) : undefined,
    'Inserted manuscript section',
  );
}

export function stageMoveSectionSibling(
  sectionId: string,
  direction: -1 | 1,
): boolean {
  return stageSectionStructureChange(
    sectionId,
    (sections) => moveSectionAmongSiblings(sections, sectionId, direction),
    'Reordered manuscript sections',
  );
}

export function stageIndentSection(sectionId: string): boolean {
  return stageSectionStructureChange(
    sectionId,
    (sections) => indentSection(sections, sectionId),
    'Nested manuscript section',
  );
}

export function stageOutdentSection(sectionId: string): boolean {
  return stageSectionStructureChange(
    sectionId,
    (sections) => outdentSection(sections, sectionId),
    'Promoted manuscript section',
  );
}

/** Drag/drop target: move the whole subtree under another section. */
export function stageReparentSection(
  sectionId: string,
  parentSectionId: string | undefined,
): boolean {
  return stageSectionStructureChange(
    sectionId,
    (sections) => reparentSection(sections, sectionId, parentSectionId),
    parentSectionId
      ? 'Moved manuscript section into subsection hierarchy'
      : 'Moved manuscript section to top level',
  );
}

/**
 * Backward-compatible move helpers now operate within sibling structure.
 */
export function stageMoveSectionToGap(
  sectionId: string,
  gapIndex: number,
): boolean {
  const sections = useStudioStore.getState().manuscript.sections;
  const index = sections.findIndex((section) => section.id === sectionId);
  if (index < 0) return false;
  return stageMoveSectionSibling(sectionId, gapIndex <= index ? -1 : 1);
}

export function stageMoveSectionToIndex(
  sectionId: string,
  targetIndex: number,
): boolean {
  const sections = useStudioStore.getState().manuscript.sections;
  const index = sections.findIndex((section) => section.id === sectionId);
  if (index < 0 || index === targetIndex) return false;
  return stageMoveSectionSibling(sectionId, targetIndex < index ? -1 : 1);
}

export function stageSectionNumberingStyleChange(
  style: OmiSectionNumberingStyle,
): void {
  let changed = false;

  useStudioStore.setState((state) => {
    const previousStyle = state.manuscript.sectionNumberingStyle ?? 'none';
    if (previousStyle === style) return state;

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

  if (changed) scheduleSectionCheckpoint();
}

function stageCreateSection(
  insert: (sections: OmiSection[], section: OmiSection) => OmiSection[],
  parentSectionId?: string,
  summary = 'Inserted manuscript section',
  kind: 'section' | 'study' = 'section',
): string | undefined {
  let insertedSectionId: string | undefined;
  let changed = false;

  useStudioStore.setState((state) => {
    const section = kind === 'study'
      ? createEmptyStudy(
          crypto.randomUUID(),
          crypto.randomUUID(),
          crypto.randomUUID(),
        )
      : createEmptySection(
          crypto.randomUUID(),
          crypto.randomUUID(),
          parentSectionId,
        );
    const insertedSections = insert(state.manuscript.sections, section);
    if (insertedSections === state.manuscript.sections) return state;

    const insertedIndex = insertedSections.findIndex(
      (candidate) => candidate.id === section.id,
    );
    const nextSections = synchronizeForManuscript(
      state.manuscript,
      insertedSections,
    );
    const timestamp = new Date().toISOString();
    const pendingChangeSet = stagePendingChanges(
      state.pendingChangeSet,
      {
        baseRevisionId: state.manuscript.headRevisionId,
        summary,
        events: [
          {
            operation: 'section.create',
            targetId: section.id,
            path: `/sections/${insertedIndex}`,
            nextValue: nextSections[insertedIndex] ?? section,
          },
          ...collectBlockContentChanges(
            state.manuscript.sections,
            nextSections,
          ),
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

  if (changed) scheduleSectionCheckpoint();
  return insertedSectionId;
}

function stageSectionStructureChange(
  sectionId: string,
  mutate: (sections: OmiSection[]) => OmiSection[],
  summary: string,
): boolean {
  let changed = false;

  useStudioStore.setState((state) => {
    const previousSections = state.manuscript.sections;
    const previousSection = previousSections.find(
      (section) => section.id === sectionId,
    );
    if (!previousSection) return state;

    const mutatedSections = mutate(previousSections);
    if (hierarchiesAreEqual(previousSections, mutatedSections)) return state;

    const nextSections = synchronizeForManuscript(
      state.manuscript,
      mutatedSections,
    );
    const nextSection = nextSections.find((section) => section.id === sectionId);
    if (!nextSection) return state;

    const timestamp = new Date().toISOString();
    const events = [];
    const previousParent = getParentSectionId(previousSection);
    const nextParent = getParentSectionId(nextSection);

    if (previousParent !== nextParent) {
      events.push({
        operation: 'section.parent.set' as never,
        targetId: sectionId,
        path: `/sections/${sectionId}/parentSectionId`,
        previousValue: previousParent,
        nextValue: nextParent,
      });
    }

    if (
      JSON.stringify(sectionOrder(previousSections)) !==
      JSON.stringify(sectionOrder(mutatedSections))
    ) {
      events.push({
        operation: 'section.reorder' as never,
        targetId: sectionId,
        path: '/sections',
        previousValue: sectionOrder(previousSections),
        nextValue: sectionOrder(mutatedSections),
      });
    }

    events.push(
      ...collectBlockContentChanges(previousSections, nextSections),
    );

    if (events.length === 0) return state;

    const pendingChangeSet = stagePendingChanges(
      state.pendingChangeSet,
      {
        baseRevisionId: state.manuscript.headRevisionId,
        summary,
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
    };
  });

  if (changed) scheduleSectionCheckpoint();
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
  if (!currentUser) return undefined;

  if (
    currentUser.agentId &&
    manuscript.agents.some((agent) => agent.id === currentUser.agentId)
  ) {
    return currentUser.agentId;
  }

  const accountOrcid = normalizeOrcidForComparison(currentUser.profile.orcid);
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
