import assert from 'node:assert/strict';
import { after, mock, test } from 'node:test';
import express from '../server/node_modules/express/index.js';

const httpFetch = globalThis.fetch;
const accounts = new Map();
const providerCalls = [];
const audits = [];
let enabled = ['org.omi.critical-text-edition'];
let active = [...enabled];
let nextId = 42;
let refreshWait = null;
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1ioAAAAASUVORK5CYII=';
const masterKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

mock.module(new URL('../server/dist/config/env.js', import.meta.url).href, { namedExports: { env: {
  INTEGRATION_MASTER_KEY: masterKey, TRANSKRIBUS_API_ORIGIN: 'https://api.transkribus.org',
  get STUDIO_ENABLED_MODULES() { return enabled; },
} } });
mock.module(new URL('../server/dist/lib/prisma.js', import.meta.url).href, { namedExports: { prisma: {
  studioModulePreference: { findUnique: async () => ({ activeModuleIds: active }) },
  userIntegration: {
    findUnique: async ({ where }) => accounts.get(where.userId_providerId_connectionKey.userId) ?? null,
    upsert: async ({ where, create, update }) => {
      const key = where.userId_providerId_connectionKey.userId;
      const account = accounts.get(key);
      const result = account ? { ...account, ...update } : { id: 'connection-' + key, ...create };
      accounts.set(key, result); return result;
    },
    deleteMany: async ({ where }) => ({ count: Number(accounts.delete(where.userId)) }),
    updateMany: async ({ where, data }) => {
      const account = accounts.get(where.userId);
      if (!account || account.id !== where.id || account.encryptedSecret !== where.encryptedSecret) return { count: 0 };
      accounts.set(where.userId, { ...account, ...data }); return { count: 1 };
    },
  },
} } });
mock.module(new URL('../server/dist/services/studioModuleAuditService.js', import.meta.url).href,
  { namedExports: { writeStudioModuleAuditEvent: async event => { audits.push(event); } } });
mock.module(new URL('../server/dist/middleware/requireSession.js', import.meta.url).href,
  { namedExports: { requireSession: (req, res, next) => {
    if (!req.headers['x-test-session']) { res.sendStatus(401); return; }
    req.authUserId = req.headers['x-test-session']; next();
  } } });

mock.method(globalThis, 'fetch', async (input, init) => {
  const url = new URL(String(input));
  providerCalls.push({ url: url.toString(), method: init?.method, body: init?.body, headers: init?.headers });
  assert.equal(init?.redirect, 'error');
  if (url.pathname.endsWith('/token')) {
    const form = init.body;
    assert.equal(form.get('client_id'), 'processing-api-client');
    if (form.get('grant_type') === 'refresh_token' && refreshWait) await refreshWait;
    return Response.json({ access_token: 'SYNTHETIC-ACCESS-TOKEN', refresh_token: 'SYNTHETIC-REFRESH-TOKEN', expires_in: 300 });
  }
  if (url.pathname.endsWith('/logout')) return new Response(null, { status: 204 });
  assert.equal(url.origin, 'https://api.transkribus.org');
  assert.equal(new Headers(init.headers).get('authorization'), 'Bearer SYNTHETIC-ACCESS-TOKEN');
  if (init.method === 'POST') return Response.json({ processId: nextId++, status: 'CREATED' });
  if (url.pathname.endsWith('/page')) return new Response('<PcGts><Page/></PcGts>');
  const id = Number(url.pathname.split('/').at(-1));
  return Response.json({ processId: id, status: 'FINISHED', content: { text: 'Synthetic transcription: árvíz, æ.' } });
});

