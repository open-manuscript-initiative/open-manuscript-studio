import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeNativeStudioServerOrigin } from '../src/services/studioServer.ts';

test('native Studio server addresses normalize to an origin', () => {
  assert.equal(
    normalizeNativeStudioServerOrigin(' https://studio.example.org/ '),
    'https://studio.example.org',
  );
  assert.equal(
    normalizeNativeStudioServerOrigin('http://127.0.0.1:8080'),
    'http://127.0.0.1:8080',
  );
});

test('native Studio server addresses require HTTPS outside localhost', () => {
  for (const value of [
    'http://studio.example.org',
    'https://user:secret@studio.example.org',
    'https://studio.example.org/studio',
    'https://studio.example.org/?next=/',
    'not a url',
    '',
  ]) {
    assert.throws(() => normalizeNativeStudioServerOrigin(value), { name: 'Error' });
  }
});
