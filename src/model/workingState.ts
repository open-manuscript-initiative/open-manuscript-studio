import type { AgentId } from './identity';
import type {
  CreateChangeEventInput,
  RevisionId,
} from './versioning';

/**
 * A pending working-state batch sits between the last committed revision and
 * the next immutable checkpoint revision.
 */
export interface OmiPendingChangeSet {
  baseRevisionId: RevisionId;
  startedAt: string;
  updatedAt: string;
  actorAgentId?: AgentId;
  mixedActors: boolean;
  summaries: string[];
  events: CreateChangeEventInput[];
}

export type CheckpointReason =
  | 'manual'
  | 'idle'
  | 'window-blur'
  | 'export';

export interface StagePendingChangesInput {
  baseRevisionId: RevisionId;
  summary: string;
  events: CreateChangeEventInput[];
  actorAgentId?: AgentId;
  timestamp?: string;
}

export interface CheckpointDescriptor {
  summary: string;
  events: CreateChangeEventInput[];
  actorAgentId?: AgentId;
}

export function stagePendingChanges(
  pending: OmiPendingChangeSet | null,
  input: StagePendingChangesInput,
): OmiPendingChangeSet {
  if (input.events.length === 0) {
    throw new Error('A pending change set must contain at least one event.');
  }

  const timestamp = input.timestamp ?? new Date().toISOString();

  if (!pending) {
    return {
      baseRevisionId: input.baseRevisionId,
      startedAt: timestamp,
      updatedAt: timestamp,
      actorAgentId: input.actorAgentId,
      mixedActors: false,
      summaries: [input.summary],
      events: coalesceEvents([], input.events),
    };
  }

  if (pending.baseRevisionId !== input.baseRevisionId) {
    throw new Error(
      'Pending changes cannot span more than one committed base revision.',
    );
  }

  const actorState = mergeActorAttribution(
    pending.actorAgentId,
    pending.mixedActors,
    input.actorAgentId,
  );

  return {
    ...pending,
    updatedAt: timestamp,
    actorAgentId: actorState.actorAgentId,
    mixedActors: actorState.mixedActors,
    summaries: appendUnique(pending.summaries, input.summary),
    events: coalesceEvents(pending.events, input.events),
  };
}

/**
 * Builds the immutable checkpoint payload represented by one pending batch.
 */
export function createCheckpointDescriptor(
  pending: OmiPendingChangeSet,
): CheckpointDescriptor {
  if (pending.events.length === 0) {
    throw new Error('Cannot checkpoint an empty pending change set.');
  }

  return {
    summary: createCheckpointSummary(pending),
    events: pending.events.map(cloneEvent),
    actorAgentId: pending.mixedActors
      ? undefined
      : pending.actorAgentId,
  };
}

export function createCheckpointSummary(
  pending: OmiPendingChangeSet,
): string {
  if (pending.summaries.length === 1) {
    return pending.summaries[0] ?? 'Checkpointed manuscript changes';
  }

  return `Checkpointed ${pending.events.length} grouped manuscript changes`;
}

/**
 * Repeated edits of the same semantic target are collapsed into one event.
 * The first previous value is retained and the latest next value wins.
 */
export function coalesceEvents(
  existing: CreateChangeEventInput[],
  incoming: CreateChangeEventInput[],
): CreateChangeEventInput[] {
  const result = existing.map(cloneEvent);

  for (const event of incoming) {
    const key = eventKey(event);
    const index = result.findIndex(
      (candidate) => eventKey(candidate) === key,
    );

    if (index < 0) {
      result.push(cloneEvent(event));
      continue;
    }

    const previous = result[index];

    if (!previous) {
      result.push(cloneEvent(event));
      continue;
    }

    result[index] = {
      ...previous,
      nextValue: cloneValue(event.nextValue),
    };
  }

  return result;
}

function mergeActorAttribution(
  currentActorAgentId: AgentId | undefined,
  mixedActors: boolean,
  nextActorAgentId: AgentId | undefined,
): {
  actorAgentId?: AgentId;
  mixedActors: boolean;
} {
  if (mixedActors) {
    return {
      actorAgentId: undefined,
      mixedActors: true,
    };
  }

  if (currentActorAgentId === nextActorAgentId) {
    return {
      actorAgentId: currentActorAgentId,
      mixedActors: false,
    };
  }

  return {
    actorAgentId: undefined,
    mixedActors: true,
  };
}

function eventKey(event: CreateChangeEventInput): string {
  return [event.operation, event.targetId, event.path ?? ''].join('|');
}

function appendUnique(values: string[], value: string): string[] {
  return values.includes(value)
    ? values
    : [...values, value];
}

function cloneEvent(
  event: CreateChangeEventInput,
): CreateChangeEventInput {
  return {
    ...event,
    previousValue: cloneValue(event.previousValue),
    nextValue: cloneValue(event.nextValue),
  };
}

function cloneValue<T>(value: T): T {
  if (value === undefined || value === null) {
    return value;
  }

  return structuredClone(value);
}
