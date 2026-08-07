import { useStudioStore } from './useStudioStore';
import { getExternalIdentifierValue } from '../model/identity';
import {
  createNoteAnnotation,
  getNoteKind,
  isNoteAnnotation,
  reconcileNoteState,
  removeNoteFromState,
  type OmiNoteKind,
} from '../model/notes';
import { extractManuscriptState } from '../model/versioning';
import { stagePendingChanges } from '../model/workingState';
import {
  getCurrentUser,
  useAuthStore,
} from '../store/authStore';
import type {
  OmiAnnotation,
  OmiManuscript,
  OmiManuscriptState,
} from '../types/omi';

const NOTE_CHECKPOINT_DELAY_MS = 2500;
let noteCheckpointTimer: ReturnType<typeof setTimeout> | null = null;

export interface CreateStudioNoteInput {
  id: string;
  anchorId: string;
  targetBlockId: string;
  kind?: OmiNoteKind;
}

export interface UpdateStudioNoteInput {
  body?: string;
  kind?: OmiNoteKind;
}

export function stageCreateNote(
  input: CreateStudioNoteInput,
): boolean {
  let changed = false;

  useStudioStore.setState((state) => {
    if (state.manuscript.annotations.some((item) => item.id === input.id)) {
      return state;
    }

    const timestamp = new Date().toISOString();
    const actorAgentId = resolveCurrentActorAgentId(state.manuscript);
    const annotation = createNoteAnnotation({
      ...input,
      creatorAgentId: actorAgentId,
      timestamp,
    });
    const portableState: OmiManuscriptState = {
      ...extractManuscriptState(state.manuscript),
      annotations: [...state.manuscript.annotations, annotation],
    };
    const reconciled = reconcileNoteState(portableState, {
      removeOrphanAnnotations: false,
    });
    const events = [
      {
        operation: 'annotation.create' as never,
        targetId: annotation.id,
        path: '/annotations/-',
        nextValue: annotation,
      },
      ...blockChangeEvents(reconciled.blockChanges),
    ];
    const pendingChangeSet = stagePendingChanges(
      state.pendingChangeSet,
      {
        baseRevisionId: state.manuscript.headRevisionId,
        summary: 'Added manuscript note',
        events,
        actorAgentId,
        timestamp,
      },
    );

    changed = true;

    return {
      manuscript: {
        ...state.manuscript,
        ...reconciled.state,
        updatedAt: timestamp,
      },
      pendingChangeSet,
    };
  });

  if (changed) {
    scheduleNoteCheckpoint();
  }

  return changed;
}

export function stageUpdateNote(
  noteId: string,
  input: UpdateStudioNoteInput,
): boolean {
  let changed = false;

  useStudioStore.setState((state) => {
    const previous = state.manuscript.annotations.find(
      (annotation) =>
        annotation.id === noteId && isNoteAnnotation(annotation),
    );

    if (!previous) {
      return state;
    }

    const timestamp = new Date().toISOString();
    const nextKind = input.kind ?? getNoteKind(previous);
    const nextAnnotation: OmiAnnotation = {
      ...previous,
      body: input.body ?? previous.body,
      noteKind: nextKind,
      renderingHint:
        nextKind === 'endnote'
          ? 'endnote'
          : nextKind === 'author-note'
            ? 'margin'
            : 'footnote',
      modifiedAt: timestamp,
    };

    if (annotationsEqual(previous, nextAnnotation)) {
      return state;
    }

    const portableState: OmiManuscriptState = {
      ...extractManuscriptState(state.manuscript),
      annotations: state.manuscript.annotations.map((annotation) =>
        annotation.id === noteId ? nextAnnotation : annotation,
      ),
    };
    const reconciled = reconcileNoteState(portableState, {
      removeOrphanAnnotations: false,
    });
    const actorAgentId = resolveCurrentActorAgentId(state.manuscript);
    const pendingChangeSet = stagePendingChanges(
      state.pendingChangeSet,
      {
        baseRevisionId: state.manuscript.headRevisionId,
        summary: 'Changed manuscript note',
        events: [
          {
            operation: 'annotation.update' as never,
            targetId: noteId,
            path: `/annotations/${noteId}`,
            previousValue: previous,
            nextValue: nextAnnotation,
          },
          ...blockChangeEvents(reconciled.blockChanges),
        ],
        actorAgentId,
        timestamp,
      },
    );

    changed = true;

    return {
      manuscript: {
        ...state.manuscript,
        ...reconciled.state,
        updatedAt: timestamp,
      },
      pendingChangeSet,
    };
  });

  if (changed) {
    scheduleNoteCheckpoint();
  }

  return changed;
}

