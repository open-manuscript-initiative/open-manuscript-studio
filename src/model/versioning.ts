import type { AgentId } from './identity';
import type {
  OmiManuscript,
  OmiManuscriptState,
} from '../types/omi';

export const OMI_VERSIONING_MODEL_VERSION =
  'OMI-SPEC-160@0.1.0' as const;

export type RevisionId = string;
export type ChangeSetId = string;
export type ChangeEventId = string;

export type OmiHistoryCompleteness =
  | 'complete'
  | 'shallow';

export type OmiChangeOperation =
  | 'manuscript.snapshot.create'
  | 'manuscript.title.set'
  | 'manuscript.abstract.set'
  | 'section.create'
  | 'block.content.set'
  | 'agent.create'
  | 'agent.update'
  | 'agent.remove'
  | 'contribution.update'
  | 'contribution.remove'
  | 'contribution.reorder'
  | 'revision.revert';

export interface OmiChangeEvent {
  id: ChangeEventId;
  operation: OmiChangeOperation;
  targetId: string;
  path?: string;
  previousValue?: unknown;
  nextValue?: unknown;
  createdAt: string;
}

export interface OmiChangeSet {
  id: ChangeSetId;
  summary: string;
  actorAgentId?: AgentId;
  createdAt: string;
  events: OmiChangeEvent[];
}

export interface OmiRevisionSnapshot {
  manuscriptId: string;
  state: OmiManuscriptState;
}

export interface OmiRevision {
  id: RevisionId;
  parentRevisionIds: RevisionId[];
  createdAt: string;
  actorAgentId?: AgentId;
  summary: string;
  changeSet: OmiChangeSet;
  snapshot: OmiRevisionSnapshot;
  revertsRevisionId?: RevisionId;
}

export interface OmiRevisionHistory {
  profile: 'core-revision-history';
  completeness: OmiHistoryCompleteness;
  rootRevisionId: RevisionId;
  headRevisionId: RevisionId;
  revisions: OmiRevision[];
}

export interface OmiVersioningEnvelope {
  versioningModelVersion: typeof OMI_VERSIONING_MODEL_VERSION;
  headRevisionId: RevisionId;
  revisionHistory: OmiRevisionHistory;
}

export interface CreateChangeEventInput {
  operation: OmiChangeOperation;
  targetId: string;
  path?: string;
  previousValue?: unknown;
  nextValue?: unknown;
}

export interface CreateInitialHistoryInput {
  summary: string;
  actorAgentId?: AgentId;
  timestamp?: string;
  completeness?: OmiHistoryCompleteness;
}

export interface CommitRevisionInput {
  summary: string;
  events: CreateChangeEventInput[];
  actorAgentId?: AgentId;
  timestamp?: string;
  revertsRevisionId?: RevisionId;
}

export function createInitialVersioningEnvelope(
  state: OmiManuscriptState,
  input: CreateInitialHistoryInput,
): OmiVersioningEnvelope {
  const timestamp = input.timestamp ?? new Date().toISOString();
  const revisionId = crypto.randomUUID();
  const changeSet = createChangeSet(
    input.summary,
    [
      {
        operation: 'manuscript.snapshot.create',
        targetId: state.id,
        path: '/',
        nextValue: {
          manuscriptId: state.id,
          title: state.title,
        },
      },
    ],
    input.actorAgentId,
    timestamp,
  );
  const revision: OmiRevision = {
    id: revisionId,
    parentRevisionIds: [],
    createdAt: timestamp,
    actorAgentId: input.actorAgentId,
    summary: input.summary,
    changeSet,
    snapshot: {
      manuscriptId: state.id,
      state: cloneManuscriptState({
        ...state,
        updatedAt: timestamp,
      }),
    },
  };

  return {
    versioningModelVersion: OMI_VERSIONING_MODEL_VERSION,
    headRevisionId: revisionId,
    revisionHistory: {
      profile: 'core-revision-history',
      completeness: input.completeness ?? 'complete',
      rootRevisionId: revisionId,
      headRevisionId: revisionId,
      revisions: [revision],
    },
  };
}

