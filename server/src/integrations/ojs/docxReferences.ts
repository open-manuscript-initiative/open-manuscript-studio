import { inflateRawSync } from 'node:zlib';

import type { OjsDocxInline, OjsDocxParagraph, OjsSourceDocument } from './docxSource.js';

export interface OjsSourceBibliographicContributor {
  role: 'author' | 'editor' | 'translator' | 'contributor';
  givenName?: string;
  familyName?: string;
  literalName?: string;
}

export interface OjsSourceBibliographicRecord {
  sourceTag: string;
  type: string;
  title: string;
  subtitle?: string;
  contributors: OjsSourceBibliographicContributor[];
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

export interface OjsCitationInline {
  kind: 'citationReference';
  sourceTags: string[];
  label: string;
}

export interface OjsLinkedTextInline {
  kind: 'text';
  text: string;
  semantics?: unknown;
  language?: string;
  href?: string;
}

interface ZipEntry {
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

interface Span {
  start: number;
  end: number;
  href?: string;
  citation?: OjsCitationInline;
}

interface RawParagraph {
  text: string;
  spans: Span[];
}

interface Relationship {
  target: string;
  external: boolean;
}

type ExtendedSource = OjsSourceDocument & {
  bibliographicRecords?: OjsSourceBibliographicRecord[];
};

export function applyReferenceSemantics(
  buffer: Buffer,
  source: OjsSourceDocument,
): ExtendedSource {
  const documentXml = readZipEntry(buffer, 'word/document.xml')?.toString('utf8');
  if (!documentXml) return source;

  const relsXml = readZipEntry(buffer, 'word/_rels/document.xml.rels')?.toString('utf8');
  const relationships = relsXml
    ? parseRelationships(relsXml)
    : new Map<string, Relationship>();
  const rawParagraphs = parseParagraphs(documentXml, relationships);

  let cursor = 0;
  const paragraphs = source.paragraphs.map((paragraph) => {
    const key = normalize(paragraph.text);
    let matched: RawParagraph | undefined;

    for (let index = cursor; index < rawParagraphs.length; index += 1) {
      const candidate = rawParagraphs[index];
      if (!candidate || normalize(candidate.text) !== key) continue;
      matched = candidate;
      cursor = index + 1;
      break;
    }

    return matched?.spans.length ? applySpans(paragraph, matched.spans) : paragraph;
  });

  const bibliographicRecords = parseBibliography(buffer);
  return {
    ...source,
    paragraphs,
    ...(bibliographicRecords.length ? { bibliographicRecords } : {}),
  };
}

function parseParagraphs(
  xml: string,
  relationships: ReadonlyMap<string, Relationship>,
): RawParagraph[] {
  const body = readElementBody(xml, 'body') ?? xml;
  const pattern = /<(?:[A-Za-z_][\w.-]*:)?p\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?p>/g;
  const result: RawParagraph[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(body))) {
    const paragraphXml = match[1] ?? '';
    const text = visibleText(paragraphXml);
    const spans: Span[] = [];

    const hyperlinkPattern = /<(?:[A-Za-z_][\w.-]*:)?hyperlink\b([^>]*)>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?hyperlink>/g;
    let hyperlink: RegExpExecArray | null;

    while ((hyperlink = hyperlinkPattern.exec(paragraphXml))) {
      const relationId = attr(hyperlink[1] ?? '', 'id');
      const relationship = relationId ? relationships.get(relationId) : undefined;
      if (!relationship?.external) continue;

      const label = visibleText(hyperlink[2] ?? '');
      const href = normalizeHref(relationship.target);
      if (!label || !href) continue;

      const start = visibleText(paragraphXml.slice(0, hyperlink.index)).length;
      spans.push({ start, end: start + label.length, href });
    }

    spans.push(...fieldSpans(paragraphXml));
    spans.push(...doiSpans(text));

    if (text || spans.length) {
      result.push({ text: text.trim(), spans: deduplicateSpans(spans) });
    }
  }

