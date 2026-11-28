import { readAssignmentTranslation, type AssignmentTranslation } from './translationAssignmentPolicy.js';
export type ReviewInlineSemantic =
  | 'strong'
  | 'emphasis'
  | 'strike'
  | 'underline'
  | 'small-caps'
  | 'superscript'
  | 'subscript'
  | 'code';

export interface ReviewCitationReference {
  sourceTags: string[];
  label: string;
}

export interface ReviewInlineSpan {
  text: string;
  semantics?: ReviewInlineSemantic[];
  language?: string;
  href?: string;
  citation?: ReviewCitationReference;
}

export interface ReviewBibliographicContributor {
  role: 'author' | 'editor' | 'translator' | 'contributor';
  givenName?: string;
  familyName?: string;
  literalName?: string;
}

export interface ReviewBibliographicRecord {
  sourceTag: string;
  type: string;
  title: string;
  subtitle?: string;
  contributors: ReviewBibliographicContributor[];
  containerTitle?: string;
  issued?: string;
  publisher?: string;
  place?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  identifiers: Array<{ scheme: string; value: string }>;
  url?: string;
}

export type ReviewChartType = 'bar' | 'horizontal-bar' | 'stacked-bar' | 'stacked-100' | 'line' | 'area' | 'pie' | 'donut' | 'scatter' | 'radar';

export type ReviewManuscriptBlock = (
  | { type: 'heading'; text: string; level?: number; richText?: ReviewInlineSpan[] }
  | { type: 'paragraph'; text: string; richText?: ReviewInlineSpan[] }
  | { type: 'note'; text: string; richText?: ReviewInlineSpan[] }
  | { type: 'list'; text: string; ordered: boolean; listLevel: number; ordinal?: number; richText?: ReviewInlineSpan[] }
  | { type: 'table'; cells: string[][]; headerRows: number }
  | { type: 'image'; src: string; mediaType: string; alt?: string }
  | { type: 'chart'; cells: string[][]; chartType: ReviewChartType; title?: string }) & { id?: string };

export interface ReviewAnnotation {
  id: string;
  type: 'comment';
  targetBlockId: string;
  targetText: string;
  targetStart?: number;
  body: string;
  visibility: 'author_and_editor' | 'editor_only';
  status: 'open' | 'resolved';
  anchorStatus?: 'resolved' | 'unresolved';
  replyToCommentId?: string;
  authorName?: string;
  createdAt?: string;
  modifiedAt?: string;
}

export interface ReviewManuscriptSnapshot {
  translation?: AssignmentTranslation;
  documentKind: 'article';
  authorIdentity: 'hidden' | 'visible';
  authors?: Array<{ name: string }>;
  annotations?: ReviewAnnotation[];
  title: string;
  subtitle?: string;
  abstract?: string;
  keywords: string[];
  blocks: ReviewManuscriptBlock[];
  bibliographicRecords: ReviewBibliographicRecord[];
}

