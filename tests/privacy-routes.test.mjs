import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import express from '../server/node_modules/express/index.js';

const calls = [];
const date = new Date('2026-11-08T00:00:00Z');
const account = {
  id: 'owner', email: 'owner@example.test', fullName: 'Synthetic owner',
  affiliation: null, affiliationRorId: null, country: null, website: null, orcid: null, bio: null, timeZone: null,
  interfaceLanguage: 'en', status: 'ACTIVE', createdAt: date, updatedAt: date, lastLoginAt: null, workflowRole: 'general',
  profileEmails: [], identities: [{ provider: 'OIDC', issuer: 'https://identity.example.test', subject: 'synthetic-subject', displayName: 'Synthetic owner', createdAt: date, lastUsedAt: null, accessToken: 'SECRET', refreshToken: 'SECRET', profile: { private: 'SECRET' } }], institutionMemberships: [], sessions: [], passkeys: [],
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
mock.module(new URL('../server/dist/lib/identityPrisma.js', import.meta.url).href, {
  namedExports: { identityPrisma: { user: { findUnique: async (args) => {
    calls.push(args); if (args.where.id === 'missing') return null;
    if (args.where.id === 'failure') throw new Error('SECRET DB path');
    return project({ ...account, id: args.where.id }, args.select);
  } } } },
});
mock.module(new URL('../server/dist/middleware/requireSession.js', import.meta.url).href, {
  namedExports: { requireSession(request, response, next) {
    if (request.headers['x-test-user'] === 'auth-failure') throw new Error('SECRET identity error');
    if (!request.headers['x-test-user']) return response.status(401).json({ error: { code: 'NOT_AUTHENTICATED', message: 'Authentication is required.' } });
    request.authUserId = request.headers['x-test-user']; next();
  } },
});
const { createPrivacyRouter } = await import('../server/dist/routes/privacyRoutes.js');
const { createAccountDataService } = await import('../server/dist/services/accountDataService.js');
const { accountDataRepository } = await import('../server/dist/repositories/accountDataRepository.js');
const { accountOverviewSchema, privacyErrorSchema } = await import('../server/dist/contracts/privacyContract.js');
const legacyCalls = [];
const privacyRouter = createPrivacyRouter({ notice: { configured: false }, exportAccountOverview: createAccountDataService(accountDataRepository), onLegacyRequest: route => legacyCalls.push(route) });

test('HTTP export enforces account isolation, no-store, secret exclusion and honest limits', async (t) => {
  const app = express(); app.set('trust proxy', 1); app.use(['/api/v1', '/api'], privacyRouter);
  const server = await new Promise((resolve) => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const base = `${origin}/api/v1`;
  const legacy = `${origin}/api`;
  const aliasNotice = await fetch(`${legacy}/privacy`);
  assert.deepEqual(await aliasNotice.json(), { configured: false });
  assert.match(aliasNotice.headers.get('deprecation'), /^@/);
  assert.equal(aliasNotice.headers.get('link'), '</api/v1/privacy>; rel="successor-version"');
  const notice = await fetch(`${base}/privacy`);
  assert.equal(notice.status, 200); assert.deepEqual(await notice.json(), { configured: false });
  assert.equal(notice.headers.get('cache-control'), 'no-store');
  assert.equal(notice.headers.get('deprecation'), null);
  assert.match(notice.headers.get('x-request-id'), /^[a-f0-9-]{36}$/);
  const unavailable = await fetch(`${base}/account/data`, { headers: { 'x-test-user': 'auth-failure' } });
  assert.equal(unavailable.status, 503);
  assert.equal(privacyErrorSchema.safeParse(await unavailable.json()).success, true);
  const anonymous = await fetch(`${base}/account/data`);
  assert.equal(anonymous.status, 401);
  assert.equal(privacyErrorSchema.safeParse(await anonymous.json()).success, true);
  const legacyAnonymous = await fetch(`${legacy}/account/data?userId=victim`);
  assert.equal(legacyAnonymous.status, 401); assert.equal(calls.length, 0);
  const response = await fetch(`${base}/account/data?userId=victim`, { headers: { 'x-test-user': 'owner' } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.match(response.headers.get('content-disposition'), /attachment/);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  const result = await response.json(); assert.equal(result.profile.id, 'owner');
  assert.ok(calls.every(call => call.where.id === 'owner'));
  assert.equal(accountOverviewSchema.safeParse(result).success, true);
  assert.doesNotMatch(JSON.stringify(result), /SECRET|passwordHash|tokenHash|accessToken|refreshToken/);
  assert.match(result.scope, /Not a complete/);
  for (const call of calls) for (const key of ['passwordHash', 'tokenHash', 'accessToken', 'refreshToken']) assert.equal(call.select[key], undefined);
  account.sessions = Array.from({ length: 1001 }, () => ({ createdAt: date, expiresAt: date, tokenHash: 'SECRET' }));
  const capped = await (await fetch(`${base}/account/data`, { headers: { 'x-test-user': 'owner' } })).json();
  assert.equal(capped.sessions.length, 1000); assert.deepEqual(capped.incompleteSections, ['sessions']);
  const missing = await fetch(`${base}/account/data`, { headers: { 'x-test-user': 'missing' } }); assert.equal(missing.status, 404); assert.equal(privacyErrorSchema.safeParse(await missing.json()).success, true);
  const failure = await fetch(`${base}/account/data`, { headers: { 'x-test-user': 'failure' } });
  assert.equal(failure.status, 500);
  const failureBody = await failure.json(); assert.equal(privacyErrorSchema.safeParse(failureBody).success, true);
  assert.doesNotMatch(JSON.stringify(failureBody), /SECRET DB path/);
  for (let i = 0; i < 6; i += 1) {
    const allowed = await fetch(`${i % 2 ? base : legacy}/account/data`, { headers: { 'x-test-user': 'owner' } });
    assert.equal(allowed.status, 200); await allowed.arrayBuffer();
  }
  const limited = await fetch(`${base}/account/data`, { headers: { 'x-test-user': 'owner' } });
  assert.equal(limited.status, 429); assert.equal(privacyErrorSchema.safeParse(await limited.json()).success, true);
  assert.ok(legacyCalls.includes('/privacy')); assert.ok(legacyCalls.includes('/account/data'));
  assert.ok(legacyCalls.every(route => ['/privacy', '/account/data'].includes(route)));
  assert.equal(limited.headers.get('cache-control'), 'no-store');
});
