import { synchronizeCrossReferenceLabels } from '../model/crossReferences';
import { recordSectionTextChanges } from '../model/proofing';
import { stagePendingChanges } from '../model/workingState';
import type { OmiSection } from '../types/omi';
import {
  resolveCurrentActorAgentId,
  useStudioStore,
} from './useStudioStore';

const CONTINUOUS_DOCUMENT_CHECKPOINT_DELAY_MS = 2500;
let checkpointTimer: ReturnType<typeof setTimeout> | null = null;

/** Atomically persists the structured projection of the live editor tree. */
export function stageContinuousDocumentChange(
  nextSections: readonly OmiSection[],
): boolean {
  let changed = false;

  useStudioStore.setState((state) => {
    const crossReferences = state.manuscript.crossReferences ?? [];
    const synchronizedSections = crossReferences.length > 0
      ? synchronizeCrossReferenceLabels(
          nextSections,
          crossReferences,
          state.manuscript.crossReferenceNumbering,
          state.manuscript.locale,
        )
      : [...nextSections];

    const timestamp = new Date().toISOString();
    const proofing = recordSectionTextChanges(
      state.manuscript.sections,
      synchronizedSections,
      state.manuscript.proofing,
      resolveCurrentActorAgentId(state.manuscript),
      timestamp,
    );
    const proofingChanged = JSON.stringify(proofing) !== JSON.stringify(state.manuscript.proofing);
    const pendingChangeSet = stagePendingChanges(
      state.pendingChangeSet,
      {
        baseRevisionId: state.manuscript.headRevisionId,
        summary: 'Edited manuscript study',
        events: [
          {
            operation: 'section.replace' as never,
            targetId: state.manuscript.id,
            path: '/sections',
            previousValue: state.manuscript.sections,
            nextValue: synchronizedSections,
          },
          ...(proofingChanged ? [{
            operation: 'proofing.change.record' as const,
            targetId: state.manuscript.id,
            path: '/proofing/changes',
            previousValue: state.manuscript.proofing?.changes ?? [],
            nextValue: proofing?.changes ?? [],
          }] : []),
        ],
        actorAgentId: resolveCurrentActorAgentId(state.manuscript),
        timestamp,
        // The projection is a newly-created immutable tree. Deep-cloning it
        // for every keystroke made large documents effectively uneditable;
        // the checkpoint path still clones the final event payload.
        cloneEventValues: false,
      },
    );
    const selectedSectionId = synchronizedSections.some(
      (section) => section.id === state.selectedSectionId,
    )
      ? state.selectedSectionId
      : synchronizedSections[0]?.id ?? null;

    changed = true;
    const { authors: _legacyAuthors, ...manuscriptWithoutLegacyAuthors } =
      state.manuscript;
    return {
      manuscript: {
        ...manuscriptWithoutLegacyAuthors,
        tombstones: state.manuscript.tombstones ?? [],
        sections: synchronizedSections,
        ...(proofing ? { proofing } : {}),
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
