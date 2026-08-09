import { inflateRawSync } from 'node:zlib';

import type { OjsSourceDocument } from './docxSource.js';

interface ParagraphFormatting {
  text: string;
  boldRatio: number;
  maxFontHalfPoints?: number;
  alignment?: string;
  spacingBefore?: number;
  spacingAfter?: number;
}

/**
 * Adds heading levels for manuscripts that use direct Word formatting instead
 * of paragraph styles. Existing semantic heading/outline information always
 * wins; this function is deliberately a conservative fallback.
 */
export function applyDirectFormattingHeadingInference(
  buffer: Buffer,
  source: OjsSourceDocument,
): OjsSourceDocument {
  const documentXml = readZipEntry(buffer, 'word/document.xml');
  if (!documentXml) return source;

  const formatting = extractParagraphFormatting(documentXml.toString('utf8'));
  if (!formatting.length) return source;

  const bodyFontHalfPoints = inferBodyFontHalfPoints(formatting);
  const paragraphs = source.paragraphs.map((paragraph, index) => {
    if (paragraph.headingLevel !== undefined || paragraph.outlineLevel !== undefined) {
      return paragraph;
    }

    const format = formatting[index];
    if (!format || normalizeText(format.text) !== normalizeText(paragraph.text)) {
      return paragraph;
    }

    const headingLevel = inferHeadingLevel(format, bodyFontHalfPoints);
    return headingLevel === undefined
      ? paragraph
      : { ...paragraph, headingLevel };
  });

  return { ...source, paragraphs };
}

function inferHeadingLevel(
  paragraph: ParagraphFormatting,
  bodyFontHalfPoints: number | undefined,
): number | undefined {
  const text = paragraph.text.trim();
  if (!text || text.length > 160 || text.split(/\s+/).length > 18) return undefined;

  // Long sentence-like paragraphs are not headings even when emphasis is used.
  if (/[.!?][”"')\]]?$/.test(text) && text.split(/\s+/).length > 7) return undefined;

  const enlargedBy =
    bodyFontHalfPoints !== undefined && paragraph.maxFontHalfPoints !== undefined
      ? paragraph.maxFontHalfPoints - bodyFontHalfPoints
      : 0;
  const stronglyBold = paragraph.boldRatio >= 0.8;
  const moderatelyBold = paragraph.boldRatio >= 0.55;
  const centered = paragraph.alignment === 'center';
  const separated =
    (paragraph.spacingBefore ?? 0) >= 120 ||
    (paragraph.spacingAfter ?? 0) >= 120;

  let score = 0;
  if (stronglyBold) score += 2;
  else if (moderatelyBold) score += 1;
  if (enlargedBy >= 4) score += 2; // at least 2 pt larger than body text
  if (enlargedBy >= 8) score += 1; // at least 4 pt larger
  if (centered) score += 1;
  if (separated) score += 1;
  if (/^[\p{Lu}\d][^.!?]{1,100}$/u.test(text)) score += 1;

  // Require a genuinely typographic signal. Spacing/alignment alone is not
  // sufficient because quotations and epigraphs often use those properties.
  if (!(moderatelyBold || enlargedBy >= 4) || score < 3) return undefined;

  const numbered = /^(\d+(?:\.\d+){0,5})[.)]?\s+\S/.exec(text);
  if (numbered?.[1]) return Math.min(6, numbered[1].split('.').length);

  if (bodyFontHalfPoints !== undefined && paragraph.maxFontHalfPoints !== undefined) {
    if (enlargedBy >= 12) return 1;
    if (enlargedBy >= 8) return 2;
    if (enlargedBy >= 4) return 3;
  }

  return 2;
}

function inferBodyFontHalfPoints(
  paragraphs: ParagraphFormatting[],
): number | undefined {
  const values = paragraphs
    .filter((paragraph) => paragraph.text.length >= 80 && paragraph.boldRatio < 0.5)
    .map((paragraph) => paragraph.maxFontHalfPoints)
    .filter((value): value is number => value !== undefined && value >= 12 && value <= 72);

  if (!values.length) {
    const fallback = paragraphs
      .map((paragraph) => paragraph.maxFontHalfPoints)
      .filter((value): value is number => value !== undefined && value >= 12 && value <= 72);
    if (!fallback.length) return undefined;
    return mode(fallback);
  }

  return mode(values);
}

function mode(values: number[]): number {
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? values[0]!;
}

function extractParagraphFormatting(xml: string): ParagraphFormatting[] {
  const result: ParagraphFormatting[] = [];
  const paragraphPattern = /<(?:[A-Za-z_][\w.-]*:)?p(?:\s[^>]*)?>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?p>/g;
  let paragraphMatch: RegExpExecArray | null;

  while ((paragraphMatch = paragraphPattern.exec(xml))) {
    const body = paragraphMatch[1] ?? '';
    const text = extractText(body).trim();
    const hasNoteReference = /<(?:[A-Za-z_][\w.-]*:)?(?:footnoteReference|endnoteReference)\b/.test(body);
    if (!text && !hasNoteReference) continue;

    const textRuns = extractTextRuns(body);
    const totalCharacters = textRuns.reduce((sum, run) => sum + run.text.length, 0);
    const boldCharacters = textRuns.reduce(
      (sum, run) => sum + (run.bold ? run.text.length : 0),
      0,
    );
    const sizes = textRuns
      .map((run) => run.fontHalfPoints)
      .filter((value): value is number => value !== undefined);

    result.push({
      text,
      boldRatio: totalCharacters ? boldCharacters / totalCharacters : 0,
      maxFontHalfPoints: sizes.length ? Math.max(...sizes) : readParagraphRunFontSize(body),
      alignment: readElementValue(body, 'jc'),
      spacingBefore: readNumericAttributeFromElement(body, 'spacing', 'before'),
      spacingAfter: readNumericAttributeFromElement(body, 'spacing', 'after'),
    });
  }

  return result;
}

function extractTextRuns(body: string): Array<{
  text: string;
  bold: boolean;
  fontHalfPoints?: number;
}> {
  const runs: Array<{ text: string; bold: boolean; fontHalfPoints?: number }> = [];
  const runPattern = /<(?:[A-Za-z_][\w.-]*:)?r(?:\s[^>]*)?>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?r>/g;
  let match: RegExpExecArray | null;

  while ((match = runPattern.exec(body))) {
    const run = match[1] ?? '';
    const text = extractText(run);
    if (!text) continue;
    const rPr = /<(?:[A-Za-z_][\w.-]*:)?rPr(?:\s[^>]*)?>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?rPr>/.exec(run)?.[1] ?? '';
    runs.push({
      text,
      bold: readBooleanProperty(rPr, 'b'),
      fontHalfPoints: readNumericElementValue(rPr, 'sz') ?? readNumericElementValue(rPr, 'szCs'),
    });
  }

  return runs;
}

function readParagraphRunFontSize(body: string): number | undefined {
  const pPr = /<(?:[A-Za-z_][\w.-]*:)?pPr(?:\s[^>]*)?>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?pPr>/.exec(body)?.[1] ?? '';
  const rPr = /<(?:[A-Za-z_][\w.-]*:)?rPr(?:\s[^>]*)?>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?rPr>/.exec(pPr)?.[1] ?? '';
  return readNumericElementValue(rPr, 'sz') ?? readNumericElementValue(rPr, 'szCs');
}

function extractText(xml: string): string {
  const pieces: string[] = [];
  const pattern = /<(?:[A-Za-z_][\w.-]*:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?t>/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(xml))) pieces.push(decodeXml(match[1] ?? ''));
  return pieces.join('');
}

