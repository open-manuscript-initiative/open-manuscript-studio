import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import {
  canonicalizePdfPageTypography,
  parseCanonicalNoteMarker,
} from './pdfCanonicalTypography.js';

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
  noteAnchors?: string[];
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

interface LayoutWord {
  text: string;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  rawText?: string;
  canonicalText?: string;
  script?: 'normal' | 'superscript' | 'subscript';
  fontHeight?: number;
  baselineOffset?: number;
  superscriptMarker?: string;
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
  words: LayoutWord[];
  column: 'full' | 'left' | 'right';
  noteAnchors?: string[];
}

interface PageFootnoteExtraction {
  page: number;
  bodyLines: LayoutLine[];
  footnotes: PdfImportBlock[];
  leadingContinuation: LayoutLine[];
}

interface NoteStartOccurrence {
  line: LayoutLine;
  lineIndex: number;
  marker: string;
  markerOffset: number;
  contentOffset: number;
}

const jobs = new Map<string, PdfImportJob>();

export function createPdfImportJob(
  ownerUserId: string,
  fileName: string,
  bytes: Buffer,
): PdfImportJobSnapshot {
  cleanupExpiredJobs();
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

export function getPdfImportJob(ownerUserId: string, jobId: string): PdfImportJobSnapshot | null {
  cleanupExpiredJobs();
  const job = jobs.get(jobId);
  return job && job.ownerUserId === ownerUserId ? publicSnapshot(job) : null;
}

export function getPdfImportResult(ownerUserId: string, jobId: string): PdfImportResult | null {
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
      await execFileAsync('pdftotext', ['-bbox-layout', '-enc', 'UTF-8', inputPath, outputPath], {
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
      const words: LayoutWord[] = [];
      const wordPattern = /<word\b([^>]*)>([\s\S]*?)<\/word>/gi;
      let wordMatch: RegExpExecArray | null;

      while ((wordMatch = wordPattern.exec(lineMatch[2] ?? '')) !== null) {
        const wordAttrs = wordMatch[1] ?? '';
        const text = normalizeWhitespace(decodeXmlText(wordMatch[2] ?? '')).normalize('NFC');
        if (!text) continue;
        words.push({
          text,
          xMin: attrNumber(wordAttrs, 'xMin'),
          xMax: attrNumber(wordAttrs, 'xMax'),
          yMin: attrNumber(wordAttrs, 'yMin'),
          yMax: attrNumber(wordAttrs, 'yMax'),
        });
      }

      const text = normalizeWhitespace(words.map((word) => word.text).join(' '));
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
        words,
        column: 'full',
      });
    }

    // Canonicalize the complete page before semantic reconstruction. This keeps
    // raw glyphs and display text while deriving NFKC values and script position
    // from page-local geometry. Footnote detection only runs after this stage.
    canonicalizePdfPageTypography(lines);
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
  const wordHeights = lines
    .flatMap((line) => line.words.map((word) => word.fontHeight ?? Math.max(1, word.yMax - word.yMin)))
    .sort((a, b) => a - b);
  const medianWordHeight = wordHeights[Math.floor(wordHeights.length / 2)] ?? medianHeight;
  const pageExtractions = extractPageLocalFootnotes(lines, pageCount, medianHeight, medianWordHeight);
  attachCrossPageFootnoteContinuations(pageExtractions);

  const blocks: PdfImportBlock[] = [];
  let paragraph: LayoutLine[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const first = paragraph[0]!;
    const text = joinLines(paragraph.map((line) => line.text));
    const noteAnchors = uniqueStrings(paragraph.flatMap((line) => line.noteAnchors ?? []));
    if (text) {
      blocks.push({
        kind: 'paragraph',
        text,
        page: first.page,
        confidence: 0.88,
        ...(noteAnchors.length ? { noteAnchors } : {}),
      });
    }
    paragraph = [];
  };

  const bodyLines = pageExtractions.flatMap((extraction) => extraction.bodyLines);
  const headingSizes = [...new Set(bodyLines
    .filter((line) => isHeadingCandidate(line, medianHeight))
    .map((line) => roundHeight(line)))]
    .sort((a, b) => b - a)
    .slice(0, 6);

  for (const extraction of pageExtractions) {
    for (const line of extraction.bodyLines) {
      const height = Math.max(1, line.yMax - line.yMin);
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
      const sameParagraph = Boolean(previous) && gap >= -2.5 && gap <= medianHeight * 1.15;
      if (!sameParagraph) flushParagraph();
      paragraph.push(line);
    }
    flushParagraph();
    blocks.push(...extraction.footnotes);
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
        message: 'A probable footnote was matched after canonical page typography reconstruction and should be checked.',
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

function extractPageLocalFootnotes(
  lines: LayoutLine[],
  pageCount: number,
  _medianLineHeight: number,
  medianWordHeight: number,
): PageFootnoteExtraction[] {
  const results: PageFootnoteExtraction[] = [];
  let lastConfirmedMarker: number | null = null;

  for (let page = 1; page <= pageCount; page += 1) {
    const pageLines = lines.filter((line) => line.page === page).sort(byPosition);
    if (!pageLines.length) {
      results.push({ page, bodyLines: [], footnotes: [], leadingContinuation: [] });
      continue;
    }

    // Semantic note recognition starts only now, after every word on the page has
    // canonical Unicode and preserved script-position metadata.
    const geometricAnchors = new Map<number, string[]>();
    for (let index = 0; index < pageLines.length; index += 1) {
      const markers = findSuperscriptNoteMarkers(pageLines[index]!, medianWordHeight);
      if (!markers.length) continue;
      geometricAnchors.set(index, markers);
    }

    const possibleStarts = pageLines.flatMap((line, lineIndex) => {
      if (!isNoteSizedLine(line, medianWordHeight) || line.yMin < line.pageHeight * 0.14) return [];
      return findPossibleNoteStarts(line).map((occurrence) => ({ ...occurrence, line, lineIndex }));
    });
    const possibleMarkerSet = new Set(possibleStarts.map((item) => item.marker));

    const attachedTextAnchors = new Map<number, string[]>();
    for (let index = 0; index < pageLines.length; index += 1) {
      const line = pageLines[index]!;
      if (typicalWordHeight(line) < medianWordHeight * 0.98) continue;
      const attached = findAttachedInlineMarkers(line, possibleMarkerSet, medianWordHeight)
        .filter((marker) => !(geometricAnchors.get(index) ?? []).includes(marker));
      if (attached.length) attachedTextAnchors.set(index, attached);
    }

    const orderedMarkers: string[] = [];
    for (let index = 0; index < pageLines.length; index += 1) {
      orderedMarkers.push(...uniqueStrings([
        ...(geometricAnchors.get(index) ?? []),
        ...(attachedTextAnchors.get(index) ?? []),
      ]));
    }

    if (!orderedMarkers.length) {
      results.push({ page, bodyLines: pageLines, footnotes: [], leadingContinuation: [] });
      continue;
    }

    const selectedMarkerSet = selectSequentialNoteMarkers(
      orderedMarkers,
      lastConfirmedMarker,
      possibleMarkerSet,
    );

    const matchedStarts = possibleStarts
      .filter((item) => selectedMarkerSet.has(item.marker))
      .sort((a, b) => a.lineIndex - b.lineIndex || a.markerOffset - b.markerOffset);

    if (!matchedStarts.length) {
      const bodyLines = pageLines.map((line, index) => {
        const anchors = uniqueStrings([
          ...(geometricAnchors.get(index) ?? []),
          ...(attachedTextAnchors.get(index) ?? []),
        ]).filter((marker) => selectedMarkerSet.has(marker));
        return anchors.length ? { ...line, noteAnchors: anchors } : line;
      });
      results.push({ page, bodyLines, footnotes: [], leadingContinuation: [] });
      continue;
    }

    const footnoteRunStart = matchedStarts[0]!.lineIndex;
    const startsByLine = new Map<number, NoteStartOccurrence[]>();
    for (const occurrence of matchedStarts) {
      const group = startsByLine.get(occurrence.lineIndex) ?? [];
      group.push(occurrence);
      startsByLine.set(occurrence.lineIndex, group);
    }

    const bodyLines = pageLines.slice(0, footnoteRunStart).map((line, index) => {
      const anchors = uniqueStrings([
        ...(geometricAnchors.get(index) ?? []),
        ...(attachedTextAnchors.get(index) ?? []),
      ]).filter((marker) => selectedMarkerSet.has(marker));
      return anchors.length ? { ...line, noteAnchors: anchors } : line;
    });

    const footnotes: PdfImportBlock[] = [];
    let currentMarker: string | null = null;
    let currentLines: string[] = [];

    const flushNote = () => {
      if (!currentMarker || !currentLines.length) return;
      const text = joinLines(currentLines);
      if (text) {
        footnotes.push({
          kind: 'footnote',
          text,
          page,
          noteMarker: currentMarker,
          confidence: 0.96,
        });
      }
      currentMarker = null;
      currentLines = [];
    };

    for (let index = footnoteRunStart; index < pageLines.length; index += 1) {
      const line = pageLines[index]!;
      const occurrences = startsByLine.get(index) ?? [];
      if (occurrences.length) {
        let cursor = 0;
        for (let occurrenceIndex = 0; occurrenceIndex < occurrences.length; occurrenceIndex += 1) {
          const occurrence = occurrences[occurrenceIndex]!;
          const prefix = normalizeWhitespace(line.text.slice(cursor, occurrence.markerOffset));
          if (prefix && currentMarker) currentLines.push(prefix);
          flushNote();
          currentMarker = occurrence.marker;

          const nextOccurrence = occurrences[occurrenceIndex + 1];
          const segmentEnd = nextOccurrence?.markerOffset ?? line.text.length;
          const segment = normalizeWhitespace(line.text.slice(occurrence.contentOffset, segmentEnd));
          if (segment) currentLines.push(segment);
          cursor = segmentEnd;
        }
        continue;
      }

      if (currentMarker) currentLines.push(line.text);
    }
    flushNote();

    const selectedInOrder = orderedMarkers.filter((marker) => selectedMarkerSet.has(marker));
    const lastSelected = selectedInOrder.at(-1);
    if (lastSelected) lastConfirmedMarker = Number(lastSelected);

    results.push({ page, bodyLines, footnotes, leadingContinuation: [] });
  }

  return results;
}

function selectSequentialNoteMarkers(
  orderedMarkers: readonly string[],
  previousMarker: number | null,
  samePageNoteStarts: ReadonlySet<string>,
): Set<string> {
  const selected = new Set<string>();
  const ordered = orderedMarkers
    .map((marker) => ({ marker, value: Number(marker) }))
    .filter((item) => Number.isInteger(item.value) && item.value > 0);
  if (!ordered.length) return selected;

  let last = previousMarker;
  for (const item of ordered) {
    if (last === null) {
      selected.add(item.marker);
      last = item.value;
      continue;
    }

    if (item.value <= last) continue;
    const expected = last + 1;
    if (item.value === expected) {
      selected.add(item.marker);
      last = item.value;
      continue;
    }

    if (samePageNoteStarts.has(item.marker)) {
      selected.add(item.marker);
      last = item.value;
    }
  }

  return selected;
}

function attachCrossPageFootnoteContinuations(extractions: PageFootnoteExtraction[]): void {
  for (let index = 1; index < extractions.length; index += 1) {
    const current = extractions[index]!;
    if (!current.leadingContinuation.length) continue;
    const previous = extractions[index - 1]!;
    const target = previous.footnotes.at(-1);
    if (!target) continue;
    const continuation = joinLines(current.leadingContinuation.map((line) => line.text));
    if (!continuation) continue;
    target.text = joinLines([target.text, continuation]);
    target.confidence = Math.min(target.confidence, 0.9);
  }
}

function findPossibleNoteStarts(
  line: LayoutLine,
): Array<Pick<NoteStartOccurrence, 'marker' | 'markerOffset' | 'contentOffset'>> {
  const results: Array<Pick<NoteStartOccurrence, 'marker' | 'markerOffset' | 'contentOffset'>> = [];
  const pattern = /([1-9][0-9]{0,2})(?:[.)]?)[ \t]+(?=[\p{L}\p{M}"“„'‘])/gu;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(line.text)) !== null) {
    const marker = match[1];
    if (!marker) continue;
    const markerOffset = match.index;
    if (markerOffset > 0 && !/\s/u.test(line.text[markerOffset - 1] ?? '')) continue;
    results.push({ marker, markerOffset, contentOffset: pattern.lastIndex });
  }

  return results;
}

function findSuperscriptNoteMarkers(line: LayoutLine, medianWordHeight: number): string[] {
  if (!line.words.length || medianWordHeight <= 0) return [];
  const markers: string[] = [];

  for (let index = 0; index < line.words.length; index += 1) {
    const word = line.words[index]!;
    const marker = word.superscriptMarker
      ?? (word.script === 'superscript' ? parseCanonicalNoteMarker(word.canonicalText ?? word.text) : null);
    if (!marker) continue;

    // Explicit Unicode superscript suffixes survive even when Poppler merged the
    // marker with the previous lexical token. Geometry-derived ASCII markers
    // still require normal lexical attachment/proximity checks.
    if (word.superscriptMarker && !parseCanonicalNoteMarker(word.canonicalText ?? '')) {
      markers.push(marker);
      continue;
    }

    const previous = line.words[index - 1];
    if (!previous || !/[\p{L}\p{M}\p{P}]$/u.test(previous.rawText ?? previous.text)) continue;

    const horizontalGap = Math.max(0, word.xMin - previous.xMax);
    const localHeight = word.fontHeight ?? Math.max(1, word.yMax - word.yMin);
    if (horizontalGap > Math.max(7, localHeight * 0.85)) continue;

    markers.push(marker);
  }

  return uniqueStrings(markers);
}

function findAttachedInlineMarkers(
  line: LayoutLine,
  candidates: ReadonlySet<string>,
  medianWordHeight: number,
): string[] {
  const matches = new Set<string>();

  for (const marker of findSuperscriptNoteMarkers(line, medianWordHeight)) {
    if (candidates.has(marker)) matches.add(marker);
  }

  for (const word of line.words) {
    if (word.superscriptMarker && candidates.has(word.superscriptMarker)) {
      matches.add(word.superscriptMarker);
      continue;
    }

    const canonical = word.canonicalText ?? word.text.normalize('NFKC');
    const match = canonical.match(/[\p{L}\p{M}\p{P}]([1-9][0-9]{0,2})$/u);
    const marker = match?.[1];
    if (marker && candidates.has(marker)) matches.add(marker);
  }

  return [...matches];
}

function isNoteSizedLine(line: LayoutLine, medianWordHeight: number): boolean {
  return typicalWordHeight(line) <= medianWordHeight * 0.97;
}

function typicalWordHeight(line: LayoutLine): number {
  return medianNumber(line.words.map((word) => word.fontHeight ?? Math.max(1, word.yMax - word.yMin)))
    ?? Math.max(1, line.yMax - line.yMin);
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
    if (!result) {
      result = line;
      continue;
    }
    if (/\p{L}-$/u.test(result) && /^\p{Ll}/u.test(line)) {
      result = `${result.slice(0, -1)}${line}`;
    } else {
      result += ` ${line}`;
    }
  }
  return normalizeWhitespace(result);
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function medianNumber(values: readonly number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? null;
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