  return result;
}

function fieldSpans(paragraphXml: string): Span[] {
  const spans: Span[] = [];
  const simple = /<(?:[A-Za-z_][\w.-]*:)?fldSimple\b([^>]*)>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?fldSimple>/g;
  let match: RegExpExecArray | null;

  while ((match = simple.exec(paragraphXml))) {
    const instruction = decodeXml(attr(match[1] ?? '', 'instr') ?? '');
    const label = visibleText(match[2] ?? '');
    const start = visibleText(paragraphXml.slice(0, match.index)).length;
    const citationTags = parseCitationTags(instruction);

    if (citationTags.length) {
      spans.push({
        start,
        end: start + label.length,
        citation: {
          kind: 'citationReference',
          sourceTags: citationTags,
          label: label || `[${citationTags.join('; ')}]`,
        },
      });
      continue;
    }

    const href = normalizeHref(parseHyperlinkInstruction(instruction) ?? '');
    if (href && label) spans.push({ start, end: start + label.length, href });
  }

  const complex = /<(?:[A-Za-z_][\w.-]*:)?r\b[^>]*>[\s\S]*?<(?:[A-Za-z_][\w.-]*:)?fldChar\b[^>]*(?:[A-Za-z_][\w.-]*:)?fldCharType\s*=\s*["']begin["'][^>]*\/?\s*>[\s\S]*?<\/(?:[A-Za-z_][\w.-]*:)?r>([\s\S]*?)<(?:[A-Za-z_][\w.-]*:)?r\b[^>]*>[\s\S]*?<(?:[A-Za-z_][\w.-]*:)?fldChar\b[^>]*(?:[A-Za-z_][\w.-]*:)?fldCharType\s*=\s*["']separate["'][^>]*\/?\s*>[\s\S]*?<\/(?:[A-Za-z_][\w.-]*:)?r>([\s\S]*?)<(?:[A-Za-z_][\w.-]*:)?r\b[^>]*>[\s\S]*?<(?:[A-Za-z_][\w.-]*:)?fldChar\b[^>]*(?:[A-Za-z_][\w.-]*:)?fldCharType\s*=\s*["']end["'][^>]*\/?\s*>[\s\S]*?<\/(?:[A-Za-z_][\w.-]*:)?r>/g;

  while ((match = complex.exec(paragraphXml))) {
    const instruction = descendantsText(match[1] ?? '', 'instrText').join(' ');
    const label = visibleText(match[2] ?? '');
    const start = visibleText(paragraphXml.slice(0, match.index)).length;
    const citationTags = parseCitationTags(instruction);

    if (citationTags.length) {
      spans.push({
        start,
        end: start + label.length,
        citation: {
          kind: 'citationReference',
          sourceTags: citationTags,
          label: label || `[${citationTags.join('; ')}]`,
        },
      });
      continue;
    }

    const href = normalizeHref(parseHyperlinkInstruction(instruction) ?? '');
    if (href && label) spans.push({ start, end: start + label.length, href });
  }

  return spans;
}

function doiSpans(text: string): Span[] {
  const result: Span[] = [];
  const pattern = /(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)?(10\.\d{4,9}\/[\w.()/:;-]+[\w()/:;-])/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text))) {
    const doi = match[1]?.replace(/[.,;:]+$/, '');
    if (!doi) continue;
    const full = match[0];
    const doiOffset = full.toLowerCase().lastIndexOf(doi.toLowerCase());
    const start = match.index + Math.max(0, doiOffset);
    result.push({ start, end: start + doi.length, href: `https://doi.org/${doi}` });
  }

  return result;
}

