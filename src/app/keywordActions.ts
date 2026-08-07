import { useStudioStore } from './useStudioStore';
import { getExternalIdentifierValue } from '../model/identity';
import { normalizeKeywords } from '../model/keywords';
import { extractManuscriptState } from '../model/versioning';
import { stagePendingChanges } from '../model/workingState';
import {
  getCurrentUser,
  useAuthStore,
} from '../store/authStore';
import type { OmiManuscript } from '../types/omi';

const KEYWORD_CHECKPOINT_DELAY_MS = 2500;
let keywordCheckpointTimer: ReturnType<typeof setTimeout> | null = null;

export function stageKeywordChange(keywords: string[]): void {
  const normalizedKeywords = normalizeKeywords(keywords);
  let changed = false;

  useStudioStore.setState((state) => {
    if (
      JSON.stringify(state.manuscript.keywords) ===
      JSON.stringify(normalizedKeywords)
    ) {
      return state;
    }

    const timestamp = new Date().toISOString();
    const previousKeywords = [...state.manuscript.keywords];
    const pendingChangeSet = stagePendingChanges(
      state.pendingChangeSet,
      {
        baseRevisionId: state.manuscript.headRevisionId,
        summary: 'Changed manuscript keywords',
        events: [
          {
            operation: 'manuscript.keywords.set' as never,
            targetId: state.manuscript.id,
            path: '/keywords',
            previousValue: previousKeywords,
            nextValue: normalizedKeywords,
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
        keywords: normalizedKeywords,
        updatedAt: timestamp,
      },
      pendingChangeSet,
    };
  });

  if (changed) {
    scheduleKeywordCheckpoint();
  }
}

function scheduleKeywordCheckpoint(): void {
  if (keywordCheckpointTimer !== null) {
    clearTimeout(keywordCheckpointTimer);
  }

  keywordCheckpointTimer = setTimeout(() => {
    keywordCheckpointTimer = null;
    useStudioStore.getState().checkpoint('idle');
  }, KEYWORD_CHECKPOINT_DELAY_MS);
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
    manuscript.agents.some(
      (agent) => agent.id === currentUser.agentId,
    )
  ) {
    return currentUser.agentId;
  }

  const accountOrcid = normalizeOrcidForComparison(
    currentUser.profile.orcid,
  );

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
