import { tableMergeLayout } from '../model/tableLayout';
import { normalizeParagraphValue } from '../model/directParagraphFormatting';
import { readOdtDirectProperties, readOdtParagraphProperties } from './odtFormatting';
import { OdtZip } from './odtZip';
import { DOMParser as XmlParser, type Document as XmlDocument, type Element as XmlElement, type Node as XmlNode } from '@xmldom/xmldom';
import { materializeSectionHeadingBlocks } from '../model/atomicTextBlocks';
import { createNoteAnnotation } from '../model/notes';
import { createImageBlock, createTableBlock } from '../model/visualBlocks';
import { noteBodyPlainText, type NoteJsonNode } from '../model/noteRichText';
import { normalizeExternalHref, normalizeInlineLanguageTag } from '../model/richText';
import { withParentSectionId } from '../model/sectionStructure';
import type { OmiAnnotation, OmiBlock, OmiImportProvenance, OmiSection, OmiTableCellMerge, OmiTableRowSplitPolicy } from '../types/omi';
import type { DocxManuscriptImportPlan } from './docxManuscriptImport';
import { createEmptyDocxImportStats, mergeDetectedAuthors, parseDetectedAuthors, type DocxImportWarning } from '../model/docxImport';

const MAX_ODT_PACKAGE_BYTES = 200 * 1024 * 1024;
const ODT_MIME = 'application/vnd.oasis.opendocument.text';

