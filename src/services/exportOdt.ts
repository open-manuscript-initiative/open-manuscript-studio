import { sourceAttributionLossDiagnostics } from '../model/sourceAttributionExport';
import { publicPublicationManuscript } from '../model/publicationAnnotations';
import { extractOmiInlineRuns, semanticKindsFromMarks, type OmiInlineRun } from '../model/inlineSemantics';
import { isNoteAnnotation, getNoteKind } from '../model/notes';
import { buildPublicationRenderingContext } from '../model/publicationRendering';
import { resolvePublicationProfile } from '../model/publicationProfile';
import type { OmiBlock, OmiManuscript } from '../types/omi';
import { createStoreZip, textZipEntry, type StoreZipEntry } from './simpleZip';

const MIME = 'application/vnd.oasis.opendocument.text';
export interface OdtExportResult { blob: Blob; bytes: Uint8Array; fileName: string; warnings: string[]; diagnostics: ReturnType<typeof sourceAttributionLossDiagnostics> }

/** Build a standards-shaped ODT package from the public scholarly manuscript view. */
export function buildOdtExport(source: OmiManuscript): OdtExportResult {
  const manuscript = publicPublicationManuscript(source);
  const context = buildPublicationRenderingContext(manuscript, resolvePublicationProfile(manuscript));
  const diagnostics = sourceAttributionLossDiagnostics(manuscript, 'ODT');
  const warnings: string[] = diagnostics.map(diagnostic => diagnostic.message);
  const notes = new Map(manuscript.annotations.filter(isNoteAnnotation).map((note) => [note.id, note]));
  const usedNotes = new Set<string>();
  const images: Array<{ path: string; bytes: Uint8Array; mediaType: string }> = [];
  const body = [
    `<text:p text:style-name="OMITitle">${escape(context.title)}</text:p>`,
    ...(context.subtitle ? [`<text:p text:style-name="OMISubtitle">${escape(context.subtitle)}</text:p>`] : []),
    ...(context.contributors.length ? [`<text:p text:style-name="OMIAuthor">${context.contributors.map((person) => escape(person.displayName)).join(', ')}</text:p>`] : []),
    ...(context.abstract ? [`<text:h text:outline-level="1">${escape(label(context.locale, 'abstract'))}</text:h>`, `<text:p>${escape(context.abstract)}</text:p>`] : []),
    ...(context.keywords.length ? [`<text:p><text:span text:style-name="OMIStrong">${escape(label(context.locale, 'keywords'))}: </text:span>${context.keywords.map(escape).join('; ')}</text:p>`] : []),
    ...context.sections.flatMap((section) => renderSection(section, notes, usedNotes, warnings, images)),
  ].join('');

  const content = `<?xml version="1.0" encoding="UTF-8"?>\n<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" office:version="1.3"><office:automatic-styles/><office:body><office:text text:use-soft-page-breaks="true">${body}</office:text></office:body></office:document-content>`;
  const styles = `<?xml version="1.0" encoding="UTF-8"?><office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" office:version="1.3"><office:styles><style:default-style style:family="paragraph"><style:paragraph-properties fo:margin-bottom="0.16in"/><style:text-properties style:font-name="Liberation Serif" fo:font-size="12pt"/></style:default-style>${paragraphStyle('OMITitle', 1, '22pt', true)}${paragraphStyle('OMISubtitle', 2, '14pt', false)}${paragraphStyle('OMIAuthor', 2, '11pt', false)}${[1,2,3,4,5,6].map((level) => paragraphStyle(`OMIHeading${level}`, level, `${Math.max(12, 18 - level)}pt`, true)).join('')}<text:list-style style:name="OMIBullets"><text:list-level-style-bullet text:level="1" text:bullet-char="•"/></text:list-style><text:list-style style:name="OMINumbers"><text:list-level-style-number text:level="1" style:num-format="1"/></text:list-style><style:style style:name="OMIStrong" style:family="text"><style:text-properties fo:font-weight="bold"/></style:style><style:style style:name="OMIEmphasis" style:family="text"><style:text-properties fo:font-style="italic"/></style:style><style:style style:name="OMIUnderline" style:family="text"><style:text-properties style:text-underline-style="solid"/></style:style><style:style style:name="OMIStrike" style:family="text"><style:text-properties style:text-line-through-style="solid"/></style:style></office:styles></office:document-styles>`;
  const metadata = `<?xml version="1.0" encoding="UTF-8"?><office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" office:version="1.3"><office:meta><dc:title>${escape(context.title)}</dc:title><dc:language>${escape(context.locale || 'en')}</dc:language><meta:generator>Open Manuscript Studio</meta:generator>${context.contributors.map((person) => `<dc:creator>${escape(person.displayName)}</dc:creator>`).join('')}${context.keywords.map((keyword) => `<meta:keyword>${escape(keyword)}</meta:keyword>`).join('')}${context.abstract ? `<dc:description>${escape(context.abstract)}</dc:description>` : ''}</office:meta></office:document-meta>`;
  const manifest = `<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3"><manifest:file-entry manifest:full-path="/" manifest:media-type="${MIME}"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>${images.map((image) => `<manifest:file-entry manifest:full-path="${image.path}" manifest:media-type="${image.mediaType}"/>`).join('')}</manifest:manifest>`;
  const entries: StoreZipEntry[] = [
    textZipEntry('mimetype', MIME),
    textZipEntry('META-INF/manifest.xml', manifest),
    textZipEntry('content.xml', content),
    textZipEntry('styles.xml', styles),
    textZipEntry('meta.xml', metadata),
    ...images.map((image) => ({ name: image.path, bytes: image.bytes })),
  ];
  const bytes = createStoreZip(entries);
  const copy = bytes.slice();
  return { bytes, blob: new Blob([copy.buffer], { type: MIME }), fileName: `${fileStem(manuscript)}.odt`, warnings, diagnostics };
}

