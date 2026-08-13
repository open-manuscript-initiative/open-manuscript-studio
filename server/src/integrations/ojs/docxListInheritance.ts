import { inflateRawSync } from 'node:zlib';

import type { OjsSourceDocument } from './docxSource.js';
import type { OjsStructuredBlock } from './docxStructureTypes.js';

interface ZipEntry {
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

interface ParagraphListStyle {
  id: string;
  basedOn?: string;
  numId?: string;
  level?: number;
}

interface ListInfo {
  level: number;
  ordered: boolean;
}

interface ParagraphInfo {
  text: string;
  list?: ListInfo;
}

type StructuredSource = OjsSourceDocument & {
  structuredBlocks?: OjsStructuredBlock[];
};

/**
 * Resolves Word list numbering inherited from paragraph styles.
 *
 * Word frequently stores List Bullet / List Number numbering in styles.xml
 * rather than directly on each document paragraph. The primary structured
 * parser intentionally handles direct w:numPr values; this enrichment pass
 * adds the style-inherited cases (including basedOn chains) before the launch
 * payload reaches the Studio frontend.
 */
export function applyStyleInheritedLists(
  buffer: Buffer,
  source: OjsSourceDocument,
): OjsSourceDocument {
  const structuredSource = source as StructuredSource;
  if (!Array.isArray(structuredSource.structuredBlocks)) return source;

  const documentXml = readZipEntry(buffer, 'word/document.xml')?.toString('utf8');
  const stylesXml = readZipEntry(buffer, 'word/styles.xml')?.toString('utf8');
  const numberingXml = readZipEntry(buffer, 'word/numbering.xml')?.toString('utf8');
  if (!documentXml || !stylesXml || !numberingXml) return source;

  const styles = parseParagraphListStyles(stylesXml);
  const numbering = parseNumbering(numberingXml);
  if (!styles.size || !numbering.size) return source;

  const paragraphs = extractParagraphListInfo(documentXml, styles, numbering);
  if (!paragraphs.some((paragraph) => paragraph.list)) return source;

  let paragraphCursor = 0;
  const structuredBlocks = structuredSource.structuredBlocks.map((block) => {
    if (block.kind !== 'paragraph') return block;

    const key = normalize(block.text);
    let matched: ParagraphInfo | undefined;
    for (let index = paragraphCursor; index < paragraphs.length; index += 1) {
      const candidate = paragraphs[index];
      if (!candidate) continue;
      if (normalize(candidate.text) !== key) continue;
      matched = candidate;
      paragraphCursor = index + 1;
      break;
    }

    if (!matched?.list) return block;
    return {
      ...block,
      listLevel: matched.list.level,
      ordered: matched.list.ordered,
    };
  });

  return Object.assign(source, { structuredBlocks });
}

function extractParagraphListInfo(
  documentXml: string,
  styles: ReadonlyMap<string, ParagraphListStyle>,
  numbering: ReadonlyMap<string, ReadonlyMap<number, boolean>>,
): ParagraphInfo[] {
  const result: ParagraphInfo[] = [];
  const body = readElementBody(documentXml, 'body') ?? documentXml;
  const paragraphPattern = /<(?:[A-Za-z_][\w.-]*:)?p\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?p>/g;
  let match: RegExpExecArray | null;

  while ((match = paragraphPattern.exec(body))) {
    const paragraphXml = match[1] ?? '';
    const text = visibleText(paragraphXml).trim();
    if (!text) continue;

    const directNumPr = readElementBody(paragraphXml, 'numPr');
    const directNumId = directNumPr ? readElementValue(directNumPr, 'numId') : undefined;
    const directLevel = directNumPr ? parseLevel(readElementValue(directNumPr, 'ilvl')) : undefined;

    let numId = directNumId && directNumId !== '0' ? directNumId : undefined;
    let level = directLevel;

    if (!numId) {
      const styleId = readElementValue(paragraphXml, 'pStyle');
      const inherited = styleId ? resolveStyleList(styleId, styles) : undefined;
      numId = inherited?.numId;
      level = inherited?.level;
    }

    if (!numId || numId === '0') {
      result.push({ text });
      continue;
    }

    const resolvedLevel = Math.max(0, level ?? 0);
    result.push({
      text,
      list: {
        level: resolvedLevel,
        ordered: numbering.get(numId)?.get(resolvedLevel) ?? true,
      },
    });
  }

  return result;
}

function parseParagraphListStyles(xml: string): Map<string, ParagraphListStyle> {
  const result = new Map<string, ParagraphListStyle>();
  const pattern = /<(?:[A-Za-z_][\w.-]*:)?style\b([^>]*)>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?style>/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(xml))) {
    const attributes = match[1] ?? '';
    const body = match[2] ?? '';
    const type = attr(attributes, 'type');
    if (type && type.toLowerCase() !== 'paragraph') continue;

    const id = attr(attributes, 'styleId');
    if (!id) continue;

    const pPr = readElementBody(body, 'pPr') ?? '';
    const numPr = readElementBody(pPr, 'numPr');
    const numId = numPr ? readElementValue(numPr, 'numId') : undefined;
    const level = numPr ? parseLevel(readElementValue(numPr, 'ilvl')) : undefined;
    const basedOn = readElementValue(body, 'basedOn');

    result.set(id, {
      id,
      ...(basedOn ? { basedOn } : {}),
      ...(numId && numId !== '0' ? { numId } : {}),
      ...(level !== undefined ? { level } : {}),
    });
  }

  return result;
}

