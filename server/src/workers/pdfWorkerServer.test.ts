import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { decodeEpubCheckInput, parseEpubCheckReceipt } from '../services/epubCheckGate.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { encodeIssuePdfSlice, decodeIssuePdfSlice, parseIssuePageText, MAX_ISSUE_PDF_PAGES } from '../services/issuePdfSlice.js';
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


test('physical page text preserves blank sheets and refuses inconsistent counts', () => {
  assert.deepEqual(parseIssuePageText('cover\f\farticle\f', 3), ['cover', '', 'article']);
  assert.deepEqual(parseIssuePageText('\f', 1), ['']);
  assert.throws(() => parseIssuePageText('one\f', 2));
  assert.throws(() => parseIssuePageText('one\ftwo\f', 1));
});

test('page evidence travels over the isolated worker socket', async (t) => {
  if (process.platform === 'win32') return t.skip('AF_UNIX worker test requires Unix');
  const directory = await mkdtemp(join(tmpdir(), 'omi-page-text-'));
  const socket = join(directory, 'worker.sock');
  const server = createPdfWorkerServer(async (kind, input) => {
    assert.equal(kind, 'page-text');
    assert.equal(input.toString(), '%PDF-issue');
    return Buffer.from(JSON.stringify({ pageCount: 2, pages: ['', 'Article'] }));
  });
  await new Promise<void>((resolve) => { server.listen(socket, resolve); });
  t.after(async () => {
    await new Promise<void>((resolve) => { server.close(() => resolve()); });
    await rm(directory, { recursive: true, force: true });
  });
  const output = await dispatchPdfWorkerTask('page-text', Buffer.from('%PDF-issue'), 'owner-1', socket, 3000);
  assert.deepEqual(JSON.parse(output.toString()), { pageCount: 2, pages: ['', 'Article'] });
});

test('EPUBCheck receipt binds exact bytes and refuses malformed or mismatched results', () => {
  const bytes = Buffer.from([0x50, 0x4b, 3, 4, 1, 2]);
  const digest = createHash('sha256').update(bytes).digest('hex');
  assert.deepEqual(decodeEpubCheckInput(bytes.toString('base64'), digest), bytes);
  assert.throws(() => decodeEpubCheckInput(bytes.toString('base64'), '0'.repeat(64)));
  const receipt = { protocol: 'omi-epubcheck/1', version: '5.3.0', sha256: digest, valid: true, codes: [] };
  assert.equal(parseEpubCheckReceipt(receipt, digest).valid, true);
  assert.throws(() => parseEpubCheckReceipt({ ...receipt, sha256: '0'.repeat(64) }, digest));
  assert.throws(() => parseEpubCheckReceipt({ ...receipt, version: '4.2.6' }, digest));
});
test('EPUBCheck dispatch uses the same isolated admission gate', async (t) => {
  if (process.platform === 'win32') return t.skip('Unix socket required');
  const directory = await mkdtemp(join(tmpdir(), 'omi-epub-worker-'));
  const socket = join(directory, 'worker.sock');
  const bytes = Buffer.from([0x50, 0x4b, 3, 4, 1]);
  const digest = createHash('sha256').update(bytes).digest('hex');
  const server = createPdfWorkerServer(async (kind, input) => {
    assert.equal(kind, 'epub-check');
    assert.deepEqual(input, bytes);
    return Buffer.from(JSON.stringify({ protocol: 'omi-epubcheck/1', version: '5.3.0', sha256: digest, valid: true, codes: [] }));
  });
  await new Promise<void>(resolve => { server.listen(socket, resolve); });
  t.after(async () => { await new Promise<void>(resolve => { server.close(() => resolve()); }); await rm(directory, { recursive: true, force: true }); });
  const output = await dispatchPdfWorkerTask('epub-check', bytes, 'owner-1', socket, 2000);
  assert.equal(parseEpubCheckReceipt(JSON.parse(output.toString()), digest).valid, true);
});
