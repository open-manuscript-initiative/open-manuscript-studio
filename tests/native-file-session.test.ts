import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { createVersionedTestManuscript } from './testManuscriptFixture.ts';
import { serializeOmiJson } from '../src/services/exportOmi.ts';
const a = createVersionedTestManuscript();
const b = createVersionedTestManuscript(); b.id = 'synthetic-native-b';
let selected = 'synthetic-a.omi.json';
const saved: Array<{ path: string; raw: string }> = [];
mock.module('@tauri-apps/plugin-dialog', { namedExports: { open: async () => selected, save: async () => selected } });
mock.module('@tauri-apps/plugin-fs', { namedExports: {
  readTextFile: async (path: string) => serializeOmiJson(path === 'synthetic-a.omi.json' ? a : b),
  writeTextFile: async (path: string, raw: string) => { saved.push({ path, raw }); },
} });
const { openLocalManuscript, saveLocalManuscript, clearCurrentManuscriptFilePath, getCurrentManuscriptFilePath } = await import('../src/services/nativeManuscriptFile.ts');
test('actual native IO saves the selected manuscript to its own path after another file opens', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { value: { __TAURI_INTERNALS__: {} }, configurable: true });
  try {
    clearCurrentManuscriptFilePath();
    await openLocalManuscript(); selected = 'synthetic-b.omi.json'; await openLocalManuscript();
    await saveLocalManuscript(a);
    await saveLocalManuscript(b);
    assert.deepEqual(saved.map(item => item.path), ['synthetic-a.omi.json', 'synthetic-b.omi.json']);
    assert.equal(JSON.parse(saved[0]!.raw).id, a.id);
    assert.equal(JSON.parse(saved[1]!.raw).id, b.id);
    assert.equal(getCurrentManuscriptFilePath('unopened'), null);
    clearCurrentManuscriptFilePath();
    assert.equal(getCurrentManuscriptFilePath(a.id), null);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
