import assert from 'node:assert/strict';
import test from 'node:test';
import { initializeLastSessionPersistence, getRestoredDesktopSession } from '../src/app/lastSessionPersistence.ts';
import { useStudioStore } from '../src/app/useStudioStore.ts';
import { createManuscriptFromOjsLaunch } from '../src/integrations/ojs/importOjsLaunch.ts';

test('a delayed IndexedDB snapshot cannot replace an OJS article imported during startup', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const saved = structuredClone(useStudioStore.getState().manuscript);
  let releaseRead!: () => void;
  let readStarted!: () => void;
  const reading = new Promise<void>((resolve) => { readStarted = resolve; });
  const database = {
    transaction: () => ({
      objectStore: () => ({
        get: () => {
          const request = { result: { version: 1, manuscript: saved }, onsuccess: () => {} };
          releaseRead = () => request.onsuccess();
          readStarted();
          return request;
        },
      }),
    }),
  };
  const globals = {
    indexedDB: {
      open: () => {
        const request = { result: database, onsuccess: () => {} };
        queueMicrotask(() => request.onsuccess());
        return request;
      },
    },
    window: { localStorage: { getItem: () => null }, addEventListener: () => {} },
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

  const restoring = initializeLastSessionPersistence();
  await reading;
  const article = createManuscriptFromOjsLaunch({
    protocol: 'omi-integration/1', profile: 'omi-integration/1/ojs',
    submission: { externalId: '42', title: { en: 'First launch article' } },
    sourceDocument: { kind: 'docx', paragraphs: [{ text: 'Imported article body.' }] },
  });
  assert.ok(article);
  useStudioStore.getState().loadManuscript(article);
  releaseRead();
  await restoring;
  assert.equal(useStudioStore.getState().manuscript.id, article.id);
  assert.equal(useStudioStore.getState().manuscript.title, 'First launch article');
  assert.equal(getRestoredDesktopSession(), null);
});
