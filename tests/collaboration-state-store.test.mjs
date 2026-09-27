import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import * as Y from '../server/node_modules/yjs/dist/yjs.mjs';

let persisted = null;
const calls = [];
mock.module(new URL('../server/dist/lib/prisma.js', import.meta.url).href, {
  namedExports: {
    prisma: {
      collaborativeDocumentState: {
        findUnique: async ({ where }) => where.documentId === 'manuscript-123' && persisted
          ? { state: Buffer.from(persisted) }
          : null,
        upsert: async ({ where, create, update }) => {
          calls.push({ where, create, update });
          persisted = Buffer.from(create.state ?? update.state);
          return { documentId: where.documentId, state: persisted };
        },
      },
    },
  },
});
const { postgresCollaborationStateStore } = await import('../server/dist/collaboration/collaborationStateStore.js');

test('PostgreSQL state adapter restores Yjs documents from durable binary snapshots', async () => {
  persisted = null;
  const original = new Y.Doc();
  original.getText('manuscript').insert(0, 'Shared text survives a process restart.');
  const snapshot = Y.encodeStateAsUpdate(original);
  await postgresCollaborationStateStore.save('manuscript-123', snapshot);
  original.destroy();

  const restored = new Y.Doc();
  const loaded = await postgresCollaborationStateStore.load('manuscript-123');
  assert.ok(loaded instanceof Uint8Array);
  Y.applyUpdate(restored, loaded);
  assert.equal(restored.getText('manuscript').toString(), 'Shared text survives a process restart.');
  assert.equal(calls.at(-1).where.documentId, 'manuscript-123');
  restored.destroy();
});

test('state adapter returns null for an uninitialized collaboration document', async () => {
  persisted = null;
  assert.equal(await postgresCollaborationStateStore.load('manuscript-123'), null);
});
