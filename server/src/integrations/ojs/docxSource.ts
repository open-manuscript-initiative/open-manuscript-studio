import { inflateRawSync } from 'node:zlib';

export interface OjsDocxInlineText {
  kind: 'text';
  text: string;
}

export interface OjsDocxFootnoteReference {
  kind: 'footnoteReference';
  footnoteId: string;
}

export interface OjsDocxEndnoteReference {
  kind: 'endnoteReference';
  endnoteId: string;
}

export type OjsDocxInline =
  | OjsDocxInlineText
  | OjsDocxFootnoteReference
  | OjsDocxEndnoteReference;

export interface OjsDocxParagraph {
  text: string;
  styleId?: string;
  headingLevel?: number;
  inline?: OjsDocxInline[];
}

export interface OjsDocxFootnote {
  id: string;
  text: string;
}

export interface OjsDocxEndnote {
  id: string;
  text: string;
}

export interface OjsSourceDocument {
  kind: 'docx';
  fileExternalId: string;
  fileName: string;
  mediaType: string;
  paragraphs: OjsDocxParagraph[];
  footnotes: OjsDocxFootnote[];
  endnotes: OjsDocxEndnote[];
}

export function parseDocxSource(
  buffer: Buffer,
  fileExternalId: string,
  fileName: string,
  mediaType: string,
): OjsSourceDocument {
  const documentPath = 'word/document.xml';
  const documentXml = readZipEntry(buffer, documentPath);
  if (!documentXml) {
    throw new Error('The transferred DOCX does not contain word/document.xml.');
  }

  const relationshipsXml = readZipEntry(buffer, 'word/_rels/document.xml.rels');
  const relationships = relationshipsXml
    ? extractRelationships(relationshipsXml.toString('utf8'), documentPath)
    : [];

  const footnotesPath =
    relationships.find((relationship) => relationship.type === 'footnotes')?.target ??
    'word/footnotes.xml';
  const endnotesPath =
    relationships.find((relationship) => relationship.type === 'endnotes')?.target ??
    'word/endnotes.xml';

  const footnotesXml = readZipEntry(buffer, footnotesPath);
  const footnotes = footnotesXml
    ? extractNotes(footnotesXml.toString('utf8'), 'footnote')
    : [];

  const endnotesXml = readZipEntry(buffer, endnotesPath);
  const endnotes = endnotesXml
    ? extractNotes(endnotesXml.toString('utf8'), 'endnote')
    : [];

  const xml = documentXml.toString('utf8');
  const paragraphs: OjsDocxParagraph[] = [];
  const paragraphPattern = /<(?:[A-Za-z_][\w.-]*:)?p(?:\s[^>]*)?>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?p>/g;
  let paragraphMatch: RegExpExecArray | null;

  while ((paragraphMatch = paragraphPattern.exec(xml))) {
    const body = paragraphMatch[1] ?? '';
    const styleId = /<(?:[A-Za-z_][\w.-]*:)?pStyle\b[^>]*\b(?:[A-Za-z_][\w.-]*:)?val\s*=\s*["']([^"']+)["'][^>]*\/?\s*>/.exec(body)?.[1];
    const inline = extractParagraphInline(body);
    const text = inline
      .filter((item): item is OjsDocxInlineText => item.kind === 'text')
      .map((item) => item.text)
      .join('')
      .trim();

    if (!text && !inline.some(isNoteReference)) continue;

    const paragraph: OjsDocxParagraph = { text };
    if (styleId !== undefined) paragraph.styleId = styleId;
    const headingLevel = headingLevelFromStyleId(styleId);
    if (headingLevel !== undefined) paragraph.headingLevel = headingLevel;
    if (inline.some(isNoteReference)) paragraph.inline = inline;
    paragraphs.push(paragraph);
  }

  if (!paragraphs.length) {
    throw new Error('The transferred DOCX contains no readable manuscript paragraphs.');
  }

  return {
    kind: 'docx',
    fileExternalId,
    fileName,
    mediaType,
    paragraphs,
    footnotes,
    endnotes,
  };
}

interface DocumentRelationship {
  type: 'footnotes' | 'endnotes';
  target: string;
}

function extractRelationships(
  xml: string,
  sourcePath: string,
): DocumentRelationship[] {
  const relationships: DocumentRelationship[] = [];
  const pattern = /<(?:[A-Za-z_][\w.-]*:)?Relationship\b([^>]*?)\/?\s*>/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(xml))) {
    const attributes = match[1] ?? '';
    const type = readXmlAttribute(attributes, 'Type');
    const target = readXmlAttribute(attributes, 'Target');
    const targetMode = readXmlAttribute(attributes, 'TargetMode');
    if (!type || !target || targetMode?.toLowerCase() === 'external') continue;

    const relationshipType = type.endsWith('/footnotes')
      ? 'footnotes'
      : type.endsWith('/endnotes')
        ? 'endnotes'
        : null;
    if (!relationshipType) continue;

    relationships.push({
      type: relationshipType,
      target: resolvePackagePartPath(sourcePath, target),
    });
  }

  return relationships;
}

function readXmlAttribute(attributes: string, name: string): string | undefined {
  const match = new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, 'i').exec(attributes);
  return match?.[1];
}

function resolvePackagePartPath(sourcePath: string, target: string): string {
  if (target.startsWith('/')) return normalizePackagePath(target.slice(1));

  const sourceDirectory = sourcePath.includes('/')
    ? sourcePath.slice(0, sourcePath.lastIndexOf('/') + 1)
    : '';
  return normalizePackagePath(`${sourceDirectory}${target}`);
}

