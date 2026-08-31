import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const MAX_PDF_BYTES = 100 * 1024 * 1024;
const MAX_PAGES = 2_000;
const JOB_TTL_MS = 30 * 60 * 1000;

export type PdfImportStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface PdfImportWarning {
  code: string;
  message: string;
  page?: number;
}

export interface PdfImportBlock {
  kind: 'heading' | 'paragraph' | 'footnote';
  text: string;
  page: number;
  confidence: number;
  headingLevel?: number;
  noteMarker?: string;
}

export interface PdfImportResult {
  source: {
    fileName: string;
    pageCount: number;
    kind: 'text' | 'scanned' | 'hybrid';
  };
  title: string;
  blocks: PdfImportBlock[];
  warnings: PdfImportWarning[];
  stats: {
    headings: number;
    paragraphs: number;
    footnotes: number;
    removedRunningHeaders: number;
  };
}

export interface PdfImportJobSnapshot {
  id: string;
  status: PdfImportStatus;
  pagesProcessed: number;
  pagesTotal: number;
  error?: string;
}

interface PdfImportJob extends PdfImportJobSnapshot {
  ownerUserId: string;
  fileName: string;
  createdAt: number;
  result?: PdfImportResult;
}

interface LayoutLine {
  page: number;
  pageWidth: number;
  pageHeight: number;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  text: string;
  column: 'full' | 'left' | 'right';
}

const jobs = new Map<string, PdfImportJob>();

export function createPdfImportJob(
  ownerUserId: string,
  fileName: string,
  bytes: unknown,
): PdfImportJobSnapshot {
  cleanupExpiredJobs();
  if (!Buffer.isBuffer(bytes)) {
    throw new Error('A PDF binary payload is required.');
  }
  if (bytes.length < 5 || bytes.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw new Error('The uploaded file is not a valid PDF document.');
  }
  if (bytes.length > MAX_PDF_BYTES) {
    throw new Error('PDF import is limited to 100 MB per file.');
  }

  const job: PdfImportJob = {
    id: randomUUID(),
    ownerUserId,
    fileName: sanitizeFileName(fileName),
    status: 'queued',
    pagesProcessed: 0,
    pagesTotal: 0,
    createdAt: Date.now(),
  };
  jobs.set(job.id, job);
  setImmediate(() => void processJob(job, bytes));
  return publicSnapshot(job);
}

export function getPdfImportJob(
  ownerUserId: string,
  jobId: string,
): PdfImportJobSnapshot | null {
  cleanupExpiredJobs();
  const job = jobs.get(jobId);
  return job && job.ownerUserId === ownerUserId ? publicSnapshot(job) : null;
}

export function getPdfImportResult(
  ownerUserId: string,
  jobId: string,
): PdfImportResult | null {
  cleanupExpiredJobs();
  const job = jobs.get(jobId);
  if (!job || job.ownerUserId !== ownerUserId || job.status !== 'completed') return null;
  return job.result ?? null;
}

async function processJob(job: PdfImportJob, bytes: Buffer): Promise<void> {
  job.status = 'processing';
  const directory = await mkdtemp(join(tmpdir(), 'omi-pdf-import-'));
  const inputPath = join(directory, 'source.pdf');
  const outputPath = join(directory, 'layout.html');

  try {
    await writeFile(inputPath, bytes, { flag: 'wx' });
    try {
      await execFileAsync('pdftotext', [
        '-bbox-layout',
        '-enc', 'UTF-8',
        inputPath,
        outputPath,
      ], {
        timeout: 120_000,
        maxBuffer: 4 * 1024 * 1024,
      });
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: unknown }).code)
        : '';
      if (code === 'ENOENT') {
        throw new Error('PDF import requires the Poppler pdftotext utility on the Studio server.');
      }
      throw new Error('The PDF text/layout extraction process failed.');
    }

    const html = await readFile(outputPath, 'utf8');
    const pages = parseBboxLayout(html);
    if (pages.length === 0) {
      throw new Error('The PDF contains no extractable text. OCR import is not enabled yet.');
    }
    if (pages.length > MAX_PAGES) {
      throw new Error(`PDF import is limited to ${MAX_PAGES} pages per file.`);
    }

    job.pagesTotal = pages.length;
    const allLines = pages.flatMap((page, index) => {
      job.pagesProcessed = index + 1;
      return orderPageLines(page.lines, page.width);
    });
    job.result = reconstructDocument(job.fileName, pages.length, allLines);
    job.status = 'completed';
  } catch (error) {
    job.error = error instanceof Error ? error.message : 'PDF import failed.';
    job.status = 'failed';
  } finally {
    await rm(directory, { recursive: true, force: true }).catch(() => undefined);
  }
}