export function sanitizeReviewManuscript(input: unknown, openIdentity = false): ReviewManuscriptSnapshot {
  const record = asRecord(input);
  const title = cleanText(record.title, 500) || 'Untitled article';
  const subtitle = cleanText(record.subtitle, 500);
  const abstract = cleanText(record.abstract, 20_000);
  const keywords = Array.isArray(record.keywords)
    ? record.keywords
        .map((value) => cleanText(value, 200))
        .filter((value): value is string => Boolean(value))
        .slice(0, 100)
    : [];

  const rawBlocks = Array.isArray(record.blocks) ? record.blocks : [];
  const blocks: ReviewManuscriptBlock[] = [];

  for (const rawBlock of rawBlocks.slice(0, 20_000)) {
    const block = asRecord(rawBlock);
    const blockIdentity = { id: cleanText(block.id, 128) ?? `review-block-${blocks.length}` };

    if (block.type === 'table') {
      const cells = sanitizeCells(block.cells);
      if (!cells.length) continue;
      const headerRows = typeof block.headerRows === 'number'
        ? Math.max(0, Math.min(cells.length, Math.trunc(block.headerRows)))
        : 0;
      blocks.push({ ...blockIdentity, type: 'table', cells, headerRows });
      continue;
    }

    if (block.type === 'chart') {
      const cells = sanitizeCells(block.cells);
      if (!cells.length) continue;
      const chartType = sanitizeChartType(block.chartType);
      const chartTitle = cleanText(block.title, 1_000);
      blocks.push({ ...blockIdentity,
        type: 'chart',
        cells,
        chartType,
        ...(chartTitle ? { title: chartTitle } : {}),
      });
      continue;
    }

    if (block.type === 'image') {
      const src = cleanImageSource(block.src);
      if (!src) continue;
      const mediaType = cleanText(block.mediaType, 200) || 'application/octet-stream';
      const alt = cleanText(block.alt, 4_000);
      blocks.push({ ...blockIdentity,
        type: 'image',
        src,
        mediaType,
        ...(alt ? { alt } : {}),
      });
      continue;
    }

    const text = cleanText(block.text, 200_000) ?? (typeof block.text === 'string' ? '' : undefined);
    if (text === undefined) continue;
    const richText = sanitizeRichText(block.richText);

    if (block.type === 'heading') {
      const level = typeof block.level === 'number'
        ? Math.max(1, Math.min(6, Math.trunc(block.level)))
        : undefined;
      blocks.push({ ...blockIdentity,
        type: 'heading',
        text,
        ...(level !== undefined ? { level } : {}),
        ...(richText.length ? { richText } : {}),
      });
      continue;
    }

    if (block.type === 'note') {
      blocks.push({ ...blockIdentity, type: 'note', text, ...(richText.length ? { richText } : {}) });
      continue;
    }

    if (block.type === 'list') {
      const listLevel = typeof block.listLevel === 'number'
        ? Math.max(0, Math.min(8, Math.trunc(block.listLevel)))
        : 0;
      const ordinal = typeof block.ordinal === 'number' && Number.isFinite(block.ordinal)
        ? Math.max(1, Math.min(99_999, Math.trunc(block.ordinal)))
        : undefined;
      blocks.push({ ...blockIdentity,
        type: 'list',
        text,
        ordered: block.ordered === true,
        listLevel,
        ...(ordinal !== undefined ? { ordinal } : {}),
        ...(richText.length ? { richText } : {}),
      });
      continue;
    }

    blocks.push({ ...blockIdentity, type: 'paragraph', text, ...(richText.length ? { richText } : {}) });
  }

  return {
    // Reviewer snapshots are an allow-listed, article-only projection. These
    // literals are deliberately not copied from input, so a stored payload
    // cannot opt into book chrome or author identity disclosure.
    documentKind: 'article',
    authorIdentity: openIdentity ? 'visible' : 'hidden',
    ...(openIdentity ? { authors: sanitizeAuthors(record.authors) } : {}),
    annotations: sanitizeAnnotations(record.annotations, blocks, openIdentity),
    title,
    ...(subtitle ? { subtitle } : {}),
    ...(abstract ? { abstract } : {}),
    keywords,
    blocks,
    bibliographicRecords: sanitizeBibliographicRecords(record.bibliographicRecords),
    ...(readAssignmentTranslation(record.translation) ? { translation: readAssignmentTranslation(record.translation)! } : {}),
  };
}

function sanitizeCells(value: unknown): string[][] {
  if (!Array.isArray(value)) return [];
  const rows: string[][] = [];
  for (const rawRow of value.slice(0, 2_000)) {
    if (!Array.isArray(rawRow)) continue;
    const row = rawRow
      .slice(0, 100)
      .map((cell) => cleanText(cell, 20_000) ?? '');
    if (row.length) rows.push(row);
  }
  const width = Math.max(0, ...rows.map((row) => row.length));
  return rows.map((row) => Array.from({ length: width }, (_, index) => row[index] ?? ''));
}

