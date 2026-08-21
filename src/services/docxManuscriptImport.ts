import {
  createEquationBlock,
  createImageBlock,
  createTableBlock,
  MAX_VISUAL_IMPORT_BYTES,
} from '../model/visualBlocks';
import {
  createEmptyDocxImportStats,
  detectKeywordLine,
  headingLevelFromStyle,
  isAbstractStyle,
  isAuthorStyle,
  isCodeStyle,
  isQuoteStyle,
  isTitleStyle,
  mapWordSourceType,
  mergeDetectedAuthors,
  parseDetectedAuthors,
  parseWordCitationInstruction,
  parseWordHyperlinkInstruction,
  type DocxDetectedAuthor,
  type DocxImportStats,
  type DocxImportWarning,
} from '../model/docxImport';
import {
  normalizeExternalHref,
  normalizeInlineLanguageTag,
} from '../model/richText';
import { withParentSectionId } from '../model/sectionStructure';
import type {
  OmiAnnotation,
  OmiBibliographicContributor,
  OmiBibliographicRecord,
  OmiBlock,
  OmiCitation,
  OmiCitationCluster,
  OmiImportProvenance,
  OmiSection,
} from '../types/omi';

interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

interface Relationship {
  target: string;
  targetMode?: string;
  type?: string;
}

interface WordStyle {
  id: string;
  name?: string;
  basedOn?: string;
  outlineLevel?: number;
}

interface WordListInfo {
  level: number;
  ordered: boolean;
}

interface ParsedListParagraph {
  level: number;
  ordered: boolean;
  content: TiptapNode[];
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
  content?: TiptapNode[];
}

interface InlineContext {
  blockId: string;
  footnotes: Map<string, string>;
  endnotes: Map<string, string>;
  bibliographyByTag: Map<string, OmiBibliographicRecord>;
  annotations: OmiAnnotation[];
  citations: OmiCitation[];
  citationClusters: OmiCitationCluster[];
  warnings: DocxImportWarning[];
  stats: DocxImportStats;
}

interface FieldState {
  instruction: string;
  result: TiptapNode[];
  phase: 'instruction' | 'result';
}

export interface DocxManuscriptImportPlan {
  fileName: string;
  title: string;
  titleSource: 'core-properties' | 'title-style' | 'filename';
  locale?: string;
  abstract?: string;
  keywords: string[];
  authors: DocxDetectedAuthor[];
  sections: OmiSection[];
  annotations: OmiAnnotation[];
  bibliographicRecords: OmiBibliographicRecord[];
  citations: OmiCitation[];
  citationClusters: OmiCitationCluster[];
  stats: DocxImportStats;
  warnings: DocxImportWarning[];
}

