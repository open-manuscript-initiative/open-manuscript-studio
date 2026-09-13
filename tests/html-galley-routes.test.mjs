import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import express from '../server/node_modules/express/index.js';

const connectionId = '20000000-0000-4000-8000-000000000002';
const destination = 'https://journal.example.test/index.php/demo';
let enabled = true, provider = 'ojs', remoteStatus = 200, trusted = true;
let calls = [];
mock.module(new URL('../server/dist/lib/prisma.js', import.meta.url).href, { namedExports: { prisma: {
  userIntegration: { findFirst: async ({ where }) => where.id === connectionId && where.userId === 'editor' && where.enabled === enabled && where.providerId === provider
    ? { id: connectionId, config: { baseUrl: destination } } : null },
} } });
mock.module(new URL('../server/dist/middleware/requireSession.js', import.meta.url).href, { namedExports: {
  requireSession: (req, res, next) => { if (!req.headers['x-test-user']) return res.sendStatus(401); req.authUserId = req.headers['x-test-user']; next(); },
} });
mock.module(new URL('../server/dist/integrations/security/trustedRemoteUrl.js', import.meta.url).href, { namedExports: {
  assertTrustedIntegrationUrl: async (url) => { if (!trusted) throw new Error('Untrusted destination'); return new URL(url); },
} });
const { directSubmissionRouter } = await import('../server/dist/routes/directSubmissionRoutes.js');
const app = express(); app.use(express.json({ limit: '25mb' })); app.use(directSubmissionRouter);
const server = await new Promise((resolve) => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
const originalFetch = globalThis.fetch;
mock.method(globalThis, 'fetch', async (url, init) => {
  if (!String(url).startsWith(destination)) return originalFetch(url, init);
  calls.push({ url: String(url), init, body: JSON.parse(init.body) });
  return new Response(JSON.stringify(remoteStatus === 200 ? { protocol: 'omi-html-galley/1', submissionId: 12, publicationId: 13, galleyId: 14, published: false }
    : { error: { message: 'Rejected editorial-test-key' } }), { status: remoteStatus });
});
const data = { action: 'inspect', manuscriptId: 'demo-study', submissionId: 12, apiKey: 'editorial-test-key' };
const transfer = { ...data, action: 'transfer', publicationId: 13, locale: 'hu', genreId: 2, html: '<!doctype html><html><head><title>Minta</title></head><body>Minta</body></html>', confirmed: true };
async function request(body = data, user = 'editor') {
  const response = await originalFetch(`http://127.0.0.1:${server.address().port}/integrations/connections/${connectionId}/html-galley`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(user ? { 'x-test-user': user } : {}) }, body: JSON.stringify(body),
  });
  return { status: response.status, cache: response.headers.get('cache-control'), body: await response.json().catch(() => null) };
}
test('HTML transfer proxy authorization and protocol', async (t) => {
  t.after(() => server.close());
  await t.test('requires a session and the owner’s enabled OJS connection', async () => {
    assert.equal((await request(data, null)).status, 401);
    assert.equal((await request(data, 'another-user')).status, 404);
    enabled = false; assert.equal((await request()).status, 404); enabled = true;
    provider = 'omp'; assert.equal((await request()).status, 404); provider = 'ojs';
    assert.equal(calls.length, 0);
  });
  await t.test('rejects missing confirmation, version, key and untrusted destinations', async () => {
    for (const bad of [{ ...transfer, confirmed: undefined }, { ...transfer, publicationId: undefined }, { ...transfer, apiKey: '' }]) assert.equal((await request(bad)).status, 400);
    trusted = false; assert.equal((await request()).status, 502); trusted = true;
    assert.equal(calls.length, 0);
  });
  await t.test('only forwards the editor key as a Bearer header to the fixed endpoint', async () => {
    const result = await request();
    assert.equal(result.status, 200); assert.equal(result.cache, 'no-store');
    assert.equal(result.body.target.publicationId, 13);
    assert.equal(calls[0].url, `${destination}/api/v1/omi-integration/html-galley`);
    assert.equal(calls[0].init.headers.get('Authorization'), 'Bearer editorial-test-key');
    assert.equal(calls[0].init.redirect, 'error');
    assert.equal(calls[0].body.apiKey, undefined);
    assert.equal((await request(transfer)).body.receipt.published, false);
  });
  await t.test('preserves publication conflict and permission errors without exposing keys', async () => {
    for (const status of [403, 409, 422]) {
      remoteStatus = status;
      const result = await request(transfer);
      assert.equal(result.status, status);
      assert.doesNotMatch(JSON.stringify(result.body), /editorial-test-key/);
    }
  });
});
