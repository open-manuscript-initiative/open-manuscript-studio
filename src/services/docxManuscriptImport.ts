import { createNamedAnchor, type OmiNamedAnchor } from '../model/namedAnchors';
import { createCrossReference } from '../model/crossReferences';
import { parseWordCrossReference, type WordCrossReferenceField } from '../model/wordCrossReference';
import type { OmiCrossReference } from '../types/omi';
import { readWordRunningPart } from './docxRunningMatterImport';
import { RUNNING_VARIANTS, type RunningVariants } from '../model/wordRunningMatter';
import { readWordSectionLayout } from '../model/wordSectionLayout';
import { tableCellPlainText, normalizeCellParagraphAttrs, tableMergeLayout, normalizeTableCellAppearance, normalizeTableCellEdges, TABLE_CELL_SIDES, normalizeTableRowHeight, MAX_NESTED_TABLE_DEPTH, parseTableCellContent } from '../model/tableLayout';
import { importedSourceStyle, type SourceStyle } from '../model/sourceWordStyles';
import { normalizeListAttribute } from '../model/directListFormatting';
import { readWordHyphenationSettings, type WordHyphenationSettings } from '../model/wordHyphenation';
import { readWordParagraphFormatting, readWordParagraphDecoration } from '../model/directParagraphFormatting';
import { wordDirectFormatting, mergeWordDirectFormatting } from './docxDirectFormatting';
import { noteBodyPlainText, parseNoteBodyContent } from '../model/noteRichText';
import { readDocxNotes, type ImportedNoteBody } from './docxNoteImport';
import { prepareWordDrawings, type WordDrawingImage } from './docxDrawingImport';
import {
  createEquationBlock,
  createImageBlock,
  createTextBoxBlock,
  createTableBlock,
  MAX_VISUAL_IMPORT_BYTES,
} from '../model/visualBlocks';
import {
  createEmptyDocxImportStats,
  detectKeywordLine,
  headingLevelFromStyle,
  isAbstractStyle,
  isDuplicateDocumentTitleHeading,
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
  OmiTableCellFormat,
  OmiTableBlockData,
  OmiTableCellMerge,
  OmiTableRowSplitPolicy,
  OmiTableRowHeight,
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
  numId?: string;
  numLevel?: number;
  source?: SourceStyle;
}

interface WordListInfo {
  level: number;
  ordered: boolean;
  attrs: Record<string, unknown>;
}

interface ParsedListParagraph extends WordListInfo {
  content: TiptapNode[];
  paragraphAttrs?: Record<string,unknown>;
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

interface PendingWordReference {id:string;anchorId:string;blockId:string;name:string;field:WordCrossReferenceField;}

interface InlineContext {
  wordReferences?:PendingWordReference[];
  blockId: string;
  footnotes: Map<string, ImportedNoteBody>;
  endnotes: Map<string, ImportedNoteBody>;
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
  namedAnchors?:OmiNamedAnchor[];
  crossReferences?:OmiCrossReference[];
  wordHyphenation?:WordHyphenationSettings;
  noteNumberingScope?:'section';
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
  const wordHyphenation=await readHyphenationArchive(archive);
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
  const { footnotes, endnotes } = await readDocxNotes(archive);
  const bibliographicRecords = await readWordBibliography(archive, importedAt);
  const bibliographyByTag = new Map(
    bibliographicRecords
      .map((record) => [getWordSourceTag(record), record] as const)
      .filter(([tag]) => Boolean(tag)),
  );
  stats.references = bibliographicRecords.length;

  const drawings = await prepareWordDrawings(await archive.text('word/document.xml'), archive, relationships);
  warnings.push(...drawings.warnings);
  const document = parseXml(drawings.xml);
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
  if (descendantsByLocalName(body, 'sdt').length > 0) {
    warnings.push(warning('content-controls-flattened'));
  }

  const sections: OmiSection[] = [];
  const namedAnchors:OmiNamedAnchor[]=[];
  const bookmarkNames=new Map<string,{anchor:OmiNamedAnchor;whole:boolean}>();
  const wordReferences:PendingWordReference[]=[];
  const captureBookmarks=(p:Element,targetId:string,targetKind:'section'|'block')=>{
    const children=Array.from(p.children);
    for(const start of children.filter(el=>el.localName==='bookmarkStart')){
      const name=attributeByLocalName(start,'name'),id=attributeByLocalName(start,'id');
      if(!name||!id||!/^[_A-Za-z][_A-Za-z0-9]{0,39}$/.test(name)||name==='_GoBack')continue;
      const key=name.toLowerCase();
      if(bookmarkNames.has(key)){warnings.push(warning('duplicate-word-bookmark'));continue;}
      const end=children.findIndex(el=>el.localName==='bookmarkEnd'&&attributeByLocalName(el,'id')===id),begin=children.indexOf(start);
      const meaningful=(el:Element)=>!['pPr','bookmarkStart','bookmarkEnd','proofErr'].includes(el.localName);
      const whole=end>begin&&!children.slice(0,begin).some(meaningful)&&!children.slice(end+1).some(meaningful);
      if(!whole)warnings.push(warning('word-bookmark-range-approximated'));
      const anchor=createNamedAnchor({name,targetId,targetKind,source:{format:'docx',originalName:name}});
      namedAnchors.push(anchor);bookmarkNames.set(key,{anchor,whole});
    }
  };
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