export async function parseDocxManuscript(
  file: File,
): Promise<DocxManuscriptImportPlan> {
  if (!/\.docx$/i.test(file.name)) {
    throw new Error('A DOCX file is required.');
  }
  if (file.size > MAX_VISUAL_IMPORT_BYTES) {
    throw new Error(
      `DOCX import is limited to ${Math.round(MAX_VISUAL_IMPORT_BYTES / 1024 / 1024)} MB per file.`,
    );
  }

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
  const styles = await readStyles(archive);
  const numbering = await readNumbering(archive);
  const relationships = archive.has('word/_rels/document.xml.rels')
    ? parseRelationships(await archive.text('word/_rels/document.xml.rels'))
    : new Map<string, Relationship>();
  const core = archive.has('docProps/core.xml')
    ? parseCoreProperties(await archive.text('docProps/core.xml'))
    : {};
  const footnotes = archive.has('word/footnotes.xml')
    ? parseNotes(await archive.text('word/footnotes.xml'), 'footnote')
    : new Map<string, string>();
  const endnotes = archive.has('word/endnotes.xml')
    ? parseNotes(await archive.text('word/endnotes.xml'), 'endnote')
    : new Map<string, string>();
  const bibliographicRecords = await readWordBibliography(archive, importedAt);
  const bibliographyByTag = new Map(
    bibliographicRecords
      .map((record) => [getWordSourceTag(record), record] as const)
      .filter(([tag]) => Boolean(tag)),
  );
  stats.references = bibliographicRecords.length;

  const document = parseXml(await archive.text('word/document.xml'));
  const body = descendantsByLocalName(document, 'body')[0];
  if (!body) {
    throw new Error('The DOCX document body is missing.');
  }

  if (descendantsByLocalName(body, 'del').length > 0) {
    warnings.push(warning('tracked-deletions'));
  }
  if (descendantsByLocalName(body, 'commentReference').length > 0) {
    warnings.push(warning('comments-not-imported'));
  }
  if (descendantsByLocalName(body, 'txbxContent').length > 0) {
    warnings.push(warning('text-boxes-flattened'));
  }

  const sections: OmiSection[] = [];
  const annotations: OmiAnnotation[] = [];
  const citations: OmiCitation[] = [];
  const citationClusters: OmiCitationCluster[] = [];
  const headingStack: Array<{ id: string; level: number }> = [];
  const authorGroups: DocxDetectedAuthor[][] = [];
  if (core.creator) {
    authorGroups.push(parseDetectedAuthors(core.creator, 'core-properties'));
  }

  let title = core.title?.trim() ?? '';
  let titleSource: DocxManuscriptImportPlan['titleSource'] = title
    ? 'core-properties'
    : 'filename';
  let abstract = '';
  let keywords: string[] = [];
  let frontMatter = true;

  const children = Array.from(body.children);
  let index = 0;

  while (index < children.length) {
    const child = children[index];
    if (!child) break;

    if (child.localName === 'tbl') {
      const section = ensureSection(sections);
      const table = parseWordTable(child);
      if (table.cells.length) {
        section.blocks.push(
          createTableBlock(table.cells, {
            headerRows: table.headerRows,
            provenance,
          }),
        );
        stats.tables += 1;
        if (table.mergedCells) warnings.push(warning('merged-table-cells'));
      }
      frontMatter = false;
      index += 1;
      continue;
    }

    if (child.localName !== 'p') {
      index += 1;
      continue;
    }

    const style = resolveParagraphStyle(child, styles);
    const plainText = paragraphPlainText(child).trim();
    const headingLevel = resolveParagraphHeadingLevel(child, style);

    if (headingLevel !== undefined && plainText) {
      frontMatter = false;
      while (
        headingStack.length &&
        (headingStack.at(-1)?.level ?? 0) >= headingLevel
      ) {
        headingStack.pop();
      }

      const id = crypto.randomUUID();
      const parentId = headingStack.at(-1)?.id;
      const section = withParentSectionId(
        {
          id,
          title: plainText,
          blocks: [],
        },
        parentId,
      );
      sections.push(section);
      headingStack.push({ id, level: headingLevel });
      stats.sections += 1;
      index += 1;
      continue;
    }

    if (frontMatter && plainText) {
      if (isTitleStyle(style?.id, style?.name)) {
        if (!title) {
          title = plainText;
          titleSource = 'title-style';
        } else if (normalizeSpace(title) !== normalizeSpace(plainText)) {
          warnings.push(warning('conflicting-title-metadata'));
        }
        index += 1;
        continue;
      }

      if (isAuthorStyle(style?.id, style?.name)) {
        authorGroups.push(parseDetectedAuthors(plainText, 'author-style'));
        index += 1;
        continue;
      }

      if (isAbstractStyle(style?.id, style?.name)) {
        abstract = [abstract, plainText].filter(Boolean).join('\n');
        index += 1;
        continue;
      }

      const detectedKeywords = detectKeywordLine(plainText);
      if (detectedKeywords) {
        keywords = Array.from(new Set([...keywords, ...detectedKeywords]));
        index += 1;
        continue;
      }
    }

    const listInfo = paragraphListInfo(child, numbering);
    if (listInfo) {
      const section = ensureSection(sections);
      const listBlockId = crypto.randomUUID();
      const listParagraphs: ParsedListParagraph[] = [];
      const trailingVisuals: OmiBlock[] = [];

      while (index < children.length) {
        const paragraph = children[index];
        if (!paragraph || paragraph.localName !== 'p') break;
        const paragraphStyle = resolveParagraphStyle(paragraph, styles);
        if (resolveParagraphHeadingLevel(paragraph, paragraphStyle) !== undefined) break;
        const info = paragraphListInfo(paragraph, numbering);
        if (!info) break;

        const context: InlineContext = {
          blockId: listBlockId,
          footnotes,
          endnotes,
          bibliographyByTag,
          annotations,
          citations,
          citationClusters,
          warnings,
          stats,
        };
        listParagraphs.push({
          ...info,
          content: parseParagraphInline(paragraph, relationships, context),
        });
        trailingVisuals.push(
          ...(await extractParagraphVisuals(
            paragraph,
            archive,
            relationships,
            provenance,
            warnings,
            stats,
          )),
        );
        stats.paragraphs += 1;
        index += 1;
      }

      section.blocks.push({
        id: listBlockId,
        type: 'paragraph',
        content: JSON.stringify({
          type: 'doc',
          content: buildListNodes(listParagraphs),
        }),
      });
      section.blocks.push(...trailingVisuals);
      stats.lists += 1;
      frontMatter = false;
      continue;
    }

    const visuals = await extractParagraphVisuals(
      child,
      archive,
      relationships,
      provenance,
      warnings,
      stats,
    );

    if (!plainText && visuals.length === 0) {
      index += 1;
      continue;
    }

    const section = ensureSection(sections);
    if (plainText) {
      const blockId = crypto.randomUUID();
      const context: InlineContext = {
        blockId,
        footnotes,
        endnotes,
        bibliographyByTag,
        annotations,
        citations,
        citationClusters,
        warnings,
        stats,
      };
      const inline = parseParagraphInline(child, relationships, context);
      const type = isQuoteStyle(style?.id, style?.name)
        ? 'quote'
        : 'paragraph';
      const tiptapContent = isCodeStyle(style?.id, style?.name)
        ? {
            type: 'doc',
            content: [{ type: 'codeBlock', content: plainText ? [{ type: 'text', text: plainText }] : [] }],
          }
        : type === 'quote'
          ? {
              type: 'doc',
              content: [
                {
                  type: 'blockquote',
                  content: [{ type: 'paragraph', content: inline }],
                },
              ],
            }
          : {
              type: 'doc',
              content: [{ type: 'paragraph', content: inline }],
            };

      section.blocks.push({
        id: blockId,
        type,
        content: JSON.stringify(tiptapContent),
      });
      stats.paragraphs += 1;
    }
    section.blocks.push(...visuals);
    frontMatter = false;
    index += 1;
  }

  for (const section of sections) {
    if (section.blocks.length === 0) {
      section.blocks.push(createEmptyParagraphBlock());
    }
  }

  if (sections.length === 0) {
    sections.push({
      id: crypto.randomUUID(),
      title: 'Imported content',
      blocks: [createEmptyParagraphBlock()],
    });
  }

  if (!title) {
    title = file.name.replace(/\.docx$/i, '').trim() || 'Imported manuscript';
    titleSource = 'filename';
    warnings.push(warning('title-from-filename'));
  }

  const authors = mergeDetectedAuthors(...authorGroups);
  if (authors.length > 0) warnings.push(warning('authors-from-docx-metadata'));
  if (archive.names().some((name) => /^word\/(header|footer)\d+\.xml$/i.test(name))) {
    warnings.push(warning('headers-footers-not-imported'));
  }

  stats.sections = sections.length;
  stats.notes = annotations.length;
  stats.citations = citations.length;
  stats.references = bibliographicRecords.length;
  stats.warnings = warnings.length;

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
    bibliographicRecords,
    citations,
    citationClusters,
    stats,
    warnings: deduplicateWarnings(warnings),
  };
}