function applySpans(
  paragraph: OjsDocxParagraph,
  spans: readonly Span[],
): OjsDocxParagraph {
  const original = paragraph.inline?.length
    ? paragraph.inline
    : [{ kind: 'text', text: paragraph.text } satisfies OjsDocxInline];
  const sorted = [...spans]
    .filter((span) => span.end >= span.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  if (!sorted.length) return paragraph;

  const result: Array<OjsDocxInline | OjsCitationInline | OjsLinkedTextInline> = [];
  let absolute = 0;
  let spanIndex = 0;

  for (const item of original) {
    if (item.kind !== 'text') {
      result.push(item);
      continue;
    }

    const textItem = item as OjsLinkedTextInline;
    let local = 0;

    while (local < textItem.text.length) {
      while (
        spanIndex < sorted.length &&
        (sorted[spanIndex]?.end ?? 0) <= absolute + local
      ) {
        spanIndex += 1;
      }

      const span = sorted[spanIndex];
      if (!span || span.start >= absolute + textItem.text.length) {
        result.push({ ...textItem, text: textItem.text.slice(local) });
        break;
      }

      const relativeStart = Math.max(local, span.start - absolute);
      if (relativeStart > local) {
        result.push({ ...textItem, text: textItem.text.slice(local, relativeStart) });
        local = relativeStart;
      }

      if (span.citation && span.start === absolute + local) {
        const consume = Math.max(
          0,
          Math.min(textItem.text.length - local, span.end - span.start),
        );
        result.push(span.citation);
        local += consume;
        if (absolute + local >= span.end) spanIndex += 1;
        continue;
      }

      if (span.href && span.start <= absolute + local && span.end > absolute + local) {
        const take = Math.min(
          textItem.text.length - local,
          span.end - (absolute + local),
        );
        result.push({
          ...textItem,
          text: textItem.text.slice(local, local + take),
          href: span.href,
        });
        local += take;
        if (absolute + local >= span.end) spanIndex += 1;
        continue;
      }

      result.push({ ...textItem, text: textItem.text.slice(local, local + 1) });
      local += 1;
    }

    absolute += textItem.text.length;
  }

  return { ...paragraph, inline: result as OjsDocxInline[] };
}

function parseBibliography(buffer: Buffer): OjsSourceBibliographicRecord[] {
  const records: OjsSourceBibliographicRecord[] = [];
  const seen = new Set<string>();

  for (const name of centralDirectory(buffer).keys()) {
    if (!/^customXml\/item\d+\.xml$/i.test(name)) continue;
    const xml = readZipEntry(buffer, name)?.toString('utf8');
    if (!xml) continue;

    const sourcePattern = /<(?:[A-Za-z_][\w.-]*:)?Source\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?Source>/g;
    let source: RegExpExecArray | null;

    while ((source = sourcePattern.exec(xml))) {
      const body = source[1] ?? '';
      const sourceTag = firstElementText(body, 'Tag')?.trim();
      const title = firstElementText(body, 'Title')?.trim();
      if (!sourceTag || !title || seen.has(sourceTag)) continue;
      seen.add(sourceTag);

      const url = firstElementText(body, 'URL')?.trim();
      const standard = firstElementText(body, 'StandardNumber')?.trim();
      const identifiers: Array<{ scheme: string; value: string }> = [];
      if (url) identifiers.push({ scheme: 'url', value: url });
      if (standard) {
        identifiers.push({
          scheme: /^97[89]/.test(standard.replace(/[-\s]/g, ''))
            ? 'isbn'
            : 'identifier',
          value: standard,
        });
      }

      const doi = extractDoi(
        [url, standard, firstElementText(body, 'Comments')]
          .filter((value): value is string => Boolean(value))
          .join(' '),
      );
      if (doi) identifiers.push({ scheme: 'doi', value: doi });

      const containerTitle = firstElementText(body, 'JournalName')?.trim();
      const issued = firstElementText(body, 'Year')?.trim();
      const publisher = firstElementText(body, 'Publisher')?.trim();
      const place = firstElementText(body, 'City')?.trim();
      const volume = firstElementText(body, 'Volume')?.trim();
      const issue = firstElementText(body, 'Issue')?.trim();
      const pages = firstElementText(body, 'Pages')?.trim();

      records.push({
        sourceTag,
        type: mapSourceType(firstElementText(body, 'SourceType')),
        title,
        contributors: parseContributors(body),
        ...(containerTitle ? { containerTitle } : {}),
        ...(issued ? { issued } : {}),
        ...(publisher ? { publisher } : {}),
        ...(place ? { place } : {}),
        ...(volume ? { volume } : {}),
        ...(issue ? { issue } : {}),
        ...(pages ? { pages } : {}),
        identifiers,
        ...(url ? { url } : {}),
      });
    }
  }

  return records;
}

function parseContributors(xml: string): OjsSourceBibliographicContributor[] {
  const result: OjsSourceBibliographicContributor[] = [];
  const personPattern = /<(?:[A-Za-z_][\w.-]*:)?Person\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?Person>/g;
  let match: RegExpExecArray | null;

  while ((match = personPattern.exec(xml))) {
    const body = match[1] ?? '';
    const givenName = [
      firstElementText(body, 'First'),
      firstElementText(body, 'Middle'),
    ]
      .filter((value): value is string => Boolean(value))
      .join(' ')
      .trim();
    const familyName = firstElementText(body, 'Last')?.trim();
    if (!givenName && !familyName) continue;

    result.push({
      role: 'author',
      ...(givenName ? { givenName } : {}),
      ...(familyName ? { familyName } : {}),
    });
  }

  return result;
}

function parseRelationships(xml: string): Map<string, Relationship> {
  const result = new Map<string, Relationship>();
  const pattern = /<(?:[A-Za-z_][\w.-]*:)?Relationship\b([^>]*?)\/?\s*>/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(xml))) {
    const attributes = match[1] ?? '';
    const id = attr(attributes, 'Id');
    const target = attr(attributes, 'Target');
    if (!id || !target) continue;
    result.set(id, {
      target,
      external: attr(attributes, 'TargetMode')?.toLowerCase() === 'external',
    });
  }

  return result;
}

