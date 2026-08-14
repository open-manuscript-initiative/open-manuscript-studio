import { inflateRawSync } from 'node:zlib';

import type {
  OjsDocxInline,
  OjsDocxParagraph,
  OjsSourceDocument,
} from './docxSource.js';

interface ZipEntry {
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

interface RawReference {
  offset: number;
  kind: 'footnoteReference' | 'endnoteReference';
  id: string;
}

interface RawParagraph {
  text: string;
  references: RawReference[];
}

/**
 * Final note-integrity pass for DOCX imports.
 *
 * Inline styling and structural enrichment are allowed to reshape paragraph
 * inline arrays, but Word note anchors are zero-width semantic objects. This
 * pass re-reads document.xml and guarantees that every footnote/endnote
 * reference is present at the correct visible-text offset while retaining the
 * already enriched text nodes and marks. It also refreshes note bodies from
 * footnotes.xml/endnotes.xml.
 */
export function applyNoteIntegrity(
  buffer: Buffer,
  source: OjsSourceDocument,
): OjsSourceDocument {
  const documentXml = readZipEntry(buffer, 'word/document.xml')?.toString('utf8');
  if (!documentXml) return source;

  const rawParagraphs = extractRawParagraphs(documentXml);
  if (!rawParagraphs.some((paragraph) => paragraph.references.length)) {
    return source;
  }

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

    if (!matched?.references.length) return paragraph;
    return ensureReferences(paragraph, matched.references);
  });

  const footnotesXml = readZipEntry(buffer, 'word/footnotes.xml')?.toString('utf8');
  const endnotesXml = readZipEntry(buffer, 'word/endnotes.xml')?.toString('utf8');

  return {
    ...source,
    paragraphs,
    footnotes: footnotesXml
      ? mergeNotes(source.footnotes, extractNotes(footnotesXml, 'footnote'))
      : source.footnotes,
    endnotes: endnotesXml
      ? mergeNotes(source.endnotes, extractNotes(endnotesXml, 'endnote'))
      : source.endnotes,
  };
}

function ensureReferences(
  paragraph: OjsDocxParagraph,
  references: readonly RawReference[],
): OjsDocxParagraph {
  const existing = paragraph.inline ?? [{ kind: 'text', text: paragraph.text }];
  const existingReferences = new Set(
    existing
      .filter((item) => item.kind !== 'text')
      .map((item) => item.kind === 'footnoteReference'
        ? `footnoteReference:${item.footnoteId}`
        : `endnoteReference:${item.endnoteId}`),
  );

  if (
    references.every((reference) =>
      existingReferences.has(`${reference.kind}:${reference.id}`),
    )
  ) {
    return paragraph;
  }

  const textItems = existing.filter((item) => item.kind === 'text');
  const result: OjsDocxInline[] = [];
  let textIndex = 0;
  let textOffset = 0;
  let absoluteOffset = 0;

  const appendUntil = (target: number) => {
    while (absoluteOffset < target && textIndex < textItems.length) {
      const item = textItems[textIndex] as OjsDocxInline & {
        kind: 'text';
        text: string;
        semantics?: unknown;
        language?: unknown;
      };
      const available = item.text.length - textOffset;
      if (available <= 0) {
        textIndex += 1;
        textOffset = 0;
        continue;
      }

      const take = Math.min(target - absoluteOffset, available);
      const text = item.text.slice(textOffset, textOffset + take);
      if (text) result.push({ ...item, text } as OjsDocxInline);
      textOffset += take;
      absoluteOffset += take;

      if (textOffset >= item.text.length) {
        textIndex += 1;
        textOffset = 0;
      }
    }
  };

  for (const reference of references) {
    appendUntil(reference.offset);
    if (reference.kind === 'footnoteReference') {
      result.push({ kind: 'footnoteReference', footnoteId: reference.id });
    } else {
      result.push({ kind: 'endnoteReference', endnoteId: reference.id });
    }
  }

  while (textIndex < textItems.length) {
    const item = textItems[textIndex] as OjsDocxInline & {
      kind: 'text';
      text: string;
      semantics?: unknown;
      language?: unknown;
    };
    const text = item.text.slice(textOffset);
    if (text) result.push({ ...item, text } as OjsDocxInline);
    textIndex += 1;
    textOffset = 0;
  }

  return { ...paragraph, inline: result };
}

