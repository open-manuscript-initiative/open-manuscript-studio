import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createFileStateStore } from '../file-state-store.mjs';

test('file store atomically persists and reloads binary state', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'omi-collaboration-'));
  try {
    const store = createFileStateStore(directory, 'synthetic-room');
    const update = Buffer.from([0, 1, 2, 255]);
    await store.save(update);
    assert.deepEqual(await store.load(), update);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('file store returns null when there is no saved room', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'omi-collaboration-'));
  try {
    assert.equal(await createFileStateStore(directory, 'room').load(), null);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