/** Import an OpenDocument Text package into a new, editable OMI manuscript. */
export async function parseOdtForStudio(file: File): Promise<DocxManuscriptImportPlan> {
  if (!/\.odt$/i.test(file.name)) throw new Error('An ODT file is required.');
  if (file.size > MAX_ODT_PACKAGE_BYTES) throw new Error(`ODT import is limited to ${MAX_ODT_PACKAGE_BYTES / 1024 / 1024} MB per file.`);
  const zip = new OdtZip(await file.arrayBuffer());
  if (await zip.text('mimetype') !== ODT_MIME || !zip.has('content.xml')) {
    throw new Error('This is not a valid OpenDocument Text package (content.xml or the ODT mimetype is missing).');
  }

  const contentDoc = parseXml(await zip.text('content.xml'));
  const textRoot = descendants(documentElement(contentDoc), 'text').find((node) => node.localName === 'text');
  if (!textRoot) throw new Error('The ODT package does not contain an office:text document body.');
  const metadata = zip.has('meta.xml') ? parseMetadata(parseXml(await zip.text('meta.xml'))) : {};
  const listStyleTypes = new Map<string, boolean>();
  const textStyles = new Map<string, XmlElement>();
  for (const part of ['styles.xml', 'content.xml']) if (zip.has(part)) {
    const styleDoc = part === 'content.xml' ? contentDoc : parseXml(await zip.text(part));
    for (const style of descendants(documentElement(styleDoc), 'style')) {
      const name = style.getAttribute('style:name');
      if (name) textStyles.set(name, style);
    }
    for (const style of descendants(documentElement(styleDoc), 'list-style')) {
      const name = style.getAttribute('style:name') ?? style.getAttribute('text:name') ?? '';
      if (name) listStyleTypes.set(name, descendants(style, 'list-level-style-number').length > 0);
    }
  }
  const timestamp = new Date().toISOString();
  const provenance: OmiImportProvenance = { sourceFormat: 'odt', fileName: file.name, importedAt: timestamp };
  const sections: OmiSection[] = [];
  const annotations: OmiAnnotation[] = [];
  const warnings: DocxImportWarning[] = [];
  const headingStack: Array<{ id: string; level: number }> = [];
  const stats = createEmptyDocxImportStats();
  let title = metadata.title?.trim() ?? '';
  let titleSource: DocxManuscriptImportPlan['titleSource'] = title ? 'core-properties' : 'filename';
  let abstract = metadata.abstract ?? '';
  let keywords = metadata.keywords ?? [];
  const authorGroups = metadata.creator ? [parseDetectedAuthors(metadata.creator, 'core-properties')] : [];
  let frontMatter = true;

  for (const child of Array.from(textRoot.children)) {
    if (child.localName === 'h') {
      const text = plainText(child).trim();
      if (!text) continue;
      const level = Math.max(1, Math.min(6, Number(child.getAttributeNS('urn:oasis:names:tc:opendocument:xmlns:text:1.0', 'outline-level') || child.getAttribute('text:outline-level') || 1)));
      while (headingStack.length && (headingStack.at(-1)?.level ?? 0) >= level) headingStack.pop();
      const id = crypto.randomUUID();
      const section = withParentSectionId({ id, title: text, blocks: [] }, headingStack.at(-1)?.id);
      sections.push(section);
      headingStack.push({ id, level });
      stats.sections += 1;
      frontMatter = false;
      continue;
    }
    if (child.localName === 'table') {
      const rows: string[][] = [];
      const merges: OmiTableCellMerge[] = [];
      const rowSplitOverrides: Record<string,OmiTableRowSplitPolicy> = {};
      let headerRows=0, bodyStarted=false;
      const rowElements=Array.from(child.getElementsByTagNameNS('*','table-row')).filter(row=>{
        let owner=row.parentNode;
        while(owner && owner.nodeType===1 && (owner as XmlElement).localName!=='table') owner=owner.parentNode;
        return owner===child;
      });
      for(const row of rowElements){
        const values:string[]=[];
        for(const cell of Array.from(row.children).filter(c=>c.localName==='table-cell'||c.localName==='covered-table-cell')){
          const col=values.length;
          const rowSpan=Number(cell.getAttribute('table:number-rows-spanned')||1);
          const colSpan=Number(cell.getAttribute('table:number-columns-spanned')||1);
          if(cell.localName==='table-cell' && (rowSpan>1||colSpan>1)) merges.push({row:rows.length,column:col,rowSpan,colSpan});
          values.push(plainText(cell).trim());
        }
        if(!values.length) continue;
        // Resolve named row styles, including inherited styles, without looping on malformed cycles.
        const visited=new Set<string>();
        let name=row.getAttribute('table:style-name')??'';
        while(name&&!visited.has(name)){
          visited.add(name);
          const style=textStyles.get(name);
          if(!style||style.getAttribute('style:family')!=='table-row') break;
          const properties=Array.from(style.children).find(node=>node.localName==='table-row-properties');
          const value=properties?.getAttribute('fo:keep-together');
          if(value==='always'||value==='auto'){rowSplitOverrides[String(rows.length)]=value==='always'?'keep':'allow';break;}
          name=style.getAttribute('style:parent-style-name')??'';
        }
        if(!bodyStarted && (row.parentNode as XmlElement | null)?.localName==='table-header-rows') headerRows++; else bodyStarted=true;
        rows.push(values);
      }
      if(rows.length){
        const width=rows.reduce((max,row)=>Math.max(max,row.length),0);
        if(width*rows.length>10000) throw new Error('Table exceeds the 10000-cell import limit.');
        const cells=rows.map(row=>Array.from({length:width},(_,c)=>row[c]??''));
        const cellMerges=tableMergeLayout(cells,merges,headerRows).merges;
        if(cellMerges.length!==merges.length) warnings.push({code:'merged-table-cells',severity:'warning',message:'Some ODT cell merges could not be preserved without hiding data.'});
        ensureSection(sections).blocks.push(createTableBlock(cells,{provenance,headerRows,cellMerges,rowSplitDefault:'allow',rowSplitOverrides})); stats.tables+=1;
      }
      frontMatter = false;
      continue;
    }
    if (child.localName === 'list') {
      const blockId = crypto.randomUUID();
      const ordered = listStyleTypes.get(child.getAttribute('text:style-name') ?? '') ?? false;
      const nodes = parseOdtList(child, ordered, blockId, annotations, stats, provenance, warnings, listStyleTypes, textStyles);
      if (nodes.length) {
        ensureSection(sections).blocks.push({ id: blockId, type: 'paragraph', content: JSON.stringify({ type: 'doc', content: nodes }) });
        stats.paragraphs += countListParagraphs(nodes);
        stats.lists += countListNodes(nodes);
      }
      frontMatter = false;
      continue;
    }
    if (child.localName !== 'p') continue;
    const text = plainText(child).trim();
    const styleName = child.getAttribute('text:style-name') ?? '';
    const foldedStyle = styleName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (frontMatter && text && /^(title|titel|cim)$/.test(foldedStyle)) {
      if (!title) { title = text; titleSource = 'title-style'; }
      continue;
    }
    if (frontMatter && text && /^(author|autor|szerzo)$/.test(foldedStyle)) { authorGroups.push(parseDetectedAuthors(text, 'author-style')); continue; }
    if (frontMatter && text && /^(abstract|zusammenfassung|absztrakt)$/.test(foldedStyle)) { abstract = [abstract, text].filter(Boolean).join('\n'); continue; }
    if (frontMatter && text && /^(keywords?|schlagworter|kulcsszavak)\s*[:：]/i.test(text)) {
      keywords = Array.from(new Set([...keywords, ...text.replace(/^[^:：]+[:：]\s*/, '').split(/[;,]+/).map((item) => item.trim()).filter(Boolean)]));
      continue;
    }
    const section = ensureSection(sections);
    const blockId = crypto.randomUUID();
    const inline = parseInlineChildren(child, blockId, annotations, stats, provenance, warnings, textStyles, listStyleTypes);
    if (inline.length) {
      section.blocks.push({ id: blockId, type: 'paragraph', content: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', ...odtParagraphAttrs(styleName, textStyles), content: inline }] }) });
      stats.paragraphs += 1;
    }
    for (const image of Array.from(child.getElementsByTagNameNS('*', 'image'))) {
      const href = image.getAttribute('xlink:href') ?? image.getAttributeNS('http://www.w3.org/1999/xlink', 'href') ?? '';
      const path = safePicturePath(href);
      if (!path || !zip.has(path)) {
        warnings.push(warning('odt-image-not-found', 'An embedded image reference could not be resolved and was skipped.'));
        continue;
      }
      const bytes = await zip.data(path);
      const mediaType = mediaTypeForPicture(path);
      const frame = image.parentElement;
      const title = frame?.getElementsByTagNameNS('*', 'title').item(0)?.textContent?.trim();
      const description = frame?.getElementsByTagNameNS('*', 'desc').item(0)?.textContent?.trim();
      section.blocks.push(createImageBlock({ src: `data:${mediaType};base64,${toBase64(bytes)}`, mediaType, alt: description || title || '', provenance: { ...provenance, sourcePart: path } }));
      stats.images += 1;
    }
    frontMatter = false;
  }

  if (!title) { title = file.name.replace(/\.odt$/i, '').trim() || 'Imported manuscript'; warnings.push(warning('title-from-filename', 'No explicit document title was found; the file name is used as the manuscript title.')); }
  if (sections.length === 0) sections.push({ id: crypto.randomUUID(), title: '', blocks: [] });
  for (const section of sections) if (!section.blocks.length) section.blocks.push(emptyParagraph());
  const finalizedSections = materializeSectionHeadingBlocks(sections);
  stats.sections = finalizedSections.length;
  stats.notes = annotations.length;
  stats.warnings = warnings.length;
  const authors = mergeDetectedAuthors(...authorGroups);
  return {
    fileName: file.name, title, titleSource, locale: normalizeInlineLanguageTag(metadata.language),
    abstract: abstract || undefined, keywords, authors, sections: finalizedSections, annotations,
    bibliographicRecords: [], citations: [], citationClusters: [], stats,
    warnings,
  };
}

function parseInlineChildren(root: XmlElement, blockId: string, annotations: OmiAnnotation[], stats: ReturnType<typeof createEmptyDocxImportStats>, provenance: OmiImportProvenance, warnings: DocxImportWarning[], textStyles: Map<string, XmlElement>, listStyleTypes: Map<string, boolean>): Array<Record<string, unknown>> {
  const output: Array<Record<string, unknown>> = [];
  const visit = (node: XmlNode, marks: Array<{ type: string; attrs?: Record<string, unknown> }> = []): void => {
    if (node.nodeType === 3) { if (node.nodeValue) output.push({ type: 'text', text: node.nodeValue, ...(marks.length ? { marks } : {}) }); return; }
    if (node.nodeType !== 1) return;
    const element = node as XmlElement;
    let next = [...marks];
    if (element.localName === 'span') {
      const style = (element.getAttribute('text:style-name') ?? '').toLowerCase();
      if (/bold|strong|félkövér/.test(style)) next.push({ type: 'bold' });
      if (/italic|emphasis|dőlt/.test(style)) next.push({ type: 'italic' });
      if (/underline/.test(style)) next.push({ type: 'omiUnderline' });
      if (/strike/.test(style)) next.push({ type: 'strike' });
    }
    next = applyOdtTextStyle(element.getAttribute('text:style-name') ?? '', textStyles, next);
    if (element.localName === 'a') {
      const href = normalizeExternalHref(element.getAttribute('xlink:href') ?? undefined);
      if (href) next.push({ type: 'omiLink', attrs: { href } });
    }
    if (element.localName === 'line-break') { output.push({ type: 'hardBreak' }); return; }
    if (element.localName === 'tab') { output.push({ type: 'omiTab' }); return; }
    if (element.localName === 'note') {
      const noteId = crypto.randomUUID();
      const anchorId = crypto.randomUUID();
      const body = element.getElementsByTagNameNS('*', 'note-body').item(0);
      const bodyContent: NoteJsonNode = { type: 'doc', content: body ? Array.from(body.children).flatMap((paragraph) => {
        if (paragraph.localName === 'list') return parseOdtList(paragraph, listStyleTypes.get(paragraph.getAttribute('text:style-name') ?? '') ?? false, blockId, annotations, stats, provenance, warnings, listStyleTypes, textStyles) as NoteJsonNode[];
        if (paragraph.localName !== 'p' && paragraph.localName !== 'h') return [];
        return [{ type: 'paragraph', ...odtParagraphAttrs(paragraph.getAttribute('text:style-name') ?? '', textStyles), content: parseInlineChildren(paragraph, blockId, annotations, stats, provenance, warnings, textStyles, listStyleTypes) as NoteJsonNode[] }];
      }) : [{ type: 'paragraph' }] };
      const bodyText = noteBodyPlainText(bodyContent);
      const kind = element.getAttribute('text:note-class') === 'endnote' ? 'endnote' : 'footnote';
      annotations.push({ ...createNoteAnnotation({ id: noteId, anchorId, targetBlockId: blockId, kind, body: bodyText }), bodyContent: JSON.stringify(bodyContent) });
      output.push({ type: 'omiNote', attrs: { noteId, anchorId, label: String(annotations.length), noteType: kind } });
      stats.notes += 1;
      return;
    }
    for (const child of Array.from(element.childNodes)) visit(child, next);
  };
  for (const child of Array.from(root.childNodes)) visit(child, applyOdtTextStyle(root.getAttribute('text:style-name') ?? '', textStyles, []));
  void provenance; void warnings;
  return output;
}

function parseOdtList(root: XmlElement, ordered: boolean, blockId: string, annotations: OmiAnnotation[], stats: ReturnType<typeof createEmptyDocxImportStats>, provenance: OmiImportProvenance, warnings: DocxImportWarning[], listStyleTypes: Map<string, boolean>, textStyles: Map<string, XmlElement>): Array<Record<string, unknown>> {
  const listItems = Array.from(root.children).filter((node) => node.localName === 'list-item' || node.localName === 'list-header');
  if (!listItems.length) return [];
  return [{
    type: ordered ? 'orderedList' : 'bulletList',
    content: listItems.map((item) => ({
      type: 'listItem',
      content: Array.from(item.children).flatMap((child) => {
        if (child.localName === 'p' || child.localName === 'h') return [{ type: 'paragraph', ...odtParagraphAttrs(child.getAttribute('text:style-name') ?? '', textStyles), content: parseInlineChildren(child, blockId, annotations, stats, provenance, warnings, textStyles, listStyleTypes) }];
        if (child.localName === 'list') {
          const styleName = child.getAttribute('text:style-name') ?? '';
          return parseOdtList(child, listStyleTypes.get(styleName) ?? false, blockId, annotations, stats, provenance, warnings, listStyleTypes, textStyles);
        }
        return [];
      }),
    })),
  }];
}
function countListParagraphs(nodes: Array<Record<string, unknown>>): number {
  let count = 0;
  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const item = node as { type?: string; content?: unknown[] };
    if (item.type === 'paragraph') count += 1;
    for (const child of item.content ?? []) walk(child);
  };
  nodes.forEach(walk); return count;
}
function countListNodes(nodes: Array<Record<string, unknown>>): number {
  let count = 0;
  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const item = node as { type?: string; content?: unknown[] };
    if (item.type === 'bulletList' || item.type === 'orderedList') count += 1;
    for (const child of item.content ?? []) walk(child);
  };
  nodes.forEach(walk); return count;
}