function parseBboxLayout(html: string): Array<{ width: number; height: number; lines: LayoutLine[] }> {
  const pages: Array<{ width: number; height: number; lines: LayoutLine[] }> = [];
  const pagePattern = /<page\b([^>]*)>([\s\S]*?)<\/page>/gi;
  let pageMatch: RegExpExecArray | null;
  let pageNumber = 0;
  while ((pageMatch = pagePattern.exec(html)) !== null) {
    pageNumber += 1;
    const attrs = pageMatch[1] ?? '';
    const body = pageMatch[2] ?? '';
    const width = attrNumber(attrs, 'width');
    const height = attrNumber(attrs, 'height');
    const lines: LayoutLine[] = [];
    const linePattern = /<line\b([^>]*)>([\s\S]*?)<\/line>/gi;
    let lineMatch: RegExpExecArray | null;
    while ((lineMatch = linePattern.exec(body)) !== null) {
      const lineAttrs = lineMatch[1] ?? '';
      const words = [...(lineMatch[2] ?? '').matchAll(/<word\b[^>]*>([\s\S]*?)<\/word>/gi)]
        .map((match) => decodeXmlText(match[1] ?? ''))
        .filter(Boolean);
      const text = normalizeWhitespace(words.join(' '));
      if (!text) continue;
      lines.push({
        page: pageNumber,
        pageWidth: width,
        pageHeight: height,
        xMin: attrNumber(lineAttrs, 'xMin'),
        xMax: attrNumber(lineAttrs, 'xMax'),
        yMin: attrNumber(lineAttrs, 'yMin'),
        yMax: attrNumber(lineAttrs, 'yMax'),
        text,
        column: 'full',
      });
    }
    pages.push({ width, height, lines });
  }
  return pages;
}

function orderPageLines(lines: LayoutLine[], pageWidth: number): LayoutLine[] {
  if (lines.length < 4 || pageWidth <= 0) return [...lines].sort(byPosition);
  const classified = lines.map((line) => {
    const lineWidth = Math.max(0, line.xMax - line.xMin);
    const center = (line.xMin + line.xMax) / 2;
    const column: LayoutLine['column'] = lineWidth >= pageWidth * 0.62
      ? 'full'
      : center < pageWidth * 0.48
        ? 'left'
        : center > pageWidth * 0.52
          ? 'right'
          : 'full';
    return { ...line, column };
  });
  const left = classified.filter((line) => line.column === 'left');
  const right = classified.filter((line) => line.column === 'right');
  if (left.length < 2 || right.length < 2) return classified.sort(byPosition);

  const full = classified.filter((line) => line.column === 'full').sort(byPosition);
  const result: LayoutLine[] = [];
  let lowerBound = -Infinity;
  for (const boundary of [...full, null]) {
    const upperBound = boundary?.yMin ?? Infinity;
    result.push(...left.filter((line) => line.yMin >= lowerBound && line.yMin < upperBound).sort(byPosition));
    result.push(...right.filter((line) => line.yMin >= lowerBound && line.yMin < upperBound).sort(byPosition));
    if (boundary) result.push(boundary);
    lowerBound = boundary?.yMax ?? upperBound;
  }
  return result;
}

