import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import express from '../server/node_modules/express/index.js';

// Exercise production middleware over HTTP, replacing only the session store.
mock.module(new URL('../server/dist/services/authService.js', import.meta.url).href, {
  namedExports: {
    getUserIdForSession: async (token) => ['cookie-ok', 'bearer-ok'].includes(token) ? 'synthetic-user' : null,
  },
});
const { requireSession } = await import('../server/dist/middleware/requireSession.js');
const { cookieOriginGuard } = await import('../server/dist/middleware/cookieOriginGuard.js');

test('Origin, bearer validation and session checking precede JSON decoding over HTTP', async (t) => {
  let parses = 0;
  const app = express();
  app.use(cookieOriginGuard(new Set(['https://studio.example.org'])));
  app.post('/document', requireSession, express.json({
    verify() { parses += 1; },
  }), (request, response) => response.json({ userId: request.authUserId }));
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  const url = `http://127.0.0.1:${server.address().port}/document`;
  async function send(headers = {}, body = '{invalid-json') {
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body });
  }

  for (const origin of [undefined, 'null', 'https://other.example.org']) {
    const response = await send({ Cookie: 'omi_session=cookie-ok', ...(origin ? { Origin: origin } : {}) });
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error.code, 'COOKIE_ORIGIN_FORBIDDEN');
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  assert.equal(parses, 0, 'Origin rejection must precede parsing even malformed JSON');

  const anonymous = await send();
  assert.equal(anonymous.status, 401);
  await anonymous.arrayBuffer();
  assert.equal(parses, 0, 'Missing authentication must precede parsing');

  const invalidBearer = await send({
    Cookie: 'omi_session=cookie-ok', Authorization: 'Bearer invalid', 'X-OMI-Native-Client': '1',
  });
  assert.equal(invalidBearer.status, 401, 'Native exception must not authenticate or fall back to a valid cookie');
  await invalidBearer.arrayBuffer();
  assert.equal(parses, 0);

  const markerOnly = await send({ Cookie: 'omi_session=cookie-ok', 'X-OMI-Native-Client': '1' });
  assert.equal(markerOnly.status, 403);
  await markerOnly.arrayBuffer();
  assert.equal(parses, 0);

  for (const headers of [
    { Cookie: 'omi_session=cookie-ok', Origin: 'https://studio.example.org' },
    { Cookie: 'omi_session=cookie-ok', Authorization: 'Bearer bearer-ok', 'X-OMI-Native-Client': '1' },
    { Authorization: 'Bearer bearer-ok' },
  ]) {
    const response = await send(headers, '{}');
    assert.equal(response.status, 200);
    assert.equal((await response.json()).userId, 'synthetic-user');
  }
  assert.equal(parses, 3, 'Legitimate browser, native and cookie-free bearer writes remain usable');
});
