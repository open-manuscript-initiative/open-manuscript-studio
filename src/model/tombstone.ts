export type OmiTombstoneObjectType =
  | 'agent'
  | 'contribution'
  | 'section'
  | 'block'
  | 'annotation'
  | 'citation';

export type OmiTombstoneVisibility =
  | 'public'
  | 'restricted';

export type OmiTombstoneRetention =
  | 'retain'
  | 'policy-controlled';

/**
 * Persistent evidence that an addressable OMI object existed and was deleted.
 *
 * A tombstone is historical evidence, not a substitute for the deleted object.
 * Restoration of the same conceptual object may reuse the original object ID,
 * but a new conceptual object must never reuse an ID that appears here.
 */
export interface OmiTombstone {
  objectId: string;
  objectType: OmiTombstoneObjectType;
  deletionRevisionId: string;
  deletingChangeEventId: string;
  deletedAt: string;
  deletedByAgentId?: string;
  reason?: string;
  formerContainerId?: string;
  visibility: OmiTombstoneVisibility;
  retention: OmiTombstoneRetention;
  restoredByRevisionId?: string;
  supersededByObjectId?: string;
}

export interface CreateTombstoneInput {
  objectId: string;
  objectType: OmiTombstoneObjectType;
  deletionRevisionId: string;
  deletingChangeEventId: string;
  deletedAt: string;
  deletedByAgentId?: string;
  reason?: string;
  formerContainerId?: string;
  visibility?: OmiTombstoneVisibility;
  retention?: OmiTombstoneRetention;
}

export function createTombstone(
  input: CreateTombstoneInput,
): OmiTombstone {
  return {
    objectId: input.objectId,
    objectType: input.objectType,
    deletionRevisionId: input.deletionRevisionId,
    deletingChangeEventId: input.deletingChangeEventId,
    deletedAt: input.deletedAt,
    deletedByAgentId: input.deletedByAgentId,
    reason: input.reason,
    formerContainerId: input.formerContainerId,
    visibility: input.visibility ?? 'public',
    retention: input.retention ?? 'retain',
  };
}

export function isObjectIdentifierReserved(
  tombstones: readonly OmiTombstone[],
  objectId: string,
): boolean {
  return tombstones.some(
    (tombstone) => tombstone.objectId === objectId,
  );
}

export function assertObjectIdentifierAvailable(
  tombstones: readonly OmiTombstone[],
  objectId: string,
): void {
  if (isObjectIdentifierReserved(tombstones, objectId)) {
    throw new Error(
      `Object identifier ${objectId} is reserved by deletion history.`,
    );
  }
}

export function getActiveTombstone(
  tombstones: readonly OmiTombstone[],
  objectId: string,
): OmiTombstone | undefined {
  return [...tombstones]
    .reverse()
    .find(
      (tombstone) =>
        tombstone.objectId === objectId &&
        tombstone.restoredByRevisionId === undefined &&
        tombstone.supersededByObjectId === undefined,
    );
}

export function markLatestTombstoneRestored(
  tombstones: readonly OmiTombstone[],
  objectId: string,
  restorationRevisionId: string,
): OmiTombstone[] {
  const activeIndex = findLatestActiveTombstoneIndex(
    tombstones,
    objectId,
  );

  if (activeIndex < 0) {
    return [...tombstones];
  }

  return tombstones.map((tombstone, index) =>
    index === activeIndex
      ? {
          ...tombstone,
          restoredByRevisionId: restorationRevisionId,
        }
      : tombstone,
  );
}

export function mergeTombstones(
  ...collections: ReadonlyArray<readonly OmiTombstone[]>
): OmiTombstone[] {
  const merged = new Map<string, OmiTombstone>();

  for (const collection of collections) {
    for (const tombstone of collection) {
      const key = `${tombstone.objectId}:${tombstone.deletionRevisionId}:${tombstone.deletingChangeEventId}`;
      merged.set(key, tombstone);
    }
  }

  return [...merged.values()];
}

function findLatestActiveTombstoneIndex(
  tombstones: readonly OmiTombstone[],
  objectId: string,
): number {
  for (let index = tombstones.length - 1; index >= 0; index -= 1) {
    const tombstone = tombstones[index];

    if (
      tombstone?.objectId === objectId &&
      tombstone.restoredByRevisionId === undefined &&
      tombstone.supersededByObjectId === undefined
    ) {
      return index;
    }
  }

  return -1;
}
