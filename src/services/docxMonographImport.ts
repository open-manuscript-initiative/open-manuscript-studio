import {
  createEmptyDocxImportStats,
  detectKeywordLine,
  headingLevelFromStyle,
  isAbstractStyle,
  isAuthorStyle,
  isTitleStyle,
  mergeDetectedAuthors,
  parseDetectedAuthors,
  type DocxDetectedAuthor,
  type DocxImportWarning,
} from '../model/docxImport';
import { createImageBlock } from '../model/visualBlocks';
import { normalizeExternalHref, normalizeInlineLanguageTag } from '../model/richText';
import { withParentSectionId } from '../model/sectionStructure';
import type { OmiAnnotation, OmiBlock, OmiImportProvenance, OmiSection } from '../types/omi';
import type { DocxManuscriptImportPlan } from './docxManuscriptImport';

interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

interface WordStyle {
  id: string;
  name?: string;
  outlineLevel?: number;
}

interface Relationship {
  target: string;
  targetMode?: string;
}

interface TiptapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  marks?: TiptapMark[];
  text?: string;
}

export interface MonographImportProgress {
  processedParagraphs: number;
  totalParagraphs: number;
}

export interface MonographImportOptions {
  onProgress?: (progress: MonographImportProgress) => void;
}

export async function parseDocxMonograph(
  file: File,
  options: MonographImportOptions = {},
): Promise<DocxManuscriptImportPlan> {
  const archive = new DocxZipArchive(await file.arrayBuffer());
  if (!archive.has('word/document.xml')) {
    throw new Error('The DOCX file does not contain word/document.xml.');
  }

  const importedAt = new Date().toISOString();
  const provenance: OmiImportProvenance = {
    sourceFormat: 'docx',
    fileName: file.name,
    importedAt,
  };
  const warnings: DocxImportWarning[] = [];
  const stats = createEmptyDocxImportStats();
  const styles = archive.has('word/styles.xml')
    ? parseStyles(await archive.text('word/styles.xml'))
    : new Map<string, WordStyle>();
  const relationships = archive.has('word/_rels/document.xml.rels')
    ? parseRelationships(await archive.text('word/_rels/document.xml.rels'))
    : new Map<string, Relationship>();
  const footnotes = archive.has('word/footnotes.xml')
    ? parseNotes(await archive.text('word/footnotes.xml'), 'footnote')
    : new Map<string, string>();
  const endnotes = archive.has('word/endnotes.xml')
    ? parseNotes(await archive.text('word/endnotes.xml'), 'endnote')
    : new Map<string, string>();
  const core = archive.has('docProps/core.xml')
    ? parseCoreProperties(await archive.text('docProps/core.xml'))
    : {};
  const documentXml = await archive.text('word/document.xml');

  if (/<w:commentReference\b/i.test(documentXml)) {
    warnings.push(makeWarning('comments-not-imported', 'Word comments are not imported in large-document mode.'));
  }
  if (/<w:del\b/i.test(documentXml)) {
    warnings.push(makeWarning('tracked-deletions', 'Tracked deletions are ignored during import.'));
  }
  if (/<w:tbl\b/i.test(documentXml)) {
    warnings.push(makeWarning('large-docx-tables-flattened', 'Tables are flattened to paragraph text in large-document mode.'));
  }
  if (/<m:oMath\b/i.test(documentXml)) {
    warnings.push(makeWarning('large-docx-equations-flattened', 'Word equations are flattened in large-document mode.'));
  }
  if (/\bCITATION\b/i.test(documentXml)) {
    warnings.push(makeWarning('large-docx-citations-flattened', 'Word citation fields are imported as visible text in large-document mode.'));
  }

  const sections: OmiSection[] = [];
  const annotations: OmiAnnotation[] = [];
  const headingStack: Array<{ id: string; level: number }> = [];
  const authorGroups: DocxDetectedAuthor[][] = [];
  if (core.creator) authorGroups.push(parseDetectedAuthors(core.creator, 'core-properties'));

  let title = core.title?.trim() ?? '';
  let titleSource: DocxManuscriptImportPlan['titleSource'] = title ? 'core-properties' : 'filename';
  let abstract = '';
  let keywords: string[] = [];
  let frontMatter = true;

  const paragraphMatches = Array.from(documentXml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/gi));
  const totalParagraphs = paragraphMatches.length;

  for (let index = 0; index < paragraphMatches.length; index += 1) {
    const paragraphXml = paragraphMatches[index]?.[0] ?? '';
    if (!paragraphXml) continue;

    const styleId = firstAttribute(paragraphXml, 'w:pStyle', 'w:val');
    const style = styleId ? styles.get(styleId) : undefined;
    const plainText = extractVisibleText(paragraphXml).trim();
    const directOutline = numberAttribute(paragraphXml, 'w:outlineLvl', 'w:val');
    const headingLevel = headingLevelFromStyle(
      styleId,
      style?.name,
      directOutline ?? style?.outlineLevel,
    );

    if (headingLevel !== undefined && plainText) {
      frontMatter = false;
      while (headingStack.length && (headingStack.at(-1)?.level ?? 0) >= headingLevel) {
        headingStack.pop();
      }
      const id = crypto.randomUUID();
      const section = withParentSectionId(
        { id, title: plainText, blocks: [] },
        headingStack.at(-1)?.id,
      );
      sections.push(section);
      headingStack.push({ id, level: headingLevel });
      stats.sections += 1;
      await maybeYield(index, totalParagraphs, options);
      continue;
    }

    if (frontMatter && plainText) {
      if (isTitleStyle(styleId, style?.name)) {
        if (!title) {
          title = plainText;
          titleSource = 'title-style';
        }
        await maybeYield(index, totalParagraphs, options);
        continue;
      }
      if (isAuthorStyle(styleId, style?.name)) {
        authorGroups.push(parseDetectedAuthors(plainText, 'author-style'));
        await maybeYield(index, totalParagraphs, options);
        continue;
      }
      if (isAbstractStyle(styleId, style?.name)) {
        abstract = [abstract, plainText].filter(Boolean).join('\n');
        await maybeYield(index, totalParagraphs, options);
        continue;
      }
      const detectedKeywords = detectKeywordLine(plainText);
      if (detectedKeywords) {
        keywords = Array.from(new Set([...keywords, ...detectedKeywords]));
        await maybeYield(index, totalParagraphs, options);
        continue;
      }
    }

    const visuals = await extractImages(paragraphXml, archive, relationships, provenance, stats);
    if (!plainText && visuals.length === 0) {
      await maybeYield(index, totalParagraphs, options);
      continue;
    }

    const section = ensureSection(sections);
    if (plainText) {
      const blockId = crypto.randomUUID();
      const inline = parseInline(paragraphXml, blockId, footnotes, endnotes, annotations, relationships, stats);
      section.blocks.push({
        id: blockId,
        type: 'paragraph',
        content: JSON.stringify({
          type: 'doc',
          content: [{ type: 'paragraph', content: inline }],
        }),
      });
      stats.paragraphs += 1;
    }
    section.blocks.push(...visuals);
    frontMatter = false;
    await maybeYield(index, totalParagraphs, options);
  }

  for (const section of sections) {
    if (section.blocks.length === 0) section.blocks.push(createEmptyParagraphBlock());
  }
  if (sections.length === 0) {
    sections.push({ id: crypto.randomUUID(), title: 'Imported content', blocks: [createEmptyParagraphBlock()] });
  }
  if (!title) {
    title = file.name.replace(/\.docx$/i, '').trim() || 'Imported manuscript';
    titleSource = 'filename';
    warnings.push(makeWarning('title-from-filename', 'The manuscript title was derived from the file name.'));
  }

  const authors = mergeDetectedAuthors(...authorGroups);
  if (authors.length > 0) {
    warnings.push(makeWarning('authors-from-docx-metadata', 'Author names were recovered from Word metadata or styles.'));
  }

  stats.sections = sections.length;
  stats.notes = annotations.length;
  stats.warnings = warnings.length;
  options.onProgress?.({ processedParagraphs: totalParagraphs, totalParagraphs });

  return {
    fileName: file.name,
    title,
    titleSource,
    locale: normalizeInlineLanguageTag(core.language),
    abstract: abstract || undefined,
    keywords,
    authors,
    sections,
    annotations,
    bibliographicRecords: [],
    citations: [],
    citationClusters: [],
    stats,
    warnings,
  };
}

