import { inflateRawSync } from 'node:zlib';

import type {
  OjsDocxInline,
  OjsSourceDocument,
} from './docxSource.js';

export type OjsInlineSemantic =
  | 'strong'
  | 'emphasis'
  | 'strike'
  | 'underline'
  | 'small-caps'
  | 'superscript'
  | 'subscript'
  | 'code';

interface StyledTextInline {
  kind: 'text';
  text: string;
  semantics?: OjsInlineSemantic[];
  language?: string;
}

interface CharacterStyle {
  id: string;
  name?: string;
  basedOn?: string;
  semantics: OjsInlineSemantic[];
}

interface ZipEntry {
  method: number;
  compressedSize: number;
  localHeaderOffset: number;
}

/**
 * Adds portable inline-semantic metadata to ordinary OJS DOCX paragraphs.
 * Paragraphs that already contain note references are kept untouched so the
 * proven note import path remains authoritative.
 */
export function applyInlineSemantics(
  buffer: Buffer,
  source: OjsSourceDocument,
): OjsSourceDocument {
  const documentXml = readZipEntry(buffer, 'word/document.xml');
  if (!documentXml) return source;
  const stylesXml = readZipEntry(buffer, 'word/styles.xml');
  const styles = stylesXml
    ? parseCharacterStyles(stylesXml.toString('utf8'))
    : new Map<string, CharacterStyle>();

  const styledParagraphs = extractStyledParagraphs(
    documentXml.toString('utf8'),
    styles,
  );
  const queues = new Map<string, StyledTextInline[][]>();
  for (const paragraph of styledParagraphs) {
    if (!paragraph.some((item) => item.semantics?.length || item.language)) continue;
    const key = normalizeText(paragraph.map((item) => item.text).join(''));
    if (!key) continue;
    const queue = queues.get(key) ?? [];
    queue.push(paragraph);
    queues.set(key, queue);
  }

  return {
    ...source,
    paragraphs: source.paragraphs.map((paragraph) => {
      if (paragraph.inline?.some((item) => item.kind !== 'text')) return paragraph;
      const queue = queues.get(normalizeText(paragraph.text));
      const styled = queue?.shift();
      if (!styled) return paragraph;
      return {
        ...paragraph,
        inline: styled as OjsDocxInline[],
      };
    }),
  };
}

function extractStyledParagraphs(
  xml: string,
  styles: ReadonlyMap<string, CharacterStyle>,
): StyledTextInline[][] {
  const result: StyledTextInline[][] = [];
  const paragraphPattern = /<(?:[A-Za-z_][\w.-]*:)?p(?:\s[^>]*)?>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?p>/g;
  let paragraphMatch: RegExpExecArray | null;

  while ((paragraphMatch = paragraphPattern.exec(xml))) {
    const body = paragraphMatch[1] ?? '';
    const parts: StyledTextInline[] = [];
    const runPattern = /<(?:[A-Za-z_][\w.-]*:)?r(?:\s[^>]*)?>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?r>/g;
    let runMatch: RegExpExecArray | null;

    while ((runMatch = runPattern.exec(body))) {
      const run = runMatch[1] ?? '';
      if (/<(?:[A-Za-z_][\w.-]*:)?(?:footnoteReference|endnoteReference)\b/i.test(run)) {
        continue;
      }
      const text = extractRunText(run);
      if (!text) continue;
      const rPr = readElementBody(run, 'rPr') ?? '';
      const styleId = readElementValue(rPr, 'rStyle');
      const semantics = Array.from(new Set([
        ...(styleId ? resolveCharacterStyleSemantics(styleId, styles) : []),
        ...semanticsFromRunProperties(rPr),
      ]));
      const language = normalizeLanguage(readElementValue(rPr, 'lang'));
      const previous = parts.at(-1);
      if (
        previous &&
        JSON.stringify(previous.semantics ?? []) === JSON.stringify(semantics) &&
        previous.language === language
      ) {
        previous.text += text;
      } else {
        parts.push({
          kind: 'text',
          text,
          ...(semantics.length ? { semantics } : {}),
          ...(language ? { language } : {}),
        });
      }
    }

    if (parts.length) result.push(parts);
  }

  return result;
}

function parseCharacterStyles(xml: string): Map<string, CharacterStyle> {
  const result = new Map<string, CharacterStyle>();
  const pattern = /<(?:[A-Za-z_][\w.-]*:)?style\b([^>]*)>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?style>/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(xml))) {
    const attributes = match[1] ?? '';
    const body = match[2] ?? '';
    const type = readXmlAttribute(attributes, 'type');
    if (type?.toLowerCase() !== 'character') continue;
    const id = readXmlAttribute(attributes, 'styleId');
    if (!id) continue;
    const name = readElementValue(body, 'name');
    const basedOn = readElementValue(body, 'basedOn');
    const rPr = readElementBody(body, 'rPr') ?? '';
    result.set(id, {
      id,
      name,
      basedOn,
      semantics: Array.from(new Set([
        ...styleNameSemantics(id, name),
        ...semanticsFromRunProperties(rPr),
      ])),
    });
  }
  return result;
}

function resolveCharacterStyleSemantics(
  styleId: string,
  styles: ReadonlyMap<string, CharacterStyle>,
): OjsInlineSemantic[] {
  const result: OjsInlineSemantic[] = [];
  const visited = new Set<string>();
  let current = styles.get(styleId);
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    result.push(...current.semantics);
    current = current.basedOn ? styles.get(current.basedOn) : undefined;
  }
  return Array.from(new Set(result));
}

