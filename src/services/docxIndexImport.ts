import type { OmiGeneratedIndex, OmiIndexEntry } from '../model/indexing';
import type { DocxManuscriptImportPlan } from './docxManuscriptImport';

interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

export async function attachWordIndexData(
  file: File,
  plan: DocxManuscriptImportPlan,
): Promise<DocxManuscriptImportPlan> {
  const { entries, generatedIndexes } = await extractWordIndexData(file);
  plan.indexEntries = entries;
  plan.generatedIndexes = generatedIndexes;
  return plan;
}

export async function extractWordIndexData(file: File): Promise<{
  entries: OmiIndexEntry[];
  generatedIndexes: OmiGeneratedIndex[];
}> {
  const archive = new DocxZipArchive(await file.arrayBuffer());
  if (!archive.has('word/document.xml')) {
    return { entries: [], generatedIndexes: [] };
  }

  const xml = await archive.text('word/document.xml');
  const instructions = collectFieldInstructions(xml);
  const entries: OmiIndexEntry[] = [];
  const generatedIndexes: OmiGeneratedIndex[] = [];

  for (const instruction of instructions) {
    const normalized = instruction.replace(/\s+/g, ' ').trim();
    if (/^XE\b/i.test(normalized)) {
      const parsed = parseXeInstruction(normalized);
      if (!parsed) continue;
      entries.push({
        id: crypto.randomUUID(),
        kind: 'name',
        terms: parsed.terms,
        sortKey: parsed.sortKey,
        source: {
          format: 'docx-xe',
          instruction: normalized,
        },
      });
      continue;
    }

    if (/^INDEX\b/i.test(normalized)) {
      generatedIndexes.push({
        id: crypto.randomUUID(),
        kind: 'name',
        source: {
          format: 'docx-index',
          instruction: normalized,
        },
      });
    }
  }

  return { entries, generatedIndexes };
}

function collectFieldInstructions(xml: string): string[] {
  const tokens = xml.match(/<w:fldChar\b[^>]*\/?\s*>|<w:instrText\b[^>]*>[\s\S]*?<\/w:instrText>/gi) ?? [];
  const result: string[] = [];
  const stack: Array<{ instruction: string }> = [];

  for (const token of tokens) {
    if (/^<w:fldChar\b/i.test(token)) {
      const type = /\bw:fldCharType="([^"]+)"/i.exec(token)?.[1]?.toLowerCase();
      if (type === 'begin') {
        stack.push({ instruction: '' });
      } else if (type === 'end') {
        const field = stack.pop();
        if (field?.instruction.trim()) result.push(field.instruction.trim());
      }
      continue;
    }

    const text = decodeXml(/>([\s\S]*?)<\/w:instrText>/i.exec(token)?.[1] ?? '');
    if (stack.length) stack[stack.length - 1]!.instruction += text;
  }

  return result;
}

function parseXeInstruction(instruction: string): { terms: string[]; sortKey?: string } | null {
  const payload = instruction.replace(/^XE\b/i, '').trim();
  if (!payload) return null;

  const quoted = /^"((?:[^"\\]|\\.)*)"/.exec(payload);
  const rawTerm = quoted ? quoted[1] ?? '' : payload.split(/\s+\\/)[0] ?? '';
  const decodedTerm = rawTerm.replace(/\\"/g, '"').trim();
  if (!decodedTerm) return null;

  const terms = splitIndexTerms(decodedTerm);
  if (!terms.length) return null;

  const sortMatch = /(?:^|\s)\\y\s+"((?:[^"\\]|\\.)*)"/i.exec(payload);
  const sortKey = sortMatch?.[1]?.replace(/\\"/g, '"').trim() || undefined;
  return { terms, sortKey };
}

function splitIndexTerms(value: string): string[] {
  const result: string[] = [];
  let current = '';
  let escaped = false;

  for (const character of value) {
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }
    if (character === '\\') {
      escaped = true;
      continue;
    }
    if (character === ':') {
      if (current.trim()) result.push(current.trim());
      current = '';
      continue;
    }
    current += character;
  }
  if (current.trim()) result.push(current.trim());
  return result;
}

function decodeXml(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
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

  has(name: string): boolean {
    return this.entries.has(name);
  }

  async text(name: string): Promise<string> {
    return new TextDecoder().decode(await this.bytes(name));
  }

  async bytes(name: string): Promise<Uint8Array> {
    const entry = this.entries.get(name);
    if (!entry) throw new Error(`DOCX part not found: ${name}`);
    const offset = entry.localHeaderOffset;
    if (this.view.getUint32(offset, true) !== 0x04034b50) {
      throw new Error(`Invalid ZIP local header for ${name}.`);
    }
    const fileNameLength = this.view.getUint16(offset + 26, true);
    const extraLength = this.view.getUint16(offset + 28, true);
    const dataOffset = offset + 30 + fileNameLength + extraLength;
    const compressed = this.bytesView.slice(dataOffset, dataOffset + entry.compressedSize);
    if (entry.method === 0) return compressed;
    if (entry.method !== 8) throw new Error(`Unsupported ZIP compression method ${entry.method}.`);
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('This browser cannot decompress DOCX files locally.');
    }
    const stream = new Blob([compressed as BlobPart])
      .stream()
      .pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  private readCentralDirectory(): void {
    const eocd = this.findEndOfCentralDirectory();
    const entryCount = this.view.getUint16(eocd + 10, true);
    let offset = this.view.getUint32(eocd + 16, true);
    const decoder = new TextDecoder();

    for (let index = 0; index < entryCount; index += 1) {
      if (this.view.getUint32(offset, true) !== 0x02014b50) {
        throw new Error('Invalid DOCX ZIP central directory.');
      }
      const method = this.view.getUint16(offset + 10, true);
      const compressedSize = this.view.getUint32(offset + 20, true);
      const uncompressedSize = this.view.getUint32(offset + 24, true);
      const fileNameLength = this.view.getUint16(offset + 28, true);
      const extraLength = this.view.getUint16(offset + 30, true);
      const commentLength = this.view.getUint16(offset + 32, true);
      const localHeaderOffset = this.view.getUint32(offset + 42, true);
      const name = decoder.decode(this.bytesView.slice(offset + 46, offset + 46 + fileNameLength));
      this.entries.set(name, {
        name,
        method,
        compressedSize,
        uncompressedSize,
        localHeaderOffset,
      });
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

declare module './docxManuscriptImport' {
  interface DocxManuscriptImportPlan {
    indexEntries?: OmiIndexEntry[];
    generatedIndexes?: OmiGeneratedIndex[];
  }
}
