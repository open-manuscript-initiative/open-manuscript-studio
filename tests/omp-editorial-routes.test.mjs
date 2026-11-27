import assert from 'node:assert/strict';
import { after, beforeEach, mock, test } from 'node:test';
import express from '../server/node_modules/express/index.js';
import { ompIdentity, ompMetadataSnapshot, ompWorkflowSnapshot } from './fixtures/ompEditorialSnapshot.mjs';

const connectionId = '20000000-0000-4000-8000-000000000003';
const destination = 'https://press.example.test/index.php/press';
const apiKey = 'personal-omp-editor-key';
let enabled, credential, provider, supported, profile, calls, remoteStatus, mutate, loseResponse;
beforeEach(() => {
  enabled = credential = supported = true;
  provider = 'omp'; profile = 'omi-integration/1/omp'; calls = [];
  remoteStatus = 200; mutate = result => result; loseResponse = false;
});
mock.module(new URL('../server/dist/repositories/editorialConnectorRepository.js', import.meta.url).href, {
  namedExports: { findEditorialConnection: async (user, id) =>
    user === 'editor' && id === connectionId && enabled ? { provider, baseUrl: destination } : null },
});
mock.module(new URL('../server/dist/middleware/requireSession.js', import.meta.url).href, {
  namedExports: { requireSession: (req, res, next) => {
    if (!req.headers['x-user']) return res.sendStatus(401);
    req.authUserId = req.headers['x-user']; next();
  } },
});
mock.module(new URL('../server/dist/services/personalPublishingCredentialService.js', import.meta.url).href, {
  namedExports: {
    resolvePersonalOmpCredential: async (user, url) => {
      assert.equal(user, 'editor'); assert.equal(url, destination);
      return credential ? { apiKey } : null;
    },
    resolvePersonalOjsCredential: async () => ({ apiKey: 'other-profile-key' }),
  },
});
mock.module(new URL('../server/dist/integrations/security/trustedRemoteUrl.js', import.meta.url).href, {
  namedExports: { assertTrustedIntegrationUrl: async (url, base) => {
    assert.equal(base, destination);
    assert.ok(url === destination || url.startsWith(destination + '/api/v1/'));
    return new URL(url);
  } },
});
// Keep the real bounded native client, including its path allowlist and credential handling.
mock.module(new URL('../server/dist/cloud/security/connectionPinnedHttp.js', import.meta.url).href, {
  namedExports: { fetchPinnedPublicUrl: async (url, init) => {
    const path = new URL(url).pathname;
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ path, body, method: init.method, authorization: init.headers.get('Authorization') });
    assert.equal(init.redirect, 'error');
    if (path.endsWith('/omi-integration')) return Response.json({
      protocol: 'omi-integration/1', profile,
      capabilities: supported ? ['editor.workflow.read', 'editor.metadata.reconcile', 'editor.chapter-page-range.write'] : [],
    });
    if (loseResponse) throw new Error('Lost response after dispatch');
    if (remoteStatus !== 200) return Response.json({ error: { message: `Native denial ${apiKey}` } }, { status: remoteStatus });
    let result;
    if (path.endsWith('/metadata')) {
      const snapshot = ompMetadataSnapshot();
      if (body.action === 'apply') {
        for (const [field, value] of Object.entries(body.fields)) {
          if (Array.isArray(snapshot.metadata[field])) snapshot.metadata[field] = {};
          snapshot.metadata[field][body.locale] = value;
        }
        snapshot.stateToken = 'c'.repeat(64);
      }
      result = { snapshot, ...(body.action === 'apply' ? { receipt: {
        ...ompIdentity, protocol: 'omi-omp-metadata/1', locale: body.locale,
        fields: Object.keys(body.fields), previousStateToken: body.expectedStateToken,
        stateToken: snapshot.stateToken, published: false,
      } } : {}) };
    } else if (path.endsWith('/workflow-status')) result = ompWorkflowSnapshot();
    else if (path.endsWith('/chapter-page-range')) {
      const snapshot = { ...ompIdentity, chapterId: 6, protocol: 'omi-chapter-page-range/1', sourceChapterId: null,
        pages: body.action === 'apply' ? '101-118' : null, workflowToken: 'd'.repeat(64), published: false };
      result = { snapshot, ...(body.action === 'apply' ? { receipt: {
        ...snapshot, previousPages: null, previousWorkflowToken: body.expectedWorkflowToken, unchanged: false,
      } } : {}) };
    } else throw new Error('Unexpected native operation');
    return Response.json(mutate(result));
  } },
});
const { editorialConnectorRouter } = await import('../server/dist/routes/editorialConnectorRoutes.js');
const app = express();
app.use(express.json());
app.use(['/api/v1', '/api'], editorialConnectorRouter);
const server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
after(() => server.close());
const root = `http://127.0.0.1:${server.address().port}`;
function send(endpoint, body, { user = 'editor', legacy = false } = {}) {
  return fetch(`${root}${legacy ? '/api' : '/api/v1'}/integrations/connections/${connectionId}/${endpoint}`, {
    method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(user ? { 'x-user': user } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
const inspect = { ...ompIdentity, action: 'inspect' };
const apply = { ...ompIdentity, action: 'apply', locale: 'hu', fields: { title: 'Új kötet' },
  confirmed: true, expectedStateToken: 'a'.repeat(64) };

test('OMP capability discovery and own workflow contract retain native series and strip private extras', async () => {
  const capabilities = await send('editorial-capabilities');
  assert.equal(capabilities.status, 200);
  assert.deepEqual((await capabilities.json()).features, {
    workflowRead: true, metadataReconcile: true, nativeCopyeditingWrite: false,
    nativeProofApproval: false, externalReviewAssurance: false,
  });
  mutate = result => ({ ...result, privateReviewer: 'secret', metadata: { ...result.metadata, issueId: 99 } });
  const response = await send('omp-workflow-status', { submissionId: 12 });
  assert.equal(response.status, 200);
  const { snapshot } = await response.json();
  assert.equal(snapshot.protocol, 'omi-omp-workflow/1');
  assert.equal(snapshot.authority, 'OMP');
  assert.equal(snapshot.metadata.seriesId, 7);
  assert.deepEqual(snapshot.metadata.subtitle, {});
  assert.equal(snapshot.metadata.issueId, undefined);
  assert.equal(snapshot.privateReviewer, undefined);
  assert.equal(snapshot.editorialDecisionsWritable, false);
  assert.equal(calls.at(-1).method, 'GET');
  assert.ok(calls.every(call => call.authorization === `Bearer ${apiKey}`));
});

test('OMP v1 and compatibility metadata handlers require exact identity and return bound selective receipts', async () => {
  const current = await send('omp-metadata', inspect);
  const old = await send('omp-metadata', inspect, { legacy: true });
  assert.equal(current.status, 200); assert.equal(old.status, 200);
  assert.equal(current.headers.get('cache-control'), 'no-store');
  assert.ok(current.headers.get('x-request-id'));
  assert.equal(current.headers.has('deprecation'), false);
  assert.equal(old.headers.has('deprecation'), true);
  const result = await current.json();
  assert.deepEqual(result, await old.json());
  assert.equal(result.snapshot.contributors[0].email, undefined);
  assert.equal(result.snapshot.contributors[0].isEditor, true);
  const written = await send('omp-metadata', apply);
  assert.equal(written.status, 200);
  const saved = await written.json();
  assert.equal(saved.snapshot.metadata.title.hu, 'Új kötet');
  assert.equal(saved.snapshot.metadata.title.en, 'Volume');
  assert.equal(saved.snapshot.metadata.seriesId, 7);
  assert.equal(saved.receipt.installationId, ompIdentity.installationId);
  assert.equal(saved.receipt.published, false);
  assert.deepEqual(calls.at(-1).body, apply);
});

test('OMP request and connection authorization failures never dispatch native metadata', async () => {
  for (const user of [null, 'other']) {
    assert.equal((await send('omp-metadata', inspect, { user })).status, user ? 404 : 401);
    assert.equal(calls.length, 0);
  }
  enabled = false;
  assert.equal((await send('omp-metadata', inspect)).status, 404);
  enabled = true; credential = false;
  assert.equal((await send('omp-metadata', inspect)).status, 400);
  assert.equal(calls.length, 0); credential = true;
  for (const invalid of [
    { ...inspect, publicationId: undefined }, { ...inspect, contextId: 0 },
    { ...inspect, baseUrl: 'https://foreign.test' }, { ...apply, confirmed: false },
    { ...apply, fields: { doi: 'forged' } }, { ...apply, fields: {} },
  ]) assert.equal((await send('omp-metadata', invalid)).status, 400);
  assert.equal(calls.length, 0);
});

test('OMP support is negotiated per operation and never passes OMP through OJS DTO routes', async () => {
  supported = false;
  const caps = await send('editorial-capabilities');
  assert.equal((await caps.json()).features.metadataReconcile, false);
  for (const [endpoint, body] of [['omp-metadata', apply], ['omp-workflow-status', { submissionId: 12 }]]) {
    calls = []; assert.equal((await send(endpoint, body)).status, 409);
    assert.equal(calls.length, 1);
  }
  supported = true; profile = 'omi-integration/1/ojs'; calls = [];
  assert.equal((await send('omp-metadata', apply)).status, 502);
  assert.equal(calls.length, 1);
  profile = 'omi-integration/1/omp'; calls = [];
  assert.equal((await send('metadata', { action: 'inspect', submissionId: 12 })).status, 409);
  assert.equal((await send('workflow-status', { submissionId: 12 })).status, 409);
  assert.equal(calls.length, 0);
  provider = 'ojs';
  assert.equal((await send('omp-metadata', inspect)).status, 409);
  assert.equal((await send('omp-workflow-status', { submissionId: 12 })).status, 409);
  assert.equal(calls.length, 0);
});

test('OMP rejects foreign snapshots and mismatched or missing write receipts', async () => {
  for (const change of [
    result => ({ ...result, snapshot: { ...result.snapshot, contextId: 2 } }),
    result => ({ ...result, snapshot: { ...result.snapshot, publicationId: 99 } }),
    result => ({ ...result, snapshot: { ...result.snapshot, authority: 'OJS' } }),
    result => ({ ...result, receipt: undefined }),
    ...['installationId', 'contextId', 'publicationId', 'previousStateToken', 'stateToken', 'locale', 'fields', 'published'].map(field =>
      result => ({ ...result, receipt: { ...result.receipt, [field]: field === 'fields' ? ['keywords'] : field === 'published' ? true : 'foreign' } })),
  ]) {
    mutate = change;
    assert.equal((await send('omp-metadata', apply)).status, 502);
  }
  mutate = result => ({ ...result, authority: 'OJS', protocol: 'omi-ojs-workflow/1' });
  assert.equal((await send('omp-workflow-status', { submissionId: 12 })).status, 502);
  mutate = result => ({ ...result, submissionId: 99 });
  assert.equal((await send('omp-workflow-status', { submissionId: 12 })).status, 502);
});

test('OMP stale, revoked and uncertain writes are not replayed and redact personal credentials', async () => {
  for (const status of [403, 404, 409, 422]) {
    remoteStatus = status; calls = [];
    const response = await send('omp-metadata', apply);
    assert.equal(response.status, status);
    assert.ok(!(await response.text()).includes(apiKey));
    assert.equal(calls.filter(call => call.method === 'POST').length, 1);
  }
  remoteStatus = 200; loseResponse = true; calls = [];
  assert.equal((await send('omp-metadata', apply)).status, 502);
  assert.equal(calls.filter(call => call.method === 'POST').length, 1);
});

test('OMP chapter printed pages reach the allowed native endpoint and validate chapter/token receipts', async () => {
  const input = { ...ompIdentity, chapterId: 6, action: 'apply', firstPrintedPage: 101, lastPrintedPage: 118,
    confirmed: true, expectedWorkflowToken: 'b'.repeat(64) };
  const response = await send('chapter-page-range', input);
  assert.equal(response.status, 200, await response.clone().text());
  assert.equal((await response.json()).receipt.pages, '101-118');
  assert.ok(calls.at(-1).path.endsWith('/omi-integration/chapter-page-range'));
  assert.equal(calls.at(-1).authorization, `Bearer ${apiKey}`);
  mutate = result => ({ ...result, receipt: { ...result.receipt, chapterId: 99 } });
  assert.equal((await send('chapter-page-range', input)).status, 502);
  mutate = result => ({ ...result, receipt: { ...result.receipt, previousWorkflowToken: 'e'.repeat(64) } });
  assert.equal((await send('chapter-page-range', input)).status, 502);
});