function parseInline(
  paragraphXml: string,
  blockId: string,
  footnotes: ReadonlyMap<string, string>,
  endnotes: ReadonlyMap<string, string>,
  annotations: OmiAnnotation[],
  relationships: ReadonlyMap<string, Relationship>,
  stats: ReturnType<typeof createEmptyDocxImportStats>,
): TiptapNode[] {
  const output: TiptapNode[] = [];
  const tokenPattern = /<w:hyperlink\b[\s\S]*?<\/w:hyperlink>|<w:r\b[\s\S]*?<\/w:r>/gi;

  for (const match of paragraphXml.matchAll(tokenPattern)) {
    const token = match[0];
    const hyperlink = token.startsWith('<w:hyperlink');
    const relationshipId = hyperlink ? attributeFromStartTag(token, 'r:id') : undefined;
    const href = relationshipId ? normalizeExternalHref(relationships.get(relationshipId)?.target) : undefined;
    if (href) stats.links += 1;

    const runs = hyperlink ? Array.from(token.matchAll(/<w:r\b[\s\S]*?<\/w:r>/gi), (item) => item[0]) : [token];
    for (const run of runs) {
      if (/<w:instrText\b/i.test(run)) continue;
      const noteMatch = /<w:(footnoteReference|endnoteReference)\b[^>]*\bw:id="(-?\d+)"[^>]*\/?\s*>/i.exec(run);
      if (noteMatch?.[2] && Number(noteMatch[2]) >= 0) {
        const noteKind = noteMatch[1] === 'endnoteReference' ? 'endnote' : 'footnote';
        const body = noteKind === 'endnote' ? endnotes.get(noteMatch[2]) : footnotes.get(noteMatch[2]);
        if (body) {
          const annotationId = `note-${crypto.randomUUID()}`;
          const anchorId = `anchor-${crypto.randomUUID()}`;
          annotations.push({
            id: annotationId,
            type: 'note',
            noteKind,
            anchorId,
            targetBlockId: blockId,
            body,
            renderingHint: noteKind,
            createdAt: new Date().toISOString(),
            modifiedAt: new Date().toISOString(),
          });
          output.push({
            type: 'omiNote',
            attrs: {
              noteId: annotationId,
              anchorId,
              label: String(annotations.length),
              noteType: noteKind,
            },
          });
        }
      }

      const marks = runMarks(run);
      if (href) marks.push({ type: 'omiLink', attrs: { href } });
      const text = extractRunText(run);
      if (text) output.push({ type: 'text', text, marks: marks.length ? marks : undefined });
      if (/<w:tab\b/i.test(run)) output.push({ type: 'text', text: '\t', marks: marks.length ? marks : undefined });
      if (/<w:(?:br|cr)\b/i.test(run)) output.push({ type: 'hardBreak' });
    }
  }

  return coalesceTextNodes(output);
}

