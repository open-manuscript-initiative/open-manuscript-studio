import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { useDocumentWorkspaceMode } from '../src/app/documentWorkspaceMode.ts';
import { createBlankManuscript } from '../src/document/createBlankManuscript.ts';
import { toPortableOmiManuscript } from '../src/services/omiPortableFormat.ts';
import { hasPlatformPasskey } from '../src/platform/passkeyCapability.ts';

test('workspace preferences are per document and never change portable bytes/history', () => {
  const manuscript = createBlankManuscript({ kind: 'study', locale: 'en', title: 'Synthetic boundary test' });
  const before = JSON.stringify(toPortableOmiManuscript(manuscript));
  const history = JSON.stringify(manuscript.revisionHistory);
  useDocumentWorkspaceMode.getState().setMode(manuscript.id, 'simple-text');
  useDocumentWorkspaceMode.getState().setMode('other-document', 'scholarly');
  assert.equal(useDocumentWorkspaceMode.getState().modes[manuscript.id], 'simple-text');
  assert.equal(JSON.stringify(toPortableOmiManuscript(manuscript)), before);
  assert.equal(JSON.stringify(manuscript.revisionHistory), history);
});

test('native origins cannot advertise web-origin passkey support', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'location');
  try {
    Object.defineProperty(globalThis, 'location', { configurable: true, value: { protocol: 'tauri:', hostname: 'localhost' } });
    assert.equal(await hasPlatformPasskey(), false);
    Object.defineProperty(globalThis, 'location', { configurable: true, value: { protocol: 'https:', hostname: 'tauri.localhost' } });
    assert.equal(await hasPlatformPasskey(), false);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'location', previous);
    else Reflect.deleteProperty(globalThis, 'location');
  }
});

 test('workspace mode is absent from the OMI schema contract', () => {
  const schema = JSON.parse(readFileSync(new URL('../src/schemas/omi-manuscript-0.3.schema.json', import.meta.url), 'utf8'));
  assert.equal('editorMode' in schema.properties, false);
});
