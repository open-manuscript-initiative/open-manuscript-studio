import assert from 'node:assert/strict';
import test from 'node:test';
import { initializeLastSessionPersistence, resumeLastSessionPersistence } from '../src/app/lastSessionPersistence.ts';
import { useStudioStore } from '../src/app/useStudioStore.ts';
import { createBlankManuscript } from '../src/document/createBlankManuscript.ts';

test('startup without a saved document does not persist the placeholder; explicit creation does', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const writes: unknown[] = [];
  const database = {
    transaction: () => {
      const transaction = {
        oncomplete: () => {},
        objectStore: () => ({
          get: () => {
            const request = { result: undefined, onsuccess: () => {} };
            queueMicrotask(() => request.onsuccess());
            return request;
          },
          put: (value: unknown) => {
            writes.push(value);
            queueMicrotask(() => transaction.oncomplete());
          },
        }),
      };
      return transaction;
    },
  };
  const globals = {
    indexedDB: {
      open: () => {
        const request = { result: database, onsuccess: () => {} };
        queueMicrotask(() => request.onsuccess());
        return request;
      },
    },
    window: { localStorage: { getItem: () => null, removeItem: () => {} }, addEventListener: () => {} },
    document: { addEventListener: () => {} },
  };
  for (const [key, value] of Object.entries(globals)) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    t.after(() => {
      if (previous) Object.defineProperty(globalThis, key, previous);
      else Reflect.deleteProperty(globalThis, key);
    });
  }
  assert.equal(useStudioStore.getState().hasOpenDocument, false);
  await initializeLastSessionPersistence();
  await resumeLastSessionPersistence();
  assert.equal(writes.length, 0);
  assert.equal(useStudioStore.getState().hasOpenDocument, false);

  const manuscript = createBlankManuscript({ kind: 'study', locale: 'en' });
  useStudioStore.getState().loadManuscript(manuscript);
  assert.equal(useStudioStore.getState().hasOpenDocument, true);
  await resumeLastSessionPersistence();
  assert.equal(writes.length, 1);
  assert.equal((writes[0] as { manuscript: { id: string } }).manuscript.id, manuscript.id);
});
