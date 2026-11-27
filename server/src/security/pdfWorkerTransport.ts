import { request } from 'node:http';
import { isAbsolute } from 'node:path';

export type PdfWorkerTask = 'import' | 'render' | 'slice' | 'page-text' | 'epub-check';
export const MAX_EPUB_CHECK_BYTES = 32 * 1024 * 1024;
const MAX_IMPORT_BYTES = 100 * 1024 * 1024;
const MAX_RENDER_INPUT_BYTES = 48 * 1024 * 1024;
const MAX_RENDER_OUTPUT_BYTES = 96 * 1024 * 1024;
const MAX_LAYOUT_BYTES = 128 * 1024 * 1024;

/** Unix socket is only a transport: OS sandbox and ACL are deployment duties. */
export function configuredPdfWorkerSocket(environment: NodeJS.ProcessEnv = process.env): string | null {
  const path = environment.PDF_WORKER_SOCKET;
  if (!path) {
    if (environment.NODE_ENV === 'production' || environment.PDF_WORKER_REQUIRED === 'true') {
      throw new Error('Isolated PDF processing is required but PDF_WORKER_SOCKET is missing');
    }
    return null;
  }
  if (!isAbsolute(path) || path.includes('\0') || path.length > 102) {
    throw new Error('PDF_WORKER_SOCKET must be a short absolute Unix socket path.');
  }
  if (process.platform === 'win32') {
    throw new Error('PDF_WORKER_SOCKET requires a Unix host.');
  }
  return path;
}

export async function dispatchPdfWorkerTask(
  task: PdfWorkerTask,
  input: Uint8Array,
  ownerUserId: string,
  socketPath: string,
  timeoutMs: number,
): Promise<Buffer> {
  const maxInput = task === 'epub-check' ? MAX_EPUB_CHECK_BYTES : task === 'import' ? MAX_IMPORT_BYTES : task === 'slice' ? MAX_RENDER_OUTPUT_BYTES + 8 : task === 'page-text' ? MAX_RENDER_OUTPUT_BYTES : MAX_RENDER_INPUT_BYTES;
  const maxOutput = task === 'epub-check' ? 4096 : task === 'import' ? MAX_LAYOUT_BYTES : task === 'page-text' ? 16 * 1024 * 1024 : MAX_RENDER_OUTPUT_BYTES;
  if (!input.byteLength || input.byteLength > maxInput) {
    throw new Error('Isolated PDF worker input exceeds the configured size limit.');
  }
  if (!/^[A-Za-z0-9:_-]{1,128}$/.test(ownerUserId)) {
    throw new Error('Invalid PDF worker owner identifier.');
  }
  return new Promise<Buffer>((resolve, reject) => {
    let completed = false;
    const fail = (error: Error) => {
      if (completed) return;
      completed = true;
      reject(error);
    };
    const req = request({
      socketPath,
      path: task === 'epub-check' ? '/v1/epub-check' : task === 'import' ? '/v1/import' : task === 'slice' ? '/v1/slice' : task === 'page-text' ? '/v1/page-text' : '/v1/render',
      method: 'POST',
      headers: {
        'content-type': 'application/octet-stream',
        'content-length': String(input.byteLength),
        'x-omi-pdf-user': ownerUserId,
      },
    }, (response) => {
      const pieces: Buffer[] = [];
      let total = 0;
      response.on('data', (piece: Buffer) => {
        total += piece.byteLength;
        if (total > maxOutput) {
          req.destroy(new Error('Isolated PDF worker response exceeds the size limit.'));
          return;
        }
        pieces.push(piece);
      });
      response.on('end', () => {
        if (completed) return;
        completed = true;
        const bytes = Buffer.concat(pieces, total);
        if (response.statusCode !== 200) {
          reject(new Error('Isolated PDF worker failed (' + String(response.statusCode ?? 502) + '): ' + bytes.toString('utf8', 0, 240)));
        } else {
          resolve(bytes);
        }
      });
      response.on('error', fail);
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error('Isolated PDF worker timed out.')));
    req.on('error', fail);
    req.end(Buffer.from(input.buffer, input.byteOffset, input.byteLength));
  });
}