function sanitizeRichText(value: unknown): ReviewInlineSpan[] {
  if (!Array.isArray(value)) return [];
  const spans: ReviewInlineSpan[] = [];
  for (const rawSpan of value.slice(0, 20_000)) {
    const span = asRecord(rawSpan);
    const text = cleanInlineText(span.text, 200_000);
    if (!text) continue;
    const semantics = Array.isArray(span.semantics)
      ? span.semantics.filter(isInlineSemantic).slice(0, 8)
      : [];
    const language = cleanText(span.language, 100);
    const href = cleanExternalUrl(span.href);
    const citation = sanitizeCitationReference(span.citation, text);
    spans.push({
      text,
      ...(semantics.length ? { semantics } : {}),
      ...(language ? { language } : {}),
      ...(href ? { href } : {}),
      ...(citation ? { citation } : {}),
    });
  }
  return spans;
}

function sanitizeCitationReference(value: unknown, fallbackLabel: string): ReviewCitationReference | undefined {
  const record = asRecord(value);
  const sourceTags = Array.isArray(record.sourceTags)
    ? record.sourceTags
        .map((item) => cleanText(item, 500))
        .filter((item): item is string => Boolean(item))
        .slice(0, 100)
    : [];
  if (!sourceTags.length) return undefined;
  const label = cleanInlineText(record.label, 5_000) ?? fallbackLabel;
  return { sourceTags, label };
}

function sanitizeBibliographicRecords(value: unknown): ReviewBibliographicRecord[] {
  if (!Array.isArray(value)) return [];
  const result: ReviewBibliographicRecord[] = [];
  const seen = new Set<string>();

  for (const rawRecord of value.slice(0, 10_000)) {
    const record = asRecord(rawRecord);
    const sourceTag = cleanText(record.sourceTag, 500);
    const title = cleanText(record.title, 5_000);
    if (!sourceTag || !title || seen.has(sourceTag)) continue;
    seen.add(sourceTag);

    const contributors: ReviewBibliographicContributor[] = [];
    if (Array.isArray(record.contributors)) {
      for (const rawContributor of record.contributors.slice(0, 100)) {
        const contributor = asRecord(rawContributor);
        const role = sanitizeBibliographicRole(contributor.role);
        const givenName = cleanText(contributor.givenName, 500);
        const familyName = cleanText(contributor.familyName, 500);
        const literalName = cleanText(contributor.literalName, 1_000);
        if (!givenName && !familyName && !literalName) continue;
        contributors.push({
          role,
          ...(givenName ? { givenName } : {}),
          ...(familyName ? { familyName } : {}),
          ...(literalName ? { literalName } : {}),
        });
      }
    }

    const identifiers: Array<{ scheme: string; value: string }> = [];
    if (Array.isArray(record.identifiers)) {
      for (const rawIdentifier of record.identifiers.slice(0, 100)) {
        const identifier = asRecord(rawIdentifier);
        const scheme = cleanText(identifier.scheme, 100);
        const identifierValue = cleanText(identifier.value, 5_000);
        if (scheme && identifierValue) identifiers.push({ scheme, value: identifierValue });
      }
    }

    const type = cleanText(record.type, 200) ?? 'document';
    const subtitle = cleanText(record.subtitle, 5_000);
    const containerTitle = cleanText(record.containerTitle, 5_000);
    const issued = cleanText(record.issued, 500);
    const publisher = cleanText(record.publisher, 2_000);
    const place = cleanText(record.place, 1_000);
    const volume = cleanText(record.volume, 500);
    const issue = cleanText(record.issue, 500);
    const pages = cleanText(record.pages, 500);
    const url = cleanExternalUrl(record.url);

    result.push({
      sourceTag,
      type,
      title,
      contributors,
      identifiers,
      ...(subtitle ? { subtitle } : {}),
      ...(containerTitle ? { containerTitle } : {}),
      ...(issued ? { issued } : {}),
      ...(publisher ? { publisher } : {}),
      ...(place ? { place } : {}),
      ...(volume ? { volume } : {}),
      ...(issue ? { issue } : {}),
      ...(pages ? { pages } : {}),
      ...(url ? { url } : {}),
    });
  }

  return result;
}

function sanitizeBibliographicRole(value: unknown): ReviewBibliographicContributor['role'] {
  if (value === 'editor' || value === 'translator' || value === 'contributor') return value;
  return 'author';
}