function runMarks(run: string): TiptapMark[] {
  const properties = /<w:rPr\b[\s\S]*?<\/w:rPr>/i.exec(run)?.[0] ?? '';
  const marks: TiptapMark[] = [];
  if (enabledProperty(properties, 'b')) marks.push({ type: 'bold' });
  if (enabledProperty(properties, 'i')) marks.push({ type: 'italic' });
  if (enabledProperty(properties, 'strike')) marks.push({ type: 'strike' });
  if (enabledProperty(properties, 'u')) marks.push({ type: 'omiUnderline' });
  if (enabledProperty(properties, 'smallCaps')) marks.push({ type: 'omiSmallCaps' });
  const vertical = firstAttribute(properties, 'w:vertAlign', 'w:val');
  if (vertical === 'superscript') marks.push({ type: 'omiSuperscript' });
  if (vertical === 'subscript') marks.push({ type: 'omiSubscript' });
  const language = normalizeInlineLanguageTag(firstAttribute(properties, 'w:lang', 'w:val'));
  if (language) marks.push({ type: 'omiLanguage', attrs: { lang: language } });
  return marks;
}

function enabledProperty(xml: string, localName: string): boolean {
  const match = new RegExp(`<w:${localName}\\b([^>]*)\\/?\\s*>`, 'i').exec(xml);
  if (!match) return false;
  const value = /\bw:val="([^"]+)"/i.exec(match[1] ?? '')?.[1];
  return value === undefined || !/^(?:0|false|off|none)$/i.test(value);
}

