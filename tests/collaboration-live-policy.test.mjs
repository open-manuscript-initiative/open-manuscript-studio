import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { createRequire } from 'node:module';
const requireServer = createRequire(new URL('../server/package.json', import.meta.url));

let hooks;
let access = { readOnly: false };
let unavailable = false;
const rechecked = [];
mock.module(requireServer.resolve('@hocuspocus/server').replace('hocuspocus-server.cjs', 'hocuspocus-server.esm.js'), { namedExports: { Server: class {
  constructor(configuration) { hooks = configuration; }
  async listen() {}
} } });
mock.module(new URL('../server/dist/config/env.js', import.meta.url).href, { namedExports: { env: {
  MANUSCRIPT_COLLABORATION_ENABLED: true, FRONTEND_ORIGIN: 'https://studio.example', COLLABORATION_WS_HOST: '127.0.0.1', COLLABORATION_WS_PORT: 1234,
} } });
mock.module(new URL('../server/dist/services/collaborationTicketService.js', import.meta.url).href, { namedExports: {
  authorizeCollaborationConnectionTicket: async () => ({ userId: 'user', documentId: 'A', role: 'AUTHOR', expiresAt: Date.now() + 10_000, readOnly: true }),
  reauthorizeCollaborationSession: async (context, documentId) => { rechecked.push({ context, documentId }); if (unavailable) throw new Error('offline'); return access; },
} });
mock.module(new URL('../server/dist/collaboration/collaborationStateStore.js', import.meta.url).href, { namedExports: {
  postgresCollaborationStateStore: { load: async () => null, save: async () => {} },
} });
const service = await import('../server/dist/collaboration/collaborationServer.js');

test('live message boundary rechecks membership and downgrades or closes stale sessions', async () => {
  await service.startCollaborationServer();
  let closed = 0;
  const context = { userId: 'user', documentId: 'A', expiresAt: Date.now() + 10_000 };
  const connection = { context, readOnly: false, close() { closed++; }, document: { name: 'A' } };
  try {
    const configuration = {};
    await assert.rejects(hooks.onAuthenticate({ token: 'ticket', documentName: 'A', requestHeaders: new Headers({ origin: 'https://untrusted.example' }), connectionConfig: configuration }), /origin/);
    // The server must enforce the ticket's effective write capability even if
    // its display role is AUTHOR; the role name is not write authority.
    await hooks.onAuthenticate({ token: 'ticket', documentName: 'A',
      requestHeaders: new Headers({ origin: 'https://studio.example' }), connectionConfig: configuration });
    assert.equal(configuration.readOnly, true);
    await hooks.beforeHandleMessage({ connection, documentName: 'A' });
    assert.equal(connection.readOnly, false);
    access = { readOnly: true };
    await hooks.beforeHandleMessage({ connection, documentName: 'A' });
    assert.equal(connection.readOnly, true);
    assert.deepEqual(rechecked[0], { context, documentId: 'A' });
    access = null;
    await assert.rejects(hooks.beforeHandleMessage({ connection, documentName: 'A' }), /authorization unavailable/);
    assert.equal(closed, 1);
    access = { readOnly: false }; unavailable = true;
    await assert.rejects(hooks.beforeHandleMessage({ connection, documentName: 'A' }), /authorization unavailable/);
    assert.equal(connection.readOnly, true);
    assert.equal(closed, 2);
  } finally { await hooks.onDestroy(); }
});
