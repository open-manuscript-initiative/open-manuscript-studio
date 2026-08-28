import type { OmiIndexEntry } from '../model/indexing';
import type { OmiBlock } from '../types/omi';
import type { DocxManuscriptImportPlan } from './docxManuscriptImport';

interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

export interface WordIndexMarkerLocation {
  entryOrdinal: number;
  paragraphOrdinal: number;
  paragraphText: string;
}

/**
 * Binds imported Word XE fields to stable OMI block ids.
 *
 * Word stores an XE marker in the source paragraph, while the generated INDEX
 * field is only a cached/paginated rendering. The semantic marker location is
 * therefore the paragraph containing XE, not the generated index row.
 */
export async function attachWordIndexLocations(
  file: File,
  plan: DocxManuscriptImportPlan,
): Promise<DocxManuscriptImportPlan> {
  if (!plan.indexEntries?.length) return plan;

  const archive = new DocxZipArchive(await file.arrayBuffer());
  if (!archive.has('word/document.xml')) return plan;

  const locations = extractWordIndexMarkerLocations(await archive.text('word/document.xml'));
  plan.indexEntries = bindWordIndexEntriesToBlocks(plan.indexEntries, locations, plan.sections);
  return plan;
}

export function extractWordIndexMarkerLocations(xml: string): WordIndexMarkerLocation[] {
  const paragraphs = xml.match(/<w:p\b[\s\S]*?<\/w:p>/gi) ?? [];
  const result: WordIndexMarkerLocation[] = [];
  let entryOrdinal = 0;

  paragraphs.forEach((paragraph, paragraphOrdinal) => {
    const paragraphText = extractWordParagraphDisplayText(paragraph);
    for (const instruction of collectFieldInstructions(paragraph)) {
      if (!/^XE\b/i.test(normalizeInstruction(instruction))) continue;
      result.push({ entryOrdinal, paragraphOrdinal, paragraphText });
      entryOrdinal += 1;
    }
  });

  return result;
}

export function bindWordIndexEntriesToBlocks(
  entries: readonly OmiIndexEntry[],
  locations: readonly WordIndexMarkerLocation[],
  sections: DocxManuscriptImportPlan['sections'],
): OmiIndexEntry[] {
  const blocks = sections
    .flatMap((section) => flattenBlocks(section.blocks))
    .map((block, ordinal) => ({
      block,
      ordinal,
      text: blockPlainText(block),
      normalized: normalizeMatchingText(blockPlainText(block)),
    }));
  const locationByEntry = new Map(locations.map((location) => [location.entryOrdinal, location]));
  const paragraphTargets = new Map<number, { block: OmiBlock; text: string }>();
  let blockCursor = 0;

  return entries.map((entry, entryOrdinal) => {
    if (entry.targetBlockId || entry.source?.format !== 'docx-xe') return { ...entry };
    const location = locationByEntry.get(entryOrdinal);
    if (!location) return { ...entry };

    let target = paragraphTargets.get(location.paragraphOrdinal);
    if (!target) {
      const paragraph = normalizeMatchingText(location.paragraphText);
      if (!paragraph) return { ...entry };
      const matchIndex = findMatchingBlock(blocks, paragraph, blockCursor);
      if (matchIndex < 0) return { ...entry };
      const match = blocks[matchIndex]!;
      target = { block: match.block, text: match.text };
      paragraphTargets.set(location.paragraphOrdinal, target);
      blockCursor = Math.max(blockCursor, matchIndex + 1);
    }

    const term = entry.terms.at(-1)?.trim() ?? '';
    const targetTextOffset = term ? findTextOffset(target.text, term) : -1;
    return {
      ...entry,
      targetBlockId: target.block.id,
      anchorId: entry.anchorId ?? crypto.randomUUID(),
      ...(targetTextOffset >= 0 ? { targetText: term, targetTextOffset } : {}),
    };
  });
}

function findMatchingBlock(
  blocks: Array<{ normalized: string }>,
  paragraph: string,
  cursor: number,
): number {
  for (let index = cursor; index < blocks.length; index += 1) {
    if (blocks[index]!.normalized === paragraph) return index;
  }
  for (let index = 0; index < cursor; index += 1) {
    if (blocks[index]!.normalized === paragraph) return index;
  }

  // Importers may normalize a small amount of punctuation/whitespace or split
  // a paragraph around structured inline content. Only use a containment
  // fallback for substantial text so short/repeated paragraphs cannot be
  // accidentally bound to the wrong index marker.
  if (paragraph.length < 24) return -1;
  for (let index = cursor; index < blocks.length; index += 1) {
    const candidate = blocks[index]!.normalized;
    if (candidate.length >= 24 && (candidate.includes(paragraph) || paragraph.includes(candidate))) return index;
  }
  return -1;
}

function findTextOffset(text: string, term: string): number {
  return text.toLocaleLowerCase().indexOf(term.toLocaleLowerCase());
}