function applyOdtTextStyle(
  name: string,
  styles: Map<string, XmlElement>,
  inherited: Array<{ type: string; attrs?: Record<string, unknown> }>,
  visited = new Set<string>(),
): Array<{ type: string; attrs?: Record<string, unknown> }> {
  if (!name || visited.has(name)) return inherited;
  visited.add(name);
  const style = styles.get(name);
  if (!style) return inherited;
  let marks = applyOdtTextStyle(style.getAttribute('style:parent-style-name') ?? '', styles, inherited, visited);
  const properties = Array.from(style.children).find((item) => item.localName === 'text-properties');
  if (!properties) return marks;
  for (const [attribute, type, enabled] of [
    ['fo:font-weight', 'bold', /^(?:bold|[6-9]00)$/i],
    ['fo:font-style', 'italic', /^(?:italic|oblique)$/i],
    ['fo:font-variant', 'omiSmallCaps', /^small-caps$/i],
    ['style:text-underline-style', 'omiUnderline', /^(?!none$).+/i],
    ['style:text-line-through-style', 'strike', /^(?!none$).+/i],
  ] as const) {
    const value = properties.getAttribute(attribute);
    if (!value) continue;
    marks = marks.filter((mark) => mark.type !== type);
    if (enabled.test(value)) marks.push({ type });
  }
  const position = properties.getAttribute('style:text-position');
  if (position) {
    marks = marks.filter((mark) => !['omiSuperscript', 'omiSubscript', 'omiBaseline'].includes(mark.type));
    // An explicit 100% glyph size is a baseline shift, not semantic super/subscript.
    if (!/^[-+]?(?:\d+(?:\.\d+)?|\.\d+)%\s+100%$/.test(position.trim())) {
      if (/^super\b/.test(position) || parseFloat(position) > 0) marks.push({ type: 'omiSuperscript' });
      else if (/^sub\b/.test(position) || parseFloat(position) < 0) marks.push({ type: 'omiSubscript' });
    }
  }
  const kerning = properties.getAttribute('style:letter-kerning');
  if (kerning === 'true' || kerning === '1') marks = marks.filter(mark => mark.type !== 'omiKerning');
  const direct = readOdtDirectProperties(attribute => properties.getAttribute(attribute) ?? undefined, name);
  if (properties.getAttribute('style:text-line-through-type') === 'double') marks = marks.filter(mark => mark.type !== 'strike');
  return [...new Map([...marks, ...direct].map((mark) => [mark.type, mark])).values()];
}