function extractRawParagraphs(xml: string): RawParagraph[] {
  const result: RawParagraph[] = [];
  const body = readElementBody(xml, 'body') ?? xml;
  const paragraphPattern = /<(?:[A-Za-z_][\w.-]*:)?p\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?p>/g;
  let paragraphMatch: RegExpExecArray | null;

  while ((paragraphMatch = paragraphPattern.exec(body))) {
    const paragraphXml = paragraphMatch[1] ?? '';
    const parts: string[] = [];
    const references: RawReference[] = [];
    let offset = 0;
    const tokenPattern = /<(?:[A-Za-z_][\w.-]*:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?t>|<(?:[A-Za-z_][\w.-]*:)?footnoteReference\b[^>]*\b(?:[A-Za-z_][\w.-]*:)?id\s*=\s*["'](-?\d+)["'][^>]*\/?\s*>|<(?:[A-Za-z_][\w.-]*:)?endnoteReference\b[^>]*\b(?:[A-Za-z_][\w.-]*:)?id\s*=\s*["'](-?\d+)["'][^>]*\/?\s*>|<(?:[A-Za-z_][\w.-]*:)?tab\b[^>]*\/?\s*>|<(?:[A-Za-z_][\w.-]*:)?(?:br|cr)\b[^>]*\/?\s*>/g;
    let token: RegExpExecArray | null;

    while ((token = tokenPattern.exec(paragraphXml))) {
      if (token[1] !== undefined) {
        const text = decodeXml(token[1]);
        parts.push(text);
        offset += text.length;
      } else if (token[2] !== undefined && Number(token[2]) > 0) {
        references.push({ offset, kind: 'footnoteReference', id: token[2] });
      } else if (token[3] !== undefined && Number(token[3]) > 0) {
        references.push({ offset, kind: 'endnoteReference', id: token[3] });
      } else if (/tab\b/.test(token[0])) {
        parts.push('\t');
        offset += 1;
      } else {
        parts.push('\n');
        offset += 1;
      }
    }

    const text = parts.join('').trim();
    if (text || references.length) result.push({ text, references });
  }

  return result;
}

function extractNotes(
  xml: string,
  kind: 'footnote' | 'endnote',
): Array<{ id: string; text: string }> {
  const notes: Array<{ id: string; text: string }> = [];
  const element = kind === 'footnote' ? 'footnote' : 'endnote';
  const pattern = new RegExp(
    `<(?:[A-Za-z_][\\w.-]*:)?${element}\\b([^>]*)>([\\s\\S]*?)<\\/(?:[A-Za-z_][\\w.-]*:)?${element}>`,
    'g',
  );
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(xml))) {
    const id = attr(match[1] ?? '', 'id');
    if (!id || Number(id) < 1) continue;
    const paragraphs: string[] = [];
    const paragraphPattern = /<(?:[A-Za-z_][\w.-]*:)?p\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?p>/g;
    let paragraphMatch: RegExpExecArray | null;
    while ((paragraphMatch = paragraphPattern.exec(match[2] ?? ''))) {
      const text = visibleText(paragraphMatch[1] ?? '').trim();
      if (text) paragraphs.push(text);
    }
    notes.push({ id, text: paragraphs.join('\n\n') });
  }

  return notes;
}

function mergeNotes(
  current: Array<{ id: string; text: string }>,
  recovered: Array<{ id: string; text: string }>,
): Array<{ id: string; text: string }> {
  const byId = new Map(current.map((note) => [note.id, note]));
  for (const note of recovered) byId.set(note.id, note);
  return Array.from(byId.values());
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
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');
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