function ensureSection(sections: OmiSection[]): OmiSection {
  const current = sections.at(-1);
  if (current) return current;

  const section: OmiSection = {
    id: crypto.randomUUID(),
    title: 'Imported content',
    blocks: [],
  };
  sections.push(section);
  return section;
}

function createEmptyParagraphBlock(): OmiBlock {
  return {
    id: crypto.randomUUID(),
    type: 'paragraph',
    content: JSON.stringify({
      type: 'doc',
      content: [{ type: 'paragraph' }],
    }),
  };
}

function parseParagraphInline(
  paragraph: Element,
  relationships: Map<string, Relationship>,
  context: InlineContext,
): TiptapNode[] {
  const output: TiptapNode[] = [];
  let field: FieldState | undefined;

  const append = (nodes: TiptapNode[]) => {
    if (field?.phase === 'result') field.result.push(...nodes);
    else if (!field) output.push(...nodes);
  };

  const finishField = () => {
    if (!field) return;
    output.push(...renderField(field, context));
    field = undefined;
  };

  const handleRun = (run: Element, inheritedMarks: TiptapMark[] = []) => {
    const marks = mergeMarks(inheritedMarks, runMarks(run));

    for (const node of Array.from(run.children)) {
      if (node.localName === 'fldChar') {
        const kind = attributeByLocalName(node, 'fldCharType');
        if (kind === 'begin') {
          if (field) finishField();
          field = { instruction: '', result: [], phase: 'instruction' };
        } else if (kind === 'separate' && field) {
          field.phase = 'result';
        } else if (kind === 'end') {
          finishField();
        }
        continue;
      }

      if (node.localName === 'instrText') {
        if (field) field.instruction += node.textContent ?? '';
        continue;
      }

      if (node.localName === 'footnoteReference' || node.localName === 'endnoteReference') {
        const noteId = attributeByLocalName(node, 'id');
        if (!noteId || Number(noteId) < 0) continue;
        const noteType = node.localName === 'endnoteReference' ? 'endnote' : 'footnote';
        const noteBody =
          noteType === 'endnote'
            ? context.endnotes.get(noteId)
            : context.footnotes.get(noteId);
        if (!noteBody) {
          context.warnings.push(warning('missing-note-body'));
          continue;
        }
        const annotationId = `note-${crypto.randomUUID()}`;
        const anchorId = `anchor-${crypto.randomUUID()}`;
        const label = String(context.annotations.length + 1);
        context.annotations.push({
          id: annotationId,
          type: 'note',
          noteKind: noteType,
          anchorId,
          targetBlockId: context.blockId,
          body: noteBody,
          renderingHint: noteType,
          createdAt: new Date().toISOString(),
          modifiedAt: new Date().toISOString(),
        });
        append([
          {
            type: 'omiNote',
            attrs: {
              noteId: annotationId,
              anchorId,
              label,
              noteType,
            },
          },
        ]);
        continue;
      }

      if (node.localName === 't' || node.localName === 'delText') {
        if (node.localName === 'delText') continue;
        const text = node.textContent ?? '';
        if (text) append([{ type: 'text', text, marks: marks.length ? marks : undefined }]);
        continue;
      }

      if (node.localName === 'tab') {
        append([{ type: 'text', text: '\t', marks: marks.length ? marks : undefined }]);
        continue;
      }

      if (node.localName === 'br' || node.localName === 'cr') {
        append([{ type: 'hardBreak' }]);
      }
    }
  };

  for (const child of Array.from(paragraph.children)) {
    if (child.localName === 'r') {
      handleRun(child);
      continue;
    }

    if (child.localName === 'hyperlink') {
      const relationshipId = attributeByLocalName(child, 'id');
      const target = relationshipId ? relationships.get(relationshipId)?.target : undefined;
      const href = normalizeExternalHref(target);
      const marks: TiptapMark[] = href
        ? [{ type: 'omiLink', attrs: { href } }]
        : [];
      if (href) context.stats.links += 1;
      for (const run of directChildrenByLocalName(child, 'r')) handleRun(run, marks);
      continue;
    }

    if (child.localName === 'fldSimple') {
      const instruction = attributeByLocalName(child, 'instr') ?? '';
      const result: TiptapNode[] = [];
      const previousField = field;
      field = { instruction, result, phase: 'result' };
      for (const run of directChildrenByLocalName(child, 'r')) handleRun(run);
      const completed = field;
      field = previousField;
      if (completed) output.push(...renderField(completed, context));
      continue;
    }

    for (const run of descendantsByLocalName(child, 'r')) handleRun(run);
  }

  if (field) finishField();
  return coalesceTextNodes(output);
}

