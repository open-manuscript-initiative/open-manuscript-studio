import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import express from '../server/node_modules/express/index.js';
const rows = new Map();
mock.module(new URL('../server/dist/repositories/extensionRegistryRepository.js', import.meta.url).href, {
  namedExports: { extensionRegistryRepository: {
    list: async owner => [...rows.values()].filter(row => row.owner === owner),
    register: async (owner, manifest) => { const id = owner + '/' + manifest.id; rows.set(id, { id, owner, manifest, extension_id: manifest.id, enabled: true, created_at: new Date(), updated_at: new Date() }); return { id, created: true }; },
    remove: async (owner, id) => { rows.delete(owner + '/' + id); },
  } },
});
mock.module(new URL('../server/dist/middleware/requireSession.js', import.meta.url).href, { namedExports: {
  requireSession: (request, response, next) => {
    if (!request.headers['x-test-owner']) return response.sendStatus(401);
    request.authUserId = request.headers['x-test-owner']; next();
  },
} });
const { extensionRegistryRouter } = await import('../server/dist/routes/extensionRegistryRoutes.js');
const manifest = { model: 'omi-integration-extension', apiVersion: '1', id: 'synthetic-tool', name: 'Synthetic', version: '1.0.0', kind: 'translation', authenticationModes: ['none'], permissions: ['document.read'], capabilities: [] };
test('v1 and legacy extension facades share validation, owner isolation and no-grant discovery', async t => {
  const app = express(); app.use(express.json()); app.use(['/api/v1', '/api'], extensionRegistryRouter);
  const server = await new Promise(resolve => { const server = app.listen(0, '127.0.0.1', () => resolve(server)); });
  t.after(() => { server.closeAllConnections(); server.close(); });
  const send = (path, owner, init = {}) => fetch(`http://127.0.0.1:${server.address().port}${path}`, { ...init, headers: { ...(owner ? { 'x-test-owner': owner } : {}), 'Content-Type': 'application/json' } });
  for (const prefix of ['/api/v1', '/api']) {
    const base = prefix + '/integrations/extensions';
    assert.equal((await send(base + '/capabilities')).status, 401);
    const discovery = await send(base + '/capabilities', 'first');
    assert.equal(discovery.headers.get('cache-control'), 'private, no-store');
    const body = await discovery.json();
    assert.equal(body.grantsManuscriptAccess, false); assert.equal(body.executesPluginCode, false);
    assert.equal((await send(base, 'first', { method: 'POST', body: JSON.stringify({ ...manifest, permissions: ['arbitrary.grant'] }) })).status, 400);
    assert.equal((await send(base, 'first', { method: 'POST', body: JSON.stringify(manifest) })).status, 201);
    assert.equal((await (await send(base, 'first')).json()).extensions.length, 1);
    assert.equal((await (await send(base, 'second')).json()).extensions.length, 0);
    await send(base + '/synthetic-tool', 'second', { method: 'DELETE' });
    assert.equal(rows.size, 1);
    await send(base + '/synthetic-tool', 'first', { method: 'DELETE' });
    assert.equal(rows.size, 0);
  }
});
