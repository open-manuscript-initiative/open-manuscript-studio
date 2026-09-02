import { useStudioStore } from './useStudioStore';
import {
  getDocumentStructureProfile,
  type OmiDocumentStructureProfile,
} from '../model/documentProfile';
import { reconcileNoteState } from '../model/notes';
import { extractManuscriptState } from '../model/versioning';
import { stagePendingChanges } from '../model/workingState';

const CHECKPOINT_DELAY_MS = 2500;
let checkpointTimer: ReturnType<typeof setTimeout> | null = null;

export function stageDocumentStructureChange(
  patch: Partial<Omit<OmiDocumentStructureProfile, 'modelVersion' | 'kind'>>,
): void {
  let changed = false;
  useStudioStore.setState((state) => {
    const previous = getDocumentStructureProfile(state.manuscript);
    if (previous.kind !== 'volume') return state;
    const next: OmiDocumentStructureProfile = { ...previous, ...patch };
    if (JSON.stringify(previous) === JSON.stringify(next)) return state;

    const timestamp = new Date().toISOString();
    const portableState = {
      ...extractManuscriptState(state.manuscript),
      documentStructure: next,
    };
    const synchronizedState = previous.noteNumberingScope === next.noteNumberingScope
      ? portableState
      : reconcileNoteState(portableState).state;
    const pendingChangeSet = stagePendingChanges(
      state.pendingChangeSet,
      {
        baseRevisionId: state.manuscript.headRevisionId,
        summary: 'Changed OMI volume structure',
        events: [{
          operation: 'manuscript.structure.set',
          targetId: state.manuscript.id,
          path: '/documentStructure',
          previousValue: previous,
          nextValue: next,
        }],
        timestamp,
      },
    );

    changed = true;
    return {
      manuscript: {
        ...state.manuscript,
        ...synchronizedState,
        updatedAt: timestamp,
      },
      pendingChangeSet,
    };
  });

  if (!changed) return;
  if (checkpointTimer) clearTimeout(checkpointTimer);
  checkpointTimer = setTimeout(() => {
    checkpointTimer = null;
    useStudioStore.getState().checkpoint('idle');
  }, CHECKPOINT_DELAY_MS);
}
