import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import express from '../server/node_modules/express/index.js';
import { jwtVerify } from '../server/node_modules/jose/dist/webapi/index.js';

const owner = '10000000-0000-4000-8000-000000000001';
const otherUser = '10000000-0000-4000-8000-000000000002';
const secret = 'a'.repeat(64);
const docs = [];
const sessions = [];
const saves = [];
let transaction = Promise.resolve();

const plainDocument = {
  findMany: async ({ where }) => docs.filter((doc) => doc.userId === where.userId).map((doc) => ({
    id: doc.id, title: doc.title, revision: doc.revision, createdAt: doc.createdAt, updatedAt: doc.updatedAt,
  })),
  findFirst: async ({ where }) => docs.find((doc) => doc.id === where.id && doc.userId === where.userId) ?? null,
  create: async ({ data }) => {
    const doc = { id: '20000000-0000-4000-8000-000000000001', ...data, revision: 1, createdAt: new Date(), updatedAt: new Date() };
    docs.push(doc);
    return { id: doc.id, title: doc.title, revision: doc.revision, createdAt: doc.createdAt, updatedAt: doc.updatedAt };
  },
  updateMany: async ({ where, data }) => {
    const doc = docs.find((item) => item.id === where.id && item.userId === where.userId && (where.revision === undefined || item.revision === where.revision));
    if (!doc) return { count: 0 };
    doc.content = data.content;
    doc.revision += data.revision.increment;
    doc.updatedAt = new Date();
    return { count: 1 };
  },
};
const euroOfficeSession = {
  deleteMany: async ({ where }) => {
    for (let index = sessions.length - 1; index >= 0; index -= 1) {
      if (sessions[index].documentId === where.documentId) sessions.splice(index, 1);
    }
    return { count: 0 };
  },
  create: async ({ data }) => { sessions.push(data); return data; },
  findFirst: async ({ where, include }) => {
    const session = sessions.find((item) =>
      item.documentId === where.documentId && item.tokenHash === where.tokenHash && item.expiresAt > new Date(),
    );
    if (!session) return null;
    if (include?.document) return { ...session, document: docs.find((doc) => doc.id === session.documentId) };
    return session;
  },
};
const prisma = {
  plainDocument,
  euroOfficeSession,
  euroOfficeSave: {
    findUnique: async ({ where }) => saves.find(save => save.documentId === where.documentId_callbackDigest.documentId && save.callbackDigest === where.documentId_callbackDigest.callbackDigest) ?? null,
    create: async ({ data }) => { const save = { id: crypto.randomUUID(), createdAt: new Date(), ...data }; saves.push(save); return save; },
    upsert: async ({ where, create }) => {
      const found = saves.find(save => save.documentId === where.documentId_callbackDigest.documentId && save.callbackDigest === where.documentId_callbackDigest.callbackDigest);
      if (found) return found;
      const save = { id: crypto.randomUUID(), createdAt: new Date(), ...create }; saves.push(save); return save;
    },
    findMany: async ({ where }) => saves.filter(save => save.documentId === where.documentId && docs.some(doc => doc.id === save.documentId && doc.userId === where.document.userId)).map(({ content: _content, ...save }) => save),
    findFirst: async ({ where }) => saves.find(save => save.id === where.id && save.documentId === where.documentId && docs.some(doc => doc.id === save.documentId && doc.userId === where.document.userId)) ?? null,
  },
  $queryRaw: async () => [],
  user: { findUnique: async () => ({ fullName: 'Test Author' }) },
  $transaction: (operation) => { const result = transaction.then(() => operation(prisma)); transaction = result.catch(() => {}); return result; },
};

mock.module(new URL('../server/dist/lib/prisma.js', import.meta.url).href, {
  namedExports: { prisma },
});
mock.module(new URL('../server/dist/config/env.js', import.meta.url).href, {
  namedExports: { env: {
    EUROOFFICE_ENABLED: true,
    EUROOFFICE_URL: 'https://office.example.org',
    EUROOFFICE_JWT_SECRET: secret,
    FRONTEND_ORIGIN: 'https://studio.example.org',
  } },
});
mock.module(new URL('../server/dist/middleware/requireSession.js', import.meta.url).href, {
  namedExports: {
    requireSession: (request, response, next) => {
      const userId = request.headers['x-test-user'];
      if (!userId) { response.sendStatus(401); return; }
      request.authUserId = userId;
      next();
    },
  },
});

