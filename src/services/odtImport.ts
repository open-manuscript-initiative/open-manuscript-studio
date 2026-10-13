import { OdtZip } from './odtZip';
import { DOMParser as XmlParser, type Document as XmlDocument, type Element as XmlElement, type Node as XmlNode } from '@xmldom/xmldom';
import { materializeSectionHeadingBlocks } from '../model/atomicTextBlocks';
import { createNoteAnnotation } from '../model/notes';
import { createImageBlock, createTableBlock } from '../model/visualBlocks';
import { normalizeInlineLanguageTag } from '../model/richText';
import { withParentSectionId } from '../model/sectionStructure';
import type { OmiAnnotation, OmiBlock, OmiImportProvenance, OmiSection } from '../types/omi';
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
  for (const part of ['styles.xml', 'content.xml']) if (zip.has(part)) {
    const styleDoc = part === 'content.xml' ? contentDoc : parseXml(await zip.text(part));
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
      const rows = Array.from(child.getElementsByTagNameNS('*', 'table-row')).map((row) =>
        Array.from(row.children).filter((cell) => cell.localName === 'table-cell' || cell.localName === 'covered-table-cell')
          .map((cell) => plainText(cell).trim()),
      ).filter((row) => row.length > 0);
      if (rows.length) { ensureSection(sections).blocks.push(createTableBlock(rows, { provenance })); stats.tables += 1; }
      frontMatter = false;
      continue;
    }
    if (child.localName === 'list') {
      const blockId = crypto.randomUUID();
      const ordered = listStyleTypes.get(child.getAttribute('text:style-name') ?? '') ?? false;
      const nodes = parseOdtList(child, ordered, blockId, annotations, stats, provenance, warnings, listStyleTypes);
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
    const inline = parseInlineChildren(child, blockId, annotations, stats, provenance, warnings);
    if (inline.length) {
      section.blocks.push({ id: blockId, type: 'paragraph', content: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: inline }] }) });
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
  if (sections.length === 0) sections.push({ id: crypto.randomUUID(), title: 'Imported content', blocks: [] });
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

function parseInlineChildren(root: XmlElement, blockId: string, annotations: OmiAnnotation[], stats: ReturnType<typeof createEmptyDocxImportStats>, provenance: OmiImportProvenance, warnings: DocxImportWarning[]): Array<Record<string, unknown>> {
  const output: Array<Record<string, unknown>> = [];
  const visit = (node: XmlNode, marks: Array<{ type: string; attrs?: Record<string, unknown> }> = []): void => {
    if (node.nodeType === 3) { if (node.nodeValue) output.push({ type: 'text', text: node.nodeValue, ...(marks.length ? { marks } : {}) }); return; }
    if (node.nodeType !== 1) return;
    const element = node as XmlElement;
    const next = [...marks];
    if (element.localName === 'span') {
      const style = (element.getAttribute('text:style-name') ?? '').toLowerCase();
      if (/bold|strong|félkövér/.test(style)) next.push({ type: 'bold' });
      if (/italic|emphasis|dőlt/.test(style)) next.push({ type: 'italic' });
      if (/underline/.test(style)) next.push({ type: 'omiUnderline' });
      if (/strike/.test(style)) next.push({ type: 'strike' });
    }
    if (element.localName === 'a') {
      const href = element.getAttribute('xlink:href') ?? '';
      if (/^(https?:|mailto:|#)/i.test(href)) next.push({ type: 'link', attrs: { href } });
    }
    if (element.localName === 'line-break') { output.push({ type: 'hardBreak' }); return; }
    if (element.localName === 'tab') { output.push({ type: 'omiTab' }); return; }
    if (element.localName === 'note') {
      const noteId = crypto.randomUUID();
      const anchorId = crypto.randomUUID();
      const body = element.getElementsByTagNameNS('*', 'note-body').item(0);
      const bodyText = body ? plainText(body).trim() : '';
      const kind = element.getAttribute('text:note-class') === 'endnote' ? 'endnote' : 'footnote';
      annotations.push(createNoteAnnotation({ id: noteId, anchorId, targetBlockId: blockId, kind, body: bodyText }));
      output.push({ type: 'omiNote', attrs: { noteId, anchorId, label: String(annotations.length), noteType: kind } });
      stats.notes += 1;
      return;
    }
    for (const child of Array.from(element.childNodes)) visit(child, next);
  };
  for (const child of Array.from(root.childNodes)) visit(child);
  void provenance; void warnings;
  return output;
}

function parseOdtList(root: XmlElement, ordered: boolean, blockId: string, annotations: OmiAnnotation[], stats: ReturnType<typeof createEmptyDocxImportStats>, provenance: OmiImportProvenance, warnings: DocxImportWarning[], listStyleTypes: Map<string, boolean>): Array<Record<string, unknown>> {
  const listItems = Array.from(root.children).filter((node) => node.localName === 'list-item' || node.localName === 'list-header');
  if (!listItems.length) return [];
  return [{
    type: ordered ? 'orderedList' : 'bulletList',
    content: listItems.map((item) => ({
      type: 'listItem',
      content: Array.from(item.children).flatMap((child) => {
        if (child.localName === 'p' || child.localName === 'h') return [{ type: 'paragraph', content: parseInlineChildren(child, blockId, annotations, stats, provenance, warnings) }];
        if (child.localName === 'list') {
          const styleName = child.getAttribute('text:style-name') ?? '';
          return parseOdtList(child, listStyleTypes.get(styleName) ?? false, blockId, annotations, stats, provenance, warnings, listStyleTypes);
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
  if (!current) { current = { id: crypto.randomUUID(), title: 'Imported content', blocks: [] }; sections.push(current); }
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
