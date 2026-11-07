import assert from 'node:assert/strict';
import test from 'node:test';
import { closeCurrentDocument } from '../src/app/documentLifecycle.ts';
import { createStudioDocumentSessions } from '../src/app/documentSessions.ts';
import { initializeLastSessionPersistence, resumeLastSessionPersistence } from '../src/app/lastSessionPersistence.ts';
import { useStudioStore } from '../src/app/useStudioStore.ts';
import { createUser } from '../src/model/user.ts';
import { getCurrentUser, useAuthStore } from '../src/store/authStore.ts';
import { createVersionedTestManuscript } from './testManuscriptFixture.ts';

test('closing the final web/native document keeps authentication and clears only document recovery', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const storage = new Map([['omi_native_session_token', 'synthetic-native-session']]);
  let reloads = 0;
  let deletions = 0;
  let saved: unknown;
  let failDelete = false;
  const database = {
    transaction: () => {
      const transaction = {
        oncomplete: () => {},
        objectStore: () => ({
          get: () => {
            const request = { result: undefined, onsuccess: () => {} };
            queueMicrotask(() => request.onsuccess()); return request;
          },
          put: (value: unknown) => { saved = value; queueMicrotask(() => transaction.oncomplete()); },
          delete: () => {
            if (failDelete) throw new Error('synthetic storage failure');
            saved = undefined; deletions++; queueMicrotask(() => transaction.oncomplete());
          },
        }),
      };
      return transaction;
    },
  };
  const localStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value); },
    removeItem: (key: string) => { storage.delete(key); },
    clear: () => assert.fail('Document close must not clear account credentials'),
  };
  const browserWindow: Record<string, unknown> = { localStorage, addEventListener: () => {}, location: { reload: () => { reloads++; } } };
  const previousAuth = useAuthStore.getState();
  const previousStudio = useStudioStore.getState();
  const globals = {
    window: browserWindow,
    document: { addEventListener: () => {} },
    indexedDB: { open: () => {
      const request = { result: database, onsuccess: () => {} };
      queueMicrotask(() => request.onsuccess()); return request;
    } },
  };
  for (const [key, value] of Object.entries(globals)) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    t.after(() => { if (previous) Object.defineProperty(globalThis, key, previous); else Reflect.deleteProperty(globalThis, key); });
  }
  t.after(() => { useAuthStore.setState(previousAuth); useStudioStore.setState(previousStudio); });
  const user = createUser({ email: 'synthetic@example.test', fullName: 'Synthetic user' });
  const session = { userId: user.id, createdAt: new Date().toISOString(), lastActivityAt: new Date().toISOString() };
  useAuthStore.setState({ users: [user], session, isInitialized: true });
  await initializeLastSessionPersistence();

  for (const native of [false, true]) {
    if (native) browserWindow.__TAURI_INTERNALS__ = {};
    else delete browserWindow.__TAURI_INTERNALS__;
    const a = createVersionedTestManuscript();
    const b = createVersionedTestManuscript(); b.id = `${a.id}-second`;
    useStudioStore.getState().loadManuscript(a);
    const manager = createStudioDocumentSessions(null);
    const stop = manager.connect();
    try {
      useStudioStore.getState().setTitle('First pending edit');
      useStudioStore.getState().loadManuscript(b);
      useStudioStore.getState().setTitle('Second pending edit');
      const before = deletions;
      await closeCurrentDocument();
      assert.equal(useStudioStore.getState().hasOpenDocument, true);
      assert.equal(useStudioStore.getState().manuscript.id, a.id);
      assert.equal(useStudioStore.getState().manuscript.title, 'First pending edit');
      assert.equal(manager.getSnapshot().tabs.length, 1);
      assert.equal(deletions, before, 'Closing one of several documents must preserve other recovery');
      assert.equal(storage.get('omi:document-closed'), undefined);

      await closeCurrentDocument();
      assert.equal(useStudioStore.getState().hasOpenDocument, false);
      assert.equal(useStudioStore.getState().pendingChangeSet, null);
      assert.equal(useStudioStore.getState().selectedSectionId, null);
      assert.deepEqual(manager.getSnapshot(), { tabs: [], activeTabId: '' });
      assert.equal(saved, undefined);
      assert.equal(deletions, before + 1);
      assert.equal(storage.get('omi:document-closed'), '1');
      assert.equal(useAuthStore.getState().session, session);
      assert.equal(getCurrentUser(useAuthStore.getState())?.id, user.id);
      assert.equal(storage.get('omi_native_session_token'), 'synthetic-native-session');
      assert.equal(reloads, 0);
      t.mock.timers.tick(3000);
      await Promise.resolve();
      assert.equal(useStudioStore.getState().hasOpenDocument, false, 'No delayed checkpoint can reopen a closed document');
      await closeCurrentDocument();
      assert.equal(deletions, before + 1, 'Empty-workspace close is idempotent');

      const next = createVersionedTestManuscript(); next.id = `${a.id}-new`;
      useStudioStore.getState().loadManuscript(next);
      assert.deepEqual(manager.getSnapshot().tabs.map((tab) => tab.manuscriptId), [next.id]);
      assert.equal(storage.get('omi:document-closed'), undefined);
      await resumeLastSessionPersistence();
      assert.equal((saved as { manuscript: { id: string } }).manuscript.id, next.id);

      failDelete = true;
      t.mock.method(console, 'warn', () => {});
      await closeCurrentDocument();
      failDelete = false;
      assert.equal(useStudioStore.getState().hasOpenDocument, false);
      assert.equal(useAuthStore.getState().session, session);
      assert.equal(storage.get('omi:document-closed'), '1');
      assert.equal(reloads, 0, 'Recovery failure must not force a new authentication bootstrap');
    } finally { stop(); }
  }
});