function reconstructDocument(fileName: string, pageCount: number, sourceLines: LayoutLine[]): PdfImportResult {
  const warnings: PdfImportWarning[] = [];
  const repeatedMargins = findRepeatedMarginLines(sourceLines, pageCount);
  let removedRunningHeaders = 0;
  const lines = sourceLines.filter((line) => {
    const key = marginKey(line);
    if (key && repeatedMargins.has(key)) {
      removedRunningHeaders += 1;
      return false;
    }
    return true;
  });

  if (lines.length === 0) {
    throw new Error('The PDF contains no usable text after removing repeated page furniture.');
  }
  const heights = lines.map((line) => Math.max(1, line.yMax - line.yMin)).sort((a, b) => a - b);
  const medianHeight = heights[Math.floor(heights.length / 2)] ?? 10;
  const blocks: PdfImportBlock[] = [];
  let paragraph: LayoutLine[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const first = paragraph[0]!;
    const text = joinLines(paragraph.map((line) => line.text));
    if (text) blocks.push({ kind: 'paragraph', text, page: first.page, confidence: 0.86 });
    paragraph = [];
  };

  const headingSizes = [...new Set(lines
    .filter((line) => isHeadingCandidate(line, medianHeight))
    .map((line) => roundHeight(line)))]
    .sort((a, b) => b - a)
    .slice(0, 6);

  for (const line of lines) {
    const height = Math.max(1, line.yMax - line.yMin);
    const footnote = line.yMin >= line.pageHeight * 0.76 && height <= medianHeight * 0.92
      ? line.text.match(/^([0-9]{1,3}|[*†‡])(?:[.)]?\s+)(.+)$/u)
      : null;
    if (footnote) {
      flushParagraph();
      const noteMarker = footnote[1];
      const footnoteText = footnote[2]?.trim() ?? '';
      if (footnoteText) {
        blocks.push({
          kind: 'footnote',
          text: footnoteText,
          ...(noteMarker ? { noteMarker } : {}),
          page: line.page,
          confidence: 0.72,
        });
      }
      continue;
    }

    if (isHeadingCandidate(line, medianHeight)) {
      flushParagraph();
      const size = roundHeight(line);
      const levelIndex = Math.max(0, headingSizes.indexOf(size));
      blocks.push({
        kind: 'heading',
        text: line.text,
        page: line.page,
        headingLevel: Math.min(6, levelIndex + 1),
        confidence: Math.min(0.98, 0.76 + (height / medianHeight - 1) * 0.18),
      });
      continue;
    }

    const previous = paragraph.at(-1);
    const gap = previous && previous.page === line.page && previous.column === line.column
      ? line.yMin - previous.yMax
      : Infinity;
    const sameParagraph = Boolean(previous) && gap >= -1 && gap <= medianHeight * 1.05;
    if (!sameParagraph) flushParagraph();
    paragraph.push(line);
  }
  flushParagraph();

  const textCharacters = blocks.reduce((sum, block) => sum + block.text.length, 0);
  const kind: PdfImportResult['source']['kind'] = textCharacters < pageCount * 80 ? 'hybrid' : 'text';
  if (kind === 'hybrid') {
    warnings.push({
      code: 'low-text-density',
      message: 'Some pages contain little extractable text. Scanned regions may require OCR.',
    });
  }
  for (const block of blocks) {
    if (block.kind === 'footnote') {
      warnings.push({
        code: 'footnote-review',
        message: 'A probable footnote was reconstructed from page geometry and should be checked.',
        page: block.page,
      });
    }
  }

  const title = blocks.find((block) => block.kind === 'heading')?.text || stripPdfExtension(fileName) || 'Imported PDF';
  return {
    source: { fileName, pageCount, kind },
    title,
    blocks,
    warnings: warnings.slice(0, 100),
    stats: {
      headings: blocks.filter((block) => block.kind === 'heading').length,
      paragraphs: blocks.filter((block) => block.kind === 'paragraph').length,
      footnotes: blocks.filter((block) => block.kind === 'footnote').length,
      removedRunningHeaders,
    },
  };
}

