import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { encodeIssuePdfSlice, decodeIssuePdfSlice, MAX_ISSUE_PDF_PAGES } from '../services/issuePdfSlice.js';
import { createPdfWorkerServer } from './pdfWorkerServer.js';
import { configuredPdfWorkerSocket, dispatchPdfWorkerTask } from '../security/pdfWorkerTransport.js';

test('isolated worker socket configuration is opt-in and fails closed when required', () => {
  assert.equal(configuredPdfWorkerSocket({}), null);
  assert.throws(() => configuredPdfWorkerSocket({ NODE_ENV: 'production' }), /required.*missing/);
  assert.throws(() => configuredPdfWorkerSocket({ NODE_ENV: 'production', PDF_WORKER_REQUIRED: 'false' }), /required.*missing/);
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
  await new Promise<void>((resolve) => { server.listen(socket, resolve); });
  t.after(async () => {
    complete();
    await new Promise<void>((resolve) => { server.close(() => resolve()); });
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
  await new Promise<void>((resolve) => { server.listen(socket, resolve); });
  t.after(async () => {
    await new Promise<void>((resolve) => { server.close(() => resolve()); });
    await rm(directory, { recursive: true, force: true });
  });
  await assert.rejects(
    dispatchPdfWorkerTask('import', new Uint8Array(0), 'owner-1', socket, 1000),
    /input exceeds/,
  );
  const content = Buffer.from('<html>Example</html>');
  assert.equal((await dispatchPdfWorkerTask('render', content, 'owner-1', socket, 2000)).toString(), '%PDF-fixture');
});


test('physical PDF slicing range envelope rejects invalid pages and non-PDF content', () => {
  const pdf = Buffer.from('%PDF-fixture');
  assert.deepEqual(decodeIssuePdfSlice(encodeIssuePdfSlice(pdf, 3, 7)), { firstPage: 3, lastPage: 7, pdf });
  for (const [first, last] of [[0, 1], [4, 3], [1.5, 3], [1, MAX_ISSUE_PDF_PAGES + 1]]) {
    assert.throws(() => encodeIssuePdfSlice(pdf, first!, last!));
  }
  assert.throws(() => encodeIssuePdfSlice(Buffer.from('not a PDF'), 1, 2));
  assert.throws(() => decodeIssuePdfSlice(Buffer.alloc(8)));
});

test('PDF slice requests travel through the same isolated Unix socket', async (t) => {
  if (process.platform === 'win32') return t.skip('AF_UNIX worker test requires Unix');
  const directory = await mkdtemp(join(tmpdir(), 'omi-slice-worker-'));
  const socket = join(directory, 'worker.sock');
  const server = createPdfWorkerServer(async (kind, input) => {
    assert.equal(kind, 'slice');
    const decoded = decodeIssuePdfSlice(input);
    assert.equal(decoded.firstPage, 2);
    assert.equal(decoded.lastPage, 3);
    assert.equal(decoded.pdf.toString(), '%PDF-issue');
    return Buffer.from('%PDF-article');
  });
  await new Promise<void>((resolve) => { server.listen(socket, resolve); });
  t.after(async () => {
    await new Promise<void>((resolve) => { server.close(() => resolve()); });
    await rm(directory, { recursive: true, force: true });
  });
  const result = await dispatchPdfWorkerTask('slice', encodeIssuePdfSlice(Buffer.from('%PDF-issue'), 2, 3), 'owner-1', socket, 3000);
  assert.equal(result.toString(), '%PDF-article');
});
