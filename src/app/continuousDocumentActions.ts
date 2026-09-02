import { synchronizeCrossReferenceLabels } from '../model/crossReferences';
import { extractManuscriptState } from '../model/versioning';
import { stagePendingChanges } from '../model/workingState';
import type { OmiSection } from '../types/omi';
import { useStudioStore } from './useStudioStore';

const CONTINUOUS_DOCUMENT_CHECKPOINT_DELAY_MS = 2500;
let checkpointTimer: ReturnType<typeof setTimeout> | null = null;

/** Atomically persists the structured projection of the live editor tree. */
export function stageContinuousDocumentChange(
  nextSections: readonly OmiSection[],
): boolean {
  let changed = false;

  useStudioStore.setState((state) => {
    const synchronizedSections = synchronizeCrossReferenceLabels(
      nextSections,
      state.manuscript.crossReferences ?? [],
      state.manuscript.crossReferenceNumbering,
      state.manuscript.locale,
    );

    if (documentsAreEqual(state.manuscript.sections, synchronizedSections)) {
      return state;
    }

    const timestamp = new Date().toISOString();
    const pendingChangeSet = stagePendingChanges(
      state.pendingChangeSet,
      {
        baseRevisionId: state.manuscript.headRevisionId,
        summary: 'Edited manuscript study',
        events: [{
          operation: 'section.replace' as never,
          targetId: state.manuscript.id,
          path: '/sections',
          previousValue: state.manuscript.sections,
          nextValue: synchronizedSections,
        }],
        timestamp,
      },
    );
    const portableState = extractManuscriptState(state.manuscript);
    const selectedSectionId = synchronizedSections.some(
      (section) => section.id === state.selectedSectionId,
    )
      ? state.selectedSectionId
      : synchronizedSections[0]?.id ?? null;

    changed = true;
    return {
      manuscript: {
        ...state.manuscript,
        ...portableState,
        sections: synchronizedSections,
        updatedAt: timestamp,
      },
      pendingChangeSet,
      selectedSectionId,
    };
  });

  if (changed) scheduleCheckpoint();
  return changed;
}

function scheduleCheckpoint(): void {
  if (checkpointTimer !== null) clearTimeout(checkpointTimer);
  checkpointTimer = setTimeout(() => {
    checkpointTimer = null;
    useStudioStore.getState().checkpoint('idle');
  }, CONTINUOUS_DOCUMENT_CHECKPOINT_DELAY_MS);
}

function documentsAreEqual(
  first: readonly OmiSection[],
  second: readonly OmiSection[],
): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
}