async function extractImages(
  paragraphXml: string,
  archive: DocxZipArchive,
  relationships: ReadonlyMap<string, Relationship>,
  provenance: OmiImportProvenance,
  stats: ReturnType<typeof createEmptyDocxImportStats>,
): Promise<OmiBlock[]> {
  const blocks: OmiBlock[] = [];
  const seen = new Set<string>();
  for (const match of paragraphXml.matchAll(/<a:blip\b[^>]*\br:embed="([^"]+)"[^>]*>/gi)) {
    const relationshipId = match[1];
    const target = relationshipId ? relationships.get(relationshipId)?.target : undefined;
    if (!target) continue;
    const archivePath = normalizeWordTarget(target);
    if (seen.has(archivePath) || !archive.has(archivePath)) continue;
    seen.add(archivePath);
    const bytes = await archive.bytes(archivePath);
    const mediaType = inferMediaType(archivePath);
    blocks.push(createImageBlock({
      src: bytesToDataUrl(bytes, mediaType),
      mediaType,
      fileName: archivePath.split('/').pop(),
      alt: firstAttribute(paragraphXml, 'wp:docPr', 'descr') ?? firstAttribute(paragraphXml, 'wp:docPr', 'name') ?? '',
      provenance: { ...provenance, sourcePart: archivePath },
    }));
    stats.images += 1;
  }
  return blocks;
}

function parseStyles(xml: string): Map<string, WordStyle> {
  const styles = new Map<string, WordStyle>();
  for (const match of xml.matchAll(/<w:style\b[\s\S]*?<\/w:style>/gi)) {
    const block = match[0];
    const id = attributeFromStartTag(block, 'w:styleId');
    if (!id) continue;
    styles.set(id, {
      id,
      name: firstAttribute(block, 'w:name', 'w:val'),
      outlineLevel: numberAttribute(block, 'w:outlineLvl', 'w:val'),
    });
  }
  return styles;
}

function parseRelationships(xml: string): Map<string, Relationship> {
  const result = new Map<string, Relationship>();
  for (const match of xml.matchAll(/<Relationship\b([^>]*)\/?\s*>/gi)) {
    const attrs = match[1] ?? '';
    const id = /\bId="([^"]+)"/i.exec(attrs)?.[1];
    const target = /\bTarget="([^"]+)"/i.exec(attrs)?.[1];
    if (!id || !target) continue;
    result.set(id, {
      target: decodeXml(target),
      targetMode: /\bTargetMode="([^"]+)"/i.exec(attrs)?.[1],
    });
  }
  return result;
}

function parseNotes(xml: string, localName: 'footnote' | 'endnote'): Map<string, string> {
  const result = new Map<string, string>();
  const pattern = new RegExp(`<w:${localName}\\b([^>]*)>([\\s\\S]*?)<\\/w:${localName}>`, 'gi');
  for (const match of xml.matchAll(pattern)) {
    const id = /\bw:id="(-?\d+)"/i.exec(match[1] ?? '')?.[1];
    if (!id || Number(id) < 0) continue;
    const text = extractVisibleText(match[2] ?? '').trim();
    if (text) result.set(id, text);
  }
  return result;
}

