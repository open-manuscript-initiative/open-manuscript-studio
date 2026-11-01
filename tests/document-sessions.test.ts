import assert from 'node:assert/strict';
import test from 'node:test';
import { createDocumentSessionManager, restoredWorkingSession, type DocumentSessionPort } from '../src/services/documentSessionManager.ts';
import { DocumentFileLocations } from '../src/services/documentFileLocations.ts';
import { createVersionedTestManuscript } from './testManuscriptFixture.ts';
import { useStudioStore } from '../src/app/useStudioStore.ts';
import { createStudioDocumentSessions } from '../src/app/documentSessions.ts';

test('application session manager preserves two pending batches, selection and history without React', () => {
  const a = createVersionedTestManuscript();
  const b = createVersionedTestManuscript();
  b.id = 'synthetic-second-session';
  let state = { hasOpenDocument: true, ...restoredWorkingSession(a) };
  const listeners = new Set<Parameters<DocumentSessionPort['subscribe']>[0]>();
  const update = (next: typeof state) => { const prev = state; state = next; for (const listener of listeners) listener(state, prev); };
  let nextId = 0;
  let checkpoints = 0;
  let persisted;
  const manager = createDocumentSessionManager({
    persist: snapshot => { persisted = snapshot; },
    read: () => state, newId: () => `session-${nextId++}`,
    restore: session => update({ hasOpenDocument: true, ...session }),
    checkpoint: () => { checkpoints++; },
    subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
  });
  const disconnect = manager.connect();
  const pending = (manuscript: typeof a) => ({ baseRevisionId: manuscript.headRevisionId, startedAt: '2026-11-01', updatedAt: '2026-11-01', mixedActors: false, summaries: ['synthetic edit'], events: [{ operation: 'manuscript.title.set' as const, targetId: manuscript.id }] });
  update({ ...state, pendingChangeSet: pending(a), selectedSectionId: 'selection-a' });
  const first = manager.getSnapshot().activeTabId;
  update({ hasOpenDocument: true, ...restoredWorkingSession(b) });
  update({ ...state, pendingChangeSet: pending(b), selectedSectionId: 'selection-b' });
  const second = manager.getSnapshot().activeTabId;
  manager.activate(first);
  assert.equal(state.manuscript.id, a.id);
  assert.deepEqual(state.pendingChangeSet, pending(a));
  assert.equal(state.selectedSectionId, 'selection-a');
  manager.activate(second);
  assert.equal(state.manuscript.id, b.id);
  assert.deepEqual(state.pendingChangeSet, pending(b));
  assert.equal(state.selectedSectionId, 'selection-b');
  assert.deepEqual(persisted, manager.getSnapshot(), 'recovery updates synchronously, before any React effect');
  const recovery = structuredClone(manager.getSnapshot());
  const recovered = createDocumentSessionManager({ read: () => ({ ...state, hasOpenDocument: false }), restore: () => {}, checkpoint: () => {}, subscribe: () => () => {}, newId: () => 'unused' }, recovery);
  assert.deepEqual(recovered.getSnapshot(), recovery);
  manager.close(first);
  assert.equal(manager.getSnapshot().tabs.length, 1);
  assert.equal(state.manuscript.id, b.id);
  assert.equal(checkpoints, 2);
  disconnect();
});

test('real store adapter retains outgoing edits and checkpoint history across a batched open', () => {
  const a = createVersionedTestManuscript();
  const b = createVersionedTestManuscript(); b.id = 'second-store-session';
  useStudioStore.getState().loadManuscript(a);
  const manager = createStudioDocumentSessions(null);
  const stop = manager.connect();
  try {
    useStudioStore.getState().setTitle('First unsaved edit');
    const first = manager.getSnapshot().activeTabId;
    // Exercise an open without an up-front checkpoint, not only the UI's safe path.
    useStudioStore.getState().loadManuscript(b);
    useStudioStore.getState().setTitle('Second unsaved edit');
    const second = manager.getSnapshot().activeTabId;
    manager.activate(first);
    assert.equal(useStudioStore.getState().manuscript.title, 'First unsaved edit');
    assert.ok(useStudioStore.getState().pendingChangeSet);
    manager.activate(second);
    const capturedFirst = manager.getSnapshot().tabs.find(tab => tab.id === first)!;
    assert.equal(capturedFirst.pendingChangeSet, null);
    assert.equal(capturedFirst.manuscript.revisionHistory.revisions.at(-1)?.snapshot.state.title, 'First unsaved edit');
    assert.equal(useStudioStore.getState().manuscript.title, 'Second unsaved edit');
    assert.equal(useStudioStore.getState().pendingChangeSet, null);
  } finally { stop(); useStudioStore.getState().loadManuscript(a); }
});

test('native save-as locations cannot route a different manuscript into the previous file', () => {
  const locations = new DocumentFileLocations();
  locations.set('first', 'content://synthetic/first');
  assert.equal(locations.get('second'), null, 'unbound manuscript must use Save As');
  locations.set('second', 'content://synthetic/second');
  assert.equal(locations.get('first'), 'content://synthetic/first');
  assert.equal(locations.get('second'), 'content://synthetic/second');
  locations.set('second', null);
  assert.equal(locations.get('first'), 'content://synthetic/first');
  locations.clear(); assert.equal(locations.get('first'), null);
});