function renderSection(section: ReturnType<typeof buildPublicationRenderingContext>['sections'][number], notes: Map<string, OmiManuscript['annotations'][number]>, usedNotes: Set<string>, warnings: string[], images: Array<{ path: string; bytes: Uint8Array; mediaType: string }>): string[] {
  const level = Math.min(6, Math.max(1, section.depth + 1));
  const heading = section.number ? `${section.number} ${section.title}` : section.title;
  return [
    `<text:h text:style-name="OMIHeading${level}" text:outline-level="${level}">${escape(heading)}</text:h>`,
    ...section.blocks.map((block) => renderBlock(block, notes, usedNotes, warnings, images)),
    ...section.children.flatMap((child) => renderSection(child, notes, usedNotes, warnings, images)),
  ];
}

function renderBlock(block: OmiBlock, notes: Map<string, OmiManuscript['annotations'][number]>, usedNotes: Set<string>, warnings: string[], images: Array<{ path: string; bytes: Uint8Array; mediaType: string }>): string {
  if (block.visual?.kind === 'image') {
    const match = /^data:(image\/(?:png|jpeg|gif|svg\+xml|webp));base64,([A-Za-z0-9+/=\s]+)$/i.exec(block.visual.src.trim());
    if (match) {
      try {
        const mediaType = match[1]!.toLowerCase();
        const extension = ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'image/webp': 'webp' } as Record<string, string>)[mediaType]!;
        const path = `Pictures/image-${images.length + 1}.${extension}`;
        const binary = atob(match[2]!.replace(/\s/g, ''));
        const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
        images.push({ path, bytes, mediaType });
        return `<text:p><draw:frame draw:name="${path.split('/').at(-1)}" text:anchor-type="as-char" svg:width="5in"><draw:image xlink:href="${path}" xlink:type="simple"/></draw:frame>${block.visual.alt ? `<text:span>${escape(block.visual.alt)}</text:span>` : ''}</text:p>`;
      } catch { /* fall through to a visible placeholder */ }
    }
    warnings.push(`Image ${block.id} is not embedded in the ODT because it is not a supported local data URI.`);
    return `<text:p>[Image${block.visual.alt ? `: ${escape(block.visual.alt)}` : ''}]</text:p>`;
  }
  if (block.visual?.kind === 'table') {
    const rows = block.visual.cells.map((row) => `<table:table-row>${row.map((cell) => `<table:table-cell office:value-type="string"><text:p>${escape(cell)}</text:p></table:table-cell>`).join('')}</table:table-row>`).join('');
    return `<table:table table:name="OMITable${safeId(block.id)}">${rows}</table:table>`;
  }
  if (block.visual) {
    const caption = 'caption' in block.visual ? block.visual.caption : undefined;
    warnings.push(`Structured ${block.visual.kind} object ${block.id} was exported as descriptive text in ODT.`);
    return `<text:p>[${escape(block.visual.kind)}${caption ? `: ${escape(caption)}` : ''}]</text:p>`;
  }
  try {
    const document = JSON.parse(block.content) as OdtJsonNode;
    if ((document.content ?? []).some((node) => node.type === 'bulletList' || node.type === 'orderedList')) {
      return (document.content ?? []).map((node) => renderOdtNode(node, notes, usedNotes)).join('');
    }
  } catch { /* legacy plain-text blocks use the regular inline renderer */ }
  const runs = extractOmiInlineRuns(block.content);
  if (!runs.length) return '';
  return `<text:p>${runs.map((run) => renderRun(run, notes, usedNotes)).join('')}</text:p>`;
}

