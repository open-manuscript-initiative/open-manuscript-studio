import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runPdfSubprocess } from '../security/pdfSubprocess.js';
import { buildPdfWorkerEnvironment } from '../security/pdfWorkerEnvironment.js';

export const MAX_ISSUE_PDF_BYTES = 96 * 1024 * 1024;
export const MAX_ISSUE_PDF_PAGES = 2000;

export function encodeIssuePdfSlice(pdf: Uint8Array, firstPage: number, lastPage: number): Buffer {
  if (!Number.isSafeInteger(firstPage) || !Number.isSafeInteger(lastPage) ||
      firstPage < 1 || lastPage < firstPage || lastPage > MAX_ISSUE_PDF_PAGES ||
      pdf.byteLength < 5 || pdf.byteLength > MAX_ISSUE_PDF_BYTES ||
      Buffer.from(pdf.subarray(0, 5)).toString('ascii') !== '%PDF-') throw new Error('Invalid PDF page range or input.');
  const header = Buffer.alloc(8);
  header.writeUInt32BE(firstPage, 0);
  header.writeUInt32BE(lastPage, 4);
  return Buffer.concat([header, pdf]);
}

export function decodeIssuePdfSlice(input: Buffer): { firstPage: number; lastPage: number; pdf: Buffer } {
  if (input.length < 13) throw new Error('Invalid PDF slice request.');
  const firstPage = input.readUInt32BE(0), lastPage = input.readUInt32BE(4), pdf = input.subarray(8);
  if (firstPage < 1 || lastPage < firstPage || lastPage > MAX_ISSUE_PDF_PAGES ||
      pdf.length > MAX_ISSUE_PDF_BYTES || pdf.subarray(0, 5).toString('ascii') !== '%PDF-') throw new Error('Invalid PDF slice request.');
  return { firstPage, lastPage, pdf };
}

/** Called only inside the sandbox worker. Physical pages are copied, never reflowed. */
export async function executeIssuePdfSlice(input: Buffer): Promise<Buffer> {
  const { firstPage, lastPage, pdf } = decodeIssuePdfSlice(input);
  const directory = await mkdtemp(join(tmpdir(), 'omi-issue-slice-'));
  const source = join(directory, 'issue.pdf');
  const output = join(directory, 'article.pdf');
  try {
    await writeFile(source, pdf, { mode: 0o600, flag: 'wx' });
    const run = (args: string[]) => runPdfSubprocess('qpdf', args, {
      cwd: directory, timeoutMs: 60_000, maxOutputChars: 16 * 1024,
      env: buildPdfWorkerEnvironment('poppler'),
    });
    const count = async (path: string) => {
      const result = await run(['--show-npages', path]);
      const value = result.stdout.trim();
      if (result.exitCode !== 0 || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) throw new Error('Cannot verify PDF page count.');
      return Number(value);
    };
    const pageCount = await count(source);
    if (pageCount > MAX_ISSUE_PDF_PAGES || lastPage > pageCount) throw new Error('PDF range exceeds actual rendered issue.');
    const result = await run(['--empty', '--pages', source, `${firstPage}-${lastPage}`, '--', output]);
    if (result.exitCode !== 0 || await count(output) !== lastPage - firstPage + 1) throw new Error('PDF extraction failed.');
    const bytes = await readFile(output);
    if (bytes.length > MAX_ISSUE_PDF_BYTES || bytes.subarray(0, 5).toString('ascii') !== '%PDF-') throw new Error('Invalid extracted PDF.');
    return bytes;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
