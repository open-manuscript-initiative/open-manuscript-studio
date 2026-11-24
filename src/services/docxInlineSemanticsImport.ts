import { normalizeSourceStyle, resolveSourceStyle, type SourceStyle } from '../model/sourceWordStyles';
import { readWordParagraphFormatting, readWordParagraphDecoration } from '../model/directParagraphFormatting';
import { wordDirectFormatting, mergeWordDirectFormatting } from './docxDirectFormatting';
import {
  wordCharacterStyleSemantics,
  type DocxInlineSemantic,
} from '../model/docxImport';
import { normalizeInlineLanguageTag } from '../model/richText';
import type { OmiBlock } from '../types/omi';
import {
  parseDocxManuscript,
  type DocxManuscriptImportPlan,
} from './docxManuscriptImport';

interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

interface CharacterStyle {
  id: string;
  name?: string;
  basedOn?: string;
  semantics: DocxInlineSemantic[];
  source: SourceStyle;
}

interface TiptapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

interface WordRunSegment {
  text: string;
  marks: TiptapMark[];
}

interface RichParagraphCandidate {
  text: string;
  content: string;
}

/**
 * Runs the stable full DOCX importer and enriches ordinary paragraph blocks
 * with inline character semantics recovered directly from WordprocessingML.
 *
 * Complex blocks containing OMI atomic nodes (notes/citations/cross-references)
 * are left untouched so this compatibility layer can never destroy already
 * recovered scholarly semantics.
 */
export async function parseDocxManuscriptWithInlineSemantics(
  file: File,
): Promise<DocxManuscriptImportPlan> {
  const plan = await parseDocxManuscript(file);

  try {
    const candidates = await readRichParagraphCandidates(file);
    enrichPlanBlocks(plan, candidates);
  } catch {
    // Inline enrichment is deliberately non-fatal. The mature structural DOCX
    // importer remains authoritative if an unusual package cannot be enriched.
  }

  return plan;
}

async function readRichParagraphCandidates(file: File): Promise<RichParagraphCandidate[]> {
  const archive = new DocxZipArchive(await file.arrayBuffer());
  if (!archive.has('word/document.xml')) return [];

  const styles = archive.has('word/styles.xml')
    ? parseCharacterStyles(await archive.text('word/styles.xml'))
    : new Map<string, CharacterStyle>();
  const document = parseXml(await archive.text('word/document.xml'));
  const body = descendantsByLocalName(document, 'body')[0];
  if (!body) return [];

  const candidates: RichParagraphCandidate[] = [];
  for (const paragraph of structuredBodyParagraphs(body)) {
    // This text-only enrichment cannot represent line breaks, tabs, or link/field
    // boundaries. The structural importer already retains them; never replace
    // those paragraphs (or queue them against an unrelated plain paragraph).
    if (['br', 'cr', 'tab', 'hyperlink', 'fldSimple', 'fldChar', 'instrText'].some(
      (name) => descendantsByLocalName(paragraph, name).length > 0,
    )) continue;
    const pPr = directChildrenByLocalName(paragraph, 'pPr')[0];
    const pStyle = pPr && directChildrenByLocalName(pPr,'pStyle')[0];
    const paragraphStyle = importedStyle(pStyle && attributeByLocalName(pStyle,'val'), styles, 'paragraph');
    const segments = parseParagraphRuns(paragraph, styles, paragraphStyle);
    const text = segments.map((segment) => segment.text).join('');
    if (!text.trim()) continue;
    if (!paragraphStyle && !segments.some((segment) => segment.marks.length > 0)) continue;
    const attrs = pPr ? readWordParagraphFormatting((property, attribute) => {
      const item = directChildrenByLocalName(pPr, property)[0];
      return item ? attributeByLocalName(item, attribute) : undefined;
    }, property => directChildrenByLocalName(pPr, property).length > 0) : {};
    if (pPr) Object.assign(attrs, readWordParagraphDecoration((parent, name) => {
      const container = directChildrenByLocalName(pPr, parent)[0];
      return container ? directChildrenByLocalName(container, name).map(element => Object.fromEntries(Array.from(element.attributes).map(attribute => [attribute.localName, attribute.value]))) : [];
    }));
    if (paragraphStyle) attrs.omiWordParagraphStyle = paragraphStyle;
    candidates.push({
      text,
      content: JSON.stringify({
        type: 'doc',
        content: [{
          type: 'paragraph',
          ...(Object.keys(attrs).length ? { attrs } : {}),
          content: segments
            .filter((segment) => segment.text)
            .map((segment) => ({
              type: 'text',
              text: segment.text,
              marks: segment.marks.length ? segment.marks : undefined,
            })),
        }],
      }),
    });
  }
  return candidates;
}

