import { synchronizeCrossReferenceLabels } from '../model/crossReferences';
import { extractManuscriptState } from '../model/versioning';
import { stagePendingChanges } from '../model/workingState';
import type { OmiSection } from '../types/omi';
import { useStudioStore } from './useStudioStore';

const CLIPBOARD_CHECKPOINT_DELAY_MS = 2500;
let clipboardCheckpointTimer: ReturnType<typeof setTimeout> | null = null;

export function stageClipboardSectionChange(
  nextSections: readonly OmiSection[],
  summary: string,
): boolean {
  let changed = false;

  useStudioStore.setState((state) => {
    const synchronizedSections = synchronizeCrossReferenceLabels(
      nextSections,
      state.manuscript.crossReferences ?? [],
      state.manuscript.crossReferenceNumbering,
      state.manuscript.locale,
    );

    if (
      JSON.stringify(state.manuscript.sections) ===
      JSON.stringify(synchronizedSections)
    ) {
      return state;
    }

    const timestamp = new Date().toISOString();
    const pendingChangeSet = stagePendingChanges(
      state.pendingChangeSet,
      {
        baseRevisionId: state.manuscript.headRevisionId,
        summary,
        events: [
          {
            operation: 'section.replace' as never,
            targetId: state.manuscript.id,
            path: '/sections',
            previousValue: state.manuscript.sections,
            nextValue: synchronizedSections,
          },
        ],
        timestamp,
      },
    );
    const portableState = extractManuscriptState(state.manuscript);

    changed = true;
    return {
      manuscript: {
        ...state.manuscript,
        ...portableState,
        sections: synchronizedSections,
        updatedAt: timestamp,
      },
      pendingChangeSet,
    };
  });

  if (changed) scheduleClipboardCheckpoint();
  return changed;
}

function scheduleClipboardCheckpoint(): void {
  if (clipboardCheckpointTimer !== null) {
    clearTimeout(clipboardCheckpointTimer);
  }

  clipboardCheckpointTimer = setTimeout(() => {
    clipboardCheckpointTimer = null;
    useStudioStore.getState().checkpoint('idle');
  }, CLIPBOARD_CHECKPOINT_DELAY_MS);
}
