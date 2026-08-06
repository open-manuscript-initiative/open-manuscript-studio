import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createCheckpointDescriptor,
  stagePendingChanges,
} from '../src/model/workingState.ts';

test('coalesces repeated edits to the same semantic target', () => {
  const first = stagePendingChanges(null, {
    baseRevisionId: 'revision-1',
    summary: 'Changed manuscript title',
    timestamp: '2026-08-06T21:50:00.000Z',
    events: [
      {
        operation: 'manuscript.title.set',
        targetId: 'manuscript-1',
        path: '/title',
        previousValue: 'Old',
        nextValue: 'N',
      },
    ],
  });
  const second = stagePendingChanges(first, {
    baseRevisionId: 'revision-1',
    summary: 'Changed manuscript title',
    timestamp: '2026-08-06T21:50:01.000Z',
    events: [
      {
        operation: 'manuscript.title.set',
        targetId: 'manuscript-1',
        path: '/title',
        previousValue: 'N',
        nextValue: 'New title',
      },
    ],
  });

  assert.equal(second.events.length, 1);
  assert.equal(second.events[0]?.previousValue, 'Old');
  assert.equal(second.events[0]?.nextValue, 'New title');
  assert.equal(second.startedAt, '2026-08-06T21:50:00.000Z');
  assert.equal(second.updatedAt, '2026-08-06T21:50:01.000Z');
});

test('keeps different semantic targets in one atomic pending batch', () => {
  const pending = stagePendingChanges(null, {
    baseRevisionId: 'revision-1',
    summary: 'Changed manuscript title',
    actorAgentId: 'agent-1',
    events: [
      {
        operation: 'manuscript.title.set',
        targetId: 'manuscript-1',
        path: '/title',
        previousValue: 'Old',
        nextValue: 'New',
      },
    ],
  });
  const grouped = stagePendingChanges(pending, {
    baseRevisionId: 'revision-1',
    summary: 'Changed manuscript abstract',
    actorAgentId: 'agent-1',
    events: [
      {
        operation: 'manuscript.abstract.set',
        targetId: 'manuscript-1',
        path: '/abstract',
        previousValue: 'Old abstract',
        nextValue: 'New abstract',
      },
    ],
  });
  const descriptor = createCheckpointDescriptor(grouped);

  assert.equal(descriptor.events.length, 2);
  assert.equal(descriptor.actorAgentId, 'agent-1');
  assert.equal(
    descriptor.summary,
    'Checkpointed 2 grouped manuscript changes',
  );
});

test('does not falsely attribute a mixed-actor checkpoint', () => {
  const first = stagePendingChanges(null, {
    baseRevisionId: 'revision-1',
    summary: 'Changed manuscript title',
    actorAgentId: 'agent-1',
    events: [
      {
        operation: 'manuscript.title.set',
        targetId: 'manuscript-1',
        path: '/title',
        nextValue: 'One',
      },
    ],
  });
  const second = stagePendingChanges(first, {
    baseRevisionId: 'revision-1',
    summary: 'Changed manuscript abstract',
    actorAgentId: 'agent-2',
    events: [
      {
        operation: 'manuscript.abstract.set',
        targetId: 'manuscript-1',
        path: '/abstract',
        nextValue: 'Two',
      },
    ],
  });
  const descriptor = createCheckpointDescriptor(second);

  assert.equal(second.mixedActors, true);
  assert.equal(descriptor.actorAgentId, undefined);
});

test('rejects pending changes that cross committed base revisions', () => {
  const pending = stagePendingChanges(null, {
    baseRevisionId: 'revision-1',
    summary: 'Changed manuscript title',
    events: [
      {
        operation: 'manuscript.title.set',
        targetId: 'manuscript-1',
        path: '/title',
        nextValue: 'One',
      },
    ],
  });

  assert.throws(
    () =>
      stagePendingChanges(pending, {
        baseRevisionId: 'revision-2',
        summary: 'Changed manuscript abstract',
        events: [
          {
            operation: 'manuscript.abstract.set',
            targetId: 'manuscript-1',
            path: '/abstract',
            nextValue: 'Two',
          },
        ],
      }),
    /cannot span more than one committed base revision/,
  );
});

test('checkpoint descriptors are detached from mutable pending arrays', () => {
  const pending = stagePendingChanges(null, {
    baseRevisionId: 'revision-1',
    summary: 'Changed manuscript title',
    events: [
      {
        operation: 'manuscript.title.set',
        targetId: 'manuscript-1',
        path: '/title',
        previousValue: { value: 'Old' },
        nextValue: { value: 'New' },
      },
    ],
  });
  const descriptor = createCheckpointDescriptor(pending);
  const next = descriptor.events[0]?.nextValue as { value: string };

  next.value = 'Mutated descriptor';

  assert.deepEqual(pending.events[0]?.nextValue, { value: 'New' });
});
