import { inflateRawSync } from 'node:zlib';

export interface OjsDocxInlineText {
  kind: 'text';
  text: string;
}

export interface OjsDocxFootnoteReference {
  kind: 'footnoteReference';
  footnoteId: string;
}

export type OjsDocxInline = OjsDocxInlineText | OjsDocxFootnoteReference;

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

export interface OjsSourceDocument {
  kind: 'docx';
  fileExternalId: string;
  fileName: string;
  mediaType: string;
  paragraphs: OjsDocxParagraph[];
  footnotes: OjsDocxFootnote[];
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

  const footnotesXml = readZipEntry(buffer, 'word/footnotes.xml');
  const footnotes = footnotesXml
    ? extractFootnotes(footnotesXml.toString('utf8'))
    : [];

  const xml = documentXml.toString('utf8');
  const paragraphs: OjsDocxParagraph[] = [];
  const paragraphPattern = /<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g;
  let paragraphMatch: RegExpExecArray | null;

  while ((paragraphMatch = paragraphPattern.exec(xml))) {
    const body = paragraphMatch[1] ?? '';
    const styleId = /<w:pStyle\b[^>]*\bw:val="([^"]+)"[^>]*\/?\s*>/.exec(body)?.[1];
    const inline = extractParagraphInline(body);
    const text = inline
      .filter((item): item is OjsDocxInlineText => item.kind === 'text')
      .map((item) => item.text)
      .join('')
      .trim();

    if (!text && !inline.some((item) => item.kind === 'footnoteReference')) continue;

    const paragraph: OjsDocxParagraph = { text };
    if (styleId !== undefined) paragraph.styleId = styleId;
    const headingLevel = headingLevelFromStyleId(styleId);
    if (headingLevel !== undefined) paragraph.headingLevel = headingLevel;
    if (inline.some((item) => item.kind === 'footnoteReference')) {
      paragraph.inline = inline;
    }
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
  };
}

function extractFootnotes(xml: string): OjsDocxFootnote[] {
  const footnotes: OjsDocxFootnote[] = [];
  const pattern = /<w:footnote\b([^>]*)>([\s\S]*?)<\/w:footnote>/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(xml))) {
    const attributes = match[1] ?? '';
    const body = match[2] ?? '';
    const id = /\bw:id="(-?\d+)"/.exec(attributes)?.[1];
    if (!id || Number(id) < 1) continue;

    const paragraphs: string[] = [];
    const paragraphPattern = /<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g;
    let paragraphMatch: RegExpExecArray | null;
    while ((paragraphMatch = paragraphPattern.exec(body))) {
      const text = extractParagraphText(paragraphMatch[1] ?? '').trim();
      if (text) paragraphs.push(text);
    }

    const text = paragraphs.join('\n\n').trim();
    if (text) footnotes.push({ id, text });
  }

  return footnotes;
}

function extractParagraphInline(body: string): OjsDocxInline[] {
  const parts: OjsDocxInline[] = [];
  const tokenPattern = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:footnoteReference\b[^>]*\bw:id="(-?\d+)"[^>]*\/?\s*>|<w:tab\b[^>]*\/?\s*>|<w:br\b[^>]*\/?\s*>|<w:cr\b[^>]*\/?\s*>/g;
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
    if (token.startsWith('<w:tab')) pushText('\t');
    else pushText('\n');
  }

  return parts;
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