function semanticsFromRunProperties(xml: string): OjsInlineSemantic[] {
  const result: OjsInlineSemantic[] = [];
  if (enabledProperty(xml, 'b')) result.push('strong');
  if (enabledProperty(xml, 'i')) result.push('emphasis');
  if (enabledProperty(xml, 'strike')) result.push('strike');
  if (enabledProperty(xml, 'smallCaps')) result.push('small-caps');

  const underline = readElementValue(xml, 'u');
  if (underline !== undefined && !/^(?:none|0|false|off)$/i.test(underline)) {
    result.push('underline');
  }

  const vertical = readElementValue(xml, 'vertAlign');
  if (vertical === 'superscript') result.push('superscript');
  if (vertical === 'subscript') result.push('subscript');

  const font = readElementAttribute(xml, 'rFonts', 'ascii') ??
    readElementAttribute(xml, 'rFonts', 'hAnsi') ?? '';
  if (/(?:courier|consolas|monaco|monospace)/i.test(font)) result.push('code');
  return result;
}

function styleNameSemantics(
  styleId: string | undefined,
  styleName: string | undefined,
): OjsInlineSemantic[] {
  const value = [styleId, styleName]
    .filter(Boolean)
    .join(' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const result: OjsInlineSemantic[] = [];
  if (/(?:strong|bold|fett|felkover)/.test(value)) result.push('strong');
  if (/(?:emphasis|italic|kursiv|dolt)/.test(value)) result.push('emphasis');
  if (/(?:small\s*caps?|smallcaps|kiskapitalis|kapitalchen)/.test(value)) result.push('small-caps');
  if (/(?:underline|unterstrichen|alahuz)/.test(value)) result.push('underline');
  if (/(?:strikethrough|strike|durchgestrichen|athuz)/.test(value)) result.push('strike');
  if (/(?:superscript|hochgestellt|felso\s*index)/.test(value)) result.push('superscript');
  if (/(?:subscript|tiefgestellt|also\s*index)/.test(value)) result.push('subscript');
  if (/(?:source\s*code|inline\s*code|monospace|quellcode|kod)/.test(value)) result.push('code');
  return result;
}

function enabledProperty(xml: string, name: string): boolean {
  const match = new RegExp(
    `<(?:[A-Za-z_][\\w.-]*:)?${name}\\b([^>]*)\\/?\\s*>`,
    'i',
  ).exec(xml);
  if (!match) return false;
  const value = readXmlAttribute(match[1] ?? '', 'val');
  return value === undefined || !/^(?:0|false|off|none)$/i.test(value);
}

function extractRunText(run: string): string {
  const parts: string[] = [];
  const pattern = /<(?:[A-Za-z_][\w.-]*:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:[A-Za-z_][\w.-]*:)?t>|<(?:[A-Za-z_][\w.-]*:)?tab\b[^>]*\/?\s*>|<(?:[A-Za-z_][\w.-]*:)?(?:br|cr)\b[^>]*\/?\s*>/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(run))) {
    const token = match[0];
    if (match[1] !== undefined) parts.push(decodeXml(match[1]));
    else if (/<(?:[A-Za-z_][\w.-]*:)?tab\b/.test(token)) parts.push('\t');
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
  return readElementAttribute(xml, name, 'val');
}

function readElementAttribute(xml: string, name: string, attribute: string): string | undefined {
  const match = new RegExp(
    `<(?:[A-Za-z_][\\w.-]*:)?${name}\\b([^>]*)\\/?\\s*>`,
    'i',
  ).exec(xml);
  return match ? readXmlAttribute(match[1] ?? '', attribute) : undefined;
}

function readXmlAttribute(attributes: string, name: string): string | undefined {
  return new RegExp(
    `(?:^|\\s)(?:[A-Za-z_][\\w.-]*:)?${name}\\s*=\\s*["']([^"']+)["']`,
    'i',
  ).exec(attributes)?.[1];
}

function normalizeLanguage(value: string | undefined): string | undefined {
  const input = value?.trim();
  if (!input) return undefined;
  try {
    return Intl.getCanonicalLocales(input)[0];
  } catch {
    return undefined;
  }
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
    .replace(/&amp;/g, '&');
}

function readZipEntry(buffer: Buffer, wanted: string): Buffer | undefined {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const entries = readCentralDirectory(buffer, view);
  const entry = entries.get(wanted);
  if (!entry) return undefined;

  const offset = entry.localHeaderOffset;
  if (view.getUint32(offset, true) !== 0x04034b50) return undefined;
  const fileNameLength = view.getUint16(offset + 26, true);
  const extraLength = view.getUint16(offset + 28, true);
  const dataOffset = offset + 30 + fileNameLength + extraLength;
  const compressed = buffer.subarray(dataOffset, dataOffset + entry.compressedSize);
  if (entry.method === 0) return Buffer.from(compressed);
  if (entry.method === 8) return inflateRawSync(compressed);
  return undefined;
}

function readCentralDirectory(
  buffer: Buffer,
  view: DataView,
): Map<string, ZipEntry> {
  const result = new Map<string, ZipEntry>();
  const minimum = Math.max(0, buffer.length - 0xffff - 22);
  let eocd = -1;
  for (let offset = buffer.length - 22; offset >= minimum; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) return result;

  const count = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  for (let index = 0; index < count; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) break;
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');
    result.set(name, { method, compressedSize, localHeaderOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return result;
}