function normalizePackagePath(value: string): string {
  const parts: string[] = [];
  for (const part of value.replace(/\\/g, '/').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  return parts.join('/');
}

function extractNotes(
  xml: string,
  kind: 'footnote' | 'endnote',
): Array<{ id: string; text: string }> {
  const notes: Array<{ id: string; text: string }> = [];
  const elementName = kind === 'footnote' ? 'footnote' : 'endnote';
  const pattern = new RegExp(
    `<(?:[A-Za-z_][\\w.-]*:)?${elementName}\\b([^>]*)>([\\s\\S]*?)<\\/(?:[A-Za-z_][\\w.-]*:)?${elementName}>`,
    'g',
  );
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(xml))) {
    const attributes = match[1] ?? '';
    const body = match[2] ?? '';
    const id = /\b(?:[A-Za-z_][\w.-]*:)?id\s*=\s*["'](-?\d+)["']/.exec(attributes)?.[1];
    if (!id || Number(id) < 1) continue;

    const paragraphs: string[] = [];
    const paragraphPattern = /<(?:[A-Za-z_][\w.-]*:)?p(?:\s[^>]*)?>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?p>/g;
    let paragraphMatch: RegExpExecArray | null;
    while ((paragraphMatch = paragraphPattern.exec(body))) {
      const text = extractParagraphText(paragraphMatch[1] ?? '').trim();
      if (text) paragraphs.push(text);
    }

    const text = paragraphs.join('\n\n').trim();
    notes.push({ id, text });
  }

  return notes;
}

function extractParagraphInline(body: string): OjsDocxInline[] {
  const parts: OjsDocxInline[] = [];
  const tokenPattern = /<(?:[A-Za-z_][\w.-]*:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?t>|<(?:[A-Za-z_][\w.-]*:)?footnoteReference\b[^>]*\b(?:[A-Za-z_][\w.-]*:)?id\s*=\s*["'](-?\d+)["'][^>]*\/?\s*>|<(?:[A-Za-z_][\w.-]*:)?endnoteReference\b[^>]*\b(?:[A-Za-z_][\w.-]*:)?id\s*=\s*["'](-?\d+)["'][^>]*\/?\s*>|<(?:[A-Za-z_][\w.-]*:)?tab\b[^>]*\/?\s*>|<(?:[A-Za-z_][\w.-]*:)?br\b[^>]*\/?\s*>|<(?:[A-Za-z_][\w.-]*:)?cr\b[^>]*\/?\s*>/g;
  let match: RegExpExecArray | null;

  const pushText = (text: string) => {
    if (!text) return;
    const previous = parts.at(-1);
    if (previous?.kind === 'text') previous.text += text;
    else parts.push({ kind: 'text', text });
  };

  while ((match = tokenPattern.exec(body))) {
    const token = match[0];
    if (match[1] !== undefined) {
      pushText(decodeXml(match[1]));
      continue;
    }
    if (match[2] !== undefined) {
      if (Number(match[2]) > 0) {
        parts.push({ kind: 'footnoteReference', footnoteId: match[2] });
      }
      continue;
    }
    if (match[3] !== undefined) {
      if (Number(match[3]) > 0) {
        parts.push({ kind: 'endnoteReference', endnoteId: match[3] });
      }
      continue;
    }
    if (/<(?:[A-Za-z_][\w.-]*:)?tab\b/.test(token)) pushText('\t');
    else pushText('\n');
  }

  return parts;
}

function isNoteReference(
  item: OjsDocxInline,
): item is OjsDocxFootnoteReference | OjsDocxEndnoteReference {
  return item.kind === 'footnoteReference' || item.kind === 'endnoteReference';
}

function extractParagraphText(body: string): string {
  return extractParagraphInline(body)
    .filter((item): item is OjsDocxInlineText => item.kind === 'text')
    .map((item) => item.text)
    .join('')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n');
}

function headingLevelFromStyleId(styleId: string | undefined): number | undefined {
  if (!styleId) return undefined;
  const match = /(?:heading|überschrift|uberschrift|címsor|cimsor)[_-]?([1-9])/i.exec(styleId);
  return match?.[1] ? Number(match[1]) : undefined;
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
  const normalizedWantedName = normalizePackagePath(wantedName);
  const eocdOffset = findEndOfCentralDirectory(buffer);
  if (eocdOffset < 0) throw new Error('Invalid DOCX ZIP container.');

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
    const fileName = buffer.subarray(offset + 46, offset + 46 + fileNameLength).toString('utf8');

    if (normalizePackagePath(fileName) === normalizedWantedName) {
      return inflateEntry(
        buffer,
        localHeaderOffset,
        compressionMethod,
        compressedSize,
        uncompressedSize,
      );
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
  if (buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
    throw new Error('Invalid DOCX local ZIP header.');
  }

  const fileNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
  const extraLength = buffer.readUInt16LE(localHeaderOffset + 28);
  const dataOffset = localHeaderOffset + 30 + fileNameLength + extraLength;
  const compressed = buffer.subarray(dataOffset, dataOffset + compressedSize);

  if (compressionMethod === 0) return Buffer.from(compressed);
  if (compressionMethod !== 8) {
    throw new Error(`Unsupported DOCX ZIP compression method ${compressionMethod}.`);
  }

  const inflated = inflateRawSync(compressed);
  if (uncompressedSize && inflated.length !== uncompressedSize) {
    throw new Error('DOCX ZIP entry size validation failed.');
  }
  return inflated;
}

function findEndOfCentralDirectory(buffer: Buffer): number {
  const minOffset = Math.max(0, buffer.length - 0xffff - 22);
  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  return -1;
}
