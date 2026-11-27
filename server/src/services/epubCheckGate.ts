import { createHash } from 'node:crypto';
import { configuredPdfWorkerSocket, dispatchPdfWorkerTask, MAX_EPUB_CHECK_BYTES } from '../security/pdfWorkerTransport.js';

export interface EpubCheckReceipt { protocol: 'omi-epubcheck/1'; version: string; sha256: string; valid: boolean; codes: string[] }
export function parseEpubCheckReceipt(raw: unknown, digest: string): EpubCheckReceipt {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid EPUBCheck receipt.');
  const result = raw as Partial<EpubCheckReceipt>;
  if (result.protocol !== 'omi-epubcheck/1' || typeof result.version !== 'string' ||
      !/^5\.[0-9]+\.[0-9]+(?:[-+][A-Za-z0-9.-]+)?$/.test(result.version) ||
      result.sha256 !== digest || !/^[a-f0-9]{64}$/.test(digest) || typeof result.valid !== 'boolean' ||
      !Array.isArray(result.codes) || result.codes.length > 50 ||
      result.codes.some(code => typeof code !== 'string' || !/^[A-Z]{2,5}-[0-9]{3}[a-z]?$/.test(code)))
    throw new Error('Invalid EPUBCheck receipt.');
  return result as EpubCheckReceipt;
}
export function decodeEpubCheckInput(base64: string, expectedDigest: unknown): Buffer {
  if (!base64.length || base64.length > Math.ceil(MAX_EPUB_CHECK_BYTES / 3) * 4 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length % 4 !== 0) throw new Error('Invalid EPUB base64.');
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length < 4 || bytes.length > MAX_EPUB_CHECK_BYTES || bytes.toString('base64') !== base64 ||
      bytes.readUInt32LE(0) !== 0x04034b50 || createHash('sha256').update(bytes).digest('hex') !== expectedDigest)
    throw new Error('EPUB bytes do not match the build digest.');
  return bytes;
}
export async function validateEpubForPublication(bytes: Buffer, owner: string): Promise<EpubCheckReceipt> {
  const socket = configuredPdfWorkerSocket();
  if (!socket) throw new Error('Isolated EPUBCheck worker unavailable.');
  const receipt = await dispatchPdfWorkerTask('epub-check', bytes, owner, socket, 110_000);
  return parseEpubCheckReceipt(JSON.parse(receipt.toString('utf8')), createHash('sha256').update(bytes).digest('hex'));
}