export function stageRemoveNote(noteId: string): boolean {
  let changed = false;

  useStudioStore.setState((state) => {
    const previous = state.manuscript.annotations.find(
      (annotation) =>
        annotation.id === noteId && isNoteAnnotation(annotation),
    );

    if (!previous) {
      return state;
    }

    const timestamp = new Date().toISOString();
    const portableState = extractManuscriptState(state.manuscript);
    const reconciled = removeNoteFromState(portableState, noteId);
    const actorAgentId = resolveCurrentActorAgentId(state.manuscript);
    const pendingChangeSet = stagePendingChanges(
      state.pendingChangeSet,
      {
        baseRevisionId: state.manuscript.headRevisionId,
        summary: 'Removed manuscript note',
        events: [
          {
            operation: 'annotation.remove',
            targetId: noteId,
            path: `/annotations/${noteId}`,
            previousValue: previous,
          },
          ...blockChangeEvents(reconciled.blockChanges),
        ],
        actorAgentId,
        timestamp,
      },
    );

    changed = true;

    return {
      manuscript: {
        ...state.manuscript,
        ...reconciled.state,
        updatedAt: timestamp,
      },
      pendingChangeSet,
    };
  });

  if (changed) {
    scheduleNoteCheckpoint();
  }

  return changed;
}

/**
 * Runs after a normal block edit. It removes note objects whose inline anchor
 * was deleted, retargets surviving notes to their current block, and keeps
 * visible note numbers in document order.
 */
export function reconcileNotesAfterBlockEdit(): void {
  let changed = false;

  useStudioStore.setState((state) => {
    const portableState = extractManuscriptState(state.manuscript);
    const reconciled = reconcileNoteState(portableState, {
      removeOrphanAnnotations: true,
    });
    const semanticEvents = [
      ...reconciled.removedAnnotations.map((annotation) => ({
        operation: 'annotation.remove' as const,
        targetId: annotation.id,
        path: `/annotations/${annotation.id}`,
        previousValue: annotation,
      })),
      ...reconciled.updatedAnnotations.map(({ previous, next }) => ({
        operation: 'annotation.update' as never,
        targetId: next.id,
        path: `/annotations/${next.id}`,
        previousValue: previous,
        nextValue: next,
      })),
      ...blockChangeEvents(reconciled.blockChanges),
    ];

    if (semanticEvents.length === 0) {
      return state;
    }

    const timestamp = new Date().toISOString();
    const actorAgentId = resolveCurrentActorAgentId(state.manuscript);
    const pendingChangeSet = stagePendingChanges(
      state.pendingChangeSet,
      {
        baseRevisionId: state.manuscript.headRevisionId,
        summary:
          reconciled.removedAnnotations.length > 0
            ? 'Removed note anchor and annotation'
            : 'Synchronized manuscript note anchors',
        events: semanticEvents,
        actorAgentId,
        timestamp,
      },
    );

    changed = true;

    return {
      manuscript: {
        ...state.manuscript,
        ...reconciled.state,
        updatedAt: timestamp,
      },
      pendingChangeSet,
    };
  });

  if (changed) {
    scheduleNoteCheckpoint();
  }
}

function blockChangeEvents(
  changes: Array<{
    blockId: string;
    previousContent: string;
    nextContent: string;
  }>,
) {
  return changes.map((change) => ({
    operation: 'block.content.set' as const,
    targetId: change.blockId,
    path: `/blocks/${change.blockId}/content`,
    previousValue: change.previousContent,
    nextValue: change.nextContent,
  }));
}

function scheduleNoteCheckpoint(): void {
  if (noteCheckpointTimer !== null) {
    clearTimeout(noteCheckpointTimer);
  }

  noteCheckpointTimer = setTimeout(() => {
    noteCheckpointTimer = null;
    useStudioStore.getState().checkpoint('idle');
  }, NOTE_CHECKPOINT_DELAY_MS);
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
    manuscript.agents.some((agent) => agent.id === currentUser.agentId)
  ) {
    return currentUser.agentId;
  }

  const accountOrcid = normalizeOrcidForComparison(currentUser.profile.orcid);

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

function annotationsEqual(
  first: OmiAnnotation,
  second: OmiAnnotation,
): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
}