function parseCitationTags(value: string): string[] {
  const input = value.replace(/\s+/g, ' ').trim();
  if (!/\bCITATION\b/i.test(input)) return [];

  const remainder = input
    .slice(input.search(/\bCITATION\b/i))
    .replace(/^CITATION\s+/i, '');
  const tokens = remainder.match(/"[^"]*"|'[^']*'|\S+/g) ?? [];
  const tags: string[] = [];
  let expectSource = true;

  for (const token of tokens) {
    if (/^\\m$/i.test(token)) {
      expectSource = true;
      continue;
    }
    if (token.startsWith('\\')) {
      expectSource = false;
      continue;
    }
    if (!expectSource) continue;

    const cleaned = token.replace(/^["']|["']$/g, '').trim();
    if (cleaned) tags.push(cleaned);
    expectSource = false;
  }

  return Array.from(new Set(tags));
}

function parseHyperlinkInstruction(value: string): string | undefined {
  const input = value.replace(/\s+/g, ' ').trim();
  const match = /^HYPERLINK\s+(?:"([^"]+)"|'([^']+)'|([^\s\\]+))/i.exec(input);
  return (match?.[1] ?? match?.[2] ?? match?.[3])?.trim() || undefined;
}

function mapSourceType(value: string | undefined): string {
  const normalized = (value ?? '').replace(/\s+/g, '').toLowerCase();
  if (/journalarticle|articleinaperiodical/.test(normalized)) return 'journal-article';
  if (/booksection|bookchapter/.test(normalized)) return 'book-chapter';
  if (/book/.test(normalized)) return 'book';
  if (/conference/.test(normalized)) return 'conference-paper';
  if (/thesis|dissertation/.test(normalized)) return 'thesis';
  if (/report/.test(normalized)) return 'report';
  if (/website|documentfrominternet|internet/.test(normalized)) return 'web-page';
  return 'journal-article';
}

function deduplicateSpans(spans: Span[]): Span[] {
  const result: Span[] = [];
  const keys = new Set<string>();

  for (const span of spans) {
    const key = `${span.start}:${span.end}:${span.href ?? ''}:${span.citation?.sourceTags.join(',') ?? ''}`;
    if (keys.has(key)) continue;
    keys.add(key);
    result.push(span);
  }

  return result;
}

function extractDoi(value: string): string | undefined {
  return /10\.\d{4,9}\/[\w.()/:;-]+/i
    .exec(value)?.[0]
    ?.replace(/[.,;:]+$/, '');
}

function normalizeHref(value: string): string | undefined {
  const input = value.trim();
  if (!input) return undefined;
  if (/^(?:https?:|mailto:)/i.test(input)) return input;
  if (/^www\./i.test(input)) return `https://${input}`;
  return undefined;
}

function visibleText(xml: string): string {
  const parts: string[] = [];
  const pattern = /<(?:[A-Za-z_][\w.-]*:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?t>|<(?:[A-Za-z_][\w.-]*:)?tab\b[^>]*\/?\s*>|<(?:[A-Za-z_][\w.-]*:)?(?:br|cr)\b[^>]*\/?\s*>/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(xml))) {
    if (match[1] !== undefined) parts.push(decodeXml(match[1]));
    else if (/tab\b/i.test(match[0])) parts.push('\t');
    else parts.push('\n');
  }

  return parts.join('');
}

