import { useStudioStore } from './useStudioStore';
import { synchronizeCrossReferenceLabels } from '../model/crossReferences.ts';
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
import type {
  OmiManuscript,
  OmiSection,
} from '../types/omi';

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

    const previousLocale = state.manuscript.locale;
    const nextSections = synchronizeCrossReferenceLabels(
      state.manuscript.sections,
      state.manuscript.crossReferences ?? [],
      state.manuscript.crossReferenceNumbering,
      normalized,
    );
    const contentEvents = collectBlockContentChanges(
      state.manuscript.sections,
      nextSections,
    );
    const timestamp = new Date().toISOString();
    const pendingChangeSet = stagePendingChanges(
      state.pendingChangeSet,
      {
        baseRevisionId: state.manuscript.headRevisionId,
        summary: 'Changed manuscript language',
        events: [
          {
            operation: 'manuscript.locale.set' as never,
            targetId: state.manuscript.id,
            path: '/locale',
            previousValue: previousLocale,
            nextValue: normalized,
          },
          ...contentEvents,
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
        sections: nextSections,
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

function collectBlockContentChanges(
  previousSections: readonly OmiSection[],
  nextSections: readonly OmiSection[],
) {
  const previousBlocks = new Map(
    previousSections
      .flatMap((section) => section.blocks)
      .map((block) => [block.id, block]),
  );

  return nextSections
    .flatMap((section) => section.blocks)
    .flatMap((block) => {
      const previous = previousBlocks.get(block.id);
      if (!previous || previous.content === block.content) return [];

      return [
        {
          operation: 'block.content.set' as const,
          targetId: block.id,
          path: `/blocks/${block.id}/content`,
          previousValue: previous.content,
          nextValue: block.content,
        },
      ];
    });
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
