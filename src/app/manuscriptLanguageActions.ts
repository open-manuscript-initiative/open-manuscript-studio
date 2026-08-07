import { useStudioStore } from './useStudioStore';
import { getExternalIdentifierValue } from '../model/identity';
import {
  normalizeManuscriptLanguageTag,
} from '../model/manuscriptLanguage';
import { extractManuscriptState } from '../model/versioning';
import { stagePendingChanges } from '../model/workingState';
import {
  getCurrentUser,
  useAuthStore,
} from '../store/authStore';
import type { OmiManuscript } from '../types/omi';

const LANGUAGE_CHECKPOINT_DELAY_MS = 2500;
let languageCheckpointTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Stages a manuscript-language metadata change in the same working-state
 * batch used by the rest of the Studio. The change becomes immutable when
 * the next checkpoint is created.
 *
 * UI language preferences are intentionally unrelated to this function:
 * manuscript language is portable scholarly metadata and is exported in the
 * canonical `.omi.json` document.
 */
export function stageManuscriptLanguageChange(
  languageTag: string,
): boolean {
  const normalized = normalizeManuscriptLanguageTag(languageTag);

  if (!normalized) {
    return false;
  }

  let changed = false;

  useStudioStore.setState((state) => {
    if (state.manuscript.locale === normalized) {
      return state;
    }

    const timestamp = new Date().toISOString();
    const previousLocale = state.manuscript.locale;
    const pendingChangeSet = stagePendingChanges(
      state.pendingChangeSet,
      {
        baseRevisionId: state.manuscript.headRevisionId,
        summary: 'Changed manuscript language',
        events: [
          {
            // The runtime operation is deliberately explicit even while the
            // broader OMI change-operation vocabulary remains extensible.
            operation: 'manuscript.locale.set' as never,
            targetId: state.manuscript.id,
            path: '/locale',
            previousValue: previousLocale,
            nextValue: normalized,
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
        locale: normalized,
        updatedAt: timestamp,
      },
      pendingChangeSet,
    };
  });

  if (changed) {
    scheduleLanguageCheckpoint();
  }

  return true;
}

function scheduleLanguageCheckpoint(): void {
  if (languageCheckpointTimer !== null) {
    clearTimeout(languageCheckpointTimer);
  }

  languageCheckpointTimer = setTimeout(() => {
    languageCheckpointTimer = null;
    useStudioStore.getState().checkpoint('idle');
  }, LANGUAGE_CHECKPOINT_DELAY_MS);
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
