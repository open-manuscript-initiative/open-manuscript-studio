import { inflateRawSync } from 'node:zlib';

import type { OjsSourceDocument } from './docxSource.js';
import type { OjsStructuredBlock } from './docxStructureTypes.js';

interface Relationship { id: string; target: string; type: string }
interface ZipEntry { method: number; compressedSize: number; uncompressedSize: number; localHeaderOffset: number }

export function applyStructuredContent(buffer: Buffer, source: OjsSourceDocument): OjsSourceDocument {
  const documentXml = readZipEntry(buffer, 'word/document.xml');
  if (!documentXml) return source;
  const numberingXml = readZipEntry(buffer, 'word/numbering.xml');
  const numbering = numberingXml ? parseNumbering(numberingXml.toString('utf8')) : new Map<string, Map<number, boolean>>();
  const relsXml = readZipEntry(buffer, 'word/_rels/document.xml.rels');
  const relationships = relsXml ? parseRelationships(relsXml.toString('utf8')) : new Map<string, Relationship>();
  const blocks: OjsStructuredBlock[] = [];
  const body = readElementBody(documentXml.toString('utf8'), 'body') ?? documentXml.toString('utf8');
  const childPattern = /<(?:[A-Za-z_][\w.-]*:)?(p|tbl)\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?\1>/g;
  let child: RegExpExecArray | null;
  let lastText = '';

  while ((child = childPattern.exec(body))) {
    const kind = child[1];
    const xml = child[2] ?? '';
    if (kind === 'tbl') {
      const cells = parseTable(xml);
      if (cells.length) blocks.push({ kind: 'table', cells, headerRows: /<(?:[A-Za-z_][\w.-]*:)?tblHeader\b/i.test(xml) ? 1 : 0, afterText: lastText });
      continue;
    }

    const text = visibleText(xml).trim();
    const list = parseListInfo(xml, numbering);
    const sourceParagraph = findSourceParagraph(source, text);
    if (text) {
      blocks.push({
        kind: 'paragraph',
        text,
        ...(sourceParagraph?.headingLevel !== undefined ? { headingLevel: sourceParagraph.headingLevel } : {}),
        ...(list ? { listLevel: list.level, ordered: list.ordered } : {}),
      });
      lastText = text;
    }

    const alt = readDocPrAlt(xml);
    for (const target of embeddedTargets(xml, relationships, 'blip', 'embed')) {
      const bytes = readZipEntry(buffer, target);
      if (!bytes) continue;
      const mediaType = mediaTypeFor(target);
      blocks.push({
        kind: 'image',
        src: `data:${mediaType};base64,${bytes.toString('base64')}`,
        mediaType,
        fileName: target.split('/').pop() ?? 'image',
        alt: alt ?? '',
        afterText: text || lastText,
      });
    }

    for (const target of embeddedTargets(xml, relationships, 'chart', 'id')) {
      const chartXml = readZipEntry(buffer, target)?.toString('utf8');
      if (!chartXml) continue;
      const chart = parseChart(chartXml);
      if (chart.cells.length > 1) blocks.push({ kind: 'chart', ...chart, afterText: text || lastText });
    }
  }

  return Object.assign(source, { structuredBlocks: blocks });
}

function findSourceParagraph(source: OjsSourceDocument, text: string) {
  const key = normalize(text);
  return source.paragraphs.find((paragraph) => normalize(paragraph.text) === key);
}

function parseListInfo(xml: string, numbering: Map<string, Map<number, boolean>>) {
  const numPr = readElementBody(xml, 'numPr');
  if (!numPr) return undefined;
  const numId = readElementValue(numPr, 'numId');
  if (!numId || numId === '0') return undefined;
  const level = Math.max(0, Number(readElementValue(numPr, 'ilvl') ?? 0) || 0);
  return { level, ordered: numbering.get(numId)?.get(level) ?? true };
}

function parseNumbering(xml: string): Map<string, Map<number, boolean>> {
  const abstractFormats = new Map<string, Map<number, boolean>>();
  const abstractPattern = /<(?:[A-Za-z_][\w.-]*:)?abstractNum\b([^>]*)>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?abstractNum>/g;
  let match: RegExpExecArray | null;
  while ((match = abstractPattern.exec(xml))) {
    const id = attr(match[1] ?? '', 'abstractNumId');
    if (!id) continue;
    const levels = new Map<number, boolean>();
    const levelPattern = /<(?:[A-Za-z_][\w.-]*:)?lvl\b([^>]*)>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?lvl>/g;
    let levelMatch: RegExpExecArray | null;
    while ((levelMatch = levelPattern.exec(match[2] ?? ''))) {
      const level = Number(attr(levelMatch[1] ?? '', 'ilvl') ?? 0);
      const format = readElementValue(levelMatch[2] ?? '', 'numFmt') ?? 'decimal';
      levels.set(level, !/^(?:bullet|none)$/i.test(format));
    }
    abstractFormats.set(id, levels);
  }

  const result = new Map<string, Map<number, boolean>>();
  const numPattern = /<(?:[A-Za-z_][\w.-]*:)?num\b([^>]*)>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?num>/g;
  while ((match = numPattern.exec(xml))) {
    const numId = attr(match[1] ?? '', 'numId');
    const abstractId = readElementValue(match[2] ?? '', 'abstractNumId');
    if (numId && abstractId && abstractFormats.has(abstractId)) result.set(numId, abstractFormats.get(abstractId) ?? new Map());
  }
  return result;
}