function renderField(field: FieldState, context: InlineContext): TiptapNode[] {
  const citationTags = parseWordCitationInstruction(field.instruction);
  if (citationTags.length > 0) {
    const records = citationTags
      .map((tag) => context.bibliographyByTag.get(tag))
      .filter((record): record is OmiBibliographicRecord => Boolean(record));

    if (records.length !== citationTags.length) {
      context.warnings.push(warning('unresolved-word-citation'));
    }

    if (records.length > 0) {
      const anchorId = `anchor-${crypto.randomUUID()}`;
      const clusterId = `cluster-${crypto.randomUUID()}`;
      const timestamp = new Date().toISOString();
      const citationIds: string[] = [];

      for (const record of records) {
        const citationId = `citation-${crypto.randomUUID()}`;
        citationIds.push(citationId);
        context.citations.push({
          id: citationId,
          target: record.id,
          anchorId,
          targetBlockId: context.blockId,
          clusterId,
          mode: 'parenthetical',
          createdAt: timestamp,
          modifiedAt: timestamp,
        });
      }

      context.citationClusters.push({
        id: clusterId,
        anchorId,
        targetBlockId: context.blockId,
        citationIds,
        createdAt: timestamp,
        modifiedAt: timestamp,
      });
      context.stats.citations += citationIds.length;
      const visible = inlinePlainText(field.result).trim();
      const label = visible || fallbackCitationLabel(records);

      return [
        {
          type: 'omiCitation',
          attrs: {
            citationId: citationIds[0],
            citationIds,
            clusterId,
            anchorId,
            label,
          },
        },
      ];
    }
  }

  const hyperlink = parseWordHyperlinkInstruction(field.instruction);
  if (hyperlink) {
    const href = normalizeExternalHref(hyperlink);
    if (href) {
      context.stats.links += 1;
      return applyMarkToInline(field.result, {
        type: 'omiLink',
        attrs: { href },
      });
    }
  }

  if (/\b(?:REF|PAGEREF|NOTEREF)\b/i.test(field.instruction)) {
    context.warnings.push(warning('word-cross-reference-flattened'));
  }

  return field.result;
}

function runMarks(run: Element): TiptapMark[] {
  const properties = directChildrenByLocalName(run, 'rPr')[0];
  if (!properties) return [];
  const marks: TiptapMark[] = [];

  if (enabledWordProperty(properties, 'b')) marks.push({ type: 'bold' });
  if (enabledWordProperty(properties, 'i')) marks.push({ type: 'italic' });
  if (enabledWordProperty(properties, 'strike')) marks.push({ type: 'strike' });

  const vertical = directChildrenByLocalName(properties, 'vertAlign')[0];
  const verticalValue = vertical ? attributeByLocalName(vertical, 'val') : undefined;
  if (verticalValue === 'superscript') marks.push({ type: 'omiSuperscript' });
  if (verticalValue === 'subscript') marks.push({ type: 'omiSubscript' });

  const language = directChildrenByLocalName(properties, 'lang')[0];
  const languageValue = language
    ? normalizeInlineLanguageTag(attributeByLocalName(language, 'val'))
    : undefined;
  if (languageValue) {
    marks.push({ type: 'omiLanguage', attrs: { lang: languageValue } });
  }

  return marks;
}

function enabledWordProperty(properties: Element, name: string): boolean {
  const element = directChildrenByLocalName(properties, name)[0];
  if (!element) return false;
  const value = attributeByLocalName(element, 'val');
  return value === undefined || !/^(?:0|false|off|none)$/i.test(value);
}