function extractWordParagraphDisplayText(paragraph: string): string {
  const tokens = paragraph.match(/<w:t\b[^>]*>[\s\S]*?<\/w:t>|<w:tab\b[^>]*\/?\s*>|<w:(?:br|cr)\b[^>]*\/?\s*>/gi) ?? [];
  return tokens.map((token) => {
    if (/^<w:tab\b/i.test(token)) return '\t';
    if (/^<w:(?:br|cr)\b/i.test(token)) return '\n';
    return decodeXml(/>([\s\S]*?)<\/w:t>/i.exec(token)?.[1] ?? '');
  }).join('');
}

function collectFieldInstructions(xml: string): string[] {
  const tokens = xml.match(/<w:fldChar\b[^>]*\/?\s*>|<w:instrText\b[^>]*>[\s\S]*?<\/w:instrText>/gi) ?? [];
  const result: string[] = [];
  const stack: Array<{ instruction: string }> = [];

  for (const token of tokens) {
    if (/^<w:fldChar\b/i.test(token)) {
      const type = /\bw:fldCharType="([^"]+)"/i.exec(token)?.[1]?.toLowerCase();
      if (type === 'begin') stack.push({ instruction: '' });
      else if (type === 'end') {
        const field = stack.pop();
        if (field?.instruction.trim()) result.push(field.instruction.trim());
      }
      continue;
    }
    const field = stack.at(-1);
    if (field) field.instruction += decodeXml(/>([\s\S]*?)<\/w:instrText>/i.exec(token)?.[1] ?? '');
  }
  return result;
}

function normalizeInstruction(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeMatchingText(value: string): string {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase();
}

function blockPlainText(block: OmiBlock): string {
  if (typeof block.content !== 'string') return '';
  try { return collectJsonText(JSON.parse(block.content) as unknown); }
  catch { return block.content.replace(/<[^>]+>/g, ' '); }
}

function collectJsonText(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const node = value as { text?: unknown; content?: unknown[] };
  const own = typeof node.text === 'string' ? node.text : '';
  return own + (node.content ?? []).map(collectJsonText).join('');
}

function flattenBlocks(blocks: OmiBlock[]): OmiBlock[] {
  const result: OmiBlock[] = [];
  for (const block of blocks) {
    result.push(block);
    if (block.children?.length) result.push(...flattenBlocks(block.children));
  }
  return result;
}

function decodeXml(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

class DocxZipArchive {
  private readonly view: DataView;
  private readonly bytesView: Uint8Array;
  private readonly entries = new Map<string, ZipEntry>();

  constructor(buffer: ArrayBuffer) {
    this.view = new DataView(buffer);
    this.bytesView = new Uint8Array(buffer);
    this.readCentralDirectory();
  }

  has(name: string): boolean { return this.entries.has(name); }
  async text(name: string): Promise<string> { return new TextDecoder().decode(await this.bytes(name)); }

  async bytes(name: string): Promise<Uint8Array> {
    const entry = this.entries.get(name);
    if (!entry) throw new Error(`DOCX part not found: ${name}`);
    const offset = entry.localHeaderOffset;
    if (this.view.getUint32(offset, true) !== 0x04034b50) throw new Error(`Invalid ZIP local header for ${name}.`);
    const fileNameLength = this.view.getUint16(offset + 26, true);
    const extraLength = this.view.getUint16(offset + 28, true);
    const dataOffset = offset + 30 + fileNameLength + extraLength;
    const compressed = this.bytesView.slice(dataOffset, dataOffset + entry.compressedSize);
    if (entry.method === 0) return compressed;
    if (entry.method !== 8) throw new Error(`Unsupported ZIP compression method ${entry.method}.`);
    if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot decompress DOCX files locally.');
    const stream = new Blob([compressed as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  private readCentralDirectory(): void {
    const eocd = this.findEndOfCentralDirectory();
    const entryCount = this.view.getUint16(eocd + 10, true);
    let offset = this.view.getUint32(eocd + 16, true);
    const decoder = new TextDecoder();
    for (let index = 0; index < entryCount; index += 1) {
      if (this.view.getUint32(offset, true) !== 0x02014b50) throw new Error('Invalid DOCX ZIP central directory.');
      const method = this.view.getUint16(offset + 10, true);
      const compressedSize = this.view.getUint32(offset + 20, true);
      const uncompressedSize = this.view.getUint32(offset + 24, true);
      const fileNameLength = this.view.getUint16(offset + 28, true);
      const extraLength = this.view.getUint16(offset + 30, true);
      const commentLength = this.view.getUint16(offset + 32, true);
      const localHeaderOffset = this.view.getUint32(offset + 42, true);
      const name = decoder.decode(this.bytesView.slice(offset + 46, offset + 46 + fileNameLength));
      this.entries.set(name, { name, method, compressedSize, uncompressedSize, localHeaderOffset });
      offset += 46 + fileNameLength + extraLength + commentLength;
    }
  }

  private findEndOfCentralDirectory(): number {
    const minimum = Math.max(0, this.bytesView.length - 0xffff - 22);
    for (let offset = this.bytesView.length - 22; offset >= minimum; offset -= 1) {
      if (this.view.getUint32(offset, true) === 0x06054b50) return offset;
    }
    throw new Error('DOCX ZIP end-of-central-directory record is missing.');
  }
}