interface OdtJsonNode { type?: string; text?: string; attrs?: Record<string, unknown>; marks?: Array<{ type?: string; attrs?: Record<string, unknown> }>; content?: OdtJsonNode[] }
function renderOdtNode(node: OdtJsonNode, notes: Map<string, OmiManuscript['annotations'][number]>, usedNotes: Set<string>): string {
  if (node.type === 'text') {
    const run: OmiInlineRun = { text: node.text ?? '', semantics: semanticKindsFromMarks(node.marks) };
    const href = node.marks?.find((mark) => mark.type === 'omiLink' || mark.type === 'link')?.attrs?.href;
    if (typeof href === 'string') run.link = href;
    return renderRun(run, notes, usedNotes);
  }
  if (node.type === 'hardBreak') return '<text:line-break/>';
  if (node.type === 'omiTab') return '<text:tab/>';
  if (node.type === 'omiNote') {
    const noteId = node.attrs?.noteId;
    return typeof noteId === 'string' ? renderRun({ text: '', semantics: [], noteId }, notes, usedNotes) : '';
  }
  const children = (node.content ?? []).map((child) => renderOdtNode(child, notes, usedNotes)).join('');
  if (node.type === 'bulletList' || node.type === 'orderedList') return `<text:list text:style-name="${node.type === 'orderedList' ? 'OMINumbers' : 'OMIBullets'}">${children}</text:list>`;
  if (node.type === 'listItem') return `<text:list-item>${children}</text:list-item>`;
  if (node.type === 'paragraph') return `<text:p>${children}</text:p>`;
  if (node.type === 'blockquote') return `<text:p text:style-name="OMIQuote">${children}</text:p>`;
  return children;
}

function renderRun(run: OmiInlineRun, notes: Map<string, OmiManuscript['annotations'][number]>, usedNotes: Set<string>): string {
  let value = escape(run.text);
  if (run.noteId) {
    const note = notes.get(run.noteId);
    if (note) {
      usedNotes.add(note.id);
      const noteClass = getNoteKind(note) === 'endnote' ? 'endnote' : 'footnote';
      const body = escape(note.body);
      value += `<text:note text:note-class="${noteClass}" text:id="${safeId(note.id)}"><text:note-citation/><text:note-body><text:p>${body}</text:p></text:note-body></text:note>`;
    }
  }
  const style = (run.semantics ?? []).map((semantic) => ({ strong: 'OMIStrong', emphasis: 'OMIEmphasis', underline: 'OMIUnderline', strike: 'OMIStrike' } as Record<string, string>)[semantic]).filter(Boolean).at(-1);
  if (style) value = `<text:span text:style-name="${style}">${value}</text:span>`;
  if (run.link && /^(https?:|mailto:)/i.test(run.link)) value = `<text:a xlink:type="simple" xlink:href="${escape(run.link)}">${value}</text:a>`;
  return value.replace(/\n/g, '<text:line-break/>').replace(/\t/g, '<text:tab/>');
}

function paragraphStyle(name: string, outline: number, size: string, bold: boolean): string {
  return `<style:style style:name="${name}" style:family="paragraph"><style:paragraph-properties${outline ? ` fo:margin-top="0.18in"` : ''}/><style:text-properties fo:font-size="${size}"${bold ? ' fo:font-weight="bold"' : ''}/></style:style>`;
}
function label(locale: string, key: 'abstract' | 'keywords'): string {
  const lang = locale.toLowerCase().split(/[-_]/)[0];
  if (lang === 'hu') return key === 'abstract' ? 'Absztrakt' : 'Kulcsszavak';
  if (lang === 'de') return key === 'abstract' ? 'Zusammenfassung' : 'Schlüsselwörter';
  return key === 'abstract' ? 'Abstract' : 'Keywords';
}
function escape(value: string): string { return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;'); }
function safeId(value: string): string { return value.replace(/[^A-Za-z0-9_.-]/g, '_'); }
function fileStem(manuscript: Pick<OmiManuscript, 'title' | 'id'>): string { return manuscript.title.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 72) || manuscript.id || 'manuscript'; }