function resolveStyleList(
  styleId: string,
  styles: ReadonlyMap<string, ParagraphListStyle>,
): { numId: string; level?: number } | undefined {
  const visited = new Set<string>();
  let current = styles.get(styleId);
  let inheritedLevel: number | undefined;

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    if (inheritedLevel === undefined && current.level !== undefined) {
      inheritedLevel = current.level;
    }
    if (current.numId) {
      return {
        numId: current.numId,
        ...(inheritedLevel !== undefined ? { level: inheritedLevel } : {}),
      };
    }
    current = current.basedOn ? styles.get(current.basedOn) : undefined;
  }

  return undefined;
}

function parseNumbering(xml: string): Map<string, Map<number, boolean>> {
  const abstractFormats = new Map<string, Map<number, boolean>>();
  const abstractPattern = /<(?:[A-Za-z_][\w.-]*:)?abstractNum\b([^>]*)>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?abstractNum>/g;
  let match: RegExpExecArray | null;

  while ((match = abstractPattern.exec(xml))) {
    const abstractId = attr(match[1] ?? '', 'abstractNumId');
    if (!abstractId) continue;

    const levels = new Map<number, boolean>();
    const levelPattern = /<(?:[A-Za-z_][\w.-]*:)?lvl\b([^>]*)>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?lvl>/g;
    let levelMatch: RegExpExecArray | null;
    while ((levelMatch = levelPattern.exec(match[2] ?? ''))) {
      const level = Math.max(0, Number(attr(levelMatch[1] ?? '', 'ilvl') ?? 0) || 0);
      const format = readElementValue(levelMatch[2] ?? '', 'numFmt') ?? 'decimal';
      levels.set(level, !/^(?:bullet|none)$/i.test(format));
    }
    abstractFormats.set(abstractId, levels);
  }

  const result = new Map<string, Map<number, boolean>>();
  const numPattern = /<(?:[A-Za-z_][\w.-]*:)?num\b([^>]*)>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?num>/g;
  while ((match = numPattern.exec(xml))) {
    const numId = attr(match[1] ?? '', 'numId');
    const abstractId = readElementValue(match[2] ?? '', 'abstractNumId');
    const levels = abstractId ? abstractFormats.get(abstractId) : undefined;
    if (numId && levels) result.set(numId, levels);
  }

  return result;
}

function parseLevel(value: string | undefined): number | undefined {
  if (value === undefined || !/^\d+$/.test(value)) return undefined;
  return Math.max(0, Number(value));
}

function visibleText(xml: string): string {
  const parts: string[] = [];
  const pattern = /<(?:[A-Za-z_][\w.-]*:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?t>|<(?:[A-Za-z_][\w.-]*:)?tab\b[^>]*\/?\s*>|<(?:[A-Za-z_][\w.-]*:)?(?:br|cr)\b[^>]*\/?\s*>/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(xml))) {
    if (match[1] !== undefined) parts.push(decodeXml(match[1]));
    else if (/tab\b/.test(match[0])) parts.push('\t');
    else parts.push('\n');
  }
  return parts.join('');
}

function readElementBody(xml: string, name: string): string | undefined {
  return new RegExp(
    `<(?:[A-Za-z_][\\w.-]*:)?${name}\\b[^>]*>([\\s\\S]*?)<\\/(?:[A-Za-z_][\\w.-]*:)?${name}>`,
    'i',
  ).exec(xml)?.[1];
}

function readElementValue(xml: string, name: string): string | undefined {
  const match = new RegExp(
    `<(?:[A-Za-z_][\\w.-]*:)?${name}\\b([^>]*)\\/?\\s*>`,
    'i',
  ).exec(xml);
  return match ? attr(match[1] ?? '', 'val') : undefined;
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
  const dataOffset = offset + 30 + buffer.readUInt16LE(offset + 26) + buffer.readUInt16LE(offset + 28);
  const compressed = buffer.subarray(dataOffset, dataOffset + entry.compressedSize);
  if (entry.method === 0) return Buffer.from(compressed);
  if (entry.method !== 8) return undefined;

  const inflated = inflateRawSync(compressed);
  if (entry.uncompressedSize && inflated.length !== entry.uncompressedSize) return undefined;
  return inflated;
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

    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const name = buffer.subarray(offset + 46, offset + 46 + fileNameLength).toString('utf8');
    result.set(normalizePackagePath(name), {
      method: buffer.readUInt16LE(offset + 10),
      compressedSize: buffer.readUInt32LE(offset + 20),
      uncompressedSize: buffer.readUInt32LE(offset + 24),
      localHeaderOffset: buffer.readUInt32LE(offset + 42),
    });
    offset += 46 + fileNameLength + extraLength + commentLength;
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
