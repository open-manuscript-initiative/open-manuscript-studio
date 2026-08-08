import { inflateRawSync } from 'node:zlib';

export interface OjsDocxParagraph {
  text: string;
  styleId?: string;
  headingLevel?: number;
}

export interface OjsSourceDocument {
  kind: 'docx';
  fileExternalId: string;
  fileName: string;
  mediaType: string;
  paragraphs: OjsDocxParagraph[];
}

export function parseDocxSource(
  buffer: Buffer,
  fileExternalId: string,
  fileName: string,
  mediaType: string,
): OjsSourceDocument {
  const documentXml = readZipEntry(buffer, 'word/document.xml');
  if (!documentXml) {
    throw new Error('The transferred DOCX does not contain word/document.xml.');
  }

  const xml = documentXml.toString('utf8');
  const paragraphs: OjsDocxParagraph[] = [];
  const paragraphPattern = /<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g;
  let paragraphMatch: RegExpExecArray | null;

  while ((paragraphMatch = paragraphPattern.exec(xml))) {
    const body = paragraphMatch[1] ?? '';
    const styleId = /<w:pStyle\b[^>]*\bw:val="([^"]+)"[^>]*\/?\s*>/.exec(body)?.[1];
    const text = extractParagraphText(body).trim();
    if (!text) continue;

    paragraphs.push({
      text,
      styleId,
      headingLevel: headingLevelFromStyleId(styleId),
    });
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
  };
}

function extractParagraphText(body: string): string {
  const normalized = body
    .replace(/<w:tab\b[^>]*\/?\s*>/g, '\t')
    .replace(/<w:br\b[^>]*\/?\s*>/g, '\n')
    .replace(/<w:cr\b[^>]*\/?\s*>/g, '\n');

  const parts: string[] = [];
  const textPattern = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
  let textMatch: RegExpExecArray | null;
  let lastIndex = 0;

  while ((textMatch = textPattern.exec(normalized))) {
    const between = normalized.slice(lastIndex, textMatch.index);
    if (between.includes('\t')) parts.push('\t');
    if (between.includes('\n')) parts.push('\n');
    parts.push(decodeXml(textMatch[1] ?? ''));
    lastIndex = textPattern.lastIndex;
  }

  return parts.join('').replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n');
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

    if (fileName === wantedName) {
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