function isInlineSemantic(value: unknown): value is ReviewInlineSemantic {
  return value === 'strong' || value === 'emphasis' || value === 'strike' ||
    value === 'underline' || value === 'small-caps' || value === 'superscript' ||
    value === 'subscript' || value === 'code';
}

function sanitizeChartType(value: unknown): ReviewChartType {
  return typeof value === 'string' && (['bar', 'horizontal-bar', 'stacked-bar', 'stacked-100', 'line', 'area', 'pie', 'donut', 'scatter', 'radar'] as string[]).includes(value)
    ? value as ReviewChartType
    : 'bar';
}

function cleanImageSource(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 35 * 1024 * 1024) return undefined;
  const normalized = value.replaceAll('\u0000', '').trim();
  if (/^https:\/\//i.test(normalized)) return normalized;
  if (/^data:image\/(?:png|jpe?g|gif|webp|svg\+xml);base64,/i.test(normalized)) return normalized;
  return undefined;
}

function cleanExternalUrl(value: unknown): string | undefined {
  const normalized = cleanText(value, 10_000);
  return normalized && /^https?:\/\//i.test(normalized) ? normalized : undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function cleanText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.replaceAll('\u0000', '').trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
}

function cleanInlineText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.replaceAll('\u0000', '').slice(0, maxLength);
  return normalized.length ? normalized : undefined;
}


function sanitizeAuthors(value: unknown): Array<{ name: string }> {
  return Array.isArray(value) ? value.slice(0, 100).flatMap(item => {
    const name = cleanText(asRecord(item).name, 500);
    return name ? [{ name }] : [];
  }) : [];
}
function sanitizeAnnotations(value: unknown, blocks: ReviewManuscriptBlock[], openIdentity: boolean): ReviewAnnotation[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  const blockIds = new Set(blocks.map(block => block.id));
  const result: ReviewAnnotation[] = [];
  for (const raw of value.slice(0, 10_000)) {
    const item = asRecord(raw), id = cleanText(item.id, 128), targetBlockId = cleanText(item.targetBlockId, 128), body = cleanText(item.body, 65_536);
    if (!id || ids.has(id) || !body || !targetBlockId) continue;
    ids.add(id);
    const authorName = openIdentity ? cleanText(item.authorName, 500) : undefined;
    const replyToCommentId = cleanText(item.replyToCommentId, 128);
    result.push({ id, type: 'comment', targetBlockId, body,
      targetText: cleanText(item.targetText, 20_000) ?? '',
      ...(typeof item.targetStart === 'number' && Number.isSafeInteger(item.targetStart) && item.targetStart >= 0 ? { targetStart: item.targetStart } : {}),
      visibility: item.visibility === 'author_and_editor' ? 'author_and_editor' : 'editor_only',
      status: item.status === 'resolved' ? 'resolved' : 'open',
      anchorStatus: item.anchorStatus === 'unresolved' || !blockIds.has(targetBlockId) ? 'unresolved' : 'resolved',
      ...(authorName ? { authorName } : {}), ...(replyToCommentId ? { replyToCommentId } : {}),
      ...validTimestamp(item.createdAt, 'createdAt'), ...validTimestamp(item.modifiedAt, 'modifiedAt'),
    });
  }
  const visible = new Map(result.map(item => [item.id, item.visibility]));
  return result.map(item => {
    if (item.replyToCommentId && (!visible.has(item.replyToCommentId) || item.replyToCommentId === item.id ||
      (item.visibility === 'author_and_editor' && visible.get(item.replyToCommentId) !== 'author_and_editor'))) {
      const { replyToCommentId: _parent, ...standalone } = item;
      return standalone;
    }
    return item;
  });
}
function validTimestamp(value: unknown, key: 'createdAt' | 'modifiedAt'): Partial<Pick<ReviewAnnotation, 'createdAt' | 'modifiedAt'>> {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? { [key]: new Date(value).toISOString() } : {};
}
export function authorVisibleReviewManuscript(input: unknown, openIdentity = false): ReviewManuscriptSnapshot {
  const snapshot = sanitizeReviewManuscript(input, openIdentity);
  return { ...snapshot, annotations: snapshot.annotations?.filter(item => item.visibility === 'author_and_editor') ?? [] };
}
