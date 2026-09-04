import { isTauri } from '@tauri-apps/api/core';

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
  /** Footnote markers found in this body block during PDF reconstruction. */
  noteAnchors?: string[];
}

export interface PdfImportMetadata {
  dois: string[];
  copyrightStatements: string[];
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
  metadata?: PdfImportMetadata;
  stats: {
    headings: number;
    paragraphs: number;
    footnotes: number;
    removedRunningHeaders: number;
  };
}

export interface PdfImportProgress {
  status: 'queued' | 'processing' | 'completed' | 'failed';
  pagesProcessed: number;
  pagesTotal: number;
}

interface JobResponse {
  job: {
    id: string;
    status: PdfImportProgress['status'];
    pagesProcessed: number;
    pagesTotal: number;
    error?: string;
  };
}

interface ResultResponse {
  result: PdfImportResult;
}

interface ErrorResponse {
  error?: { message?: string };
}

const NATIVE_SESSION_KEY = 'omi_native_session_token';
const NATIVE_API_BASE_URL = 'https://studio.openmanuscript.org';
const IS_TAURI = isTauri();
const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL?.trim()
  || (IS_TAURI && !import.meta.env.DEV ? NATIVE_API_BASE_URL : '')).replace(/\/$/, '');

export async function importPdfForStudio(
  file: File,
  onProgress?: (progress: PdfImportProgress) => void,
): Promise<PdfImportResult> {
  if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
    throw new Error('A PDF file is required.');
  }
  if (file.size > 100 * 1024 * 1024) {
    throw new Error('PDF import is limited to 100 MB per file.');
  }

  const started = await fetch(`${API_BASE_URL}/api/import/pdf`, {
    method: 'POST',
    credentials: 'include',
    headers: buildPdfImportHeaders({
      Accept: 'application/json',
      'Content-Type': 'application/pdf',
      'X-OMI-File-Name': encodeURIComponent(file.name),
    }),
    body: file,
  });
  if (!started.ok) throw await createApiError(started);
  const created = await started.json() as JobResponse;
  const jobId = created.job.id;
  onProgress?.(created.job);

  for (;;) {
    await delay(350);
    const response = await fetch(`${API_BASE_URL}/api/import/pdf/${encodeURIComponent(jobId)}`, {
      method: 'GET',
      credentials: 'include',
      headers: buildPdfImportHeaders({ Accept: 'application/json' }),
      cache: 'no-store',
    });
    if (!response.ok) throw await createApiError(response);
    const payload = await response.json() as JobResponse;
    onProgress?.(payload.job);
    if (payload.job.status === 'failed') {
      throw new Error(payload.job.error || 'PDF import failed.');
    }
    if (payload.job.status !== 'completed') continue;

    const resultResponse = await fetch(
      `${API_BASE_URL}/api/import/pdf/${encodeURIComponent(jobId)}/result`,
      {
        method: 'GET',
        credentials: 'include',
        headers: buildPdfImportHeaders({ Accept: 'application/json' }),
        cache: 'no-store',
      },
    );
    if (!resultResponse.ok) throw await createApiError(resultResponse);
    const result = (await resultResponse.json() as ResultResponse).result;
    return normalizePdfFootnotes(normalizePdfPageFurniture(result));
  }
}

export function buildPdfImportHeaders(
  input: HeadersInit,
  nativeRuntime = IS_TAURI,
  sessionToken = nativeRuntime
    ? globalThis.localStorage?.getItem(NATIVE_SESSION_KEY) ?? null
    : null,
): Headers {
  const headers = new Headers(input);
  if (!nativeRuntime) return headers;

  headers.set('X-OMI-Native-Client', '1');
  if (sessionToken) headers.set('Authorization', `Bearer ${sessionToken}`);
  return headers;
}

/**
 * Remove publication furniture before footnote reconstruction. PDF extraction
 * often exposes running heads and page numbers as ordinary text blocks, which
 * makes a page number indistinguishable from a footnote marker later in the
 * pipeline. DOI and copyright lines are publication metadata rather than body
 * prose: extract and preserve them before dropping the footer/header block.
 */