function parseTable(xml: string): string[][] {
  const rows: string[][] = [];
  const rowPattern = /<(?:[A-Za-z_][\w.-]*:)?tr\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?tr>/g;
  let row: RegExpExecArray | null;
  while ((row = rowPattern.exec(xml))) {
    const cells: string[] = [];
    const cellPattern = /<(?:[A-Za-z_][\w.-]*:)?tc\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?tc>/g;
    let cell: RegExpExecArray | null;
    while ((cell = cellPattern.exec(row[1] ?? ''))) cells.push(visibleText(cell[1] ?? '').trim());
    if (cells.length) rows.push(cells);
  }
  const width = Math.max(0, ...rows.map((row) => row.length));
  return rows.map((row) => Array.from({ length: width }, (_, index) => row[index] ?? ''));
}

function embeddedTargets(xml: string, relationships: Map<string, Relationship>, tag: string, attribute: string): string[] {
  const targets: string[] = [];
  const seen = new Set<string>();
  const pattern = new RegExp(`<(?:[A-Za-z_][\\w.-]*:)?${tag}\\b([^>]*)\\/?\\s*>`, 'g');
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(xml))) {
    const id = attr(match[1] ?? '', attribute);
    const target = id ? relationships.get(id)?.target : undefined;
    if (target && !seen.has(target)) { seen.add(target); targets.push(target); }
  }
  return targets;
}

function parseChart(xml: string): { cells: string[][]; chartType: 'bar' | 'line' | 'pie' | 'scatter' | 'area'; title?: string } {
  const chartType = /<(?:[A-Za-z_][\w.-]*:)?lineChart\b/i.test(xml) ? 'line' : /<(?:[A-Za-z_][\w.-]*:)?pieChart\b/i.test(xml) ? 'pie' : /<(?:[A-Za-z_][\w.-]*:)?scatterChart\b/i.test(xml) ? 'scatter' : /<(?:[A-Za-z_][\w.-]*:)?areaChart\b/i.test(xml) ? 'area' : 'bar';
  const series: Array<{ name: string; categories: string[]; values: string[] }> = [];
  const serPattern = /<(?:[A-Za-z_][\w.-]*:)?ser\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?ser>/g;
  let match: RegExpExecArray | null;
  while ((match = serPattern.exec(xml))) {
    const body = match[1] ?? '';
    const name = cachedValues(readElementBody(body, 'tx') ?? '')[0] ?? `Series ${series.length + 1}`;
    const categories = cachedValues(readElementBody(body, 'cat') ?? readElementBody(body, 'xVal') ?? '');
    const values = cachedValues(readElementBody(body, 'val') ?? readElementBody(body, 'yVal') ?? '');
    if (values.length) series.push({ name, categories, values });
  }
  const categories = series.find((item) => item.categories.length)?.categories ?? [];
  const rowCount = Math.max(categories.length, ...series.map((item) => item.values.length), 0);
  const cells = [['Category', ...series.map((item) => item.name)]];
  for (let i = 0; i < rowCount; i += 1) cells.push([categories[i] ?? String(i + 1), ...series.map((item) => item.values[i] ?? '')]);
  const titleBody = readElementBody(xml, 'title') ?? '';
  const title = visibleText(titleBody).trim();
  return { cells, chartType, ...(title ? { title } : {}) };
}

function cachedValues(xml: string): string[] {
  const values: Array<{ index: number; value: string }> = [];
  const pattern = /<(?:[A-Za-z_][\w.-]*:)?pt\b([^>]*)>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?pt>/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(xml))) {
    const index = Number(attr(match[1] ?? '', 'idx') ?? values.length);
    const value = readElementBody(match[2] ?? '', 'v');
    if (value !== undefined) values.push({ index, value: decodeXml(value) });
  }
  return values.sort((a, b) => a.index - b.index).map((item) => item.value);
}

