import { useStudioStore } from './useStudioStore';
import { isNoteAnnotation } from '../model/notes';
import { extractManuscriptState } from '../model/versioning';
import { stagePendingChanges } from '../model/workingState';

const NOTE_RICH_TEXT_CHECKPOINT_DELAY_MS = 2500;
let checkpointTimer: ReturnType<typeof setTimeout> | null = null;

export function stageUpdateNoteRichText(
  noteId: string,
  bodyContent: string,
  body: string,
  retainedCitationIds: readonly string[],
): boolean {
  let changed = false;

  useStudioStore.setState((state) => {
    const previous = state.manuscript.annotations.find(
      (annotation) => annotation.id === noteId && isNoteAnnotation(annotation),
    );
    if (!previous) return state;

    const retained = new Set(retainedCitationIds);
    const nextCitations = (previous.noteCitations ?? []).filter((citation) => retained.has(citation.id));
    const timestamp = new Date().toISOString();
    const nextAnnotation = {
      ...previous,
      bodyContent,
      body,
      noteCitations: nextCitations,
      modifiedAt: timestamp,
    };

    if (JSON.stringify(previous) === JSON.stringify(nextAnnotation)) return state;

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
        summary: 'Changed rich manuscript note',
        events: [{
          operation: 'annotation.update' as never,
          targetId: noteId,
          path: `/annotations/${noteId}`,
          previousValue: previous,
          nextValue: nextAnnotation,
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
  }, NOTE_RICH_TEXT_CHECKPOINT_DELAY_MS);
}
