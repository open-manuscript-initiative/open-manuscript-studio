import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildNativeAuthReturnUrl,
  decodeOrcidStateReturnPath,
  encodeOrcidStateReturnPath,
  normalizeNativeReturnOrigin,
} from '../server/src/integrations/nativeAuthHandoff.ts';

test('native ORCID handoff accepts only registered Studio return targets', () => {
  assert.equal(normalizeNativeReturnOrigin('tauri://localhost'), 'tauri://localhost');
  assert.equal(normalizeNativeReturnOrigin('http://tauri.localhost/'), 'http://tauri.localhost');
  assert.equal(normalizeNativeReturnOrigin('https://tauri.localhost'), 'https://tauri.localhost');
  assert.equal(normalizeNativeReturnOrigin('openmanuscript://auth'), 'openmanuscript://auth');
  assert.equal(normalizeNativeReturnOrigin('https://studio.openmanuscript.org'), undefined);
  assert.equal(normalizeNativeReturnOrigin('http://tauri.localhost.evil.example'), undefined);
  assert.equal(normalizeNativeReturnOrigin('openmanuscript://attacker'), undefined);
});

test('native ORCID return metadata preserves nonce and validated app origin', () => {
  const expectedNonceHash = 'a'.repeat(64);
  const encoded = encodeOrcidStateReturnPath(
    expectedNonceHash,
    'http://tauri.localhost',
  );

  assert.deepEqual(decodeOrcidStateReturnPath(encoded), {
    expectedNonceHash,
    nativeReturnOrigin: 'http://tauri.localhost',
  });
});

test('legacy ORCID nonce-only state remains compatible', () => {
  const expectedNonceHash = 'b'.repeat(64);
  assert.deepEqual(
    decodeOrcidStateReturnPath(`oidc-nonce:${expectedNonceHash}`),
    { expectedNonceHash },
  );
});

test('invalid native return metadata cannot create an open redirect', () => {
  const expectedNonceHash = 'c'.repeat(64);
  const encoded = `oidc-nonce:${expectedNonceHash}|native-return:${encodeURIComponent('https://attacker.example')}`;
  assert.deepEqual(decodeOrcidStateReturnPath(encoded), { expectedNonceHash });
});

test('native handoff code is returned in the local app URL fragment', () => {
  const url = buildNativeAuthReturnUrl('http://tauri.localhost', {
    handoffCode: 'one-time-code',
  });
  assert.equal(url, 'http://tauri.localhost/#nativeAuthCode=one-time-code');
  assert.equal(new URL(url).search, '');
});

test('mobile handoff code is returned through the registered app scheme', () => {
  const url = buildNativeAuthReturnUrl('openmanuscript://auth', {
    handoffCode: 'mobile-one-time-code',
  });
  assert.equal(url, 'openmanuscript://auth/#nativeAuthCode=mobile-one-time-code');
  assert.equal(new URL(url).search, '');
});

test('native ORCID errors return to the local Tauri application', () => {
  assert.equal(
    buildNativeAuthReturnUrl('tauri://localhost', { errorCode: 'orcid_signin_failed' }),
    'tauri://localhost/#authError=orcid_signin_failed',
  );
});