async function extractParagraphVisuals(
  paragraph: Element,
  archive: DocxZipArchive,
  relationships: Map<string, Relationship>,
  provenance: OmiImportProvenance,
  warnings: DocxImportWarning[],
  stats: DocxImportStats,
): Promise<OmiBlock[]> {
  const blocks: OmiBlock[] = [];
  const mathNodes = descendantsByLocalName(paragraph, 'oMath');
  const hasNonMathText = paragraphPlainText(paragraph).trim().length > 0;

  for (const mathNode of mathNodes) {
    const latex = ommlToLatex(mathNode).trim();
    if (!latex) continue;
    blocks.push(
      createEquationBlock(serializeXml(mathNode), {
        notation: 'omml',
        latex,
        provenance,
      }),
    );
    stats.equations += 1;
    if (hasNonMathText) warnings.push(warning('inline-equation-promoted'));
  }

  const seenTargets = new Set<string>();
  for (const blip of descendantsByLocalName(paragraph, 'blip')) {
    const relationId = attributeByLocalName(blip, 'embed');
    const target = relationId ? relationships.get(relationId)?.target : undefined;
    if (!target) continue;
    const archivePath = normalizeWordTarget(target);
    if (seenTargets.has(archivePath) || !archive.has(archivePath)) continue;
    seenTargets.add(archivePath);

    const bytes = await archive.bytes(archivePath);
    const mediaType = inferMediaTypeFromFileName(archivePath);
    const docPr = descendantsByLocalName(paragraph, 'docPr')[0];
    blocks.push(
      createImageBlock({
        src: bytesToDataUrl(bytes, mediaType),
        mediaType,
        fileName: archivePath.split('/').pop(),
        alt: docPr?.getAttribute('descr') ?? docPr?.getAttribute('name') ?? '',
        provenance: { ...provenance, sourcePart: archivePath },
      }),
    );
    stats.images += 1;
  }

  return blocks;
}

function buildListNodes(items: readonly ParsedListParagraph[]): TiptapNode[] {
  const result: TiptapNode[] = [];
  let index = 0;

  while (index < items.length) {
    const level = items[index]?.level ?? 0;
    const consumed = consumeList(items, index, level);
    result.push(consumed.node);
    index = consumed.nextIndex;
  }

  return result;
}

function consumeList(
  items: readonly ParsedListParagraph[],
  startIndex: number,
  level: number,
): { node: TiptapNode; nextIndex: number } {
  const first = items[startIndex];
  const ordered = first?.ordered ?? false;
  const node: TiptapNode = {
    type: ordered ? 'orderedList' : 'bulletList',
    content: [],
  };
  let index = startIndex;

  while (index < items.length) {
    const item = items[index];
    if (!item || item.level < level) break;

    if (item.level > level) {
      const lastItem = node.content?.at(-1);
      if (!lastItem) break;
      const nested = consumeList(items, index, item.level);
      lastItem.content = [...(lastItem.content ?? []), nested.node];
      index = nested.nextIndex;
      continue;
    }

    if (item.ordered !== ordered) break;
    node.content?.push({
      type: 'listItem',
      content: [{ type: 'paragraph', content: item.content }],
    });
    index += 1;
  }

  return { node, nextIndex: index };
}

async function readStyles(archive: DocxZipArchive): Promise<Map<string, WordStyle>> {
  if (!archive.has('word/styles.xml')) return new Map();
  const document = parseXml(await archive.text('word/styles.xml'));
  const styles = new Map<string, WordStyle>();

  for (const element of descendantsByLocalName(document, 'style')) {
    const id = attributeByLocalName(element, 'styleId');
    if (!id) continue;
    const nameElement = directChildrenByLocalName(element, 'name')[0];
    const basedOnElement = directChildrenByLocalName(element, 'basedOn')[0];
    const pPr = directChildrenByLocalName(element, 'pPr')[0];
    const outline = pPr ? directChildrenByLocalName(pPr, 'outlineLvl')[0] : undefined;
    const outlineValue = outline ? Number(attributeByLocalName(outline, 'val')) : undefined;
    styles.set(id, {
      id,
      name: nameElement ? attributeByLocalName(nameElement, 'val') : undefined,
      basedOn: basedOnElement ? attributeByLocalName(basedOnElement, 'val') : undefined,
      outlineLevel: Number.isFinite(outlineValue) ? outlineValue : undefined,
    });
  }

  return styles;
}

async function readNumbering(
  archive: DocxZipArchive,
): Promise<Map<string, Map<number, boolean>>> {
  if (!archive.has('word/numbering.xml')) return new Map();
  const document = parseXml(await archive.text('word/numbering.xml'));
  const abstractFormats = new Map<string, Map<number, boolean>>();

  for (const abstract of descendantsByLocalName(document, 'abstractNum')) {
    const id = attributeByLocalName(abstract, 'abstractNumId');
    if (!id) continue;
    const levels = new Map<number, boolean>();
    for (const level of directChildrenByLocalName(abstract, 'lvl')) {
      const ilvl = Number(attributeByLocalName(level, 'ilvl') ?? 0);
      const format = firstDescendant(level, 'numFmt');
      const value = format ? attributeByLocalName(format, 'val') : undefined;
      levels.set(ilvl, !/^(?:bullet|none)$/i.test(value ?? 'decimal'));
    }
    abstractFormats.set(id, levels);
  }

  const result = new Map<string, Map<number, boolean>>();
  for (const num of descendantsByLocalName(document, 'num')) {
    const numId = attributeByLocalName(num, 'numId');
    const abstractIdElement = directChildrenByLocalName(num, 'abstractNumId')[0];
    const abstractId = abstractIdElement
      ? attributeByLocalName(abstractIdElement, 'val')
      : undefined;
    if (numId && abstractId && abstractFormats.has(abstractId)) {
      result.set(numId, abstractFormats.get(abstractId) ?? new Map());
    }
  }

  return result;
}

