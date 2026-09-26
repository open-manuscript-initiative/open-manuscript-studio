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
  /**
   * Continuous editors already produce fresh immutable section trees. They
   * can retain those references until the checkpoint, where the revision
   * snapshot performs the authoritative deep clone.
   */
  cloneEventValues?: boolean;
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
  const cloneEventValues = input.cloneEventValues !== false;

  if (!pending) {
    return {
      baseRevisionId: input.baseRevisionId,
      startedAt: timestamp,
      updatedAt: timestamp,
      actorAgentId: input.actorAgentId,
      mixedActors: false,
      summaries: [input.summary],
      events: coalesceEvents([], input.events, cloneEventValues),
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
    events: coalesceEvents(pending.events, input.events, cloneEventValues),
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
    events: pending.events.map((event) => cloneEvent(event)),
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
function coalesceEvents(
  existing: CreateChangeEventInput[],
  incoming: CreateChangeEventInput[],
  cloneEventValues = true,
): CreateChangeEventInput[] {
  const result = existing.map((event) => cloneEvent(event, cloneEventValues));

  for (const event of incoming) {
    const key = eventKey(event);
    const index = result.findIndex(
      (candidate) => eventKey(candidate) === key,
    );

    if (index < 0) {
      result.push(cloneEvent(event, cloneEventValues));
      continue;
    }

    const previous = result[index];

    if (!previous) {
      result.push(cloneEvent(event, cloneEventValues));
      continue;
    }

    result[index] = {
      ...previous,
      nextValue: cloneEventValue(event.nextValue, cloneEventValues),
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
  cloneEventValues = true,
): CreateChangeEventInput {
  return {
    ...event,
    previousValue: cloneEventValue(event.previousValue, cloneEventValues),
    nextValue: cloneEventValue(event.nextValue, cloneEventValues),
  };
}

function cloneEventValue<T>(value: T, cloneValue = true): T {
  return cloneValue ? cloneEventPayload(value) : value;
}

function cloneEventPayload<T>(value: T): T {
  if (value === undefined || value === null) {
    return value;
  }

  return structuredClone(value);
}
