import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { rejectsCookieOrigin } from '../server/src/middleware/cookieOriginGuard.ts';

const allowedOrigins = new Set([
  'https://studio.openmanuscript.org',
  'tauri://localhost',
  'http://tauri.localhost',
  'https://tauri.localhost',
]);

function rejects(input: {
  method: string;
  path?: string;
  cookie?: string;
  origin?: string;
  authorization?: string;
  nativeClient?: string;
  fetchSite?: string;
}) {
  return rejectsCookieOrigin({ ...input, allowedOrigins });
}

test('cookie-authenticated mutations reject missing, null and untrusted origins', () => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    for (const origin of [undefined, 'null', 'https://evil.example', 'https://subdomain.openmanuscript.org', 'http://studio.openmanuscript.org']) {
      assert.equal(rejects({ method, cookie: 'other=1; omi_session=opaque; theme=dark', origin }), true, method + ': ' + origin);
    }
  }
});

test('legitimate same-origin cookie writes are allowed, including tauri browser contexts', () => {
  for (const origin of allowedOrigins) {
    assert.equal(rejects({ method: 'POST', cookie: 'omi_session=opaque', origin, fetchSite: 'same-origin' }), false, origin);
  }
  assert.equal(rejects({ method: 'PATCH', cookie: 'omi_session=opaque', origin: 'https://studio.openmanuscript.org', fetchSite: 'cross-site' }), true);
});

test('read-only requests and requests without the session cookie are unaffected', () => {
  for (const method of ['GET', 'HEAD', 'OPTIONS']) {
    assert.equal(rejects({ method, cookie: 'omi_session=opaque', origin: 'https://evil.example' }), false, method);
  }
  for (const cookie of [undefined, '', 'other=1', 'xomi_session=wrong']) {
    assert.equal(rejects({ method: 'POST', cookie, origin: undefined }), false);
  }
});

test('Tauri bearer requests and server-to-server callbacks remain permitted', () => {
  assert.equal(rejects({ method: 'POST', cookie: 'omi_session=opaque', origin: undefined, nativeClient: '1', authorization: 'Bearer token' }), false);
  assert.equal(rejects({ method: 'POST', cookie: 'omi_session=opaque', origin: 'https://evil.example', nativeClient: '1' }), true);
  assert.equal(rejects({ method: 'POST', cookie: undefined, origin: undefined }), false);
});

test('API rate limiting and CSRF checking run before the first large JSON parser', () => {
  const source = readFileSync(new URL('../server/src/app.ts', import.meta.url), 'utf8');
  const firstLargeParser = source.indexOf("app.use('/api/integrations/connections/:connectionId/direct-submission', requireSession, express.json");
  assert.ok(firstLargeParser > 0);
  for (const middleware of [
    'app.use(apiRateLimit);',
    "app.use('/api/auth', authRateLimit);",
    "app.use('/api/v1/auth', authRateLimit);",
    "app.use('/integrations', integrationRateLimit);",
    'app.use(cookieOriginGuard(allowedOrigins));',
  ]) {
    const index = source.indexOf(middleware);
    assert.ok(index > 0 && index < firstLargeParser, middleware);
  }
  assert.equal(source.match(/app\.use\(apiRateLimit\);/g)?.length, 1);
});

test('large document parsers authenticate before JSON decode and keep the OMP signed callback separate', () => {
  const source = readFileSync(new URL('../server/src/app.ts', import.meta.url), 'utf8');
  for (const route of [
    '/api/integrations/connections/:connectionId/direct-submission',
    '/api/integrations/connections/:connectionId/publication-artifact',
    '/api/native-editorial/submissions',
    '/api/publication/render/pdf',
    '/api/publication/newsletter',
    '/api/v1/publications/web',
    '/api/publication/validate/jats',
    '/api/references/library',
    '/api/collaboration/documents',
  ]) {
    assert.ok(source.includes("app.use('" + route + "', requireSession, express.json"), route);
  }
  assert.ok(source.includes(
    "app.use('/integrations/omp/native/author/:contextId/revision', express.json"
  ));
});

test('one-time HMAC-signed PKP review launch endpoints preserve Origin-less server callbacks', () => {
  for (const path of ['/integrations/ojs/review/launch', '/integrations/omp/review/launch']) {
    assert.equal(rejects({ method: 'POST', path, cookie: 'omi_session=opaque' }), false, path);
    assert.equal(rejects({ method: 'POST', path: path + '/other', cookie: 'omi_session=opaque' }), true);
    assert.equal(rejects({ method: 'DELETE', path, cookie: 'omi_session=opaque' }), true);
  }
});
