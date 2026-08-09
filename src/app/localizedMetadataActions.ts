import { getExternalIdentifierValue } from '../model/identity';
import { normalizeKeywords } from '../model/keywords';
import { extractManuscriptState } from '../model/versioning';
import { stagePendingChanges } from '../model/workingState';
import {
  getCurrentUser,
  useAuthStore,
} from '../store/authStore';
import type { OmiLocale, OmiManuscript } from '../types/omi';
import { useStudioStore } from './useStudioStore';

const METADATA_CHECKPOINT_DELAY_MS = 2500;
let metadataCheckpointTimer: ReturnType<typeof setTimeout> | null = null;

export function setLocalizedAbstract(
  locale: OmiLocale,
  abstractText: string,
): void {
  let changed = false;

  useStudioStore.setState((state) => {
    const current = state.manuscript.abstracts?.[locale] ??
      (locale === state.manuscript.locale ? state.manuscript.abstract ?? '' : '');
    if (current === abstractText) return state;

    const timestamp = new Date().toISOString();
    const abstracts = {
      ...(state.manuscript.abstracts ?? primaryAbstractMap(state.manuscript)),
      [locale]: abstractText,
    };
    const isPrimary = locale === state.manuscript.locale;
    const portableState = extractManuscriptState(state.manuscript);
    const pendingChangeSet = stagePendingChanges(
      state.pendingChangeSet,
      {
        baseRevisionId: state.manuscript.headRevisionId,
        summary: `Changed ${locale} manuscript abstract`,
        events: [
          {
            operation: 'manuscript.abstract.set' as never,
            targetId: state.manuscript.id,
            path: `/abstracts/${locale}`,
            previousValue: current,
            nextValue: abstractText,
          },
        ],
        actorAgentId: resolveCurrentActorAgentId(state.manuscript),
        timestamp,
      },
    );

    changed = true;
    return {
      manuscript: {
        ...state.manuscript,
        ...portableState,
        abstracts,
        abstract: isPrimary ? abstractText : (state.manuscript.abstract ?? ''),
        updatedAt: timestamp,
      },
      pendingChangeSet,
    };
  });

  if (changed) scheduleMetadataCheckpoint();
}

export function setLocalizedKeywords(
  locale: OmiLocale,
  keywords: string[],
): void {
  const normalized = normalizeKeywords(keywords);
  let changed = false;

  useStudioStore.setState((state) => {
    const current = state.manuscript.keywordsByLocale?.[locale] ??
      (locale === state.manuscript.locale ? state.manuscript.keywords : []);
    if (JSON.stringify(current) === JSON.stringify(normalized)) return state;

    const timestamp = new Date().toISOString();
    const keywordsByLocale = {
      ...(state.manuscript.keywordsByLocale ?? primaryKeywordMap(state.manuscript)),
      [locale]: normalized,
    };
    const isPrimary = locale === state.manuscript.locale;
    const portableState = extractManuscriptState(state.manuscript);
    const pendingChangeSet = stagePendingChanges(
      state.pendingChangeSet,
      {
        baseRevisionId: state.manuscript.headRevisionId,
        summary: `Changed ${locale} manuscript keywords`,
        events: [
          {
            operation: 'manuscript.keywords.set' as never,
            targetId: state.manuscript.id,
            path: `/keywordsByLocale/${locale}`,
            previousValue: current,
            nextValue: normalized,
          },
        ],
        actorAgentId: resolveCurrentActorAgentId(state.manuscript),
        timestamp,
      },
    );

    changed = true;
    return {
      manuscript: {
        ...state.manuscript,
        ...portableState,
        keywordsByLocale,
        keywords: isPrimary ? normalized : state.manuscript.keywords,
        updatedAt: timestamp,
      },
      pendingChangeSet,
    };
  });

  if (changed) scheduleMetadataCheckpoint();
}

function scheduleMetadataCheckpoint(): void {
  if (metadataCheckpointTimer !== null) {
    clearTimeout(metadataCheckpointTimer);
  }

  metadataCheckpointTimer = setTimeout(() => {
    metadataCheckpointTimer = null;
    useStudioStore.getState().checkpoint('idle');
  }, METADATA_CHECKPOINT_DELAY_MS);
}

function primaryAbstractMap(
  manuscript: OmiManuscript,
): Partial<Record<OmiLocale, string>> {
  return manuscript.abstract
    ? { [manuscript.locale]: manuscript.abstract }
    : {};
}

function primaryKeywordMap(
  manuscript: OmiManuscript,
): Partial<Record<OmiLocale, string[]>> {
  return manuscript.keywords.length
    ? { [manuscript.locale]: [...manuscript.keywords] }
    : {};
}

function resolveCurrentActorAgentId(
  manuscript: OmiManuscript,
): string | undefined {
  const currentUser = getCurrentUser(useAuthStore.getState());
  if (!currentUser) return undefined;

  if (
    currentUser.agentId &&
    manuscript.agents.some((agent) => agent.id === currentUser.agentId)
  ) {
    return currentUser.agentId;
  }

  const accountOrcid = normalizeOrcid(currentUser.profile.orcid);
  if (!accountOrcid) return undefined;

  const matches = manuscript.agents.filter(
    (agent) =>
      normalizeOrcid(getExternalIdentifierValue(agent, 'orcid')) === accountOrcid,
  );
  return matches.length === 1 ? matches[0]?.id : undefined;
}

function normalizeOrcid(value: string | undefined): string {
  return (value ?? '')
    .trim()
    .replace(/^https?:\/\/orcid\.org\//i, '')
    .toUpperCase();
}
