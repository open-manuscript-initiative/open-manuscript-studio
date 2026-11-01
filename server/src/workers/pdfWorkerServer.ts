import { execFile } from 'node:child_process';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { buildPdfWorkerEnvironment } from '../security/pdfWorkerEnvironment.js';
import { renderVivliostylePdfLocally } from '../services/vivliostylePdfRenderer.js';

const execAsync = promisify(execFile);
const MAX_IMPORT_BYTES = 100 * 1024 * 1024;
const MAX_RENDER_BYTES = 48 * 1024 * 1024;
const MAX_LAYOUT_BYTES = 128 * 1024 * 1024;
const MAX_RENDER_PDF_BYTES = 96 * 1024 * 1024;
const MAX_CONCURRENT = 2;
const MAX_PER_OWNER = 1;
export type PdfWorkerOperation = 'import' | 'render';
export type PdfJobExecutor = (kind: PdfWorkerOperation, bytes: Buffer) => Promise<Buffer>;

export async function executePdfWorkerJob(kind: PdfWorkerOperation, bytes: Buffer): Promise<Buffer> {
  if (kind === 'render') {
    const artifact = await renderVivliostylePdfLocally(bytes.toString('utf8'));
    const output = Buffer.from(artifact.bytes);
    if (output.length > MAX_RENDER_PDF_BYTES || output.subarray(0, 5).toString('ascii') !== '%PDF-') {
      throw new Error('PDF renderer produced an invalid or oversized artifact.');
    }
    return output;
  }
  if (bytes.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw new Error('Invalid PDF input.');
  }
  const directory = await mkdtemp(join(tmpdir(), 'omi-sandbox-pdf-'));
  try {
    const input = join(directory, 'input.pdf');
    const output = join(directory, 'layout.html');
    await writeFile(input, bytes, { mode: 0o600, flag: 'wx' });
    await execAsync('pdftotext', ['-bbox-layout', '-enc', 'UTF-8', input, output], {
      timeout: 120_000,
      maxBuffer: 4 * 1024 * 1024,
      env: buildPdfWorkerEnvironment('poppler'),
    });
    const result = await readFile(output);
    if (!result.length || result.length > MAX_LAYOUT_BYTES) throw new Error('PDF layout output is missing or too large.');
    return result;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

/**
 * One worker socket service is the shared cross-API-replica admission gate.
 * The AF_UNIX path must be ACL-restricted by systemd and NOT TCP-exposed.
 */
export function createPdfWorkerServer(execute: PdfJobExecutor = executePdfWorkerJob): Server {
  const active = new Map<string, number>();
  let running = 0;

  const server = createServer(async (request: IncomingMessage, response: ServerResponse) => {
    const kind: PdfWorkerOperation | null = request.method === 'POST' && request.url === '/v1/import'
      ? 'import'
      : request.method === 'POST' && request.url === '/v1/render'
        ? 'render'
        : null;
    if (!kind) { response.writeHead(404).end(); return; }

    const owner = request.headers['x-omi-pdf-user'];
    if (typeof owner !== 'string' || !/^[A-Za-z0-9:_-]{1,128}$/.test(owner)) {
      response.writeHead(400).end('Invalid worker owner.'); return;
    }
    const lengthHeader = request.headers['content-length'];
    const maxInput = kind === 'import' ? MAX_IMPORT_BYTES : MAX_RENDER_BYTES;
    const length = typeof lengthHeader === 'string' ? Number(lengthHeader) : Number.NaN;
    if (!Number.isSafeInteger(length) || length < 1 || length > maxInput || request.headers['transfer-encoding']) {
      response.writeHead(413).end('Invalid worker input length.'); return;
    }
    if (running >= MAX_CONCURRENT || (active.get(owner) ?? 0) >= MAX_PER_OWNER) {
      response.writeHead(503, { 'retry-after': '3' }).end('PDF worker capacity is exhausted.'); return;
    }

    running += 1;
    active.set(owner, (active.get(owner) ?? 0) + 1);
    const parts: Buffer[] = [];
    let total = 0;
    try {
      for await (const chunk of request) {
        const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        total += data.byteLength;
        if (total > length || total > maxInput) throw new Error('PDF input exceeds declared length.');
        parts.push(data);
      }
      if (total !== length) throw new Error('Incomplete PDF worker request.');
      const output = await execute(kind, Buffer.concat(parts, total));
      const maxOutput = kind === 'import' ? MAX_LAYOUT_BYTES : MAX_RENDER_PDF_BYTES;
      if (!Buffer.isBuffer(output) || !output.length || output.byteLength > maxOutput) {
        throw new Error('Invalid PDF worker output.');
      }
      if (!response.destroyed) {
        response.writeHead(200, {
          'content-type': 'application/octet-stream',
          'content-length': output.byteLength,
          'cache-control': 'no-store',
        }).end(output);
      }
    } catch {
      if (!response.destroyed && !response.headersSent) {
        response.writeHead(422, { 'cache-control': 'no-store' }).end('Isolated PDF processing failed.');
      } else if (!response.destroyed) {
        response.destroy();
      }
    } finally {
      running -= 1;
      const remaining = (active.get(owner) ?? 1) - 1;
      if (remaining > 0) active.set(owner, remaining);
      else active.delete(owner);
    }
  });
  server.requestTimeout = 150_000;
  server.headersTimeout = 15_000;
  server.timeout = 150_000;
  server.maxRequestsPerSocket = 50;
  return server;
}

if (process.argv[1]?.endsWith('pdfWorkerServer.js')) {
  // systemd .socket with Accept=no passes the listening Unix socket as FD 3.
  // The service itself opens no TCP listener and requires no API .env.
  if (process.env.LISTEN_FDS !== '1' || Number(process.env.LISTEN_PID) !== process.pid) {
    throw new Error('PDF worker must be launched through its systemd Unix socket unit.');
  }
  createPdfWorkerServer().listen({ fd: 3 });
}