function paragraphListInfo(
  paragraph: Element,
  numbering: Map<string, Map<number, boolean>>,
): WordListInfo | undefined {
  const pPr = directChildrenByLocalName(paragraph, 'pPr')[0];
  const numPr = pPr ? directChildrenByLocalName(pPr, 'numPr')[0] : undefined;
  if (!numPr) return undefined;
  const numIdElement = directChildrenByLocalName(numPr, 'numId')[0];
  const levelElement = directChildrenByLocalName(numPr, 'ilvl')[0];
  const numId = numIdElement ? attributeByLocalName(numIdElement, 'val') : undefined;
  if (!numId || numId === '0') return undefined;
  const level = Math.max(0, Number(levelElement ? attributeByLocalName(levelElement, 'val') : 0) || 0);
  return {
    level,
    ordered: numbering.get(numId)?.get(level) ?? true,
  };
}

function resolveParagraphStyle(
  paragraph: Element,
  styles: Map<string, WordStyle>,
): WordStyle | undefined {
  const pPr = directChildrenByLocalName(paragraph, 'pPr')[0];
  const pStyle = pPr ? directChildrenByLocalName(pPr, 'pStyle')[0] : undefined;
  const styleId = pStyle ? attributeByLocalName(pStyle, 'val') : undefined;
  if (!styleId) return undefined;
  return styles.get(styleId) ?? { id: styleId };
}

function resolveParagraphHeadingLevel(
  paragraph: Element,
  style: WordStyle | undefined,
): number | undefined {
  const pPr = directChildrenByLocalName(paragraph, 'pPr')[0];
  const outline = pPr ? directChildrenByLocalName(pPr, 'outlineLvl')[0] : undefined;
  const directOutline = outline ? Number(attributeByLocalName(outline, 'val')) : undefined;
  return headingLevelFromStyle(
    style?.id,
    style?.name,
    Number.isFinite(directOutline) ? directOutline : style?.outlineLevel,
  );
}

function parseWordTable(table: Element): {
  cells: string[][];
  headerRows: number;
  mergedCells: boolean;
} {
  const rows = directChildrenByLocalName(table, 'tr');
  let mergedCells = false;
  const cells = rows.map((row) =>
    directChildrenByLocalName(row, 'tc').map((cell) => {
      if (
        descendantsByLocalName(cell, 'gridSpan').length ||
        descendantsByLocalName(cell, 'vMerge').length
      ) {
        mergedCells = true;
      }
      return descendantsByLocalName(cell, 't')
        .map((text) => text.textContent ?? '')
        .join('')
        .trim();
    }),
  );
  const headerRows = rows[0] && descendantsByLocalName(rows[0], 'tblHeader').length ? 1 : 0;
  return { cells: rectangularize(cells), headerRows, mergedCells };
}

function parseRelationships(xmlText: string): Map<string, Relationship> {
  const document = parseXml(xmlText);
  const relationships = new Map<string, Relationship>();
  for (const element of descendantsByLocalName(document, 'Relationship')) {
    const id = element.getAttribute('Id');
    const target = element.getAttribute('Target');
    if (!id || !target) continue;
    relationships.set(id, {
      target,
      targetMode: element.getAttribute('TargetMode') ?? undefined,
      type: element.getAttribute('Type') ?? undefined,
    });
  }
  return relationships;
}

function parseCoreProperties(xmlText: string): {
  title?: string;
  creator?: string;
  language?: string;
} {
  const document = parseXml(xmlText);
  return {
    title: firstTextByLocalName(document, 'title'),
    creator: firstTextByLocalName(document, 'creator'),
    language: firstTextByLocalName(document, 'language'),
  };
}

function parseNotes(
  xmlText: string,
  localName: 'footnote' | 'endnote',
): Map<string, string> {
  const document = parseXml(xmlText);
  const result = new Map<string, string>();
  for (const note of descendantsByLocalName(document, localName)) {
    const id = attributeByLocalName(note, 'id');
    if (!id || Number(id) < 0) continue;
    const paragraphs = directChildrenByLocalName(note, 'p')
      .map((paragraph) => paragraphPlainText(paragraph).trim())
      .filter(Boolean);
    result.set(id, paragraphs.join('\n'));
  }
  return result;
}