// Route fixtures keep their synthetic Office response while the real
// pinned transport is independently tested for connection-time DNS safety.
const officeDownloads = [];
mock.module(new URL('../server/dist/cloud/security/connectionPinnedHttp.js', import.meta.url).href, {
  namedExports: {
    fetchPinnedPublicUrl: async (url, init) => {
      officeDownloads.push({ url: String(url), method: init.method, redirect: init.redirect });
      return globalThis.fetch(url, init);
    },
  },
});

const { euroOfficeRouter } = await import('../server/dist/routes/euroOfficeRoutes.js');
const app = express();
app.use(express.json());
app.use('/api/v1', euroOfficeRouter);
app.use('/api', euroOfficeRouter);
const server = await new Promise((resolve) => {
  const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
});
const localFetch = globalThis.fetch;

async function request(path, init = {}, userId = owner) {
  const headers = new Headers(init.headers);
  if (userId) headers.set('x-test-user', userId);
  const response = await localFetch(`http://127.0.0.1:${server.address().port}${path}`, { ...init, headers });
  return response;
}

test('ordinary DOCX stays native and uses an owner-scoped, short-lived EuroOffice API session', async (t) => {
  t.after(() => server.close());
  docs.length = 0;
  sessions.length = 0;

  assert.equal((await request('/api/eurooffice/status', {}, null)).status, 401);
  assert.deepEqual(await (await request('/api/eurooffice/status')).json(), { enabled: true });

  // The anonymous iframe host carries no user token and has its own restricted
  // security policy. It is allowed to frame only the configured Office origin,
  // never arbitrary remote JavaScript in the privileged Tauri main WebView.
  const embed = await request('/api/v1/eurooffice/embed-host', {}, null);
  assert.equal(embed.status, 200);
  assert.match(embed.headers.get('content-type') || '', /text\/html/);
  assert.equal(embed.headers.get('cache-control'), 'no-store');
  assert.equal(embed.headers.get('referrer-policy'), 'no-referrer');
  const embedCsp = embed.headers.get('content-security-policy') || '';
  assert.match(embedCsp, /script-src 'nonce-[^']+' https:\/\/office\.example\.org/);
  assert.match(embedCsp, /frame-src https:\/\/office\.example\.org/);
  assert.match(embedCsp, /frame-ancestors [^;]*tauri:\/\/localhost/);
  assert.doesNotMatch(embedCsp, /unsafe-eval|script-src https:|frame-src https:(?:;|$)/);
  assert.match(embedCsp, /(?:^|;) ?sandbox allow-scripts allow-downloads(?:;|$)/);
  assert.doesNotMatch(embedCsp, /allow-same-origin|connect-src 'self'/);
  const embedHtml = await embed.text();
  assert.match(embedHtml, /\/web-apps\/apps\/api\/documents\/api\.js/);
  assert.doesNotMatch(embedHtml, /synthetic-config-token|Bearer |"token":/);
  assert.equal(embed.headers.get('x-frame-options'), null);

  const created = await request('/api/eurooffice/documents', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Plain text' }),
  });
  assert.equal(created.status, 201);
  const documentId = (await created.json()).document.id;
  const otherUserDocuments = await (await request('/api/eurooffice/documents', {}, otherUser)).json();
  assert.equal(otherUserDocuments.documents.length, 0);

  const launched = await request(`/api/eurooffice/documents/${documentId}/session`);
  assert.equal(launched.status, 200);
  const launch = await launched.json();
  assert.equal(launch.apiScriptUrl, 'https://office.example.org/web-apps/apps/api/documents/api.js');
  assert.equal(launch.config.document.fileType, 'docx');
  assert.equal(launch.config.editorConfig.customization.compactHeader, true);
  const claims = await jwtVerify(launch.config.token, new TextEncoder().encode(secret));
  assert.equal(claims.payload.document.title, 'Plain text.docx');
  assert.equal(claims.payload.type, 'desktop');
  assert.equal(JSON.stringify(launch).includes(secret), false);

  const mobileLaunch = await (await request(`/api/eurooffice/documents/${documentId}/session?type=mobile`)).json();
  assert.equal(mobileLaunch.config.editorConfig.customization.compactHeader, true);
  const mobileClaims = await jwtVerify(mobileLaunch.config.token, new TextEncoder().encode(secret));
  assert.equal(mobileClaims.payload.type, 'mobile');

  const capability = new URL(launch.config.document.url).searchParams.get('token');
  const fileResponse = await request(`/api/integrations/eurooffice/${documentId}/content?token=${capability}`, {}, null);
  assert.equal(fileResponse.status, 200);
  assert.equal(Buffer.from(await fileResponse.arrayBuffer()).subarray(0, 4).toString('hex'), '504b0304');
  assert.equal((await request(`/api/integrations/eurooffice/${documentId}/content?token=wrong`, {}, null)).status, 404);

  const blockedCallback = await request(`/api/integrations/eurooffice/${documentId}/callback?token=${capability}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ status: 2, key: launch.config.document.key, url: 'https://attacker.example/file' }),
  }, null);
  assert.equal(blockedCallback.status, 400);
  assert.equal(docs[0].revision, 1);

  const fragmentCallback = await request(`/api/integrations/eurooffice/${documentId}/callback?token=${capability}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ status: 2, key: launch.config.document.key, url: 'https://office.example.org/cache/docx#fragment' }),
  }, null);
  assert.equal(fragmentCallback.status, 400);
  assert.equal(officeDownloads.length, 0, 'invalid callback must not open an outbound socket');

  const { createBlankDocx } = await import('../server/dist/integrations/eurooffice/blankDocx.js');
  const updatedPackage = createBlankDocx('Synthetic updated document');
  globalThis.fetch = async () => new Response(updatedPackage, { status: 200 });
  try {
    const force = await request(`/api/v1/integrations/eurooffice/${documentId}/callback?token=${capability}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 6, key: launch.config.document.key, url: 'https://office.example.org/cache/force-before-final' }),
    }, null);
    assert.equal(force.status, 200);
    assert.equal(docs[0].revision, 1);
    assert.ok(saves.some(save => save.status === 6));
    const callbackResponse = await request(`/api/integrations/eurooffice/${documentId}/callback?token=${capability}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 2, key: launch.config.document.key, url: 'https://office.example.org/cache/docx' }),
    }, null);
    assert.equal(callbackResponse.status, 200);
    assert.deepEqual(await callbackResponse.json(), { error: 0 });
    const duplicate = await request(`/api/v1/integrations/eurooffice/${documentId}/callback?token=${capability}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 2, key: launch.config.document.key, url: 'https://office.example.org/cache/docx' }),
    }, null);
    assert.equal(duplicate.status, 200);
    assert.equal(docs[0].revision, 2);
    assert.ok(officeDownloads.length >= 2, 'valid callback must use pinned transport');
    assert.ok(officeDownloads.every((entry) =>
      entry.method === 'GET' && entry.redirect === 'error' &&
      entry.url.startsWith('https://office.example.org/cache/')
    ));
    const staleFinal = await request(`/api/integrations/eurooffice/${documentId}/callback?token=${capability}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 2, key: launch.config.document.key, url: 'https://office.example.org/cache/stale-final' }),
    }, null);
    assert.equal(staleFinal.status, 200);
    assert.equal(docs[0].revision, 2);
    assert.ok(saves.some(save => save.status === 2 && !save.applied));
    const stale = await request(`/api/integrations/eurooffice/${documentId}/callback?token=${capability}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 6, key: launch.config.document.key, url: 'https://office.example.org/cache/late-force' }),
    }, null);
    assert.equal(stale.status, 200);
    assert.equal(docs[0].revision, 2);
    assert.ok(saves.some(save => save.status === 6 && !save.applied));
    assert.equal((await request(`/api/v1/eurooffice/documents/${documentId}/saves`, {}, otherUser)).status, 404);
    const recovery = await request(`/api/v1/eurooffice/documents/${documentId}/saves`);
    assert.equal(recovery.status, 200);
    const list = (await recovery.json()).saves;
    assert.ok(list.some(save => save.status === 0));
    assert.equal(JSON.stringify(list).includes('content"'), false);
    assert.equal((await request(`/api/v1/eurooffice/documents/${documentId}/saves/${list[0].id}`)).status, 200);

  } finally {
    globalThis.fetch = localFetch;
  }
  assert.equal(docs[0].revision, 2);
  assert.equal(Buffer.from(docs[0].content).toString(), updatedPackage.toString());
});