function enrichPlanBlocks(
  plan: DocxManuscriptImportPlan,
  candidates: readonly RichParagraphCandidate[],
): void {
  const queues = new Map<string, RichParagraphCandidate[]>();
  for (const candidate of candidates) {
    const key = normalize(candidate.text);
    const queue = queues.get(key) ?? [];
    queue.push(candidate);
    queues.set(key, queue);
  }

  for (const section of plan.sections) {
    for (const block of section.blocks) {
      if (!isSafeSimpleTextBlock(block)) continue;
      const text = storedPlainText(block.content);
      const queue = queues.get(normalize(text));
      const candidate = queue?.shift();
      if (!candidate) continue;
      block.content = candidate.content;
    }
  }
}

function isSafeSimpleTextBlock(block: OmiBlock): boolean {
  if (block.visual) return false;
  if (block.type !== 'paragraph' && block.type !== 'quote') return false;
  if (/"type"\s*:\s*"(?:hardBreak|omiTab|omiLink)"/.test(block.content)) return false;
  if (storedPlainText(block.content).includes('\t')) return false;
  if (/"type"\s*:\s*"omi(?:Note|Citation|CrossReference)"/.test(block.content)) {
    return false;
  }
  if (/"type"\s*:\s*"(?:bulletList|orderedList|codeBlock)"/.test(block.content)) {
    return false;
  }
  return true;
}

function parseParagraphRuns(
  paragraph: Element,
  styles: ReadonlyMap<string, CharacterStyle>,
  paragraphStyle?: string,
): WordRunSegment[] {
  const result: WordRunSegment[] = [];

  for (const run of descendantsByLocalName(paragraph, 'r')) {
    const text = directChildrenByLocalName(run, 't')
      .map((node) => node.textContent ?? '')
      .join('');
    if (!text) continue;

    const properties = directChildrenByLocalName(run, 'rPr')[0];
    const direct = properties ? semanticsFromRunProperties(properties) : [];
    const styleIdElement = properties
      ? directChildrenByLocalName(properties, 'rStyle')[0]
      : undefined;
    const styleId = styleIdElement
      ? attributeByLocalName(styleIdElement, 'val')
      : undefined;
    const inherited = styleId
      ? resolveCharacterStyleSemantics(styleId, styles)
      : [];
    const characterStyle = importedStyle(styleId,styles,'character');
    const p = resolveSourceStyle(paragraphStyle), c = resolveSourceStyle(characterStyle);
    const semantics = Array.from(new Set([...inherited, ...direct]));
    // Named custom style toggles and absolute direct overrides must not be
    // collapsed into a union: an explicit w:b=0 cancels inherited bold.
    for (const [property,semantic] of [['b','strong'],['i','emphasis']] as const) {
      const key = property === 'b' ? 'bold' : 'italic';
      const explicit = properties && directChildrenByLocalName(properties,property)[0];
      const enabled = explicit ? enabledWordProperty(properties!,property) : c[key] !== undefined ? Boolean(p[key]) !== c[key] : p[key];
      if (enabled === undefined) continue;
      const index = semantics.indexOf(semantic);
      if (enabled && index < 0) semantics.push(semantic);
      if (!enabled && index >= 0) semantics.splice(index,1);
    }
    const marks: TiptapMark[] = mergeWordDirectFormatting(semantics.flatMap(toTiptapMark), properties ? wordDirectFormatting(
      (property, attribute = 'val') => { const item = directChildrenByLocalName(properties, property)[0]; return item ? attributeByLocalName(item, attribute) : undefined; },
      (property) => directChildrenByLocalName(properties, property).length > 0,
    ) : []);
    const inheritedColor = c.color ?? p.color;
    const colorElement = properties && directChildrenByLocalName(properties,'color')[0];
    if (inheritedColor && !colorElement && !marks.some(m=>m.type==='omiTextColor')) marks.push({type:'omiTextColor',attrs:{value:inheritedColor}});
    if (characterStyle) marks.push({type:'omiWordCharacterStyle',attrs:{definition:characterStyle}});
    const sourceFontFamily = properties
      ? sourceFontFamilyFromRunProperties(properties)
      : undefined;
    if (sourceFontFamily) {
      marks.push({ type: 'omiSourceFont', attrs: { family: sourceFontFamily } });
    }

    const languageElement = properties
      ? directChildrenByLocalName(properties, 'lang')[0]
      : undefined;
    const language = normalizeInlineLanguageTag(
      languageElement ? attributeByLocalName(languageElement, 'val') : undefined,
    );
    if (language) marks.push({ type: 'omiLanguage', attrs: { lang: language } });

    const previous = result.at(-1);
    if (previous && JSON.stringify(previous.marks) === JSON.stringify(marks)) {
      previous.text += text;
    } else {
      result.push({ text, marks });
    }
  }

  return result;
}

