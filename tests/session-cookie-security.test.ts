import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { readOmiSessionCookie } from '../server/src/middleware/sessionCookie.ts';

test('accepts an ordinary opaque Studio session token and ignores unrelated cookies', () => {
  const value = 'Abcdef1234_-xyzTEST';
  assert.equal(readOmiSessionCookie('theme=dark; omi_session=' + value + '; other=1'), value);
  assert.equal(readOmiSessionCookie('other=1; xomi_session=' + value), undefined);
  assert.equal(readOmiSessionCookie(undefined), undefined);
  assert.equal(readOmiSessionCookie('theme=dark'), undefined);
  assert.equal(readOmiSessionCookie('omi_session='), undefined);
});

test('does not throw for malformed or oversized cookie values', () => {
  for (const value of ['%', '%E0%A4%A', '%ZZ', '%', '%EF%BF', 'x'.repeat(513)]) {
    assert.doesNotThrow(() => readOmiSessionCookie('omi_session=' + value));
    assert.equal(readOmiSessionCookie('omi_session=' + value), undefined);
  }
  assert.equal(readOmiSessionCookie('omi_session=' + 'x'.repeat(512)), 'x'.repeat(512));
});

test('all authentication and admin route entry points use one defensive cookie parser', () => {
  for (const path of [
    'server/src/middleware/requireSession.ts',
    'server/src/routes/authRoutes.ts',
    'server/src/routes/authorSignatureRoutes.ts',
    'server/src/routes/linkedIdentityRoutes.ts',
    'server/src/routes/federatedAuthRoutes.ts',
    'server/src/routes/oidcProviderRoutes.ts',
    'server/src/routes/centralAdminRoutes.ts',
    'server/src/routes/institutionalProfileRoutes.ts',
  ]) {
    const source = readFileSync(new URL('../' + path, import.meta.url), 'utf8');
    assert.match(source, /import \{ readOmiSessionCookie(?: as readSessionCookie)? \} from/);
    assert.doesNotMatch(source, /decodeURIComponent\(rest\.join\('= '\)\)/);
    assert.doesNotMatch(source, /return decodeURIComponent\(rest\.join\('='\)\)/);
  }
});
