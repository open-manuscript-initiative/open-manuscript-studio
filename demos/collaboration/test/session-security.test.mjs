import assert from 'node:assert/strict';
import test from 'node:test';
import { createSessionToken, safeEqualSecret, verifySessionToken, ROOM_ID } from '../session-security.mjs';

const secret = 'test-signing-secret-with-32-bytes-minimum';

test('session token is signed, room scoped, and expires after two hours', () => {
  const now = 1_700_000_000_000;
  const token = createSessionToken('Ada Lovelace', secret, now);
  assert.equal(verifySessionToken(token, secret, now)?.room, ROOM_ID);
  assert.equal(verifySessionToken(token, secret, now)?.name, 'Ada Lovelace');
  assert.equal(verifySessionToken(token, secret, now + 7_200_000), null);
  assert.equal(verifySessionToken(token + 'x', secret, now), null);
});

test('display name is normalized and short names are rejected', () => {
  const token = createSessionToken('  Ada   Lovelace ', secret);
  assert.equal(verifySessionToken(token, secret)?.name, 'Ada Lovelace');
  assert.throws(() => createSessionToken('A', secret));
});

test('shared access code is compared without accepting empty values', () => {
  assert.equal(safeEqualSecret(secret, secret), true);
  assert.equal(safeEqualSecret(secret, 'wrong'), false);
  assert.equal(safeEqualSecret(secret, ''), false);
});
