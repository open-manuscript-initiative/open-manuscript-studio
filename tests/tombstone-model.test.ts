import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertObjectIdentifierAvailable,
  createTombstone,
  getActiveTombstone,
  isObjectIdentifierReserved,
  markLatestTombstoneRestored,
  mergeTombstones,
} from '../src/model/tombstone.ts';

const tombstone = createTombstone({
  objectId: 'object-1',
  objectType: 'agent',
  deletionRevisionId: 'revision-delete-1',
  deletingChangeEventId: 'event-delete-1',
  deletedAt: '2026-08-07T03:00:00.000Z',
  deletedByAgentId: 'agent-editor',
  reason: 'Removed manuscript contributor',
  formerContainerId: 'manuscript-1',
});

test('creates a portable tombstone with conservative defaults', () => {
  assert.equal(tombstone.objectId, 'object-1');
  assert.equal(tombstone.objectType, 'agent');
  assert.equal(tombstone.visibility, 'public');
  assert.equal(tombstone.retention, 'retain');
  assert.equal(tombstone.restoredByRevisionId, undefined);
});

test('reserves deleted identifiers against silent reuse', () => {
  assert.equal(isObjectIdentifierReserved([tombstone], 'object-1'), true);
  assert.equal(isObjectIdentifierReserved([tombstone], 'object-2'), false);
  assert.throws(
    () => assertObjectIdentifierAvailable([tombstone], 'object-1'),
    /reserved by deletion history/,
  );
});

test('marks only the latest active deletion as restored', () => {
  const older = {
    ...tombstone,
    deletionRevisionId: 'revision-delete-0',
    deletingChangeEventId: 'event-delete-0',
    restoredByRevisionId: 'revision-restore-0',
  };
  const latest = {
    ...tombstone,
    deletionRevisionId: 'revision-delete-2',
    deletingChangeEventId: 'event-delete-2',
  };
  const restored = markLatestTombstoneRestored(
    [older, latest],
    'object-1',
    'revision-restore-2',
  );

  assert.equal(
    restored[0]?.restoredByRevisionId,
    'revision-restore-0',
  );
  assert.equal(
    restored[1]?.restoredByRevisionId,
    'revision-restore-2',
  );
  assert.equal(getActiveTombstone(restored, 'object-1'), undefined);
});

test('retains separate deletion cycles while deduplicating identical records', () => {
  const secondCycle = {
    ...tombstone,
    deletionRevisionId: 'revision-delete-2',
    deletingChangeEventId: 'event-delete-2',
  };
  const merged = mergeTombstones(
    [tombstone],
    [tombstone, secondCycle],
  );

  assert.equal(merged.length, 2);
  assert.deepEqual(
    merged.map((item) => item.deletionRevisionId),
    ['revision-delete-1', 'revision-delete-2'],
  );
});
