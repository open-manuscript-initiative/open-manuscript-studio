import { synchronizeCrossReferenceLabels } from '../model/crossReferences';
import { extractManuscriptState } from '../model/versioning';
import { stagePendingChanges } from '../model/workingState';
import type { OmiAnnotation, OmiSection } from '../types/omi';
import { useStudioStore } from './useStudioStore';

const CLIPBOARD_CHECKPOINT_DELAY_MS = 2500;
let clipboardCheckpointTimer: ReturnType<typeof setTimeout> | null = null;

export function stageClipboardSectionChange(
  nextSections: readonly OmiSection[],
  summary: string,
  nextAnnotations?: readonly OmiAnnotation[],
): boolean {
  let changed = false;

  useStudioStore.setState((state) => {
    const synchronizedSections = synchronizeCrossReferenceLabels(
      nextSections,
      state.manuscript.crossReferences ?? [],
      state.manuscript.crossReferenceNumbering,
      state.manuscript.locale,
    );

    const annotations = nextAnnotations ?? state.manuscript.annotations;
    if (
      JSON.stringify(state.manuscript.sections) ===
      JSON.stringify(synchronizedSections) &&
      JSON.stringify(state.manuscript.annotations) === JSON.stringify(annotations)
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
          ...annotations
            .filter((annotation) => !state.manuscript.annotations.some((item) => item.id === annotation.id))
            .map((annotation) => ({
              operation: 'annotation.create' as never,
              targetId: annotation.id,
              path: '/annotations/-',
              nextValue: annotation,
            })),
        ],
        timestamp,
      },
    );
    const portableState = extractManuscriptState(state.manuscript);

    changed = true;
    const selectedSectionId = synchronizedSections.some(
      (section) => section.id === state.selectedSectionId,
    )
      ? state.selectedSectionId
      : synchronizedSections[0]?.id ?? null;
    return {
      manuscript: {
        ...state.manuscript,
        ...portableState,
        sections: synchronizedSections,
        annotations: [...annotations],
        updatedAt: timestamp,
      },
      pendingChangeSet,
      selectedSectionId,
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
