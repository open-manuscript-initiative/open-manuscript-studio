import { useStudioStore } from './useStudioStore';
import { FRAME_LAYOUT_EXTENSION, validateFrameLayout, type PublicationFrameLayout } from '../model/publicationFrames';
import { stagePendingChanges } from '../model/workingState';
import { getCurrentUser, useAuthStore } from '../store/authStore';

let checkpointTimer: ReturnType<typeof setTimeout> | undefined;
export function stageFrameLayout(layout: PublicationFrameLayout): void {
  validateFrameLayout(layout);
  useStudioStore.setState((state) => {
    const previous = state.manuscript.extensions?.[FRAME_LAYOUT_EXTENSION];
    if (JSON.stringify(previous) === JSON.stringify(layout)) return state;
    const timestamp = new Date().toISOString();
    const actor = getCurrentUser(useAuthStore.getState())?.agentId;
    return {
      manuscript: { ...state.manuscript, extensions: { ...state.manuscript.extensions, [FRAME_LAYOUT_EXTENSION]: structuredClone(layout) }, updatedAt: timestamp },
      pendingChangeSet: stagePendingChanges(state.pendingChangeSet, {
        baseRevisionId: state.manuscript.headRevisionId, summary: 'Changed publication frame layout',
        actorAgentId: state.manuscript.agents.some((agent) => agent.id === actor) ? actor : undefined, timestamp,
        events: [{ operation: 'publication.frames.set', targetId: state.manuscript.id,
          path: `/extensions/${FRAME_LAYOUT_EXTENSION.replace(/~/g, '~0').replace(/\//g, '~1')}`, previousValue: previous, nextValue: layout }],
      }),
    };
  });
  clearTimeout(checkpointTimer);
  checkpointTimer = setTimeout(() => useStudioStore.getState().checkpoint('idle'), 2500);
}