export function normalizePdfPageFurniture(result: PdfImportResult): PdfImportResult {
  const pages = new Map<number, PdfImportBlock[]>();
  for (const block of result.blocks) {
    const list = pages.get(block.page) ?? [];
    list.push(block);
    pages.set(block.page, list);
  }

  const furnitureCounts = new Map<string, number>();
  for (const pageBlocks of pages.values()) {
    const edgeBlocks = pageEdgeBlocks(pageBlocks);
    const signatures = new Set(edgeBlocks.map((block) => furnitureSignature(block.text)).filter(Boolean));
    for (const signature of signatures) {
      furnitureCounts.set(signature, (furnitureCounts.get(signature) ?? 0) + 1);
    }
  }

  const repeatedThreshold = Math.max(2, Math.ceil(result.source.pageCount * 0.35));
  const dois = new Set(result.metadata?.dois ?? []);
  const copyrightStatements = new Set(result.metadata?.copyrightStatements ?? []);
  const output: PdfImportBlock[] = [];
  let removed = 0;

  for (const pageBlocks of pages.values()) {
    const edge = new Set(pageEdgeBlocks(pageBlocks));
    for (const block of pageBlocks) {
      const text = block.text.replace(/\s+/gu, ' ').trim();
      if (!text) continue;

      if (edge.has(block)) {
        for (const doi of extractDois(text)) dois.add(doi);
        if (isCopyrightStatement(text)) copyrightStatements.add(text);

        const signature = furnitureSignature(text);
        const repeatedFurniture = Boolean(signature && (furnitureCounts.get(signature) ?? 0) >= repeatedThreshold);
        const pageNumber = isStandalonePageNumber(text);
        const metadataLine = extractDois(text).length > 0 || isCopyrightStatement(text);

        if (repeatedFurniture || pageNumber || metadataLine) {
          removed += 1;
          continue;
        }
      }

      output.push(block);
    }
  }

  return {
    ...result,
    blocks: output,
    metadata: {
      dois: [...dois],
      copyrightStatements: [...copyrightStatements],
    },
    stats: {
      ...result.stats,
      removedRunningHeaders: result.stats.removedRunningHeaders + removed,
    },
    warnings: removed > 0
      ? [
          ...result.warnings,
          {
            code: 'page-furniture-removed',
            message: `${removed} running-header, running-footer, page-number or publication-metadata block${removed === 1 ? '' : 's'} were removed from body flow. DOI and copyright metadata were preserved.`,
          },
        ]
      : result.warnings,
  };
}

function pageEdgeBlocks(blocks: readonly PdfImportBlock[]): PdfImportBlock[] {
  if (blocks.length <= 8) return [...blocks];
  return [...blocks.slice(0, 4), ...blocks.slice(-4)];
}

function furnitureSignature(text: string): string {
  return text
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/\b\d{1,4}\b/gu, '#')
    .replace(/\s+/gu, ' ')
    .trim();
}

function isStandalonePageNumber(text: string): boolean {
  return /^\d{1,4}$/u.test(text.trim());
}

function extractDois(text: string): string[] {
  const matches = text.match(/\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+/giu) ?? [];
  return matches.map((doi) => doi.replace(/[.,;:)]+$/u, ''));
}

function isCopyrightStatement(text: string): boolean {
  return /(?:©|\bcopyright\b|\ball rights reserved\b)/iu.test(text);
}

/**
 * Poppler can expose a footnote as visual fragments ordered like
 * `first text line -> small marker -> continuation lines`. The initial PDF
 * import intentionally keeps those fragments losslessly. This pass pairs each
 * standalone numeric marker with the matching in-text marker on the same page,
 * removes the page-bottom fragments from body flow and emits one semantic
 * footnote block. The later OMI conversion can then attach the note to the
 * exact body block rather than to whichever paragraph happened to precede it.
 */