function descendantsText(xml: string, name: string): string[] {
  const result: string[] = [];
  const pattern = new RegExp(
    `<(?:[A-Za-z_][\\w.-]*:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[A-Za-z_][\\w.-]*:)?${name}>`,
    'gi',
  );
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(xml))) {
    result.push(decodeXml(match[1] ?? ''));
  }

  return result;
}

function firstElementText(xml: string, name: string): string | undefined {
  return descendantsText(xml, name)[0];
}

function readElementBody(xml: string, name: string): string | undefined {
  return new RegExp(
    `<(?:[A-Za-z_][\\w.-]*:)?${name}\\b[^>]*>([\\s\\S]*?)<\\/(?:[A-Za-z_][\\w.-]*:)?${name}>`,
    'i',
  ).exec(xml)?.[1];
}

function attr(attributes: string, name: string): string | undefined {
  return new RegExp(
    `(?:^|\\s)(?:[A-Za-z_][\\w.-]*:)?${name}\\s*=\\s*["']([^"']+)["']`,
    'i',
  ).exec(attributes)?.[1];
}

function normalize(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function readZipEntry(buffer: Buffer, wanted: string): Buffer | undefined {
  const entry = centralDirectory(buffer).get(normalizePackagePath(wanted));
  if (!entry) return undefined;

  const offset = entry.localHeaderOffset;
  if (buffer.readUInt32LE(offset) !== 0x04034b50) return undefined;

  const dataOffset =
    offset +
    30 +
    buffer.readUInt16LE(offset + 26) +
    buffer.readUInt16LE(offset + 28);
  const compressed = buffer.subarray(
    dataOffset,
    dataOffset + entry.compressedSize,
  );

  if (entry.method === 0) return Buffer.from(compressed);
  if (entry.method !== 8) return undefined;

  const inflated = inflateRawSync(compressed);
  return entry.uncompressedSize && inflated.length !== entry.uncompressedSize
    ? undefined
    : inflated;
}

function centralDirectory(buffer: Buffer): Map<string, ZipEntry> {
  const result = new Map<string, ZipEntry>();
  let eocd = -1;
  const minimum = Math.max(0, buffer.length - 0xffff - 22);

  for (let offset = buffer.length - 22; offset >= minimum; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      eocd = offset;
      break;
    }
  }

  if (eocd < 0) return result;

  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);

  for (let index = 0; index < count && offset + 46 <= buffer.length; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break;

    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const name = buffer
      .subarray(offset + 46, offset + 46 + nameLength)
      .toString('utf8');

    result.set(normalizePackagePath(name), {
      method: buffer.readUInt16LE(offset + 10),
      compressedSize: buffer.readUInt32LE(offset + 20),
      uncompressedSize: buffer.readUInt32LE(offset + 24),
      localHeaderOffset: buffer.readUInt32LE(offset + 42),
    });

    offset += 46 + nameLength + extraLength + commentLength;
  }

  return result;
}

function normalizePackagePath(value: string): string {
  const result: string[] = [];
  for (const part of value.replace(/\\/g, '/').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') result.pop();
    else result.push(part);
  }
  return result.join('/');
}