function readBooleanProperty(xml: string, elementName: string): boolean {
  const pattern = new RegExp(
    `<(?:[A-Za-z_][\\w.-]*:)?${elementName}\\b([^>]*)\\/?\\s*>`,
    'i',
  );
  const attributes = pattern.exec(xml)?.[1];
  if (attributes === undefined) return false;
  const raw = readXmlAttribute(attributes, 'val');
  return raw === undefined || !/^(?:0|false|off|no)$/i.test(raw);
}

function readNumericElementValue(xml: string, elementName: string): number | undefined {
  const raw = readElementValue(xml, elementName);
  if (raw === undefined || !/^\d+$/.test(raw)) return undefined;
  return Number(raw);
}

function readElementValue(xml: string, elementName: string): string | undefined {
  const pattern = new RegExp(
    `<(?:[A-Za-z_][\\w.-]*:)?${elementName}\\b[^>]*\\b(?:[A-Za-z_][\\w.-]*:)?val\\s*=\\s*["']([^"']+)["'][^>]*\\/?\\s*>`,
    'i',
  );
  return pattern.exec(xml)?.[1];
}

function readNumericAttributeFromElement(
  xml: string,
  elementName: string,
  attributeName: string,
): number | undefined {
  const element = new RegExp(
    `<(?:[A-Za-z_][\\w.-]*:)?${elementName}\\b([^>]*)\\/?\\s*>`,
    'i',
  ).exec(xml)?.[1];
  if (element === undefined) return undefined;
  const raw = readXmlAttribute(element, attributeName);
  return raw && /^\d+$/.test(raw) ? Number(raw) : undefined;
}

function readXmlAttribute(attributes: string, name: string): string | undefined {
  return new RegExp(
    `(?:^|\\s)(?:[A-Za-z_][\\w.-]*:)?${name}\\s*=\\s*["']([^"']+)["']`,
    'i',
  ).exec(attributes)?.[1];
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function readZipEntry(buffer: Buffer, wantedName: string): Buffer | null {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  if (eocdOffset < 0) return null;
  const centralDirectorySize = buffer.readUInt32LE(eocdOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  const centralEnd = centralDirectoryOffset + centralDirectorySize;
  let offset = centralDirectoryOffset;

  while (offset + 46 <= centralEnd && offset + 46 <= buffer.length) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break;
    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const fileName = buffer.subarray(offset + 46, offset + 46 + fileNameLength).toString('utf8').replace(/\\/g, '/');

    if (fileName === wantedName) {
      return inflateEntry(buffer, localHeaderOffset, compressionMethod, compressedSize, uncompressedSize);
    }
    offset += 46 + fileNameLength + extraLength + commentLength;
  }
  return null;
}

function inflateEntry(
  buffer: Buffer,
  localHeaderOffset: number,
  compressionMethod: number,
  compressedSize: number,
  uncompressedSize: number,
): Buffer {
  if (buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) return Buffer.alloc(0);
  const fileNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
  const extraLength = buffer.readUInt16LE(localHeaderOffset + 28);
  const dataOffset = localHeaderOffset + 30 + fileNameLength + extraLength;
  const compressed = buffer.subarray(dataOffset, dataOffset + compressedSize);
  if (compressionMethod === 0) return Buffer.from(compressed);
  if (compressionMethod !== 8) return Buffer.alloc(0);
  const inflated = inflateRawSync(compressed);
  return uncompressedSize && inflated.length !== uncompressedSize ? Buffer.alloc(0) : inflated;
}

function findEndOfCentralDirectory(buffer: Buffer): number {
  const minOffset = Math.max(0, buffer.length - 0xffff - 22);
  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  return -1;
}