function parseRelationships(xml: string): Map<string, Relationship> {
  const result = new Map<string, Relationship>();
  const pattern = /<(?:[A-Za-z_][\w.-]*:)?Relationship\b([^>]*?)\/?\s*>/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(xml))) {
    const a = match[1] ?? '';
    const id = attr(a, 'Id'); const target = attr(a, 'Target'); const type = attr(a, 'Type'); const mode = attr(a, 'TargetMode');
    if (!id || !target || !type || mode?.toLowerCase() === 'external') continue;
    result.set(id, { id, type, target: normalizePackagePath(target.startsWith('/') ? target.slice(1) : `word/${target}`) });
  }
  return result;
}

function readDocPrAlt(xml: string): string | undefined {
  const match = /<(?:[A-Za-z_][\w.-]*:)?docPr\b([^>]*)\/?\s*>/i.exec(xml);
  return match ? attr(match[1] ?? '', 'descr') ?? attr(match[1] ?? '', 'name') : undefined;
}

function visibleText(xml: string): string {
  const parts: string[] = [];
  const pattern = /<(?:[A-Za-z_][\w.-]*:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?t>|<(?:[A-Za-z_][\w.-]*:)?tab\b[^>]*\/?\s*>|<(?:[A-Za-z_][\w.-]*:)?(?:br|cr)\b[^>]*\/?\s*>/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(xml))) parts.push(match[1] !== undefined ? decodeXml(match[1]) : /tab\b/.test(match[0]) ? '\t' : '\n');
  return parts.join('');
}

function readElementBody(xml: string, name: string): string | undefined { return new RegExp(`<(?:[A-Za-z_][\\w.-]*:)?${name}\\b[^>]*>([\\s\\S]*?)<\\/(?:[A-Za-z_][\\w.-]*:)?${name}>`, 'i').exec(xml)?.[1] }
function readElementValue(xml: string, name: string): string | undefined { const m = new RegExp(`<(?:[A-Za-z_][\\w.-]*:)?${name}\\b([^>]*)\\/?\\s*>`, 'i').exec(xml); return m ? attr(m[1] ?? '', 'val') : undefined }
function attr(attributes: string, name: string): string | undefined { return new RegExp(`(?:^|\\s)(?:[A-Za-z_][\\w.-]*:)?${name}\\s*=\\s*["']([^"']+)["']`, 'i').exec(attributes)?.[1] }
function normalize(value: string): string { return value.replace(/\s+/g, ' ').trim() }
function normalizePackagePath(value: string): string { const out: string[] = []; for (const part of value.replace(/\\/g, '/').split('/')) { if (!part || part === '.') continue; if (part === '..') out.pop(); else out.push(part); } return out.join('/') }
function mediaTypeFor(path: string): string { const ext = path.split('.').pop()?.toLowerCase(); return ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'gif' ? 'image/gif' : ext === 'svg' ? 'image/svg+xml' : ext === 'webp' ? 'image/webp' : 'application/octet-stream' }
function decodeXml(value: string): string { return value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&') }

function readZipEntry(buffer: Buffer, wanted: string): Buffer | null {
  const entry = centralDirectory(buffer).get(normalizePackagePath(wanted)); if (!entry) return null;
  const o = entry.localHeaderOffset; if (buffer.readUInt32LE(o) !== 0x04034b50) return null;
  const dataOffset = o + 30 + buffer.readUInt16LE(o + 26) + buffer.readUInt16LE(o + 28);
  const compressed = buffer.subarray(dataOffset, dataOffset + entry.compressedSize);
  if (entry.method === 0) return Buffer.from(compressed); if (entry.method !== 8) return null;
  const inflated = inflateRawSync(compressed); return entry.uncompressedSize && inflated.length !== entry.uncompressedSize ? null : inflated;
}

function centralDirectory(buffer: Buffer): Map<string, ZipEntry> {
  const result = new Map<string, ZipEntry>(); let eocd = -1; const min = Math.max(0, buffer.length - 0xffff - 22);
  for (let o = buffer.length - 22; o >= min; o -= 1) if (buffer.readUInt32LE(o) === 0x06054b50) { eocd = o; break; }
  if (eocd < 0) return result; const count = buffer.readUInt16LE(eocd + 10); let o = buffer.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i += 1) { if (o + 46 > buffer.length || buffer.readUInt32LE(o) !== 0x02014b50) break; const nameLength = buffer.readUInt16LE(o + 28); const extra = buffer.readUInt16LE(o + 30); const comment = buffer.readUInt16LE(o + 32); const name = buffer.subarray(o + 46, o + 46 + nameLength).toString('utf8'); result.set(normalizePackagePath(name), { method: buffer.readUInt16LE(o + 10), compressedSize: buffer.readUInt32LE(o + 20), uncompressedSize: buffer.readUInt32LE(o + 24), localHeaderOffset: buffer.readUInt32LE(o + 42) }); o += 46 + nameLength + extra + comment; }
  return result;
}