function parseCharacterStyles(xml: string): Map<string, CharacterStyle> {
  const document = parseXml(xml);
  const result = new Map<string, CharacterStyle>();

  for (const style of descendantsByLocalName(document, 'style')) {
    const type = attributeByLocalName(style, 'type');
    if (type !== 'character' && type !== 'paragraph') continue;
    const id = attributeByLocalName(style, 'styleId');
    if (!id) continue;
    const nameElement = directChildrenByLocalName(style, 'name')[0];
    const basedOnElement = directChildrenByLocalName(style, 'basedOn')[0];
    const name = nameElement ? attributeByLocalName(nameElement, 'val') : undefined;
    const rPr = directChildrenByLocalName(style, 'rPr')[0];
    const semantics = [
      ...(type === 'character' ? wordCharacterStyleSemantics(id, name) : []),
      ...(rPr ? semanticsFromRunProperties(rPr) : []),
    ];
    const next = directChildrenByLocalName(style,'next')[0];
    const color = rPr && directChildrenByLocalName(rPr,'color')[0];
    const flag = (key:string) => rPr && directChildrenByLocalName(rPr,key)[0] ? enabledWordProperty(rPr,key) : undefined;
    const rawColor = color && attributeByLocalName(color,'val');
    result.set(id, {
      source: {id,name:name ?? id,kind:type,basedOn:basedOnElement && attributeByLocalName(basedOnElement,'val'),next:next && attributeByLocalName(next,'val'),bold:flag('b'),italic:flag('i'),color:rawColor && /^([0-9a-f]{6})$/i.test(rawColor) ? '#'+rawColor : undefined},
      id,
      name,
      basedOn: basedOnElement ? attributeByLocalName(basedOnElement, 'val') : undefined,
      semantics: Array.from(new Set(semantics)),
    });
  }

  return result;
}


function importedStyle(id: string | undefined, styles: ReadonlyMap<string,CharacterStyle>, kind: SourceStyle['kind']): string | undefined {
  if (!id || styles.get(id)?.source.kind !== kind) return undefined;
  // Studio's own exported semantic styles are already represented by native
  // marks. Do not add redundant source metadata on repeated DOCX imports.
  if (/^(?:Normal|DefaultParagraphFont|Title|Subtitle|Author|Heading[1-9]|FootnoteText|EndnoteText|FootnoteReference|EndnoteReference|FundingNote|OMIStrong|OMIEmphasis|OMIStrongEmphasis|OMIStrike|OMIUnderline|OMISmallCaps|OMISuperscript|OMISubscript|OMICode|OMIAuthorGivenName|OMIAuthorFamilyName)$/.test(id)) return undefined;
  const definitions: SourceStyle[]=[];
  const seen=new Set<string>();
  const pending=[id];
  while(pending.length && definitions.length < 64) {
    const key=pending.shift()!;
    if(seen.has(key)) continue;
    seen.add(key);
    const definition=styles.get(key)?.source;
    if(!definition) continue;
    definitions.push(definition);
    if(definition.basedOn) pending.push(definition.basedOn);
    if(definition.next) pending.push(definition.next);
  }
  return normalizeSourceStyle({selected:id,styles:definitions});
}

function resolveCharacterStyleSemantics(
  styleId: string,
  styles: ReadonlyMap<string, CharacterStyle>,
): DocxInlineSemantic[] {
  const result: DocxInlineSemantic[] = [];
  const visited = new Set<string>();
  let current: CharacterStyle | undefined = styles.get(styleId);

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    result.push(...current.semantics);
    current = current.basedOn ? styles.get(current.basedOn) : undefined;
  }
  return Array.from(new Set(result));
}

