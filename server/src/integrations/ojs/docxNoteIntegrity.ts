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

interface NoteReference {
  kind: 'footnoteReference' | 'endnoteReference';
  id: string;
  offset: number;
}

interface ParagraphNotes {
  text: string;
  references: NoteReference[];
}

/**
 * Final integrity pass for Word footnote/endnote anchors.
 *
 * References are zero-width in visible text. Enrichment passes that rebuild
 * run-level text must never be allowed to drop those anchors. This pass reads
 * document.xml as the authoritative source and restores any missing note
 * reference atoms at their original character offsets while preserving styled
 * text nodes produced by the earlier inline-semantics pass.
 */
export function applyNoteIntegrity(
  buffer: Buffer,
  source: OjsSourceDocument,
): OjsSourceDocument {
  const documentXml = readZipEntry(buffer, 'word/document.xml')?.toString('utf8');
  if (!documentXml) return source;

  const wordParagraphs = extractParagraphNotes(documentXml);
  if (!wordParagraphs.some((paragraph) => paragraph.references.length)) return source;

  let cursor = 0;
  const paragraphs = source.paragraphs.map((paragraph) => {
    const key = normalize(paragraph.text);
    let matched: ParagraphNotes | undefined;

    for (let index = cursor; index < wordParagraphs.length; index += 1) {
      const candidate = wordParagraphs[index];
      if (!candidate || normalize(candidate.text) !== key) continue;
      matched = candidate;
      cursor = index + 1;
      break;
    }

    if (!matched?.references.length) return paragraph;
    return reconcileParagraphReferences(paragraph, matched.references);
  });

  return { ...source, paragraphs };
}

function reconcileParagraphReferences(
  paragraph: OjsDocxParagraph,
  expected: readonly NoteReference[],
): OjsDocxParagraph {
  const inline = paragraph.inline?.length
    ? paragraph.inline
    : paragraph.text
      ? [{ kind: 'text' as const, text: paragraph.text }]
      : [];

  const existing = new Set(
    inline
      .filter((item) => item.kind !== 'text')
      .map((item) => item.kind === 'footnoteReference'
        ? `footnote:${item.footnoteId}`
        : `endnote:${item.endnoteId}`),
  );

  const missing = expected.filter((reference) => !existing.has(referenceKey(reference)));
  if (!missing.length) return paragraph;

  return {
    ...paragraph,
    inline: insertReferences(inline, expected),
  };
}

function insertReferences(
  inline: readonly OjsDocxInline[],
  references: readonly NoteReference[],
): OjsDocxInline[] {
  const result: OjsDocxInline[] = [];
  const ordered = [...references].sort((left, right) => left.offset - right.offset);
  let referenceIndex = 0;
  let textOffset = 0;

  const pushReference = (reference: NoteReference) => {
    result.push(reference.kind === 'footnoteReference'
      ? { kind: 'footnoteReference', footnoteId: reference.id }
      : { kind: 'endnoteReference', endnoteId: reference.id });
  };

  for (const item of inline) {
    if (item.kind !== 'text') continue;

    let localOffset = 0;
    while (referenceIndex < ordered.length) {
      const reference = ordered[referenceIndex];
      if (!reference || reference.offset > textOffset + item.text.length) break;

      const splitAt = Math.max(0, Math.min(
        item.text.length,
        reference.offset - textOffset,
      ));
      if (splitAt > localOffset) {
        result.push({
          ...item,
          text: item.text.slice(localOffset, splitAt),
        } as OjsDocxInline);
      }
      pushReference(reference);
      localOffset = splitAt;
      referenceIndex += 1;
    }

    if (localOffset < item.text.length) {
      result.push({
        ...item,
        text: item.text.slice(localOffset),
      } as OjsDocxInline);
    }
    textOffset += item.text.length;
  }

  while (referenceIndex < ordered.length) {
    const reference = ordered[referenceIndex];
    if (reference) pushReference(reference);
    referenceIndex += 1;
  }

  return coalesceText(result);
}

function extractParagraphNotes(xml: string): ParagraphNotes[] {
  const result: ParagraphNotes[] = [];
  const body = readElementBody(xml, 'body') ?? xml;
  const paragraphPattern = /<(?:[A-Za-z_][\w.-]*:)?p\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?p>/g;
  let paragraphMatch: RegExpExecArray | null;

  while ((paragraphMatch = paragraphPattern.exec(body))) {
    const paragraphXml = paragraphMatch[1] ?? '';
    const tokenPattern = /<(?:[A-Za-z_][\w.-]*:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?t>|<(?:[A-Za-z_][\w.-]*:)?footnoteReference\b([^>]*)\/?\s*>|<(?:[A-Za-z_][\w.-]*:)?endnoteReference\b([^>]*)\/?\s*>|<(?:[A-Za-z_][\w.-]*:)?tab\b[^>]*\/?\s*>|<(?:[A-Za-z_][\w.-]*:)?(?:br|cr)\b[^>]*\/?\s*>/g;
    let token: RegExpExecArray | null;
    let text = '';
    const references: NoteReference[] = [];

    while ((token = tokenPattern.exec(paragraphXml))) {
      if (token[1] !== undefined) {
        text += decodeXml(token[1]);
        continue;
      }
      if (token[2] !== undefined) {
        const id = attr(token[2], 'id');
        if (id && Number(id) > 0) {
          references.push({ kind: 'footnoteReference', id, offset: text.length });
        }
        continue;
      }
      if (token[3] !== undefined) {
        const id = attr(token[3], 'id');
        if (id && Number(id) > 0) {
          references.push({ kind: 'endnoteReference', id, offset: text.length });
        }
        continue;
      }
      text += /tab\b/.test(token[0]) ? '\t' : '\n';
    }

    const trimmed = text.trim();
    if (trimmed || references.length) {
      const leadingWhitespace = text.length - text.trimStart().length;
      result.push({
        text: trimmed,
        references: references.map((reference) => ({
          ...reference,
          offset: Math.max(0, reference.offset - leadingWhitespace),
        })),
      });
    }
  }

  return result;
}

function coalesceText(items: readonly OjsDocxInline[]): OjsDocxInline[] {
  const result: OjsDocxInline[] = [];
  for (const item of items) {
    const previous = result.at(-1) as (OjsDocxInline & {
      semantics?: unknown;
      language?: unknown;
    }) | undefined;
    const current = item as OjsDocxInline & {
      semantics?: unknown;
      language?: unknown;
    };
    if (
      previous?.kind === 'text' &&
      current.kind === 'text' &&
      JSON.stringify(previous.semantics ?? []) === JSON.stringify(current.semantics ?? []) &&
      previous.language === current.language
    ) {
      previous.text += current.text;
    } else {
      result.push({ ...item } as OjsDocxInline);
    }
  }
  return result;
}

function referenceKey(reference: NoteReference): string {
  return reference.kind === 'footnoteReference'
    ? `footnote:${reference.id}`
    : `endnote:${reference.id}`;
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
  return entry.uncompressedSize && inflated.length !== entry.uncompressedSize ? undefined : inflated;
}

function centralDirectory(buffer: Buffer): Map<string, ZipEntry> {
  const result = new Map<string, ZipEntry>();
  let eocd = -1;
  const minimum = Math.max(0, buffer.length - 0xffff - 22);
  for (let offset = buffer.length - 22; offset >= minimum; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) { eocd = offset; break; }
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
