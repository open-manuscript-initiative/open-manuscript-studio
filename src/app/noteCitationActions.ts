import { useStudioStore } from './useStudioStore';
import { extractManuscriptState } from '../model/versioning';
import { stagePendingChanges } from '../model/workingState';
import { isNoteAnnotation } from '../model/notes';
import type { OmiNoteCitation } from '../model/noteCitations';

const NOTE_CITATION_CHECKPOINT_DELAY_MS = 2500;
let checkpointTimer: ReturnType<typeof setTimeout> | null = null;

export function stageAddNoteCitations(
  noteId: string,
  citations: readonly OmiNoteCitation[],
): boolean {
  if (!citations.length) return false;
  let changed = false;

  useStudioStore.setState((state) => {
    const previous = state.manuscript.annotations.find(
      (annotation) => annotation.id === noteId && isNoteAnnotation(annotation),
    );
    if (!previous) return state;

    const records = state.manuscript.bibliographicRecords ?? [];
    const validTargets = new Set(records.map((record) => record.id));
    const additions = citations.filter((citation) => validTargets.has(citation.target));
    if (!additions.length) return state;

    const timestamp = new Date().toISOString();
    const nextAnnotation = {
      ...previous,
      noteCitations: [...(previous.noteCitations ?? []), ...additions],
      modifiedAt: timestamp,
    };
    const nextState = {
      ...extractManuscriptState(state.manuscript),
      annotations: state.manuscript.annotations.map((annotation) =>
        annotation.id === noteId ? nextAnnotation : annotation,
      ),
    };
    const pendingChangeSet = stagePendingChanges(
      state.pendingChangeSet,
      {
        baseRevisionId: state.manuscript.headRevisionId,
        summary: additions.length > 1 ? 'Added note citations' : 'Added note citation',
        events: [{
          operation: 'annotation.update' as never,
          targetId: noteId,
          path: `/annotations/${noteId}/noteCitations`,
          previousValue: previous.noteCitations ?? [],
          nextValue: nextAnnotation.noteCitations,
        }],
        timestamp,
      },
    );

    changed = true;
    return {
      manuscript: {
        ...state.manuscript,
        ...nextState,
        updatedAt: timestamp,
      },
      pendingChangeSet,
    };
  });

  if (changed) scheduleCheckpoint();
  return changed;
}

export function stageRemoveNoteCitation(
  noteId: string,
  citationId: string,
): boolean {
  let changed = false;

  useStudioStore.setState((state) => {
    const previous = state.manuscript.annotations.find(
      (annotation) => annotation.id === noteId && isNoteAnnotation(annotation),
    );
    if (!previous?.noteCitations?.some((citation) => citation.id === citationId)) {
      return state;
    }

    const timestamp = new Date().toISOString();
    const nextCitations = previous.noteCitations.filter(
      (citation) => citation.id !== citationId,
    );
    const nextAnnotation = {
      ...previous,
      noteCitations: nextCitations,
      modifiedAt: timestamp,
    };
    const nextState = {
      ...extractManuscriptState(state.manuscript),
      annotations: state.manuscript.annotations.map((annotation) =>
        annotation.id === noteId ? nextAnnotation : annotation,
      ),
    };
    const pendingChangeSet = stagePendingChanges(
      state.pendingChangeSet,
      {
        baseRevisionId: state.manuscript.headRevisionId,
        summary: 'Removed note citation',
        events: [{
          operation: 'annotation.update' as never,
          targetId: noteId,
          path: `/annotations/${noteId}/noteCitations`,
          previousValue: previous.noteCitations,
          nextValue: nextCitations,
        }],
        timestamp,
      },
    );

    changed = true;
    return {
      manuscript: {
        ...state.manuscript,
        ...nextState,
        updatedAt: timestamp,
      },
      pendingChangeSet,
    };
  });

  if (changed) scheduleCheckpoint();
  return changed;
}

function scheduleCheckpoint(): void {
  if (checkpointTimer) clearTimeout(checkpointTimer);
  checkpointTimer = setTimeout(() => {
    checkpointTimer = null;
    useStudioStore.getState().checkpoint('idle');
  }, NOTE_CITATION_CHECKPOINT_DELAY_MS);
}