export function commitManuscriptRevision(
  manuscript: OmiManuscript,
  nextState: OmiManuscriptState,
  input: CommitRevisionInput,
): OmiManuscript {
  if (nextState.id !== manuscript.id) {
    throw new Error(
      'A revision cannot change the manuscript identifier.',
    );
  }

  if (!isValidLinearRevisionHistory(manuscript.revisionHistory)) {
    throw new Error(
      'The manuscript revision history is not a valid linear history.',
    );
  }

  if (input.events.length === 0) {
    throw new Error('A revision must contain at least one change event.');
  }

  const timestamp = input.timestamp ?? new Date().toISOString();
  const parentRevisionId = manuscript.revisionHistory.headRevisionId;
  const revisionId = crypto.randomUUID();
  const normalizedState: OmiManuscriptState = {
    ...nextState,
    updatedAt: timestamp,
  };
  const changeSet = createChangeSet(
    input.summary,
    input.events,
    input.actorAgentId,
    timestamp,
  );
  const revision: OmiRevision = {
    id: revisionId,
    parentRevisionIds: [parentRevisionId],
    createdAt: timestamp,
    actorAgentId: input.actorAgentId,
    summary: input.summary,
    changeSet,
    snapshot: {
      manuscriptId: manuscript.id,
      state: cloneManuscriptState(normalizedState),
    },
    revertsRevisionId: input.revertsRevisionId,
  };

  return {
    ...normalizedState,
    versioningModelVersion: OMI_VERSIONING_MODEL_VERSION,
    headRevisionId: revisionId,
    revisionHistory: {
      ...manuscript.revisionHistory,
      headRevisionId: revisionId,
      revisions: [
        ...manuscript.revisionHistory.revisions,
        revision,
      ],
    },
  };
}

export function revertManuscriptToRevision(
  manuscript: OmiManuscript,
  targetRevisionId: RevisionId,
  input: Omit<CommitRevisionInput, 'events' | 'revertsRevisionId'>,
): OmiManuscript {
  const targetRevision = getRevisionById(
    manuscript.revisionHistory,
    targetRevisionId,
  );

  if (!targetRevision) {
    throw new Error('The target revision does not exist.');
  }

  const timestamp = input.timestamp ?? new Date().toISOString();
  const restoredState: OmiManuscriptState = {
    ...cloneManuscriptState(targetRevision.snapshot.state),
    schema: manuscript.schema,
    id: manuscript.id,
    version: manuscript.version,
    identityModelVersion: manuscript.identityModelVersion,
    createdAt: manuscript.createdAt,
    updatedAt: timestamp,
  };

  return commitManuscriptRevision(
    manuscript,
    restoredState,
    {
      ...input,
      timestamp,
      revertsRevisionId: targetRevisionId,
      events: [
        {
          operation: 'revision.revert',
          targetId: manuscript.id,
          path: '/revisionHistory/headRevisionId',
          previousValue: manuscript.headRevisionId,
          nextValue: targetRevisionId,
        },
      ],
    },
  );
}

export function extractManuscriptState(
  manuscript: OmiManuscript,
): OmiManuscriptState {
  const {
    versioningModelVersion: _versioningModelVersion,
    headRevisionId: _headRevisionId,
    revisionHistory: _revisionHistory,
    ...state
  } = manuscript;
  const portableState = {
    ...state,
  };

  delete portableState.authors;

  return cloneManuscriptState(portableState);
}

export function getRevisionById(
  history: OmiRevisionHistory,
  revisionId: RevisionId,
): OmiRevision | undefined {
  return history.revisions.find(
    (revision) => revision.id === revisionId,
  );
}

export function isValidLinearRevisionHistory(
  history: OmiRevisionHistory,
): boolean {
  if (history.revisions.length === 0) {
    return false;
  }

  const identifiers = new Set<string>();

  for (let index = 0; index < history.revisions.length; index += 1) {
    const revision = history.revisions[index];

    if (!revision || identifiers.has(revision.id)) {
      return false;
    }

    identifiers.add(revision.id);

    if (revision.snapshot.manuscriptId !== revision.snapshot.state.id) {
      return false;
    }

    if (index === 0) {
      if (
        revision.id !== history.rootRevisionId ||
        revision.parentRevisionIds.length !== 0
      ) {
        return false;
      }

      continue;
    }

    const previousRevision = history.revisions[index - 1];

    if (
      !previousRevision ||
      revision.parentRevisionIds.length !== 1 ||
      revision.parentRevisionIds[0] !== previousRevision.id
    ) {
      return false;
    }
  }

  const lastRevision = history.revisions.at(-1);

  return Boolean(
    lastRevision && lastRevision.id === history.headRevisionId,
  );
}

function createChangeSet(
  summary: string,
  eventInputs: CreateChangeEventInput[],
  actorAgentId: AgentId | undefined,
  timestamp: string,
): OmiChangeSet {
  return {
    id: crypto.randomUUID(),
    summary,
    actorAgentId,
    createdAt: timestamp,
    events: eventInputs.map((event) => ({
      id: crypto.randomUUID(),
      operation: event.operation,
      targetId: event.targetId,
      path: event.path,
      previousValue: clonePortableValue(event.previousValue),
      nextValue: clonePortableValue(event.nextValue),
      createdAt: timestamp,
    })),
  };
}

function cloneManuscriptState(
  state: OmiManuscriptState,
): OmiManuscriptState {
  return JSON.parse(JSON.stringify(state)) as OmiManuscriptState;
}

function clonePortableValue(value: unknown): unknown {
  if (value === undefined) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value)) as unknown;
}