export function normalizePdfFootnotes(result: PdfImportResult): PdfImportResult {
  const blocks = result.blocks.map((block) => ({
    ...block,
    ...(block.noteAnchors ? { noteAnchors: [...block.noteAnchors] } : {}),
  }));
  const output: PdfImportBlock[] = [];

  for (let page = 1; page <= result.source.pageCount; page += 1) {
    const pageBlocks = blocks.filter((block) => block.page === page);
    if (!pageBlocks.length) continue;

    const candidates = pageBlocks
      .map((block, index) => ({ block, index }))
      .filter(({ block, index }) => {
        const marker = standaloneNoteMarker(block);
        if (!marker || index === 0) return false;
        return findAnchorIndex(pageBlocks, marker, index - 1) >= 0;
      });

    if (!candidates.length) {
      output.push(...pageBlocks);
      continue;
    }

    const removed = new Set<number>();
    const footnoteAt = new Map<number, PdfImportBlock>();

    for (let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex += 1) {
      const candidate = candidates[candidateIndex]!;
      const marker = standaloneNoteMarker(candidate.block)!;
      const firstTextIndex = candidate.index - 1;
      const nextMarkerIndex = candidates[candidateIndex + 1]?.index ?? pageBlocks.length;
      const anchorIndex = findAnchorIndex(pageBlocks, marker, firstTextIndex - 1);
      const firstText = pageBlocks[firstTextIndex];
      if (anchorIndex < 0 || !firstText || firstText.kind !== 'paragraph') continue;

      const continuation: PdfImportBlock[] = [];
      for (let index = candidate.index + 1; index < Math.max(candidate.index + 1, nextMarkerIndex - 1); index += 1) {
        const block = pageBlocks[index];
        if (!block || block.kind !== 'paragraph' || standaloneNoteMarker(block)) break;
        continuation.push(block);
      }

      const text = joinPdfText([firstText.text, ...continuation.map((block) => block.text)]);
      if (!text) continue;

      const anchor = pageBlocks[anchorIndex]!;
      const noteAnchors = new Set(anchor.noteAnchors ?? []);
      noteAnchors.add(marker);
      pageBlocks[anchorIndex] = { ...anchor, noteAnchors: [...noteAnchors] };

      removed.add(firstTextIndex);
      removed.add(candidate.index);
      continuation.forEach((block) => {
        const index = pageBlocks.indexOf(block);
        if (index >= 0) removed.add(index);
      });

      footnoteAt.set(candidate.index, {
        kind: 'footnote',
        text,
        page,
        noteMarker: marker,
        confidence: 0.84,
      });
    }

    for (let index = 0; index < pageBlocks.length; index += 1) {
      const footnote = footnoteAt.get(index);
      if (footnote) output.push(footnote);
      if (!removed.has(index)) output.push(pageBlocks[index]!);
    }
  }

  const footnoteCount = output.filter((block) => block.kind === 'footnote').length;
  return {
    ...result,
    blocks: output,
    stats: {
      ...result.stats,
      headings: output.filter((block) => block.kind === 'heading').length,
      paragraphs: output.filter((block) => block.kind === 'paragraph').length,
      footnotes: footnoteCount,
    },
    warnings: footnoteCount > 0
      ? [
          ...result.warnings.filter((warning) => warning.code !== 'footnote-review'),
          {
            code: 'footnote-link-review',
            message: `${footnoteCount} PDF footnote${footnoteCount === 1 ? '' : 's'} were linked to in-text markers and should be checked.`,
          },
        ]
      : result.warnings,
  };
}

function standaloneNoteMarker(block: PdfImportBlock): string | null {
  if (block.kind !== 'paragraph') return null;
  const match = block.text.trim().match(/^([1-9][0-9]{0,2})$/u);
  return match?.[1] ?? null;
}

function findAnchorIndex(blocks: readonly PdfImportBlock[], marker: string, beforeIndex: number): number {
  for (let index = Math.min(beforeIndex, blocks.length - 1); index >= 0; index -= 1) {
    const block = blocks[index];
    if (!block || block.kind === 'footnote' || standaloneNoteMarker(block)) continue;
    if (containsMarker(block.text, marker)) return index;
  }
  return -1;
}

function containsMarker(text: string, marker: string): boolean {
  const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^0-9])${escaped}(?=$|[^0-9])`, 'u').test(text);
}

function joinPdfText(parts: readonly string[]): string {
  let result = '';
  for (const raw of parts) {
    const part = raw.replace(/\s+/gu, ' ').trim();
    if (!part) continue;
    if (!result) {
      result = part;
      continue;
    }
    if (/\p{L}-$/u.test(result) && /^\p{Ll}/u.test(part)) {
      result = `${result.slice(0, -1)}${part}`;
    } else {
      result += ` ${part}`;
    }
  }
  return result.replace(/\s+/gu, ' ').trim();
}

async function createApiError(response: Response): Promise<Error> {
  try {
    const payload = await response.json() as ErrorResponse;
    return new Error(payload.error?.message || `PDF import failed with HTTP ${response.status}.`);
  } catch {
    return new Error(`PDF import failed with HTTP ${response.status}.`);
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}