const { transkribusRouter } = await import('../server/dist/routes/transkribusRoutes.js');
const { encryptSecret, decryptSecret } = await import('../server/dist/integrations/secretCrypto.js');
const app = express(); app.use(express.json({ limit: '28mb' })); app.use('/api', transkribusRouter);
const server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
after(() => server.close());
const base = '/modules/critical-text-edition/transkribus/jobs';
const connectionPath = '/integrations/transkribus/connection';
async function request(path, method = 'GET', body, user = 'alice') {
  return httpFetch(`http://127.0.0.1:${server.address().port}/api${path}`, {
    method, headers: { ...(user ? { 'x-test-session': user } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
const submitBody = { modelId: 38230, imageBase64: png, consent: true };
const signIn = user => request(connectionPath, 'POST', { username: user + '@example.test', password: 'SYNTHETIC-PASSWORD' }, user);
let handle;

test('Transkribus connection is account scoped, stores encrypted tokens only and never returns credentials', async () => {
  assert.equal((await request(connectionPath, 'GET', undefined, null)).status, 401);
  assert.deepEqual(await (await request(connectionPath)).json(), { connected: false, accountLabel: '' });
  const result = await signIn('alice');
  assert.equal(result.status, 200);
  const publicStatus = await result.text();
  assert.equal(publicStatus.includes('TOKEN'), false);
  assert.equal(publicStatus.includes('PASSWORD'), false);
  assert.equal(result.headers.get('cache-control'), 'no-store');
  const stored = accounts.get('alice');
  assert.equal(stored.encryptedSecret.includes('SYNTHETIC'), false);
  const tokens = JSON.parse(decryptSecret(JSON.parse(stored.encryptedSecret)));
  assert.equal(tokens.accessToken, 'SYNTHETIC-ACCESS-TOKEN');
  assert.equal(JSON.stringify(stored).includes('SYNTHETIC-PASSWORD'), false);
  assert.deepEqual(await (await request(connectionPath, 'GET', undefined, 'bob')).json(), { connected: false, accountLabel: '' });
});

test('paid recognition enforces session, installation, workspace activation, capability and explicit consent', async () => {
  const before = providerCalls.length;
  assert.equal((await request(base, 'POST', submitBody, null)).status, 401);
  enabled = [];
  assert.equal((await request(base, 'POST', submitBody)).status, 403);
  enabled = ['org.omi.critical-text-edition']; active = [];
  assert.equal((await request(base, 'POST', submitBody)).status, 403);
  active = [...enabled];
  assert.equal((await request(base + '?workspaceId=../private', 'POST', submitBody)).status, 400);
  assert.equal((await request(base, 'POST', { ...submitBody, consent: false })).status, 400);
  assert.equal((await request(base, 'POST', { ...submitBody, apiOrigin: 'https://evil.test' })).status, 400);
  assert.equal((await request(base, 'POST', { ...submitBody, imageBase64: 'not-an-image' })).status, 400);
  assert.equal(providerCalls.length, before);
  const response = await request(base, 'POST', submitBody);
  assert.equal(response.status, 201);
  const job = await response.json();
  handle = job.handle;
  assert.equal(job.processId, 42);
  assert.match(handle, /^42\.[A-Za-z0-9_-]{43}$/);
  assert.equal(providerCalls.length, before + 1);
  assert.equal(audits.at(-1).capability, 'transkribus.recognize');
  assert.equal(JSON.stringify(audits).includes(png), false);
  assert.equal(JSON.stringify(audits).includes('SYNTHETIC-PASSWORD'), false);
});

test('job handles prevent cross-account reads and tampering before contacting Transkribus', async () => {
  const before = providerCalls.length;
  assert.equal((await request(base + '/' + handle, 'GET', undefined, 'bob')).status, 404);
  assert.equal((await request(base + '/42')).status, 404);
  assert.equal((await request(base + '/' + handle.replace(/^42/, '43'))).status, 404);
  assert.equal(providerCalls.length, before);
  const job = await request(base + '/' + handle);
  assert.equal(job.status, 200);
  assert.equal((await job.json()).text, 'Synthetic transcription: árvíz, æ.');
  const page = await request(base + '/' + handle + '/page');
  assert.match(page.headers.get('content-disposition'), /attachment/);
  assert.equal(await page.text(), '<PcGts><Page/></PcGts>');
});

test('expired credentials refresh once for simultaneous status requests and rotate the encrypted token set', async () => {
  const stored = accounts.get('alice');
  stored.encryptedSecret = JSON.stringify(encryptSecret(JSON.stringify({
    accessToken: 'EXPIRED', refreshToken: 'SYNTHETIC-REFRESH-TOKEN', expiresAt: 0,
  })));
  const before = providerCalls.filter(call => call.url.endsWith('/token')).length;
  const results = await Promise.all([request(base + '/' + handle), request(base + '/' + handle)]);
  assert.ok(results.every(response => response.status === 200));
  assert.equal(providerCalls.filter(call => call.url.endsWith('/token')).length, before + 1);
  const tokens = JSON.parse(decryptSecret(JSON.parse(accounts.get('alice').encryptedSecret)));
  assert.equal(tokens.accessToken, 'SYNTHETIC-ACCESS-TOKEN');
  assert.ok(tokens.expiresAt > Date.now());
});

test('disconnect during token refresh cannot recreate removed credentials', async () => {
  const stored = accounts.get('alice');
  stored.encryptedSecret = JSON.stringify(encryptSecret(JSON.stringify({
    accessToken: 'EXPIRED', refreshToken: 'SYNTHETIC-REFRESH-TOKEN', expiresAt: 0,
  })));
  let resume;
  refreshWait = new Promise(resolve => { resume = resolve; });
  const before = providerCalls.length;
  const reading = request(base + '/' + handle);
  for (let attempt = 0; attempt < 100 && providerCalls.length === before; attempt++) {
    await new Promise(resolve => { setTimeout(resolve, 5); });
  }
  assert.ok(providerCalls.length > before);
  assert.equal((await request(connectionPath, 'DELETE')).status, 204);
  resume(); refreshWait = null;
  assert.equal((await reading).status, 409);
  assert.equal(accounts.has('alice'), false);
  assert.equal((await request(base + '/' + handle)).status, 409);
});

test('connection requests are strictly validated and sign-in is rate limited per Studio account', async () => {
  assert.equal((await request(connectionPath, 'POST', { username: 'name', password: 'value', secret: 'unexpected' }, 'rate-test')).status, 400);
  for (let index = 0; index < 7; index++) {
    assert.equal((await request(connectionPath, 'POST', {}, 'rate-test')).status, 400);
  }
  const blocked = await request(connectionPath, 'POST', {}, 'rate-test');
  assert.equal(blocked.status, 429);
  assert.deepEqual(await blocked.json(), { error: { code: 'TRANSKRIBUS_RATE_LIMIT' } });
});