function parseCoreProperties(xml: string): { title?: string; creator?: string; language?: string } {
  return {
    title: elementText(xml, 'dc:title'),
    creator: elementText(xml, 'dc:creator'),
    language: elementText(xml, 'dc:language'),
  };
}

function extractVisibleText(xml: string): string {
  return Array.from(xml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/gi), (match) => decodeXml(match[1] ?? '')).join('');
}

function extractRunText(run: string): string {
  return Array.from(run.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/gi), (match) => decodeXml(match[1] ?? '')).join('');
}

function firstAttribute(xml: string, tagName: string, attributeName: string): string | undefined {
  const escapedTag = tagName.replace(':', '\\:');
  const escapedAttribute = attributeName.replace(':', '\\:');
  return decodeXml(new RegExp(`<${escapedTag}\\b[^>]*\\b${escapedAttribute}="([^"]+)"`, 'i').exec(xml)?.[1] ?? '') || undefined;
}

function numberAttribute(xml: string, tagName: string, attributeName: string): number | undefined {
  const value = firstAttribute(xml, tagName, attributeName);
  if (value === undefined) return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function attributeFromStartTag(xml: string, attributeName: string): string | undefined {
  const start = /^<[^>]+>/i.exec(xml)?.[0] ?? '';
  const escaped = attributeName.replace(':', '\\:');
  return decodeXml(new RegExp(`\\b${escaped}="([^"]+)"`, 'i').exec(start)?.[1] ?? '') || undefined;
}

function elementText(xml: string, tagName: string): string | undefined {
  const escaped = tagName.replace(':', '\\:');
  const value = new RegExp(`<${escaped}\\b[^>]*>([\\s\\S]*?)<\\/${escaped}>`, 'i').exec(xml)?.[1];
  return value === undefined ? undefined : decodeXml(value).trim() || undefined;
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

function ensureSection(sections: OmiSection[]): OmiSection {
  const existing = sections.at(-1);
  if (existing) return existing;
  const section: OmiSection = { id: crypto.randomUUID(), title: 'Imported content', blocks: [] };
  sections.push(section);
  return section;
}

function createEmptyParagraphBlock(): OmiBlock {
  return {
    id: crypto.randomUUID(),
    type: 'paragraph',
    content: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] }),
  };
}

function coalesceTextNodes(nodes: readonly TiptapNode[]): TiptapNode[] {
  const output: TiptapNode[] = [];
  for (const node of nodes) {
    const previous = output.at(-1);
    if (
      node.type === 'text' && previous?.type === 'text' &&
      JSON.stringify(node.marks ?? []) === JSON.stringify(previous.marks ?? [])
    ) {
      previous.text = `${previous.text ?? ''}${node.text ?? ''}`;
    } else {
      output.push({ ...node });
    }
  }
  return output;
}

async function maybeYield(index: number, total: number, options: MonographImportOptions): Promise<void> {
  if ((index + 1) % 64 !== 0 && index + 1 !== total) return;
  options.onProgress?.({ processedParagraphs: index + 1, totalParagraphs: total });
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

function makeWarning(code: string, message: string): DocxImportWarning {
  return { code, severity: 'warning', message };
}

function normalizeWordTarget(target: string): string {
  const normalized = target.replace(/\\/g, '/').replace(/^\.\//, '');
  return normalized.startsWith('word/') ? normalized : `word/${normalized.replace(/^\.\.\//, '')}`;
}

function inferMediaType(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.emf')) return 'image/emf';
  if (lower.endsWith('.wmf')) return 'image/wmf';
  return 'application/octet-stream';
}

function bytesToDataUrl(bytes: Uint8Array, mediaType: string): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return `data:${mediaType};base64,${btoa(binary)}`;
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

  async text(name: string): Promise<string> {
    return new TextDecoder().decode(await this.bytes(name));
  }

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