  // Word content controls (w:sdt) are transparent containers for manuscript
  // content. Flatten only their block-level sdtContent children here, keeping
  // document order and leaving inline controls to the inline parser.
  const children = structuredBlockChildren(body);
  const sectionProperties=(p:Element)=>directChildrenByLocalName(directChildrenByLocalName(p,'pPr')[0]??p,'sectPr')[0];
  const nativeSections=[...children.map(sectionProperties).filter((p):p is Element=>Boolean(p)),...directChildrenByLocalName(body,'sectPr')];
  const settings=archive.has('word/settings.xml')?parseXml(await archive.text('word/settings.xml')).documentElement:undefined;
  const restart=(root:Element|undefined,kind:'footnote'|'endnote')=>{
    const props=root&&directChildrenByLocalName(root,kind+'Pr')[0];
    const node=props&&directChildrenByLocalName(props,'numRestart')[0];
    return node?attributeByLocalName(node,'val'):undefined;
  };
  const kinds=(['footnote','endnote'] as const).filter(kind=>descendantsByLocalName(body,kind+'Reference').length>0);
  const modes=kinds.flatMap(kind=>(nativeSections.length?nativeSections:[undefined]).map(p=>restart(p,kind)??restart(settings,kind)??'continuous'));
  const sectionRestart=modes.length>0&&modes.every(mode=>mode==='eachSect');
  if(!sectionRestart&&modes.some(mode=>mode!=='continuous'))warnings.push(warning('note-numbering-restart-not-fully-supported'));
  let index = 0;
  let pendingSection=false;
  let physicalIndex=0,physicalStart=0;
  const runningPartCache=new Map<string,RunningVariants['default']>();
  const onOff=(root:Element|undefined,tag:string):boolean|undefined=>{
    const el=root&&directChildrenByLocalName(root,tag)[0];
    if(!el)return undefined;
    return !/^(?:0|false|off)$/i.test(attributeByLocalName(el,'val')??'1');
  };
  const applyPhysicalLayout=async()=>{
    const props=nativeSections[physicalIndex++];
    if(!props&&nativeSections.length===0)return;
    const read=(tag:string,attr:string)=>{const node=props&&directChildrenByLocalName(props,tag)[0];return node?attributeByLocalName(node,attr):undefined;};
    const wordSection=readWordSectionLayout(crypto.randomUUID(),read);
    const count=Number(read('cols','num')??1);
    const rawGap=read('cols','space'),gap=rawGap===undefined?undefined:Number(rawGap)*25.4/1440;
    if(count>3||count<1||read('cols','equalWidth')==='0')warnings.push(warning('word-section-columns-partial'));
    const evenAndOdd=onOff(settings,'evenAndOddHeaders'),differentFirstPage=onOff(props,'titlePg');
    if(evenAndOdd!==undefined)wordSection.evenAndOddHeaders=evenAndOdd;
    if(differentFirstPage!==undefined)wordSection.differentFirstPage=differentFirstPage;
    if(props)for(const kind of ['header','footer'] as const){
      const variants:RunningVariants={};
      for(const reference of directChildrenByLocalName(props,kind+'Reference')){
        const variant=attributeByLocalName(reference,'type');
        const id=attributeByLocalName(reference,'id');
        const rel=id?relationships.get(id):undefined;
        // Only internal package parts of the expected relationship kind.
        // No network or external target resolution, traversal or raw XML reuse.
        const target=rel?.target.replace(/^\.\//,'').replace(/^\/word\//,'').replace(/^word\//,'');
        if(!RUNNING_VARIANTS.includes(variant as typeof RUNNING_VARIANTS[number])||!rel||rel.targetMode?.toLowerCase()==='external'||!rel.type?.endsWith('/'+kind)||!target||!/^[-a-z0-9_]+\.xml$/i.test(target)||!archive.has('word/'+target)){
          warnings.push(warning('word-running-matter-reference-not-supported'));continue;
        }
        const key=kind+':'+target;
        try{
          if(!runningPartCache.has(key)){
            const xml=await archive.text('word/'+target);
            if(xml.length>1000000||/<!DOCTYPE\b|<!ENTITY\b/i.test(xml)){warnings.push(warning('word-running-matter-part-not-supported'));runningPartCache.set(key,undefined);}
            else runningPartCache.set(key,readWordRunningPart(parseXml(xml).documentElement,kind,()=>warnings.push(warning('word-running-matter-formatting-partial'))));
          }
          const paragraphs=runningPartCache.get(key);
          if(paragraphs)variants[variant as typeof RUNNING_VARIANTS[number]]=structuredClone(paragraphs);
          else warnings.push(warning('word-running-matter-part-not-supported'));
        }catch{warnings.push(warning('word-running-matter-part-not-supported'));}
      }
      if(Object.keys(variants).length)wordSection[kind==='header'?'headers':'footers']=variants;
    }
    for(const section of sections.slice(physicalStart))section.layout={...section.layout,wordSection,...(count===2||count===3?{columns:count,...(gap!==undefined&&Number.isFinite(gap)&&gap>=0&&gap<=50?{columnGapMm:gap}:{})}:{})};
    physicalStart=sections.length;
  };

  while (index < children.length) {
    const child = children[index];
    if (!child) break;
    if(pendingSection){
      await applyPhysicalLayout();
      const nextHeading=child.localName==='p'&&resolveParagraphHeadingLevel(child,resolveParagraphStyle(child,styles))!==undefined&&!paragraphHasNoteReference(child)&&paragraphPlainText(child).trim();
      headingStack.length=0;
      if(!nextHeading&&sections.at(-1)?.blocks.length){sections.push({id:crypto.randomUUID(),title:'',blocks:[]});stats.sections+=1;}
      pendingSection=false;
    }
    if(child.localName==='p'&&sectionProperties(child))pendingSection=true;

    if (child.localName === 'tbl') {
      const section = ensureSection(sections);
      const blockId=crypto.randomUUID();
      // Bibliographic fields in cells retain their cached text until citation
      // cluster traversal supports visual content; note anchors use the real registry.
      const context:InlineContext={blockId,footnotes,endnotes,bibliographyByTag:new Map(),annotations,citations,citationClusters,warnings,stats};
      const table = parseWordTable(child,numbering,relationships,context,styles);
      if (table.cells.length) {
        section.blocks.push(
          createTableBlock(table.cells, {
            headerRows: table.headerRows,
            cellFormats: table.cellFormats,
            cellContent:table.cellContent,
            cellMerges: table.cellMerges,
            rowSplitDefault: 'allow',
            rowSplitOverrides: table.rowSplitOverrides,
            rowHeights: table.rowHeights,
            provenance,
          },blockId),
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

    // A standalone simple TOC field contains only a generated display cache.
    // Never remove an unrelated paragraph just because its text equals a TOC row.
    const directContent=Array.from(child.children).filter(el=>!['pPr','bookmarkStart','bookmarkEnd','proofErr'].includes(el.localName));
    if(directContent.length===1&&directContent[0]?.localName==='fldSimple'){
      const instruction=attributeByLocalName(directContent[0],'instr')?.trim()??'';
      if(/^TOC\b/i.test(instruction)&&!/(?:^|\s)\\(?:a|c)(?:\s|$)/i.test(instruction)){index+=1;continue;}
    }
    const style = resolveParagraphStyle(child, styles);
    const plainText = paragraphPlainText(child).trim();
    const headingLevel = resolveParagraphHeadingLevel(child, style);
    const hasNoteReference = paragraphHasNoteReference(child);

    if (headingLevel !== undefined && plainText && !hasNoteReference) {
      if (
        sections.length === 0 &&
        headingStack.length === 0 &&
        titleSource !== 'filename' &&
        isDuplicateDocumentTitleHeading(plainText, title)
      ) {
        frontMatter = false;
        index += 1;
        continue;
      }
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
      captureBookmarks(child,id,'section');
      headingStack.push({ id, level: headingLevel });
      stats.sections += 1;
      index += 1;
      continue;
    }

    if (frontMatter && plainText && !hasNoteReference) {
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

    const listInfo = paragraphListInfo(child, numbering, styles);
    if (listInfo) {
      const section = ensureSection(sections);
      const listBlockId = crypto.randomUUID();
      const listParagraphs: ParsedListParagraph[] = [];
      const trailingVisuals: OmiBlock[] = [];

      while (index < children.length) {
        if(listParagraphs.length&&pendingSection)break;
        const paragraph = children[index];
        if (!paragraph || paragraph.localName !== 'p') break;
        const paragraphStyle = resolveParagraphStyle(paragraph, styles);
        if (
          resolveParagraphHeadingLevel(paragraph, paragraphStyle) !== undefined
          && !paragraphHasNoteReference(paragraph)
        ) break;
        const info = paragraphListInfo(paragraph, numbering, styles);
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
          paragraphAttrs: sourceParagraphAttrs(paragraphStyle,styles),
        });
        trailingVisuals.push(
          ...(await extractParagraphVisuals(
            paragraph,
            archive,
            relationships,
            provenance,
            warnings,
            stats,
            drawings.images,
          )),
        );
        stats.paragraphs += 1;
        if(sectionProperties(paragraph))pendingSection=true;
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
      drawings.images,
    );

    // Parse inline content before deciding that a paragraph is empty. A Word
    // paragraph may consist solely of a semantic atom such as a footnote or
    // endnote reference and therefore have no w:t text at all.
    const blockId = crypto.randomUUID();
    const context: InlineContext = {
      blockId,
      wordReferences,
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
    const hasInlineContent = hasMeaningfulInlineContent(inline);

    if (!hasInlineContent && visuals.length === 0) {
      index += 1;
      continue;
    }

    const section = ensureSection(sections);
    if (hasInlineContent) {
      const type = isQuoteStyle(style?.id, style?.name)
        ? 'quote'
        : 'paragraph';
      const pPr = directChildrenByLocalName(child, 'pPr')[0];
      const paragraphAttrs = pPr ? readWordParagraphFormatting((property, attribute) => {
        const item = directChildrenByLocalName(pPr, property)[0];
        return item ? attributeByLocalName(item, attribute) : undefined;
      }, property => directChildrenByLocalName(pPr, property).length > 0) : {};
    if (pPr) Object.assign(paragraphAttrs, readWordParagraphDecoration((parent, name) => {
      const container = directChildrenByLocalName(pPr, parent)[0];
      return container ? directChildrenByLocalName(container, name).map(element => Object.fromEntries(Array.from(element.attributes).map(attribute => [attribute.localName, attribute.value]))) : [];
    }));
      Object.assign(paragraphAttrs,sourceParagraphAttrs(style,styles));
      const attrs = Object.keys(paragraphAttrs).length ? { attrs: paragraphAttrs } : {};
      const tiptapContent = isCodeStyle(style?.id, style?.name) && plainText
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
                  content: [{ type: 'paragraph', ...attrs, content: inline }],
                },
              ],
            }
          : {
              type: 'doc',
              content: [{ type: 'paragraph', ...attrs, content: inline }],
            };

      section.blocks.push({
        id: blockId,
        type,
        content: JSON.stringify(tiptapContent),
      });
      captureBookmarks(child,blockId,'block');
      stats.paragraphs += 1;
    }
    section.blocks.push(...visuals);
    frontMatter = false;
    index += 1;
  }

  if(physicalStart<sections.length)await applyPhysicalLayout();
  for (const section of sections) {
    if (section.blocks.length === 0) {
      section.blocks.push(createEmptyParagraphBlock());
    }
  }

  if (sections.length === 0) {
    sections.push({
      id: crypto.randomUUID(),
      title: '',
      blocks: [createEmptyParagraphBlock()],
    });
  }

  if (!title) {
    title = file.name.replace(/\.docx$/i, '').trim() || 'Imported manuscript';
    titleSource = 'filename';
    warnings.push(warning('title-from-filename'));
  }

  // Forward references resolve only after every physical paragraph has been read.
  const crossReferences:OmiCrossReference[]=[];
  const pending=new Map(wordReferences.map(item=>[item.id,item]));
  for(const section of sections)for(const block of section.blocks){
    if(block.visual||!block.content.includes('omiCrossReference'))continue;
    const visit=(node:TiptapNode):TiptapNode=>{
      const id=node.type==='omiCrossReference'&&typeof node.attrs?.crossReferenceId==='string'?node.attrs.crossReferenceId:undefined;
      const ref=id?pending.get(id):undefined;
      if(ref){
        const target=bookmarkNames.get(ref.name.toLowerCase());
        if(!target||(ref.field.kind==='REF'&&!target.whole)){
          warnings.push(warning('word-cross-reference-flattened'));
          return {type:'text',text:ref.field.cachedLabel||ref.name};
        }
        crossReferences.push({...createCrossReference({id:ref.id,anchorId:ref.anchorId,sourceBlockId:block.id,targetId:target.anchor.id,targetKind:'bookmark',displayStyle:'title'}),wordField:ref.field});
        return node;
      }
      return node.content?{...node,content:node.content.map(visit)}:node;
    };
    block.content=JSON.stringify(visit(JSON.parse(block.content) as TiptapNode));
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
  if(sectionRestart&&sections.length>Math.max(1,nativeSections.length))warnings.push(warning('note-numbering-logical-section-approximation'));
  stats.warnings = warnings.length;

  return {
    fileName: file.name,
    ...(wordHyphenation?{wordHyphenation}:{}),
    ...(sectionRestart?{noteNumberingScope:'section' as const}:{}),
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
    ...(namedAnchors.length?{namedAnchors}:{}),
    ...(crossReferences.length?{crossReferences}:{}),
    stats,
    warnings: deduplicateWarnings(warnings),
  };
}

async function readHyphenationArchive(archive:DocxZipArchive):Promise<WordHyphenationSettings|undefined>{
  if(!archive.has('word/settings.xml'))return undefined;
  const doc=parseXml(await archive.text('word/settings.xml'));
  const root=doc.documentElement;
  if(root.localName!=='settings')return undefined;
  const find=(name:string)=>directChildrenByLocalName(root,name)[0];
  return readWordHyphenationSettings(name=>{const node=find(name);return node?attributeByLocalName(node,'val'):undefined;},name=>Boolean(find(name)));
}
export async function readDocxHyphenation(file:File):Promise<WordHyphenationSettings|undefined>{
  return readHyphenationArchive(new DocxZipArchive(await file.arrayBuffer()));
}

function ensureSection(sections: OmiSection[]): OmiSection {
  const current = sections.at(-1);
  if (current) return current;

  const section: OmiSection = {
    id: crypto.randomUUID(),
    title: '',
    blocks: [],
  };
  sections.push(section);
  return section;
}

function structuredBlockChildren(container: Element): Element[] {
  const result: Element[] = [];

  for (const child of Array.from(container.children)) {
    if (child.localName === 'p' || child.localName === 'tbl') {
      result.push(child);
      continue;
    }

    if (child.localName !== 'sdt' && child.localName !== 'sdtContent') {
      continue;
    }

    const contentContainers = child.localName === 'sdtContent'
      ? [child]
      : directChildrenByLocalName(child, 'sdtContent');
    for (const content of contentContainers) {
      result.push(...structuredBlockChildren(content));
    }
  }

  return result;
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

function removeSourceStar(note:ImportedNoteBody):ImportedNoteBody{
  const document=parseNoteBodyContent(note.bodyContent);
  if(!document)return note;
  const first=document.content?.[0]?.content?.[0];
  if(first?.type!=='text'||!first.text?.startsWith('*'))return note;
  first.text=first.text.slice(1).replace(/^ /,'');
  if(!first.text)document.content![0]!.content!.shift();
  return {body:noteBodyPlainText(document),bodyContent:JSON.stringify(document)};
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

  const appendHardBreakIfNeeded = () => {
    const target = field?.phase === 'result' ? field.result : field ? undefined : output;
    if (target?.length && target.at(-1)?.type !== 'hardBreak') {
      target.push({ type: 'hardBreak' });
    }
  };

  const hasImportableInline = (element: Element) =>
    descendantsByLocalName(element, 't').some((node) => Boolean(node.textContent))
    || descendantsByLocalName(element, 'footnoteReference').length > 0
    || descendantsByLocalName(element, 'endnoteReference').length > 0;

  const handleTextBoxTable = (table: Element, inheritedMarks: TiptapMark[]) => {
    const rows = directChildrenByLocalName(table, 'tr');
    rows.forEach((row, rowIndex) => {
      if (rowIndex > 0) appendHardBreakIfNeeded();
      const cells = directChildrenByLocalName(row, 'tc');
      cells.forEach((cell, cellIndex) => {
        if (cellIndex > 0) append([{ type: 'text', text: '\t' }]);
        const blocks = structuredBlockChildren(cell);
        blocks.forEach((block, blockIndex) => {
          if (blockIndex > 0) appendHardBreakIfNeeded();
          if (block.localName === 'p') {
            for (const child of Array.from(block.children)) {
              visitElement(child, inheritedMarks);
            }
          } else {
            handleTextBoxTable(block, inheritedMarks);
          }
        });
      });
    });
  };

  const handleTextBoxContent = (content: Element, inheritedMarks: TiptapMark[]) => {
    const blocks = structuredBlockChildren(content).filter(hasImportableInline);
    if (blocks.length === 0) return;

    // Text boxes have no portable positioning in the manuscript model. Keep
    // their content in reading order and separate it from surrounding text.
    appendHardBreakIfNeeded();
    blocks.forEach((block, blockIndex) => {
      if (blockIndex > 0) appendHardBreakIfNeeded();
      if (block.localName === 'p') {
        for (const child of Array.from(block.children)) {
          visitElement(child, inheritedMarks);
        }
      } else {
        handleTextBoxTable(block, inheritedMarks);
      }
    });
  };

  const handleRun = (run: Element, inheritedMarks: TiptapMark[] = []) => {
    const marks = mergeMarks(inheritedMarks, runMarks(run));
    const skipStar=new Set<Element>();
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
        if (!noteId || Number(noteId) < 1) continue;

        // Word note references are independent anchors in the document stream.
        // Flush an in-flight field before placing the anchor so a citation or
        // index field cannot swallow the marker into its cached result.
        finishField();

        const noteType = node.localName === 'endnoteReference' ? 'endnote' : 'footnote';
        const noteBodies = noteType === 'endnote' ? context.endnotes : context.footnotes;
        if (!noteBodies.has(noteId)) {
          context.warnings.push(warning('missing-note-body'));
        }
        let noteBody = noteBodies.get(noteId);
        const siblings=Array.from(run.children);
        const marker=siblings[siblings.indexOf(node)+1];
        const customMark= /^(?:1|true|on)$/i.test(attributeByLocalName(node,'customMarkFollows')??'')&&marker?.localName==='t'&&marker.textContent?.startsWith('*')?'*' as const:undefined;
        if(customMark&&marker){skipStar.add(marker);if(noteBody)noteBody=removeSourceStar(noteBody);}
        else if(attributeByLocalName(node,'customMarkFollows')&&attributeByLocalName(node,'customMarkFollows')!=='0')context.warnings.push(warning('unsupported-custom-note-mark'));
        const annotationId = `note-${crypto.randomUUID()}`;
        const anchorId = `anchor-${crypto.randomUUID()}`;
        const label = customMark??String(context.annotations.filter(note=>note.noteCustomMark!=='*').length + 1);
        context.annotations.push({
          id: annotationId,
          type: 'note',
          noteKind: noteType,
          ...(customMark?{noteCustomMark:customMark}:{}),
          anchorId,
          targetBlockId: context.blockId,
          body: noteBody?.body ?? '',
          ...(noteBody ? { bodyContent: noteBody.bodyContent } : {}),
          renderingHint: noteType,
          createdAt: new Date().toISOString(),
          modifiedAt: new Date().toISOString(),
        });
        output.push(
          {
            type: 'omiNote',
            attrs: {
              noteId: annotationId,
              anchorId,
              label,
              noteType,
            },
          },
        );
        continue;
      }

      if (node.localName === 't' || node.localName === 'delText') {
        if (node.localName === 'delText') continue;
        const text = (node.textContent ?? '').slice(skipStar.has(node)?1:0);
        if (text) append([{ type: 'text', text, marks: marks.length ? marks : undefined }]);
        continue;
      }

      if (node.localName === 'tab') {
        append([{ type: 'text', text: '\t', marks: marks.length ? marks : undefined }]);
        continue;
      }

      if (node.localName === 'br' || node.localName === 'cr') {
        append([{ type: 'hardBreak' }]);
        continue;
      }

      if (node.localName !== 'rPr') visitElement(node, marks);
    }
  };

  function visitElement(element: Element, inheritedMarks: TiptapMark[] = []): void {
    if (element.localName === 'r') {
      handleRun(element, inheritedMarks);
      return;
    }

    if (element.localName === 'hyperlink') {
      const relationshipId = attributeByLocalName(element, 'id');
      const relationship=relationshipId?relationships.get(relationshipId):undefined;
      const target=relationship?.targetMode?.toLowerCase()==='external'&&(!relationship.type||relationship.type.endsWith('/hyperlink'))?relationship.target:undefined;
      const href=target&&/^(https?:|mailto:)/i.test(target.trim())?normalizeExternalHref(target):undefined;
      const anchor=attributeByLocalName(element,'anchor');
      if(!relationshipId&&anchor&&/^[_A-Za-z][_A-Za-z0-9]{0,39}$/.test(anchor)&&context.wordReferences&&!field){
        const label=descendantsByLocalName(element,'t').map(t=>t.textContent??'').join('');
        if(label.length<=4096&&label){
          const id='xref-'+crypto.randomUUID(),anchorId='anchor-'+crypto.randomUUID();
          context.wordReferences.push({id,anchorId,blockId:context.blockId,name:anchor,field:{kind:'HYPERLINK',cachedLabel:label}});
          output.push({type:'omiCrossReference',attrs:{crossReferenceId:id,anchorId,label,unresolved:false}});
          return;
        }
      }
      const marks = href
        ? mergeMarks(inheritedMarks, [{ type: 'omiLink', attrs: { href,...(attributeByLocalName(element,'tooltip')?{title:attributeByLocalName(element,'tooltip')}: {}) } }])
        : inheritedMarks;
      if (href) context.stats.links += 1;
      for (const child of Array.from(element.children)) visitElement(child, marks);
      return;
    }

    if (element.localName === 'fldSimple') {
      const instruction = attributeByLocalName(element, 'instr') ?? '';
      const previousField = field;
      field = { instruction, result: [], phase: 'result' };
      for (const child of Array.from(element.children)) visitElement(child, inheritedMarks);
      const completed = field;
      field = previousField;
      if (completed) append(renderField(completed, context));
      return;
    }

    if (element.localName === 'txbxContent') {
      handleTextBoxContent(element, inheritedMarks);
      return;
    }

    for (const child of Array.from(element.children)) {
      visitElement(child, inheritedMarks);
    }
  }

  for (const child of Array.from(paragraph.children)) visitElement(child);

  if (field) finishField();
  return coalesceTextNodes(output);
}

function paragraphHasNoteReference(paragraph: Element): boolean {
  return ['footnoteReference', 'endnoteReference'].some((name) =>
    descendantsByLocalName(paragraph, name).some((reference) => {
      const id = attributeByLocalName(reference, 'id');
      return Boolean(id && Number(id) >= 1);
    }),
  );
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
    const href = /^(https?:|mailto:)/i.test(hyperlink.trim())?normalizeExternalHref(hyperlink):undefined;
    if (href) {
      context.stats.links += 1;
      return applyMarkToInline(field.result, {
        type: 'omiLink',
        attrs: { href },
      });
    }
  }

  const reference=parseWordCrossReference(field.instruction,inlinePlainText(field.result));
  if(reference&&context.wordReferences){
    const id='xref-'+crypto.randomUUID(),anchorId='anchor-'+crypto.randomUUID();
    context.wordReferences.push({id,anchorId,blockId:context.blockId,...reference});
    return [{type:'omiCrossReference',attrs:{crossReferenceId:id,anchorId,label:reference.field.cachedLabel||reference.name,unresolved:false}}];
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
  if (enabledWordProperty(properties, 'smallCaps')) marks.push({ type: 'omiSmallCaps' });
  if (enabledWordProperty(properties, 'u')) marks.push({ type: 'omiUnderline' });
  const fonts = directChildrenByLocalName(properties, 'rFonts')[0];
  if (fonts) {
    const family = ['hAnsi', 'ascii', 'eastAsia', 'cs']
      .map((name) => attributeByLocalName(fonts, name)?.trim())
      .find((value) => value && value.length <= 128 && Array.from(value).every((character) => { const code = character.charCodeAt(0); return code >= 32 && code !== 127; }));
    if (family) marks.push({ type: 'omiSourceFont', attrs: { family } });
  }

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

  return mergeWordDirectFormatting(marks, wordDirectFormatting(
    (property, attribute = 'val') => { const item = directChildrenByLocalName(properties, property)[0]; return item ? attributeByLocalName(item, attribute) : undefined; },
    (property) => directChildrenByLocalName(properties, property).length > 0,
  ));
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
  composedImages: ReadonlyMap<string, WordDrawingImage>,
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
    const composed = relationId ? composedImages.get(relationId) : undefined;
    if (composed) {
      const { sourcePart, textBox, ...data } = composed;
      const block = textBox ? createTextBoxBlock(textBox) : createImageBlock(data);
      block.visual!.provenance = { ...provenance, sourcePart };
      blocks.push(block);
      if (!textBox) stats.images += 1;
      continue;
    }
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
    attrs: first?.attrs,
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

    if (item.ordered !== ordered || item.attrs.omiListId !== first?.attrs.omiListId) break;
    node.content?.push({
      type: 'listItem',
      content: [{ type: 'paragraph', ...(item.paragraphAttrs?{attrs:item.paragraphAttrs}:{}), content: item.content }],
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
    const kind=attributeByLocalName(element,'type');
    const rPr=directChildrenByLocalName(element,'rPr')[0];
    const next=directChildrenByLocalName(element,'next')[0];
    const color=rPr&&directChildrenByLocalName(rPr,'color')[0];
    const rawColor=color&&attributeByLocalName(color,'val');
    const flag=(key:string)=>rPr&&directChildrenByLocalName(rPr,key)[0]?enabledWordProperty(rPr,key):undefined;
    const source:SourceStyle|undefined=kind==='paragraph'||kind==='character'?{id,name:nameElement?attributeByLocalName(nameElement,'val')??id:id,kind,basedOn:basedOnElement&&attributeByLocalName(basedOnElement,'val'),next:next&&attributeByLocalName(next,'val'),bold:flag('b'),italic:flag('i'),color:rawColor&&/^[0-9a-f]{6}$/i.test(rawColor)?'#'+rawColor:undefined}:undefined;
    styles.set(id, {
      id,
      source,
      name: nameElement ? attributeByLocalName(nameElement, 'val') : undefined,
      basedOn: basedOnElement ? attributeByLocalName(basedOnElement, 'val') : undefined,
      outlineLevel: Number.isFinite(outlineValue) ? outlineValue : undefined,
      ...readParagraphNumbering(pPr),
    });
  }

  return styles;
}

type WordNumbering = Map<string, Map<number, Record<string, unknown>>>;

function readNumberingLevel(level: Element): Record<string, unknown> {
  const read = (name: string) => {
    const child = directChildrenByLocalName(level,name)[0];
    return child ? attributeByLocalName(child,'val') : undefined;
  };
  const attrs: Record<string, unknown> = {};
  const set = (name: Parameters<typeof normalizeListAttribute>[0], value: unknown) => {
    const normalized = normalizeListAttribute(name,value);
    if (normalized !== undefined) attrs[name] = normalized;
  };
  set('omiListFormat',read('numFmt'));
  set('omiListLabel',read('lvlText'));
  set('omiListStart',read('start'));
  const paragraphStyle=read('pStyle');
  if(paragraphStyle)attrs.wordParagraphStyle=paragraphStyle;
  const pPr = directChildrenByLocalName(level,'pPr')[0];
  const ind = pPr && directChildrenByLocalName(pPr,'ind')[0];
  if (ind) {
    set('omiListLeft',attributeByLocalName(ind,'left') ?? attributeByLocalName(ind,'start'));
    set('omiListHanging',attributeByLocalName(ind,'hanging'));
  }
  return attrs;
}

async function readNumbering(archive: DocxZipArchive): Promise<WordNumbering> {
  if (!archive.has('word/numbering.xml')) return new Map();
  const document = parseXml(await archive.text('word/numbering.xml'));
  const abstractFormats: WordNumbering = new Map();
  for (const abstract of descendantsByLocalName(document,'abstractNum')) {
    const id = attributeByLocalName(abstract,'abstractNumId');
    if (!id) continue;
    const levels = new Map<number,Record<string,unknown>>();
    for (const level of directChildrenByLocalName(abstract,'lvl')) {
      const index = normalizeListAttribute('omiListLevel',attributeByLocalName(level,'ilvl') ?? 0);
      if (typeof index === 'number') levels.set(index,readNumberingLevel(level));
    }
    abstractFormats.set(id,levels);
  }
  const result: WordNumbering = new Map();
  for (const num of descendantsByLocalName(document,'num')) {
    const id = attributeByLocalName(num,'numId');
    const abstract = directChildrenByLocalName(num,'abstractNumId')[0];
    const abstractId = abstract && attributeByLocalName(abstract,'val');
    if (!id || !abstractId) continue;
    const levels = new Map<number, Record<string, unknown>>([...(abstractFormats.get(abstractId) ?? [])].map(([level,attrs])=>[level,{...attrs}]));
    for (const override of directChildrenByLocalName(num,'lvlOverride')) {
      const index = normalizeListAttribute('omiListLevel',attributeByLocalName(override,'ilvl'));
      if (typeof index !== 'number') continue;
      const level = directChildrenByLocalName(override,'lvl')[0];
      const start = directChildrenByLocalName(override,'startOverride')[0];
      const attrs = {...levels.get(index),...(level ? readNumberingLevel(level) : {})};
      const value = start && normalizeListAttribute('omiListStart',attributeByLocalName(start,'val'));
      if (value !== undefined) { attrs.omiListStart = value; attrs.omiListOverrideStart = value; }
      levels.set(index,attrs);
    }
    // Scope source numId values to this import to avoid collisions when
    // independently imported documents are subsequently combined.
    const group = crypto.randomUUID();
    for (const attrs of levels.values()) attrs.omiListId = group;
    result.set(id,levels);
  }
  return result;
}

function readParagraphNumbering(pPr: Element | undefined): {numId?:string;numLevel?:number} {
  const numPr=pPr&&directChildrenByLocalName(pPr,'numPr')[0];
  const id=numPr&&directChildrenByLocalName(numPr,'numId')[0];
  const level=numPr&&directChildrenByLocalName(numPr,'ilvl')[0];
  const value=level&&normalizeListAttribute('omiListLevel',attributeByLocalName(level,'val'));
  return {numId:id?attributeByLocalName(id,'val'):undefined,numLevel:typeof value==='number'?value:undefined};
}

function paragraphListInfo(paragraph: Element, numbering: WordNumbering, styles: Map<string,WordStyle>): WordListInfo | undefined {
  const pPr = directChildrenByLocalName(paragraph,'pPr')[0];
  const direct=readParagraphNumbering(pPr);
  let id=direct.numId, level=direct.numLevel;
  let style=resolveParagraphStyle(paragraph,styles);
  const visited=new Set<string>();
  // Each property may be inherited independently. An explicit zero numId
  // suppresses numbering; cycles must not cause unbounded traversal.
  while(style&&!visited.has(style.id)){
    visited.add(style.id);
    id??=style.numId;
    level??=style.numLevel;
    style=style.basedOn?styles.get(style.basedOn):undefined;
  }
  if(!id||id==='0')return undefined;
  // Word can link a numbering level to a paragraph style instead of
  // specifying ilvl in the style's numPr.
  const styleId=resolveParagraphStyle(paragraph,styles)?.id;
  if(level===undefined&&styleId){
    const match=[...(numbering.get(id)??[])].find(([,attrs])=>attrs.wordParagraphStyle===styleId);
    if(match)level=match[0];
  }
  level??=0;
  const definition = numbering.get(id)?.get(level);
  const ordered = definition?.omiListFormat !== 'bullet' && definition?.omiListFormat !== 'none';
  const attrs: Record<string,unknown> = {...definition,omiListLevel:level};
  delete attrs.wordParagraphStyle;
  if (ordered && typeof definition?.omiListStart === 'number' && definition.omiListStart !== 1) attrs.start = definition.omiListStart;
  return {level,ordered,attrs};
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

function sourceParagraphAttrs(style:WordStyle|undefined,styles:ReadonlyMap<string,WordStyle>):Record<string,unknown>{
  const bundle=importedSourceStyle(style?.id,key=>styles.get(key)?.source,'paragraph');
  return bundle?{omiWordParagraphStyle:bundle}:{};
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

function parseWordTable(table: Element,numbering:WordNumbering,relationships:Map<string,Relationship>,context:InlineContext,styles:Map<string,WordStyle>,depth=0,budget={cells:10000}): {
  cells: string[][];
  headerRows: number;
  mergedCells: boolean;
  cellFormats: Record<string, OmiTableCellFormat>;
  cellMerges: OmiTableCellMerge[];
  rowSplitOverrides: Record<string,OmiTableRowSplitPolicy>;
  rowHeights: Record<string,OmiTableRowHeight>;
  cellContent:Record<string,string>;
} {
  if(depth>MAX_NESTED_TABLE_DEPTH) throw new Error('Nested table exceeds the supported depth.');
  const rows = directChildrenByLocalName(table, 'tr');
  const cellFormats: Record<string, OmiTableCellFormat> = {};
  let mergedCells = false;
  const merges: OmiTableCellMerge[] = [];
  const rowSplitOverrides: Record<string,OmiTableRowSplitPolicy> = {};
  const rowHeights: Record<string,OmiTableRowHeight> = {};
  const cellContent:Record<string,string>={};
  let active = new Map<number,OmiTableCellMerge>();
  const cells = rows.map((row,rowIndex)=>{
    const next = new Map<number,OmiTableCellMerge>();
    const values:string[]=[];
    const rowProperties=directChildrenByLocalName(row,'trPr')[0];
    const height=rowProperties && directChildrenByLocalName(rowProperties,'trHeight')[0];
    if(height){
      const rule=attributeByLocalName(height,'hRule');
      const value=normalizeTableRowHeight({mode:rule==='auto'?'auto':rule==='exact'?'exact':'minimum',heightPt:Number(attributeByLocalName(height,'val'))/20});
      if(value.mode!=='auto') rowHeights[String(rowIndex)]=value;
    }
    const cantSplit=rowProperties && directChildrenByLocalName(rowProperties,'cantSplit')[0];
    if(cantSplit) rowSplitOverrides[String(rowIndex)]=['0','false','off'].includes(attributeByLocalName(cantSplit,'val')?.toLowerCase()??'')?'allow':'keep';
    const before=rowProperties && directChildrenByLocalName(rowProperties,'gridBefore')[0];
    const offset=before ? Number(attributeByLocalName(before,'val')) : 0;
    if(Number.isSafeInteger(offset) && offset>0 && offset<=1000) for(let i=0;i<offset;i++) values.push('');
    for(const cell of directChildrenByLocalName(row,'tc')){
      const columnIndex=values.length;
      const properties=directChildrenByLocalName(cell,'tcPr')[0];
      const prop=(name:string)=>properties && directChildrenByLocalName(properties,name)[0];
      const direction=prop('textDirection');
      const value=direction && attributeByLocalName(direction,'val');
      const format: OmiTableCellFormat = {};
      if(value==='btLr'||value==='tbRl') format.textRotation=value==='btLr'?-90:90;
      const valign=prop('vAlign');
      const va=valign && attributeByLocalName(valign,'val');
      const shading=prop('shd');
      const fill=shading && attributeByLocalName(shading,'fill');
      const pattern=shading && attributeByLocalName(shading,'val');
      const paragraphs=directChildrenByLocalName(cell,'p');
      const aligns=paragraphs.map(p=>{
        const pp=directChildrenByLocalName(p,'pPr')[0];
        const jc=pp && directChildrenByLocalName(pp,'jc')[0];
        return jc && attributeByLocalName(jc,'val');
      });
      const alignment=aligns[0];
      const appearance=normalizeTableCellAppearance({
        horizontalAlign:aligns.every(a=>a===alignment)?(alignment==='both'?'justify':alignment as OmiTableCellFormat['horizontalAlign']):undefined,
        verticalAlign:va==='center'?'middle':va as OmiTableCellFormat['verticalAlign'],
        backgroundColor:fill && (!pattern||pattern==='clear') && !attributeByLocalName(shading!,'themeFill')?'#'+fill:undefined,
      });
      const borderProps=prop('tcBorders');
      const marginProps=prop('tcMar');
      const borders: NonNullable<OmiTableCellFormat['borders']>={};
      const paddingPt: NonNullable<OmiTableCellFormat['paddingPt']>={};
      for(const side of TABLE_CELL_SIDES){
        const edge=borderProps && directChildrenByLocalName(borderProps,side)[0];
        if(edge){
          const val=attributeByLocalName(edge,'val');
          const style=val==='single'?'solid':val==='dashSmallGap'||val==='dashed'?'dashed':val==='dotted'?'dotted':val==='double'?'double':undefined;
          if(val==='nil'||val==='none') borders[side]={style:'none'};
          else if(style){
            const raw=attributeByLocalName(edge,'sz');
            const color=attributeByLocalName(edge,'color');
            borders[side]={style,widthPt:raw!==undefined&&raw!==''?Number(raw)/8:undefined,color:color&&color!=='auto'?'#'+color:undefined};
          }
        }
        const margin=marginProps && directChildrenByLocalName(marginProps,side)[0];
        if(margin && attributeByLocalName(margin,'type')==='dxa'){
          const raw=attributeByLocalName(margin,'w');
          if(raw!==undefined&&raw!=='') paddingPt[side]=Number(raw)/20;
        }
      }
      Object.assign(format,appearance,normalizeTableCellEdges({borders,paddingPt}));
      if(Object.keys(format).length) cellFormats[`${rowIndex}:${columnIndex}`]=format;
      const span=prop('gridSpan');
      const rawSpan=span?Number(attributeByLocalName(span,'val')):1;
      const colSpan=Number.isSafeInteger(rawSpan)&&rawSpan>=1&&rawSpan<=1000?rawSpan:1;
      if(rawSpan!==colSpan) mergedCells=true;
      if(values.length+colSpan>10000 || (rowIndex+1)*(values.length+colSpan)>10000) throw new Error('Table exceeds the 10000-cell import limit.');
      // Keep direct cell blocks in source order, including nested tables.
      const cellParagraphs=directChildrenByLocalName(cell,'p');
      const nested=directChildrenByLocalName(cell,'tbl').length>0;
      const parsedParagraphs=cellParagraphs.map(p=>{
        const pp=directChildrenByLocalName(p,'pPr')[0];
        const attrs=pp?normalizeCellParagraphAttrs({
          ...readWordParagraphFormatting((property,attribute)=>{
            const node=directChildrenByLocalName(pp,property)[0];
            return node?attributeByLocalName(node,attribute):undefined;
          },property=>directChildrenByLocalName(pp,property).length>0),
          ...readWordParagraphDecoration((parent,name)=>{
            const container=directChildrenByLocalName(pp,parent)[0];
            return container?directChildrenByLocalName(container,name).map(element=>Object.fromEntries(Array.from(element.attributes).map(a=>[a.localName,a.value]))):[];
          }),
        }):{};
        if(attrs.omiAlign===format.horizontalAlign) delete attrs.omiAlign;
        return {type:'paragraph',...(Object.keys(attrs).length?{attrs}:{}),content:parseParagraphInline(p,relationships,context)};});
      const nodes:TiptapNode[]=[];
      let listItems:ParsedListParagraph[]=[];
      const flush=()=>{if(listItems.length){nodes.push(...buildListNodes(listItems));listItems=[];}};
      let paragraphIndex=0;
      for(const source of Array.from(cell.children)){
        if(source.localName==='tbl'){
          flush();
          const child=parseWordTable(source,numbering,relationships,context,styles,depth+1,budget);
          const nestedTable:OmiTableBlockData={kind:'table',cells:child.cells,headerRows:child.headerRows,cellFormats:child.cellFormats,cellContent:child.cellContent,cellMerges:child.cellMerges,rowSplitDefault:'allow',rowSplitOverrides:child.rowSplitOverrides,rowHeights:child.rowHeights};
          if(child.mergedCells) mergedCells=true;
          if(child.cells.length) nodes.push({type:'omiCellTable',attrs:{table:nestedTable}});
          continue;
        }
        if(source.localName!=='p') continue;
        const paragraph=parsedParagraphs[paragraphIndex++]!;
        const info=paragraphListInfo(source,numbering,styles);
        if(info){
          listItems.push({...info,content:paragraph.content,paragraphAttrs:paragraph.attrs});
        }else{flush();nodes.push(paragraph);}
      }
      flush();
      const doc={type:'doc',content:nodes};
      const rich=nodes.length>0&&nodes.some(p=>p.type!=='paragraph'||p.attrs||p.content?.some(n=>n.marks?.length||n.type!=='text')||nodes.length>1);
      const parsed=rich?parseTableCellContent(JSON.stringify(doc)):undefined;
      if((nested||cellParagraphs.some(paragraphHasNoteReference))&&!parsed) throw new Error('Structured table content could not be represented safely.');
      const text=parsed?tableCellPlainText(parsed):descendantsByLocalName(cell,'p').map(paragraph=>paragraphPlainText(paragraph).trim()).filter(Boolean).join('\n');
      if(parsed) cellContent[`${rowIndex}:${columnIndex}`]=JSON.stringify(parsed);
      const vertical=prop('vMerge');
      const mode=vertical?(attributeByLocalName(vertical,'val')??'continue'):undefined;
      const prior=active.get(columnIndex);
      if(mode==='continue' && prior && prior.colSpan===colSpan && text===''){
        prior.rowSpan++;
        next.set(columnIndex,prior);
      }else{
        if(mode==='continue') mergedCells=true;
        if(mode==='restart'||colSpan>1){
          const merge={row:rowIndex,column:columnIndex,rowSpan:1,colSpan};
          merges.push(merge);
          if(mode==='restart') next.set(columnIndex,merge);
        }
      }
      values.push(text);
      for(let i=1;i<colSpan;i++) values.push('');
    }
    active=next;
    return values;
  });

  // Word commonly marks the first row as a header through the table style's
  // tblLook instead of an explicit w:tblHeader row property. Preserve both
  // representations so styled Word headers render as headers in OMI.
  const tableProperties = directChildrenByLocalName(table, 'tblPr')[0];
  const look = tableProperties
    ? directChildrenByLocalName(tableProperties, 'tblLook')[0]
    : undefined;
  const firstRowStyledAsHeader = look
    ? ['firstRow', 'firstrow'].some((name) => {
        const value = attributeByLocalName(look, name);
        return value === '1' || value?.toLocaleLowerCase() === 'true';
      })
    : false;
  let headerRows = 0;
  for (const row of rows) {
    const properties = directChildrenByLocalName(row, 'trPr')[0];
    const header = properties && directChildrenByLocalName(properties, 'tblHeader')[0];
    if (header) {
      if (['0','false','off'].includes(attributeByLocalName(header,'val')?.toLowerCase() ?? '')) break;
    } else if (headerRows !== 0 || !firstRowStyledAsHeader) break;
    headerRows++;
  }
  const width=cells.reduce((max,row)=>Math.max(max,row.length),0);
  if(width*cells.length>budget.cells) throw new Error('Table exceeds the 10000-cell import limit.');
  budget.cells-=width*cells.length;
  const matrix=rectangularize(cells);
  const candidates=merges.filter(m=>m.rowSpan>1||m.colSpan>1);
  const cellMerges=tableMergeLayout(matrix,candidates,headerRows).merges;
  return {cells:matrix,headerRows,mergedCells:mergedCells||cellMerges.length!==candidates.length,cellFormats,cellMerges,rowSplitOverrides,rowHeights,cellContent};
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

function hasMeaningfulInlineContent(nodes: readonly TiptapNode[]): boolean {
  return nodes.some((node) => {
    if (node.type === 'hardBreak') return false;
    if (node.type === 'text') return Boolean(node.text?.trim());
    return node.content ? hasMeaningfulInlineContent(node.content) : true;
  });
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
