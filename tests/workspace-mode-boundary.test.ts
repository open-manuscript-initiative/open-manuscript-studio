import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { hasPlatformPasskey } from '../src/platform/passkeyCapability.ts';

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

test('editor mode is absent from the OMI schema contract', () => {
  const schema = JSON.parse(readFileSync(new URL('../src/schemas/omi-manuscript-0.3.schema.json', import.meta.url), 'utf8'));
  assert.equal('editorMode' in schema.properties, false);
});
