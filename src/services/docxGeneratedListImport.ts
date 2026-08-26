import type { OmiGeneratedListDefinition, OmiGeneratedListKind } from '../model/generatedLists';
import type { OmiBlock } from '../types/omi';
import type { DocxManuscriptImportPlan } from './docxManuscriptImport';

interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

export interface WordGeneratedListPreflight {
  definitions: OmiGeneratedListDefinition[];
  renderedLines: Set<string>;
  headings: Set<string>;
}

interface FieldState {
  instruction: string;
  phase: 'instruction' | 'result';
  kind: 'caption-list' | 'index' | null;
}

export async function preflightWordGeneratedLists(file: File): Promise<WordGeneratedListPreflight> {
  const archive = new DocxZipArchive(await file.arrayBuffer());
  if (!archive.has('word/document.xml')) return emptyPreflight();
  return extractWordGeneratedListsFromXml(await archive.text('word/document.xml'));
}

/**
 * Detects pagination-dependent Word generated-list result caches before the
 * normal DOCX body parser runs. Word stores lists of figures/tables/maps as
 * `TOC \\c "label"` fields and indexes as `INDEX` fields. Their visible rows
 * are cached rendering output and must not become canonical body paragraphs.
 */
export function extractWordGeneratedListsFromXml(xml: string): WordGeneratedListPreflight {
  const definitions: OmiGeneratedListDefinition[] = [];
  const renderedLines = new Set<string>();
  const headings = new Set<string>();
  const paragraphs = xml.match(/<w:p\b[\s\S]*?<\/w:p>/gi) ?? [];
  const stack: FieldState[] = [];
  let previousVisible = '';

  for (const paragraph of paragraphs) {
    let inSupportedResult = stack.some((field) => field.kind && field.phase === 'result');
    const tokens = paragraph.match(/<w:fldChar\b[^>]*\/?\s*>|<w:instrText\b[^>]*>[\s\S]*?<\/w:instrText>/gi) ?? [];

    for (const token of tokens) {
      if (/^<w:fldChar\b/i.test(token)) {
        const type = /\bw:fldCharType="([^"]+)"/i.exec(token)?.[1]?.toLowerCase();
        if (type === 'begin') {
          stack.push({ instruction: '', phase: 'instruction', kind: null });
        } else if (type === 'separate') {
          const field = stack.at(-1);
          if (field) {
            const normalized = normalizeInstruction(field.instruction);
            field.kind = classifyGeneratedField(normalized);
            field.phase = 'result';
            if (field.kind) {
              inSupportedResult = true;
              if (previousVisible) headings.add(normalizeGeneratedDisplayText(previousVisible));
              if (field.kind === 'caption-list') {
                const label = captionLabelFromToc(normalized);
                if (label) definitions.push(createCaptionListDefinition(label, normalized, previousVisible));
              }
            }
          }
        } else if (type === 'end') {
          if (stack.some((field) => field.kind && field.phase === 'result')) inSupportedResult = true;
          stack.pop();
        }
        continue;
      }
      const field = stack.at(-1);
      if (field?.phase === 'instruction') {
        field.instruction += decodeXml(/>([\s\S]*?)<\/w:instrText>/i.exec(token)?.[1] ?? '');
      }
    }

    const display = extractWordParagraphDisplayText(paragraph).trim();
    if (inSupportedResult && display) {
      const normalized = normalizeGeneratedDisplayText(display);
      if (normalized) renderedLines.add(normalized);
    }
    if (display && !inSupportedResult && !tokens.some((token) => /w:instrText/i.test(token))) previousVisible = display;
  }

  return { definitions: deduplicateDefinitions(definitions), renderedLines, headings };
}

