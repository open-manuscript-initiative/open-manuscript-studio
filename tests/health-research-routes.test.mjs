import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import express from '../server/node_modules/express/index.js';
let enabled = ['org.omi.psychology', 'org.omi.medical-sciences'];
let active = [...enabled];
let calls = [];
let audits = [];
let fail = false;
mock.module(new URL('../server/dist/config/env.js', import.meta.url).href, { namedExports: { env: { get STUDIO_ENABLED_MODULES() { return enabled; } } } });
mock.module(new URL('../server/dist/lib/prisma.js', import.meta.url).href, { namedExports: { prisma: { studioModulePreference: { findUnique: async ({ where }) => {
  assert.equal(where.userId_workspaceId.userId, 'synthetic-user');
  return { activeModuleIds: active };
} } } } });
mock.module(new URL('../server/dist/services/studioModuleAuditService.js', import.meta.url).href, { namedExports: { writeStudioModuleAuditEvent: async value => { audits.push(value); } } });
mock.module(new URL('../server/dist/middleware/requireSession.js', import.meta.url).href, { namedExports: { requireSession: (req, res, next) => {
  if (!req.headers['x-test-session']) { res.sendStatus(401); return; }
  req.authUserId = 'synthetic-user'; next();
} } });
mock.module(new URL('../server/dist/integrations/healthResearch/search.js', import.meta.url).href, { namedExports: { searchHealthResearch: async input => {
  calls.push(input); if (fail) throw new Error('SYNTHETIC-SECRET');
  return { items: [], totalResults: 0, nextCursor: null };
} } });
const { healthResearchRouter } = await import('../server/dist/routes/healthResearchRoutes.js');
const app = express(); app.use(express.json()); app.use('/api/v1', healthResearchRouter);
const server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
async function request(body, session = true, discipline = 'psychology', workspace = 'default') {
  return fetch(`http://127.0.0.1:${server.address().port}/api/v1/modules/${discipline}/health/search?workspaceId=${encodeURIComponent(workspace)}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(session ? { 'x-test-session': '1' } : {}) }, body: JSON.stringify(body) });
}
test('health search enforces account, installation, workspace activation, capability and request boundaries', async t => {
  t.after(() => server.close());
  const body = { provider: 'pubmed', query: 'Synthetic query' };
  assert.equal((await request(body, false)).status, 401); assert.equal(calls.length, 0);
  enabled = []; assert.equal((await request(body)).status, 403); assert.equal(calls.length, 0);
  enabled = ['org.omi.psychology', 'org.omi.medical-sciences']; active = [];
  assert.equal((await request(body)).status, 403); assert.equal(calls.length, 0);
  active = [...enabled]; assert.equal((await request(body, true, 'psychology', '../invalid')).status, 400);
  assert.equal((await request({ ...body, manuscript: 'SYNTHETIC-PRIVATE' })).status, 400);
  assert.equal((await request({ ...body, provider: 'http://evil.test' })).status, 400);
  assert.equal((await request({ ...body, cursor: '9999' })).status, 400);
  for (const discipline of ['psychology', 'medical-sciences']) {
    const response = await request(body, true, discipline);
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], body);
  assert.ok(audits.every(a => a.capability === 'health-research.search'));
  assert.equal(JSON.stringify(audits).includes(body.query), false);
  fail = true; const error = await request(body);
  assert.equal(error.status, 502); assert.equal((await error.text()).includes('SYNTHETIC-SECRET'), false);
});