function odtParagraphAttrs(name: string, styles: Map<string, XmlElement>): { attrs?: Record<string, unknown> } {
  const properties = new Map<string, string>();
  let tabs: XmlElement | undefined;
  const seen = new Set<string>();
  const visit = (id: string) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    const style = styles.get(id);
    if (!style) return;
    visit(style.getAttribute('style:parent-style-name') ?? '');
    const element = Array.from(style.children).find(item => item.localName === 'paragraph-properties');
    if (element) {
      for (const attribute of Array.from(element.attributes)) properties.set(attribute.name, attribute.value);
      tabs = Array.from(element.children).find(child=>child.localName==='tab-stops') ?? tabs;
    }
  };
  visit(name);
  const attrs = readOdtParagraphProperties(key => properties.get(key));
  if (tabs) {
    const list = Array.from(tabs.children).filter(child=>child.localName==='tab-stop').map(child=>{
      const raw=child.getAttribute('style:position') ?? '';
      const match=raw.match(/^(\d+(?:\.\d+)?)(pt|mm|cm|in)$/);
      const units: Record<string,number>={pt:1,mm:72/25.4,cm:72/2.54,in:72};
      const type=child.getAttribute('style:type') ?? 'left';
      const leader: Record<string,string>={'.':'dot','-':'hyphen','_':'underscore','·':'middleDot'};
      return {position:match?Number(match[1])*units[match[2]!]!:NaN,alignment:type==='char'?'decimal':type,leader:leader[child.getAttribute('style:leader-text') ?? '']??'none'};
    });
    const value=normalizeParagraphValue('omiParagraphTabs',list);
    if(value!==undefined) attrs.omiParagraphTabs=value;
  }
  return Object.keys(attrs).length ? { attrs } : {};
}

