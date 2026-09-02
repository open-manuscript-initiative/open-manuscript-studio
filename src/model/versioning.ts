import type { AgentId } from './identity';
import {
  createTombstone,
  getActiveTombstone,
  markLatestTombstoneRestored,
  mergeTombstones,
  type OmiTombstoneObjectType,
} from './tombstone.ts';
import type {
  OmiBlock,
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
  | 'manuscript.subtitle.set'
  | 'manuscript.motto.set'
  | 'manuscript.titleMatter.set'
  | 'manuscript.structure.set'
  | 'manuscript.abstract.set'
  | 'section.create'
  | 'section.remove'
  | 'section.restore'
  | 'block.content.set'
  | 'block.remove'
  | 'block.restore'
  | 'agent.create'
  | 'agent.update'
  | 'agent.remove'
  | 'agent.restore'
  | 'contribution.update'
  | 'contribution.remove'
  | 'contribution.restore'
  | 'contribution.reorder'
  | 'annotation.remove'
  | 'annotation.restore'
  | 'citation.remove'
  | 'citation.restore'
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
  const normalizedState = cloneManuscriptState({
    ...state,
    tombstones: state.tombstones ?? [],
    updatedAt: timestamp,
  });
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
      state: normalizedState,
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
  const changeSet = createChangeSet(
    input.summary,
    input.events,
    input.actorAgentId,
    timestamp,
  );
  const stateWithRetainedTombstones: OmiManuscriptState = {
    ...nextState,
    tombstones: mergeTombstones(
      manuscript.tombstones ?? [],
      nextState.tombstones ?? [],
    ),
    updatedAt: timestamp,
  };

  assertNoUndeclaredIdentifierRestoration(
    stateWithRetainedTombstones,
    changeSet,
  );

  const normalizedState = applyTombstoneLifecycle(
    stateWithRetainedTombstones,
    changeSet,
    revisionId,
    input.actorAgentId,
    timestamp,
    input.summary,
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
  const currentState = extractManuscriptState(manuscript);
  const targetState = cloneManuscriptState(targetRevision.snapshot.state);
  const lifecycleEvents = createRevertLifecycleEvents(
    currentState,
    targetState,
  );
  const restoredState: OmiManuscriptState = {
    ...targetState,
    tombstones: mergeTombstones(
      manuscript.tombstones ?? [],
      targetState.tombstones ?? [],
    ),
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
        ...lifecycleEvents,
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
    tombstones: state.tombstones ?? [],
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

function assertNoUndeclaredIdentifierRestoration(
  state: OmiManuscriptState,
  changeSet: OmiChangeSet,
): void {
  const explicitRestorationIds = new Set(
    changeSet.events
      .filter((event) => Boolean(RESTORATION_OPERATION_TYPES[event.operation]))
      .map((event) => event.targetId),
  );
  const liveObjects = collectAddressableObjects(state);

  for (const objectId of liveObjects.keys()) {
    const activeTombstone = getActiveTombstone(
      state.tombstones ?? [],
      objectId,
    );

    if (activeTombstone && !explicitRestorationIds.has(objectId)) {
      throw new Error(
        `Object identifier ${objectId} is reserved by an active tombstone and cannot be reused without an explicit restoration event.`,
      );
    }
  }
}

function applyTombstoneLifecycle(
  state: OmiManuscriptState,
  changeSet: OmiChangeSet,
  revisionId: RevisionId,
  actorAgentId: AgentId | undefined,
  timestamp: string,
  reason: string,
): OmiManuscriptState {
  let tombstones = mergeTombstones(state.tombstones ?? []);

  for (const event of changeSet.events) {
    const deletionType = DELETION_OPERATION_TYPES[event.operation];

    if (deletionType) {
      tombstones = [
        ...tombstones,
        createTombstone({
          objectId: event.targetId,
          objectType: deletionType,
          deletionRevisionId: revisionId,
          deletingChangeEventId: event.id,
          deletedAt: timestamp,
          deletedByAgentId: actorAgentId,
          reason,
          formerContainerId: inferFormerContainerId(
            event,
            deletionType,
            state.id,
          ),
          visibility: 'public',
          retention: 'retain',
        }),
      ];
    }

    if (RESTORATION_OPERATION_TYPES[event.operation]) {
      tombstones = markLatestTombstoneRestored(
        tombstones,
        event.targetId,
        revisionId,
      );
    }
  }

  return {
    ...state,
    tombstones,
  };
}

interface AddressableObject {
  type: OmiTombstoneObjectType;
  value: unknown;
  path: string;
}

function createRevertLifecycleEvents(
  currentState: OmiManuscriptState,
  targetState: OmiManuscriptState,
): CreateChangeEventInput[] {
  const currentObjects = collectAddressableObjects(currentState);
  const targetObjects = collectAddressableObjects(targetState);
  const events: CreateChangeEventInput[] = [];

  for (const [objectId, currentObject] of currentObjects) {
    if (targetObjects.has(objectId)) {
      continue;
    }

    events.push({
      operation: deletionOperationForType(currentObject.type),
      targetId: objectId,
      path: currentObject.path,
      previousValue: currentObject.value,
    });
  }

  for (const [objectId, targetObject] of targetObjects) {
    if (currentObjects.has(objectId)) {
      continue;
    }

    events.push({
      operation: restorationOperationForType(targetObject.type),
      targetId: objectId,
      path: targetObject.path,
      nextValue: targetObject.value,
    });
  }

  return events;
}

function collectAddressableObjects(
  state: OmiManuscriptState,
): Map<string, AddressableObject> {
  const objects = new Map<string, AddressableObject>();

  for (const contribution of state.contributions) {
    objects.set(contribution.id, {
      type: 'contribution',
      value: contribution,
      path: `/contributions/${contribution.id}`,
    });
  }

  for (const agent of state.agents) {
    objects.set(agent.id, {
      type: 'agent',
      value: agent,
      path: `/agents/${agent.id}`,
    });
  }

  for (const section of state.sections) {
    objects.set(section.id, {
      type: 'section',
      value: section,
      path: `/sections/${section.id}`,
    });

    collectBlocks(section.blocks, objects);
  }

  for (const annotation of state.annotations) {
    objects.set(annotation.id, {
      type: 'annotation',
      value: annotation,
      path: `/annotations/${annotation.id}`,
    });
  }

  for (const citation of state.citations) {
    objects.set(citation.id, {
      type: 'citation',
      value: citation,
      path: `/citations/${citation.id}`,
    });
  }

  return objects;
}

function collectBlocks(
  blocks: OmiBlock[],
  objects: Map<string, AddressableObject>,
): void {
  for (const block of blocks) {
    objects.set(block.id, {
      type: 'block',
      value: block,
      path: `/blocks/${block.id}`,
    });

    if (block.children?.length) {
      collectBlocks(block.children, objects);
    }
  }
}

function inferFormerContainerId(
  event: OmiChangeEvent,
  objectType: OmiTombstoneObjectType,
  manuscriptId: string,
): string {
  if (objectType === 'contribution') {
    const targetId = getStringProperty(event.previousValue, 'targetId');

    if (targetId) {
      return targetId;
    }
  }

  return manuscriptId;
}

function getStringProperty(
  value: unknown,
  property: string,
): string | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const candidate = record[property];

  return typeof candidate === 'string' ? candidate : undefined;
}

function deletionOperationForType(
  objectType: OmiTombstoneObjectType,
): OmiChangeOperation {
  switch (objectType) {
    case 'agent':
      return 'agent.remove';
    case 'contribution':
      return 'contribution.remove';
    case 'section':
      return 'section.remove';
    case 'block':
      return 'block.remove';
    case 'annotation':
      return 'annotation.remove';
    case 'citation':
      return 'citation.remove';
  }
}

function restorationOperationForType(
  objectType: OmiTombstoneObjectType,
): OmiChangeOperation {
  switch (objectType) {
    case 'agent':
      return 'agent.restore';
    case 'contribution':
      return 'contribution.restore';
    case 'section':
      return 'section.restore';
    case 'block':
      return 'block.restore';
    case 'annotation':
      return 'annotation.restore';
    case 'citation':
      return 'citation.restore';
  }
}

const DELETION_OPERATION_TYPES: Partial<
  Record<OmiChangeOperation, OmiTombstoneObjectType>
> = {
  'agent.remove': 'agent',
  'contribution.remove': 'contribution',
  'section.remove': 'section',
  'block.remove': 'block',
  'annotation.remove': 'annotation',
  'citation.remove': 'citation',
};

const RESTORATION_OPERATION_TYPES: Partial<
  Record<OmiChangeOperation, OmiTombstoneObjectType>
> = {
  'agent.restore': 'agent',
  'contribution.restore': 'contribution',
  'section.restore': 'section',
  'block.restore': 'block',
  'annotation.restore': 'annotation',
  'citation.restore': 'citation',
};

function cloneManuscriptState(
  state: OmiManuscriptState,
): OmiManuscriptState {
  const cloned = JSON.parse(JSON.stringify(state)) as OmiManuscriptState;

  return {
    ...cloned,
    tombstones: cloned.tombstones ?? [],
  };
}

function clonePortableValue(value: unknown): unknown {
  if (value === undefined) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value)) as unknown;
}