export function attachWordGeneratedLists(
  plan: DocxManuscriptImportPlan,
  preflight: WordGeneratedListPreflight,
): DocxManuscriptImportPlan {
  if (!preflight.definitions.length && !preflight.renderedLines.size) return plan;

  const existing = plan.generatedListDefinitions ?? [];
  plan.generatedListDefinitions = deduplicateDefinitions([...existing, ...preflight.definitions]);

  for (const section of plan.sections) {
    section.blocks = section.blocks.filter((block) => {
      const normalized = normalizeGeneratedDisplayText(blockPlainText(block));
      return !normalized || !preflight.renderedLines.has(normalized);
    });
  }

  plan.sections = plan.sections.filter((section) => {
    const title = normalizeGeneratedDisplayText(section.title);
    if (!preflight.headings.has(title)) return true;
    return section.blocks.some((block) => blockPlainText(block).trim().length > 0);
  });
  return plan;
}

export function normalizeGeneratedDisplayText(value: string): string {
  return value
    .replace(/\u00a0/g, ' ')
    // A Word-generated row normally separates its cached page number with a
    // tab stop. Remove the tab and following layout leaders/page number, but do
    // not consume punctuation that belongs to the entry itself (for example
    // the final period in "Apaffi György I.").
    .replace(/\t[.·•…_\-\s]*\d+\s*$/u, '')
    // Some producers flatten tab stops to visible leaders. Require at least two
    // leader characters so an entry-ending period is never mistaken for layout.
    .replace(/(?:[.·•…_\-]\s*){2,}\d+\s*$/u, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase();
}

function classifyGeneratedField(instruction: string): FieldState['kind'] {
  if (/^INDEX\b/i.test(instruction)) return 'index';
  if (/^TOC\b/i.test(instruction) && /(?:^|\s)\\c\s+"[^"]+"/i.test(instruction)) return 'caption-list';
  return null;
}

function captionLabelFromToc(instruction: string): string | undefined {
  return /(?:^|\s)\\c\s+"([^"]+)"/i.exec(instruction)?.[1]?.trim() || undefined;
}

function createCaptionListDefinition(label: string, instruction: string, heading: string): OmiGeneratedListDefinition {
  const kind = generatedKindForCaptionLabel(label);
  return {
    id: crypto.randomUUID(),
    kind,
    title: heading.trim() || defaultListTitle(label, kind),
    source: { format: 'docx-field', instruction, captionLabel: label },
  };
}

function generatedKindForCaptionLabel(label: string): OmiGeneratedListKind {
  const normalized = label.trim().toLocaleLowerCase();
  return /^(table|tableau|tabelle|táblázat|tabla|tabela)$/iu.test(normalized) ? 'tables' : 'figures';
}

function defaultListTitle(label: string, kind: OmiGeneratedListKind): string {
  if (kind === 'tables') return 'List of tables';
  return `List of ${label}`;
}

function deduplicateDefinitions(definitions: OmiGeneratedListDefinition[]): OmiGeneratedListDefinition[] {
  const seen = new Set<string>();
  return definitions.filter((definition) => {
    const key = `${definition.kind}:${definition.source?.captionLabel?.toLocaleLowerCase() ?? definition.title.toLocaleLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeInstruction(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function extractWordParagraphDisplayText(paragraph: string): string {
  const tokens = paragraph.match(/<w:t\b[^>]*>[\s\S]*?<\/w:t>|<w:tab\b[^>]*\/?\s*>|<w:(?:br|cr)\b[^>]*\/?\s*>/gi) ?? [];
  return tokens.map((token) => {
    if (/^<w:tab\b/i.test(token)) return '\t';
    if (/^<w:(?:br|cr)\b/i.test(token)) return '\n';
    return decodeXml(/>([\s\S]*?)<\/w:t>/i.exec(token)?.[1] ?? '');
  }).join('');
}

function blockPlainText(block: OmiBlock): string {
  if (typeof block.content !== 'string') return '';
  try { return collectJsonText(JSON.parse(block.content) as unknown); }
  catch { return block.content; }
}

function collectJsonText(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const node = value as { text?: unknown; content?: unknown[] };
  if (typeof node.text === 'string') return node.text;
  return (node.content ?? []).map(collectJsonText).join('');
}

function decodeXml(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

function emptyPreflight(): WordGeneratedListPreflight {
  return { definitions: [], renderedLines: new Set(), headings: new Set() };
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

declare module './docxManuscriptImport' {
  interface DocxManuscriptImportPlan {
    generatedListDefinitions?: OmiGeneratedListDefinition[];
  }
}
