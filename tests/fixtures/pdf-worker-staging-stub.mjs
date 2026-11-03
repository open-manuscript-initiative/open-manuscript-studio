/**
 * Synthetic worker fixture for #774 staging API/socket contract tests.
 * Only accepts a private Unix socket inside the test's 0700 temporary dir;
 * it never starts Chromium, Poppler or an external listener.
 */
import { createServer } from 'node:http';
import { statSync } from 'node:fs';
import { basename, dirname, resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

if (process.platform === 'win32' || process.getuid?.() === 0) {
  throw new Error('Staging worker requires Unix non-root identity');
}
const socket = process.argv[2];
const root = process.env.OMI_PDF_STAGE_SERVER_ROOT;
if (!root || !socket || !socket.startsWith('/tmp/omi-pdf-api-stage-')
  || basename(socket) !== 'synthetic-worker.sock'
  || !basename(dirname(socket)).startsWith('omi-pdf-api-stage-')
  || (statSync(dirname(socket)).mode & 0o777) !== 0o700
  || process.env.PDF_WORKER_SOCKET === '/run/omi-pdf-worker.sock') {
  throw new Error('Refusing to use a non-staging worker socket');
}
const serverModule = pathToFileURL(join(resolve(root), 'dist/workers/pdfWorkerServer.js')).href;
const { createPdfWorkerServer } = await import(serverModule);
const worker = createPdfWorkerServer(async (kind, bytes) => {
  if (kind !== 'render' || !bytes.toString('utf8').includes('OMI synthetic fail-closed canary')) {
    throw new Error('Synthetic worker fixture rejected input');
  }
  return Buffer.from('%PDF-1.7\n% OMI synthetic contract response\n%%EOF\n');
});
worker.listen(socket, () => process.send?.({ type: 'ready' }));
process.on('SIGTERM', () => worker.close(() => process.exit(0)));