function semanticsFromRunProperties(properties: Element): DocxInlineSemantic[] {
  const result: DocxInlineSemantic[] = [];
  if (enabledWordProperty(properties, 'b')) result.push('strong');
  if (enabledWordProperty(properties, 'i')) result.push('emphasis');
  if (enabledWordProperty(properties, 'strike')) result.push('strike');
  if (enabledWordProperty(properties, 'smallCaps')) result.push('small-caps');

  const underline = directChildrenByLocalName(properties, 'u')[0];
  const underlineValue = underline ? attributeByLocalName(underline, 'val') : undefined;
  if (underline && !/^(?:none|0|false|off)$/i.test(underlineValue ?? 'single')) {
    result.push('underline');
  }

  const vertical = directChildrenByLocalName(properties, 'vertAlign')[0];
  const verticalValue = vertical ? attributeByLocalName(vertical, 'val') : undefined;
  if (verticalValue === 'superscript') result.push('superscript');
  if (verticalValue === 'subscript') result.push('subscript');

  const fonts = directChildrenByLocalName(properties, 'rFonts')[0];
  const fontName = fonts
    ? [attributeByLocalName(fonts, 'ascii'), attributeByLocalName(fonts, 'hAnsi')]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
    : '';
  if (/(?:courier|consolas|monaco|monospace)/.test(fontName)) result.push('code');

  return Array.from(new Set(result));
}

function toTiptapMark(semantic: DocxInlineSemantic): TiptapMark[] {
  switch (semantic) {
    case 'strong': return [{ type: 'bold' }];
    case 'emphasis': return [{ type: 'italic' }];
    case 'strike': return [{ type: 'strike' }];
    case 'underline': return [{ type: 'omiUnderline' }];
    case 'small-caps': return [{ type: 'omiSmallCaps' }];
    case 'superscript': return [{ type: 'omiSuperscript' }];
    case 'subscript': return [{ type: 'omiSubscript' }];
    case 'code': return [{ type: 'code' }];
  }
}

function sourceFontFamilyFromRunProperties(properties: Element): string | undefined {
  const fonts = directChildrenByLocalName(properties, 'rFonts')[0];
  if (!fonts) return undefined;
  const family = ['hAnsi', 'ascii', 'eastAsia', 'cs']
    .map((name) => attributeByLocalName(fonts, name)?.trim())
    .find((value) => value && value.length <= 128 && Array.from(value).every((character) => { const code = character.charCodeAt(0); return code >= 32 && code !== 127; }));
  return family || undefined;
}

function enabledWordProperty(properties: Element, name: string): boolean {
  const element = directChildrenByLocalName(properties, name)[0];
  if (!element) return false;
  const value = attributeByLocalName(element, 'val');
  return value === undefined || !/^(?:0|false|off|none)$/i.test(value);
}

function storedPlainText(content: string): string {
  try {
    const value = JSON.parse(content) as unknown;
    return collectJsonText(value);
  } catch {
    return content;
  }
}

function collectJsonText(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const node = value as { text?: unknown; content?: unknown[] };
  if (typeof node.text === 'string') return node.text;
  return (node.content ?? []).map(collectJsonText).join('');
}

function normalize(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function parseXml(xml: string): XMLDocument {
  // WordprocessingML is parsed as XML in a detached document and only read as
  // structured data. It is never reinterpreted as HTML or mounted in the live DOM.
  // codeql[js/xss-through-dom]
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.querySelector('parsererror')) throw new Error('Invalid Open XML part.');
  return document;
}

function descendantsByLocalName(root: Document | Element, name: string): Element[] {
  return Array.from(root.getElementsByTagName('*')).filter((element) => element.localName === name);
}

function directChildrenByLocalName(root: Element, name: string): Element[] {
  return Array.from(root.children).filter((element) => element.localName === name);
}

function structuredBodyParagraphs(container: Element): Element[] {
  const result: Element[] = [];
  for (const child of Array.from(container.children)) {
    if (child.localName === 'p') {
      result.push(child);
      continue;
    }
    if (child.localName !== 'sdt' && child.localName !== 'sdtContent') continue;
    const contentContainers = child.localName === 'sdtContent'
      ? [child]
      : directChildrenByLocalName(child, 'sdtContent');
    for (const content of contentContainers) {
      result.push(...structuredBodyParagraphs(content));
    }
  }
  return result;
}

function attributeByLocalName(element: Element, name: string): string | undefined {
  return Array.from(element.attributes).find((attribute) => attribute.localName === name)?.value;
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
    if (this.view.getUint32(offset, true) !== 0x04034b50) throw new Error('Invalid ZIP local header.');
    const fileNameLength = this.view.getUint16(offset + 26, true);
    const extraLength = this.view.getUint16(offset + 28, true);
    const dataOffset = offset + 30 + fileNameLength + extraLength;
    const compressed = this.bytesView.slice(dataOffset, dataOffset + entry.compressedSize);

    if (entry.method === 0) return compressed;
    if (entry.method !== 8) throw new Error(`Unsupported ZIP compression method ${entry.method}.`);
    if (typeof DecompressionStream === 'undefined') throw new Error('DOCX decompression is unavailable.');
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
      if (this.view.getUint32(offset, true) !== 0x02014b50) throw new Error('Invalid ZIP central directory.');
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
