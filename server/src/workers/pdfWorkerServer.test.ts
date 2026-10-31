import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createPdfWorkerServer } from './pdfWorkerServer.js';
import { configuredPdfWorkerSocket, dispatchPdfWorkerTask } from '../security/pdfWorkerTransport.js';

test('isolated worker socket configuration is opt-in and fails closed when required', () => {
  assert.equal(configuredPdfWorkerSocket({}), null);
  assert.throws(() => configuredPdfWorkerSocket({ PDF_WORKER_REQUIRED: 'true' }), /missing/);
  assert.throws(() => configuredPdfWorkerSocket({ PDF_WORKER_SOCKET: 'worker.sock' }), /absolute/);
  assert.equal(configuredPdfWorkerSocket({ PDF_WORKER_SOCKET: '/run/omi-pdf-worker.sock' }), '/run/omi-pdf-worker.sock');
});

test('isolated Unix socket bounds inputs and enforces owner quotas across concurrent clients', async (t) => {
  if (process.platform === 'win32') return t.skip('AF_UNIX worker test requires Unix');
  const directory = await mkdtemp(join(tmpdir(), 'omi-worker-test-'));
  const socket = join(directory, 'worker.sock');
  let complete!: () => void;
  let started!: () => void;
  const running = new Promise<void>((resolve) => { started = resolve; });
  const pending = new Promise<void>((resolve) => { complete = resolve; });
  const server = createPdfWorkerServer(async (kind, input) => {
    assert.equal(kind, 'import');
    assert.equal(input.toString(), '%PDF-fixture');
    started();
    await pending;
    return Buffer.from('<html>layout</html>');
  });
  await new Promise<void>((resolve) => server.listen(socket, resolve));
  t.after(async () => {
    complete();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
  });
  const first = dispatchPdfWorkerTask('import', Buffer.from('%PDF-fixture'), 'owner-1', socket, 3_000);
  await running;
  await assert.rejects(
    dispatchPdfWorkerTask('import', Buffer.from('%PDF-fixture'), 'owner-1', socket, 3_000),
    /503.*capacity/i,
  );
  await assert.rejects(
    dispatchPdfWorkerTask('import', Buffer.from('%PDF-fixture'), 'owner 1', socket, 3_000),
    /Invalid PDF worker owner/,
  );
  complete();
  assert.equal((await first).toString('utf8'), '<html>layout</html>');
});

test('socket transport refuses malformed PDF requests and worker rejects wrong lengths', async (t) => {
  if (process.platform === 'win32') return t.skip('AF_UNIX worker test requires Unix');
  const directory = await mkdtemp(join(tmpdir(), 'omi-worker-safety-'));
  const socket = join(directory, 'worker.sock');
  const server = createPdfWorkerServer(async () => Buffer.from('%PDF-fixture'));
  await new Promise<void>((resolve) => server.listen(socket, resolve));
  t.after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
  });
  await assert.rejects(
    dispatchPdfWorkerTask('import', new Uint8Array(0), 'owner-1', socket, 1000),
    /input exceeds/,
  );
  const content = Buffer.from('<html>Example</html>');
  assert.equal((await dispatchPdfWorkerTask('render', content, 'owner-1', socket, 2000)).toString(), '%PDF-fixture');
});
