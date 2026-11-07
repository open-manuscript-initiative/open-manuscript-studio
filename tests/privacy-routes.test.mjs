import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import express from '../server/node_modules/express/index.js';

const calls = [];
const account = {
  id: 'owner', email: 'owner@example.test', fullName: 'Synthetic owner',
  profileEmails: [], identities: [{ provider: 'OIDC', issuer: 'https://identity.example.test', subject: 'synthetic-subject', displayName: 'Synthetic owner', accessToken: 'SECRET', refreshToken: 'SECRET', profile: { private: 'SECRET' } }], institutionMemberships: [], sessions: [], passkeys: [],
  passwordHash: 'SECRET', tokenHash: 'SECRET', accessToken: 'SECRET', refreshToken: 'SECRET',
};
function project(row, select) {
  return Object.fromEntries(Object.entries(select).flatMap(([key, value]) => {
    if (!(key in row)) return [];
    if (value === true) return [[key, row[key]]];
    if (Array.isArray(row[key])) return [[key, row[key].slice(0, value.take).map((item) => project(item, value.select))]];
    return [[key, project(row[key], value.select)]];
  }));
}
mock.module(new URL('../server/dist/config/env.js', import.meta.url).href, { namedExports: { env: {} } });
mock.module(new URL('../server/dist/lib/identityPrisma.js', import.meta.url).href, {
  namedExports: { identityPrisma: { user: { findUnique: async (args) => {
    calls.push(args); if (args.where.id === 'missing') return null;
    if (args.where.id === 'failure') throw new Error('SECRET DB path');
    return project({ ...account, id: args.where.id }, args.select);
  } } } },
});
mock.module(new URL('../server/dist/middleware/requireSession.js', import.meta.url).href, {
  namedExports: { requireSession(request, response, next) {
    if (!request.headers['x-test-user']) return response.sendStatus(401);
    request.authUserId = request.headers['x-test-user']; next();
  } },
});
const { privacyRouter } = await import('../server/dist/routes/privacyRoutes.js');

test('HTTP export enforces account isolation, no-store, secret exclusion and honest limits', async (t) => {
  const app = express(); app.set('trust proxy', 1); app.use('/api', privacyRouter);
  const server = await new Promise((resolve) => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const notice = await fetch(`${base}/privacy`);
  assert.equal(notice.status, 200); assert.deepEqual(await notice.json(), { configured: false });
  assert.equal(notice.headers.get('cache-control'), 'no-store');
  const anonymous = await fetch(`${base}/account/data`);
  assert.equal(anonymous.status, 401); assert.equal(calls.length, 0);
  const response = await fetch(`${base}/account/data?userId=victim`, { headers: { 'x-test-user': 'owner' } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.match(response.headers.get('content-disposition'), /attachment/);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  const result = await response.json(); assert.equal(result.profile.id, 'owner');
  assert.equal(calls.at(-1).where.id, 'owner');
  assert.doesNotMatch(JSON.stringify(result), /SECRET|passwordHash|tokenHash|accessToken|refreshToken/);
  assert.match(result.scope, /Not a complete/);
  for (const key of ['passwordHash', 'tokenHash', 'accessToken', 'refreshToken']) assert.equal(calls.at(-1).select[key], undefined);
  account.sessions = Array.from({ length: 1001 }, () => ({ createdAt: new Date().toISOString(), expiresAt: new Date().toISOString(), tokenHash: 'SECRET' }));
  const capped = await (await fetch(`${base}/account/data`, { headers: { 'x-test-user': 'owner' } })).json();
  assert.equal(capped.sessions.length, 1000); assert.deepEqual(capped.incompleteSections, ['sessions']);
  const missing = await fetch(`${base}/account/data`, { headers: { 'x-test-user': 'missing' } }); assert.equal(missing.status, 404);
  const failure = await fetch(`${base}/account/data`, { headers: { 'x-test-user': 'failure' } });
  assert.equal(failure.status, 500); assert.doesNotMatch(await failure.text(), /SECRET DB path/);
  for (let i = 0; i < 6; i += 1) {
    const allowed = await fetch(`${base}/account/data`, { headers: { 'x-test-user': 'owner' } });
    assert.equal(allowed.status, 200); await allowed.arrayBuffer();
  }
  const limited = await fetch(`${base}/account/data`, { headers: { 'x-test-user': 'owner' } });
  assert.equal(limited.status, 429); assert.equal(limited.headers.get('cache-control'), 'no-store');
});
