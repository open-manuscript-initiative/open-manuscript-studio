import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeNativeStudioServerOrigin } from '../src/services/studioServer.ts';
import { parseStudioServerDirectory } from '../src/services/studioServerDirectory.ts';
import { NATIVE_SESSION_STORAGE_KEY, persistNativeServerSelection } from '../src/platform/nativeServerSelection.ts';

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

test('native server selection clears the prior bearer token before writing the new endpoint', () => {
  const events: string[] = [];
  const storage = {
    getItem: () => null,
    setItem: (key: string, value: string) => { events.push(`set:${key}:${value}`); },
    removeItem: (key: string) => { events.push(`remove:${key}`); },
  };
  persistNativeServerSelection('https://other.example.org', storage);
  assert.equal(events[0], `remove:${NATIVE_SESSION_STORAGE_KEY}`);
  assert.match(events[1] ?? '', /^set:omi_native_studio_api_origin:https:\/\/other\.example\.org$/);
});

test('native server selection fails closed if bearer token removal fails', () => {
  let wroteOrigin = false;
  const storage = {
    getItem: () => null,
    setItem: () => { wroteOrigin = true; },
    removeItem: () => { throw new Error('storage denied'); },
  };
  assert.throws(() => persistNativeServerSelection('https://other.example.org', storage), /storage denied/);
  assert.equal(wroteOrigin, false);
});

test('server directory entries provide normalized HTTPS origins for one-click selection', () => {
  assert.deepEqual(
    parseStudioServerDirectory({
      version: 1,
      servers: [{
        id: 'community-server',
        name: 'Community Studio',
        origin: ' https://studio.example.org/ ',
      }],
    }),
    [{
      id: 'community-server',
      name: 'Community Studio',
      origin: 'https://studio.example.org',
      availability: 'unknown',
    }],
  );
});


test('live directory status is preserved so the chooser can disable offline servers', () => {
  assert.deepEqual(
    parseStudioServerDirectory({
      servers: [
        { id: 'online-server', name: 'Online Studio', origin: 'https://online.example.org', status: 'online' },
        { id: 'offline-server', name: 'Offline Studio', origin: 'https://offline.example.org', status: 'offline' },
      ],
    }),
    [
      { id: 'online-server', name: 'Online Studio', origin: 'https://online.example.org', availability: 'online' },
      { id: 'offline-server', name: 'Offline Studio', origin: 'https://offline.example.org', availability: 'offline' },
    ],
  );
});

test('server directory rejects duplicate origins and invalid endpoints', () => {
  assert.throws(() => parseStudioServerDirectory({
    servers: [
      { id: 'server-one', name: 'One', origin: 'https://studio.example.org' },
      { id: 'server-two', name: 'Two', origin: 'https://studio.example.org/' },
    ],
  }), /duplicate entry/);

  assert.throws(() => parseStudioServerDirectory({
    servers: [{ id: 'insecure', name: 'Insecure', origin: 'http://studio.example.org' }],
  }), /HTTPS/);
});