async function readWordBibliography(
  archive: DocxZipArchive,
  timestamp: string,
): Promise<OmiBibliographicRecord[]> {
  const records: OmiBibliographicRecord[] = [];
  const seenTags = new Set<string>();

  for (const name of archive.names().filter((item) => /^customXml\/item\d+\.xml$/i.test(item))) {
    let document: XMLDocument;
    try {
      document = parseXml(await archive.text(name));
    } catch {
      continue;
    }

    for (const source of descendantsByLocalName(document, 'Source')) {
      const tag = firstTextByLocalName(source, 'Tag')?.trim();
      if (!tag || seenTags.has(tag)) continue;
      const title = firstTextByLocalName(source, 'Title')?.trim();
      if (!title) continue;
      seenTags.add(tag);

      const contributors = parseWordSourceContributors(source);
      const identifiers = [] as Array<{ scheme: string; value: string }>;
      const standardNumber = firstTextByLocalName(source, 'StandardNumber')?.trim();
      if (standardNumber) {
        identifiers.push({
          scheme: /^97[89]/.test(standardNumber.replace(/[-\s]/g, '')) ? 'isbn' : 'identifier',
          value: standardNumber,
        });
      }
      const url = firstTextByLocalName(source, 'URL')?.trim();
      if (url) identifiers.push({ scheme: 'url', value: url });
      identifiers.push({ scheme: 'word-source-tag', value: tag });

      records.push({
        id: `bib-${crypto.randomUUID()}`,
        type: mapWordSourceType(firstTextByLocalName(source, 'SourceType')),
        title,
        contributors,
        containerTitle: firstTextByLocalName(source, 'JournalName')?.trim(),
        issued: firstTextByLocalName(source, 'Year')?.trim(),
        publisher: firstTextByLocalName(source, 'Publisher')?.trim(),
        place: firstTextByLocalName(source, 'City')?.trim(),
        volume: firstTextByLocalName(source, 'Volume')?.trim(),
        issue: firstTextByLocalName(source, 'Issue')?.trim(),
        pages: firstTextByLocalName(source, 'Pages')?.trim(),
        identifiers,
        url,
        status: 'provisional',
        createdAt: timestamp,
        modifiedAt: timestamp,
      });
    }
  }

  return records;
}

function parseWordSourceContributors(source: Element): OmiBibliographicContributor[] {
  const people = descendantsByLocalName(source, 'Person');
  const contributors: OmiBibliographicContributor[] = [];

  for (const person of people) {
    const givenName = [
      firstTextByLocalName(person, 'First'),
      firstTextByLocalName(person, 'Middle'),
    ]
      .filter(Boolean)
      .join(' ')
      .trim();
    const familyName = firstTextByLocalName(person, 'Last')?.trim();
    if (!givenName && !familyName) continue;
    contributors.push({
      id: `bibcontrib-${crypto.randomUUID()}`,
      role: 'author',
      givenName: givenName || undefined,
      familyName: familyName || undefined,
    });
  }

  return contributors;
}

function getWordSourceTag(record: OmiBibliographicRecord): string {
  return record.identifiers.find((identifier) => identifier.scheme === 'word-source-tag')?.value ?? '';
}

function paragraphPlainText(paragraph: Element): string {
  return descendantsByLocalName(paragraph, 't')
    .map((text) => text.textContent ?? '')
    .join('');
}

function firstTextByLocalName(root: Document | Element, name: string): string | undefined {
  return descendantsByLocalName(root, name)[0]?.textContent ?? undefined;
}

function fallbackCitationLabel(records: readonly OmiBibliographicRecord[]): string {
  return records
    .map((record) => {
      const first = record.contributors[0];
      const author = first?.familyName ?? first?.literalName ?? record.title;
      return record.issued ? `${author}, ${record.issued}` : author;
    })
    .join('; ')
    .replace(/^/, '(')
    .concat(')');
}

function inlinePlainText(nodes: readonly TiptapNode[]): string {
  return nodes
    .map((node) => node.text ?? (node.content ? inlinePlainText(node.content) : ''))
    .join('');
}

function applyMarkToInline(nodes: readonly TiptapNode[], mark: TiptapMark): TiptapNode[] {
  return nodes.map((node) => {
    if (node.type === 'text') {
      return { ...node, marks: mergeMarks(node.marks ?? [], [mark]) };
    }
    if (node.content) {
      return { ...node, content: applyMarkToInline(node.content, mark) };
    }
    return node;
  });
}

