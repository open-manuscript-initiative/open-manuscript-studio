import { useStudioStore } from './useStudioStore';
import { getExternalIdentifierValue } from '../model/identity';
import {
  normalizeOptionalFrontMatterValue,
} from '../model/frontMatter';
import { extractManuscriptState } from '../model/versioning';
import { stagePendingChanges } from '../model/workingState';
import {
  getCurrentUser,
  useAuthStore,
} from '../store/authStore';
import type { OmiManuscript } from '../types/omi';

const FRONT_MATTER_CHECKPOINT_DELAY_MS = 2500;
let frontMatterCheckpointTimer: ReturnType<typeof setTimeout> | null = null;

export function stageSubtitleChange(value: string): void {
  stageOptionalFrontMatterChange(
    'subtitle',
    value,
    'Changed manuscript subtitle',
    'manuscript.subtitle.set',
  );
}

export function stageMottoChange(value: string): void {
  stageOptionalFrontMatterChange(
    'motto',
    value,
    'Changed manuscript motto',
    'manuscript.motto.set',
  );
}

function stageOptionalFrontMatterChange(
  field: 'subtitle' | 'motto',
  value: string,
  summary: string,
  operation: 'manuscript.subtitle.set' | 'manuscript.motto.set',
): void {
  let changed = false;

  useStudioStore.setState((state) => {
    const previousValue = state.manuscript[field];
    const nextValue = normalizeOptionalFrontMatterValue(value);

    if ((previousValue ?? '') === (nextValue ?? '')) return state;

    const timestamp = new Date().toISOString();
    const portableState = extractManuscriptState(state.manuscript);
    const pendingChangeSet = stagePendingChanges(
      state.pendingChangeSet,
      {
        baseRevisionId: state.manuscript.headRevisionId,
        summary,
        events: [
          {
            operation: operation as never,
            targetId: state.manuscript.id,
            path: `/${field}`,
            previousValue,
            nextValue,
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
        [field]: nextValue,
        updatedAt: timestamp,
      },
      pendingChangeSet,
    };
  });

  if (changed) scheduleFrontMatterCheckpoint();
}

function scheduleFrontMatterCheckpoint(): void {
  if (frontMatterCheckpointTimer !== null) {
    clearTimeout(frontMatterCheckpointTimer);
  }

  frontMatterCheckpointTimer = setTimeout(() => {
    frontMatterCheckpointTimer = null;
    useStudioStore.getState().checkpoint('idle');
  }, FRONT_MATTER_CHECKPOINT_DELAY_MS);
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

  const accountOrcid = normalizeOrcidForComparison(currentUser.profile.orcid);
  if (!accountOrcid) return undefined;

  const matches = manuscript.agents.filter(
    (agent) =>
      normalizeOrcidForComparison(
        getExternalIdentifierValue(agent, 'orcid'),
      ) === accountOrcid,
  );

  return matches.length === 1 ? matches[0]?.id : undefined;
}

function normalizeOrcidForComparison(value: string | undefined): string {
  return (value ?? '')
    .trim()
    .replace(/^https?:\/\/orcid\.org\//i, '')
    .toUpperCase();
}