function parseMetadata(doc: XmlDocument): { title?: string; creator?: string; language?: string; abstract?: string; keywords?: string[] } {
  const root = documentElement(doc);
  const get = (name: string) => descendants(root, name)[0]?.textContent?.trim();
  const title = get('title'); const creator = get('creator'); const language = get('language'); const abstract = get('description');
  const keywords = descendants(root, 'keyword').map((node) => node.textContent?.trim() ?? '').filter(Boolean);
  return { title, creator, language, abstract, keywords };
}

function parseXml(value: string): XmlDocument {
  // ODT parts are untrusted XML. Parse into an isolated XML-only tree, reject
  // DTD/entity declarations, and never reinterpret the content as HTML or mount it.
  if (/<!DOCTYPE\b|<!ENTITY\b/i.test(value)) throw new Error('ODT XML declarations and entities are not supported.');
  const doc = new XmlParser({ onError: () => { throw new Error('The ODT package contains invalid XML.'); } }).parseFromString(value, 'application/xml');
  if (!doc.documentElement) throw new Error('The ODT package contains invalid XML.');
  return doc;
}
function documentElement(doc: XmlDocument): XmlElement {
  if (!doc.documentElement) throw new Error('The ODT package contains invalid XML.');
  return doc.documentElement;
}
function descendants(root: XmlElement, name: string): XmlElement[] { return Array.from(root.getElementsByTagNameNS('*', name)); }
function plainText(node: XmlElement): string { return node.textContent ?? ''; }
function ensureSection(sections: OmiSection[]): OmiSection {
  let current = sections.at(-1);
  if (!current) { current = { id: crypto.randomUUID(), title: '', blocks: [] }; sections.push(current); }
  return current;
}
function emptyParagraph(): OmiBlock { return { id: crypto.randomUUID(), type: 'paragraph', content: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] }) }; }
function warning(code: string, message: string): DocxImportWarning { return { code, severity: 'warning', message }; }


function safePicturePath(href: string): string | undefined {
  let path = href.trim();
  try { path = decodeURIComponent(path); } catch { return undefined; }
  if (!path.startsWith('Pictures/') || path.includes('..') || path.includes('\\') || path.includes('\0')) return undefined;
  return path;
}
function mediaTypeForPicture(path: string): string {
  const extension = path.split('.').at(-1)?.toLowerCase();
  return ({ png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp' } as Record<string, string>)[extension ?? ''] ?? 'application/octet-stream';
}
function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length)));
  return btoa(binary);
}