function mergeMarks(...groups: readonly TiptapMark[][]): TiptapMark[] {
  const result: TiptapMark[] = [];
  const seen = new Set<string>();
  for (const mark of groups.flat()) {
    const key = `${mark.type}:${JSON.stringify(mark.attrs ?? {})}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(mark);
  }
  return result;
}

function coalesceTextNodes(nodes: readonly TiptapNode[]): TiptapNode[] {
  const result: TiptapNode[] = [];
  for (const node of nodes) {
    const previous = result.at(-1);
    if (
      node.type === 'text' &&
      previous?.type === 'text' &&
      JSON.stringify(node.marks ?? []) === JSON.stringify(previous.marks ?? [])
    ) {
      previous.text = `${previous.text ?? ''}${node.text ?? ''}`;
    } else {
      result.push({ ...node });
    }
  }
  return result;
}

function normalizeSpace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function rectangularize(rows: string[][]): string[][] {
  const width = Math.max(0, ...rows.map((row) => row.length));
  return rows.map((row) => Array.from({ length: width }, (_, index) => row[index] ?? ''));
}

function warning(code: string): DocxImportWarning {
  return { code, severity: 'warning', message: code };
}

function deduplicateWarnings(warnings: readonly DocxImportWarning[]): DocxImportWarning[] {
  const seen = new Set<string>();
  return warnings.filter((item) => {
    const key = `${item.code}:${item.sourcePart ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseXml(xml: string): XMLDocument {
  // WordprocessingML/OOXML is parsed as XML in a detached document and only
  // traversed as structured data. It is never reinterpreted as HTML or mounted.
  // codeql[js/xss-through-dom]
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.querySelector('parsererror')) {
    throw new Error('Invalid Open XML document part.');
  }
  return document;
}

function serializeXml(node: Element): string {
  return new XMLSerializer().serializeToString(node);
}

function descendantsByLocalName(root: Document | Element, name: string): Element[] {
  return Array.from(root.getElementsByTagName('*')).filter((element) => element.localName === name);
}

function directChildrenByLocalName(root: Element, name: string): Element[] {
  return Array.from(root.children).filter((element) => element.localName === name);
}

function firstDescendant(root: Element, name: string): Element | undefined {
  return descendantsByLocalName(root, name)[0];
}

function attributeByLocalName(element: Element, name: string): string | undefined {
  return Array.from(element.attributes).find((attribute) => attribute.localName === name)?.value;
}

function normalizeWordTarget(target: string): string {
  const normalized = target.replace(/\\/g, '/').replace(/^\.\//, '');
  return normalized.startsWith('word/') ? normalized : `word/${normalized.replace(/^\.\.\//, '')}`;
}

function inferMediaTypeFromFileName(fileName: string): string {
  const clean = fileName.toLowerCase().split(/[?#]/)[0] ?? '';
  if (clean.endsWith('.png')) return 'image/png';
  if (clean.endsWith('.jpg') || clean.endsWith('.jpeg')) return 'image/jpeg';
  if (clean.endsWith('.gif')) return 'image/gif';
  if (clean.endsWith('.webp')) return 'image/webp';
  if (clean.endsWith('.svg')) return 'image/svg+xml';
  if (clean.endsWith('.emf')) return 'image/emf';
  if (clean.endsWith('.wmf')) return 'image/wmf';
  return 'application/octet-stream';
}

function bytesToDataUrl(bytes: Uint8Array, mediaType: string): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return `data:${mediaType};base64,${btoa(binary)}`;
}

function ommlToLatex(element: Element): string {
  switch (element.localName) {
    case 't':
      return element.textContent ?? '';
    case 'f': {
      const numerator = directChildrenByLocalName(element, 'num')[0];
      const denominator = directChildrenByLocalName(element, 'den')[0];
      return `\\frac{${ommlChildren(numerator)}}{${ommlChildren(denominator)}}`;
    }
    case 'rad': {
      const degree = directChildrenByLocalName(element, 'deg')[0];
      const expression = directChildrenByLocalName(element, 'e')[0];
      const degreeText = ommlChildren(degree).trim();
      return degreeText
        ? `\\sqrt[${degreeText}]{${ommlChildren(expression)}}`
        : `\\sqrt{${ommlChildren(expression)}}`;
    }
    case 'sSup': {
      const base = directChildrenByLocalName(element, 'e')[0];
      const sup = directChildrenByLocalName(element, 'sup')[0];
      return `${ommlChildren(base)}^{${ommlChildren(sup)}}`;
    }
    case 'sSub': {
      const base = directChildrenByLocalName(element, 'e')[0];
      const sub = directChildrenByLocalName(element, 'sub')[0];
      return `${ommlChildren(base)}_{${ommlChildren(sub)}}`;
    }
    case 'sSubSup': {
      const base = directChildrenByLocalName(element, 'e')[0];
      const sub = directChildrenByLocalName(element, 'sub')[0];
      const sup = directChildrenByLocalName(element, 'sup')[0];
      return `${ommlChildren(base)}_{${ommlChildren(sub)}}^{${ommlChildren(sup)}}`;
    }
    default:
      return ommlChildren(element);
  }
}

function ommlChildren(element: Element | undefined): string {
  if (!element) return '';
  return Array.from(element.children).map((child) => ommlToLatex(child)).join('');
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

  names(): string[] {
    return Array.from(this.entries.keys());
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
    const decompressed = new Uint8Array(await new Response(stream).arrayBuffer());
    if (entry.uncompressedSize && decompressed.length !== entry.uncompressedSize) {
      throw new Error(`Unexpected decompressed size for ${name}.`);
    }
    return decompressed;
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
    throw new Error('The DOCX ZIP end-of-central-directory record is missing.');
  }
}