function findRepeatedMarginLines(lines: LayoutLine[], pageCount: number): Set<string> {
  const occurrences = new Map<string, Set<number>>();
  for (const line of lines) {
    if (line.pageHeight <= 0) continue;
    const inMargin = line.yMin < line.pageHeight * 0.09 || line.yMax > line.pageHeight * 0.91;
    if (!inMargin) continue;
    const key = marginKey(line);
    if (!key) continue;
    const pages = occurrences.get(key) ?? new Set<number>();
    pages.add(line.page);
    occurrences.set(key, pages);
  }
  const threshold = Math.max(3, Math.ceil(pageCount * 0.4));
  return new Set([...occurrences.entries()].filter(([, pages]) => pages.size >= threshold).map(([key]) => key));
}

function marginKey(line: LayoutLine): string {
  const text = line.text.toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, ' ').trim();
  return text.length >= 2 && text.length <= 160 ? text : '';
}

function isHeadingCandidate(line: LayoutLine, medianHeight: number): boolean {
  const height = Math.max(1, line.yMax - line.yMin);
  if (line.text.length > 180 || height < medianHeight * 1.22) return false;
  if (/^[\d\s.,:;()\-–—]+$/.test(line.text)) return false;
  return true;
}

function joinLines(lines: string[]): string {
  let result = '';
  for (const raw of lines) {
    const line = normalizeWhitespace(raw);
    if (!line) continue;
    if (!result) { result = line; continue; }
    if (/\p{L}-$/u.test(result) && /^\p{Ll}/u.test(line)) {
      result = `${result.slice(0, -1)}${line}`;
    } else {
      result += ` ${line}`;
    }
  }
  return normalizeWhitespace(result);
}

function byPosition(a: LayoutLine, b: LayoutLine): number {
  return a.yMin - b.yMin || a.xMin - b.xMin;
}

function roundHeight(line: LayoutLine): number {
  return Math.round(Math.max(1, line.yMax - line.yMin) * 2) / 2;
}

function attrNumber(attrs: string, name: string): number {
  const match = attrs.match(new RegExp(`${name}=["']([^"']+)["']`, 'i'));
  const value = Number(match?.[1] ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function decodeXmlText(value: string): string {
  const withoutMarkupDelimiters = value.replace(/[<>]/g, '');
  return withoutMarkupDelimiters
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_match, digits: string) => decodeSafeCodePoint(Number(digits)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex: string) => decodeSafeCodePoint(Number.parseInt(hex, 16)))
    .replace(/&amp;/g, '&');
}

function decodeSafeCodePoint(codePoint: number): string {
  if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return '';
  if (codePoint === 0x3c) return '&lt;';
  if (codePoint === 0x3e) return '&gt;';
  if (codePoint >= 0xd800 && codePoint <= 0xdfff) return '';
  return String.fromCodePoint(codePoint);
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/gu, ' ').trim();
}

function sanitizeFileName(value: string): string {
  const normalized = value.trim().replace(/[\u0000-\u001f\u007f]/g, '').replace(/[\\/]/g, '_');
  return normalized.slice(0, 240) || 'document.pdf';
}

function stripPdfExtension(value: string): string {
  return value.replace(/\.pdf$/i, '').trim();
}

function cleanupExpiredJobs(): void {
  const cutoff = Date.now() - JOB_TTL_MS;
  for (const [id, job] of jobs) {
    if (job.createdAt < cutoff) jobs.delete(id);
  }
}

function publicSnapshot(job: PdfImportJob): PdfImportJobSnapshot {
  return {
    id: job.id,
    status: job.status,
    pagesProcessed: job.pagesProcessed,
    pagesTotal: job.pagesTotal,
    ...(job.error ? { error: job.error } : {}),
  };
}
