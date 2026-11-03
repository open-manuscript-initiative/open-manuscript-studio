/**
 * #774: stage-only integration of the real publication PDF route, real renderer
 * and real AF_UNIX transport. Requires only an isolated synthetic worker.
 *
 * Authentication is explicitly mocked; this is NOT a login/DB/SSO acceptance.
 * Run as a non-root user, in a separate sandbox. No production socket, secrets
 * or private manuscript may be used.
 */
import assert from 'node:assert/strict';
import { chmod, mkdtemp, rm } from 'node:fs/promises';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mock, test } from 'node:test';

const root = resolve(process.env.OMI_PDF_STAGE_SERVER_ROOT ??
  new URL('../server', import.meta.url).pathname);
const absoluteModule = (path) => pathToFileURL(join(root, path)).href;
if (process.platform === 'win32') throw new Error('AF_UNIX PDF staging requires Unix');
if (process.getuid?.() === 0) throw new Error('PDF staging API must not run as root');
if (process.env.OMI_PDF_STAGE_ALLOW_LIVE_SOCKET === 'true') {
  throw new Error('Live-worker socket use is forbidden in staging');
}
const { default: express } = await import(absoluteModule('node_modules/express/index.js'));

// Only the authentication middleware is replaced with a private synthetic
// fixture; the real route, renderer, and Unix-socket transport are unmocked.
mock.module(absoluteModule('dist/middleware/requireSession.js'), {
  namedExports: {
    requireSession: (req, res, next) => {
      if (req.headers['x-test-user'] !== 'synthetic-owner') {
        res.sendStatus(401); return;
      }
      req.authUserId = 'synthetic-owner';
      next();
    },
  },
});
const { publicationPdfRouter } = await import(absoluteModule('dist/routes/publicationPdfRoutes.js'));
const { createPdfWorkerServer } = await import(absoluteModule('dist/workers/pdfWorkerServer.js'));

function listenUnix(server, socket) {
  return new Promise((resolveReady, reject) => {
    server.once('error', reject);
    server.listen(socket, () => {
      server.removeListener('error', reject);
      resolveReady();
    });
  });
}
function closeServer(server) {
  return new Promise((done, reject) => {
    server.close((error) => error ? reject(error) : done());
  });
}
function apiPost(socket, user = true) {
  return new Promise((done, reject) => {
    const payload = Buffer.from(JSON.stringify({
      html: '<!doctype html><html><body>OMI synthetic fail-closed canary</body></html>',
    }));
    const req = request({
      socketPath: socket,
      path: '/publication/render/pdf',
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': String(payload.length),
        ...(user ? { 'x-test-user': 'synthetic-owner' } : {}),
      },
      timeout: 5000,
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const body = Buffer.concat(chunks);
        done({
          status: response.statusCode,
          contentType: response.headers['content-type'],
          cache: response.headers['cache-control'],
          body,
          json: response.headers['content-type']?.includes('application/json')
            ? JSON.parse(body.toString('utf8')) : null,
        });
      });
      response.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error('Synthetic staging API timed out')));
    req.on('error', reject);
    req.end(payload);
  });
}

test('staging-only authenticated publication API fails closed on worker outage and recovers', async (t) => {
  const previous = Object.fromEntries(
    ['NODE_ENV', 'PDF_WORKER_REQUIRED', 'PDF_WORKER_SOCKET'].map(k => [k, process.env[k]]));
  const dir = await mkdtemp(join(tmpdir(), 'omi-pdf-api-stage-'));
  await chmod(dir, 0o700);
  const stageWorkerSocket = join(dir, 'synthetic-worker.sock');
  const stageApiSocket = join(dir, 'staging-api.sock');
  assert.notEqual(stageWorkerSocket, '/run/omi-pdf-worker.sock');
  assert.notEqual(stageApiSocket, '/run/omi-pdf-worker.sock');

  process.env.NODE_ENV = 'production';
  process.env.PDF_WORKER_REQUIRED = 'true';
  process.env.PDF_WORKER_SOCKET = stageWorkerSocket;
  let worker = null;
  const app = express();
  app.use(express.json({ limit: '64kb' }));
  app.use('/publication', publicationPdfRouter);
  let apiServer = null;
  let successes = 0;
  const startWorker = async () => {
    assert.equal(worker, null);
    worker = createPdfWorkerServer(async (operation, bytes) => {
      assert.equal(operation, 'render');
      assert.match(bytes.toString('utf8'), /OMI synthetic fail-closed canary/);
      successes += 1;
      return Buffer.from('%PDF-1.7\n% OMI synthetic contract response\n%%EOF\n');
    });
    await listenUnix(worker, stageWorkerSocket);
  };
  const stopWorker = async () => {
    if (!worker) return;
    const closing = worker;
    worker = null;
    await closeServer(closing);
    await rm(stageWorkerSocket, { force: true });
  };
  t.after(async () => {
    await stopWorker();
    if (apiServer) await closeServer(apiServer);
    await rm(dir, { recursive: true, force: true });
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const { createServer } = await import('node:http');
  apiServer = createServer(app);
  await listenUnix(apiServer, stageApiSocket);

  const unauthorized = await apiPost(stageApiSocket, false);
  assert.equal(unauthorized.status, 401);

  const missing = await apiPost(stageApiSocket);
  assert.equal(missing.status, 503);
  assert.equal(missing.json?.error?.code, 'PDF_RENDERER_UNAVAILABLE');
  assert.equal(missing.cache, 'no-store');
  assert.doesNotMatch(missing.body.toString('utf8'), /\/tmp\/|ECONN|ENOENT|synthetic-worker\.sock/);

  await startWorker();
  const available = await apiPost(stageApiSocket);
  assert.equal(available.status, 200);
  assert.match(available.contentType, /^application\/pdf/);
  assert.ok(available.body.subarray(0, 5).equals(Buffer.from('%PDF-')));

  await stopWorker();
  const dropped = await apiPost(stageApiSocket);
  assert.equal(dropped.status, 503);
  assert.equal(dropped.json?.error?.code, 'PDF_RENDERER_UNAVAILABLE');
  assert.equal(dropped.cache, 'no-store');

  await startWorker();
  const recovered = await apiPost(stageApiSocket);
  assert.equal(recovered.status, 200);
  assert.ok(recovered.body.subarray(0, 5).equals(Buffer.from('%PDF-')));
  assert.equal(successes, 2);
  console.log(JSON.stringify({
    stagingApiUnavailable: 'PASS',
    stagingApiRecovery: 'PASS',
    authenticationFixtureRequired: 'PASS',
    realRouteAndSocketTransport: 'PASS',
    result: 'PASS',
  }));
});
