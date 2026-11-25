import { tableMergeLayout, tableHeaderRows, tableRowSplitPolicy, tableCellFormat, TABLE_CELL_SIDES } from '../model/tableLayout';
import { paragraphTabs } from '../model/directParagraphFormatting';
import { odtCharacterProperties, odtParagraphProperties, odtRunHasDirectFormatting } from './odtFormatting';
import { directFormattingFromMarks } from '../model/directFormatting';
import { visualTextBoxText } from '../model/textBoxes';
import { sourceAttributionLossDiagnostics } from '../model/sourceAttributionExport';
import { officeMetadataConversion, metadataConversionWarnings, type MetadataConversionObservation } from '../model/metadataConversion';
import { publicPublicationManuscript } from '../model/publicationAnnotations';
import { extractOmiInlineRuns, semanticKindsFromMarks, inlineLanguageFromMarks, inlineSourceFontFamilyFromMarks, type OmiInlineRun } from '../model/inlineSemantics';
import { isNoteAnnotation, getNoteKind } from '../model/notes';
import { buildPublicationRenderingContext } from '../model/publicationRendering';
import { resolvePublicationProfile } from '../model/publicationProfile';
import type { OmiBlock, OmiManuscript } from '../types/omi';
import { createStoreZip, textZipEntry, type StoreZipEntry } from './simpleZip';

const MIME = 'application/vnd.oasis.opendocument.text';
export interface OdtExportResult { blob: Blob; bytes: Uint8Array; fileName: string; warnings: string[]; diagnostics: ReturnType<typeof sourceAttributionLossDiagnostics>; metadataConversion: MetadataConversionObservation[] }

/** Build a standards-shaped ODT package from the public scholarly manuscript view. */
export function buildOdtExport(source: OmiManuscript): OdtExportResult {
  const manuscript = publicPublicationManuscript(source);
  const context = buildPublicationRenderingContext(manuscript, resolvePublicationProfile(manuscript));
  const diagnostics = sourceAttributionLossDiagnostics(manuscript, 'ODT');
  const metadataConversion = officeMetadataConversion(manuscript, context);
  const warnings: string[] = [...diagnostics.map(diagnostic => diagnostic.message), ...metadataConversionWarnings(metadataConversion)];
  const notes = new Map(manuscript.annotations.filter(isNoteAnnotation).map((note) => [note.id, note]));
  const usedNotes = new Set<string>();
  const stylesRegistry = new AutomaticStyles();
  const images: Array<{ path: string; bytes: Uint8Array; mediaType: string }> = [];
  const body = [
    `<text:p text:style-name="OMITitle">${escape(context.title)}</text:p>`,
    ...(context.subtitle ? [`<text:p text:style-name="OMISubtitle">${escape(context.subtitle)}</text:p>`] : []),
    ...(context.contributors.length ? [`<text:p text:style-name="OMIAuthor">${context.contributors.map((person) => escape(person.displayName)).join(', ')}</text:p>`] : []),
    ...(context.abstract ? [`<text:h text:outline-level="1">${escape(label(context.locale, 'abstract'))}</text:h>`, `<text:p>${escape(context.abstract)}</text:p>`] : []),
    ...(context.keywords.length ? [`<text:p><text:span text:style-name="OMIStrong">${escape(label(context.locale, 'keywords'))}: </text:span>${context.keywords.map(escape).join('; ')}</text:p>`] : []),
    ...context.sections.flatMap((section) => renderSection(section, notes, usedNotes, warnings, images, stylesRegistry)),
  ].join('');

  const content = `<?xml version="1.0" encoding="UTF-8"?>\n<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" office:version="1.3"><office:automatic-styles>${stylesRegistry.xml()}</office:automatic-styles><office:body><office:text text:use-soft-page-breaks="true">${body}</office:text></office:body></office:document-content>`;
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
  return { bytes, blob: new Blob([copy.buffer], { type: MIME }), fileName: `${fileStem(manuscript)}.odt`, warnings, diagnostics, metadataConversion };
}

function renderSection(section: ReturnType<typeof buildPublicationRenderingContext>['sections'][number], notes: Map<string, OmiManuscript['annotations'][number]>, usedNotes: Set<string>, warnings: string[], images: Array<{ path: string; bytes: Uint8Array; mediaType: string }>, stylesRegistry: AutomaticStyles): string[] {
  const level = Math.min(6, Math.max(1, section.depth + 1));
  const heading = section.number ? `${section.number} ${section.title}` : section.title;
  return [
    ...(section.title.trim() ? [`<text:h text:style-name="OMIHeading${level}" text:outline-level="${level}">${escape(heading)}</text:h>`] : []),
    ...section.blocks.map((block) => renderBlock(block, notes, usedNotes, warnings, images, stylesRegistry)),
    ...section.children.flatMap((child) => renderSection(child, notes, usedNotes, warnings, images, stylesRegistry)),
  ];
}

function renderBlock(block: OmiBlock, notes: Map<string, OmiManuscript['annotations'][number]>, usedNotes: Set<string>, warnings: string[], images: Array<{ path: string; bytes: Uint8Array; mediaType: string }>, stylesRegistry: AutomaticStyles): string {
  if (block.visual?.kind === 'text-box') {
    warnings.push(`Text box ${block.id} is preserved as semantic text; graphical placement is unsupported in ODT.`);
    return `<text:p>${escape(visualTextBoxText(block.visual))}</text:p>`;
  }
  if (block.visual?.kind === 'image') {
    if (block.visual.textBoxes?.length) warnings.push(`Image annotations on ${block.id} are preserved as text after the image in ODT.`);
    const match = /^data:(image\/(?:png|jpeg|gif|svg\+xml|webp));base64,([A-Za-z0-9+/=\s]+)$/i.exec(block.visual.src.trim());
    if (match) {
      try {
        const mediaType = match[1]!.toLowerCase();
        const extension = ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'image/webp': 'webp' } as Record<string, string>)[mediaType]!;
        const path = `Pictures/image-${images.length + 1}.${extension}`;
        const binary = atob(match[2]!.replace(/\s/g, ''));
        const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
        images.push({ path, bytes, mediaType });
        return `<text:p><draw:frame draw:name="${path.split('/').at(-1)}" text:anchor-type="as-char" svg:width="5in"><draw:image xlink:href="${path}" xlink:type="simple"/></draw:frame>${block.visual.alt ? `<text:span>${escape(block.visual.alt)}</text:span>` : ''}</text:p>${visualTextBoxText(block.visual) ? `<text:p>${escape(visualTextBoxText(block.visual))}</text:p>` : ''}`;
      } catch { /* fall through to a visible placeholder */ }
    }
    warnings.push(`Image ${block.id} is not embedded in the ODT because it is not a supported local data URI.`);
    return `<text:p>[Image${block.visual.alt ? `: ${escape(block.visual.alt)}` : ''}] ${escape(visualTextBoxText(block.visual))}</text:p>`;
  }
  if (block.visual?.kind === 'table') {
    const headerRows=tableHeaderRows(block.visual.cells,block.visual.headerRows);
    const layout=tableMergeLayout(block.visual.cells,block.visual.cellMerges,headerRows);
    const table=block.visual;
    const rows=table.cells.map((row,r)=>'<table:table-row table:style-name="'+stylesRegistry.tableRow(tableRowSplitPolicy(table,r))+'">'+row.map((cell,c)=>{
      if(layout.covered(r,c)) return '<table:covered-table-cell/>';
      const m=layout.at(r,c);
      const format=tableCellFormat(table.cellFormats,r,c);
      const cellStyle=stylesRegistry.tableCell(format);
      const paraStyle=stylesRegistry.cellParagraph(format.horizontalAlign);
      return '<table:table-cell office:value-type="string"'+(cellStyle?' table:style-name="'+cellStyle+'"':'')+(m&&m.rowSpan>1?' table:number-rows-spanned="'+m.rowSpan+'"':'')+(m&&m.colSpan>1?' table:number-columns-spanned="'+m.colSpan+'"':'')+'>'+cell.split(/\r\n?|\n/).map(line=>'<text:p'+(paraStyle?' text:style-name="'+paraStyle+'"':'')+'>'+escape(line)+'</text:p>').join('')+'</table:table-cell>';
    }).join('')+'</table:table-row>');
    const head=headerRows?'<table:table-header-rows>'+rows.slice(0,headerRows).join('')+'</table:table-header-rows>':'';
    return `<table:table table:name="OMITable${safeId(block.id)}">${head}${rows.slice(headerRows).join('')}</table:table>`;
  }
  if (block.visual) {
    const caption = 'caption' in block.visual ? block.visual.caption : undefined;
    warnings.push(`Structured ${block.visual.kind} object ${block.id} was exported as descriptive text in ODT.`);
    return `<text:p>[${escape(block.visual.kind)}${caption ? `: ${escape(caption)}` : ''}]</text:p>`;
  }
  try {
    const document = JSON.parse(block.content) as OdtJsonNode;
    if ((document.content ?? []).some((node) => node.type === 'bulletList' || node.type === 'orderedList')) {
      return (document.content ?? []).map((node) => renderOdtNode(node, notes, usedNotes, stylesRegistry)).join('');
    }
  } catch { /* legacy plain-text blocks use the regular inline renderer */ }
  const runs = extractOmiInlineRuns(block.content);
  if (!runs.length) return '';
  if (runs.some(run => {
    const d = run.directFormatting;
    return d?.omiLigatures !== undefined
      || (d?.omiBaseline !== undefined && (d.omiFontSize === undefined || run.semantics.includes('superscript') || run.semantics.includes('subscript')))
      || (d?.omiKerning !== undefined && d.omiKerning !== 0)
      || (d?.omiHighlight && d.omiCharacterBackground);
  })) warnings.push(`Some direct typography in block ${block.id} has no exact ODT mapping; review in the target editor.`);
  let attrs: Record<string, unknown> | undefined;
  try { const root = JSON.parse(block.content) as OdtJsonNode; attrs = (root.type === 'paragraph' ? root : root.content?.[0])?.attrs; } catch { /* Plain text. */ }
  const style = stylesRegistry.paragraph(attrs);
  return `<text:p${style ? ` text:style-name="${style}"` : ''}>${runs.map((run) => renderRun(run, notes, usedNotes, stylesRegistry)).join('')}</text:p>`;
}

interface OdtJsonNode { type?: string; text?: string; attrs?: Record<string, unknown>; marks?: Array<{ type?: string; attrs?: Record<string, unknown> }>; content?: OdtJsonNode[] }
function renderOdtNode(node: OdtJsonNode, notes: Map<string, OmiManuscript['annotations'][number]>, usedNotes: Set<string>, stylesRegistry: AutomaticStyles): string {
  if (node.type === 'text') {
    const run: OmiInlineRun = { text: node.text ?? '', semantics: semanticKindsFromMarks(node.marks), language: inlineLanguageFromMarks(node.marks), sourceFontFamily: inlineSourceFontFamilyFromMarks(node.marks), directFormatting: directFormattingFromMarks(node.marks) };
    const href = node.marks?.find((mark) => mark.type === 'omiLink' || mark.type === 'link')?.attrs?.href;
    if (typeof href === 'string') run.link = href;
    return renderRun(run, notes, usedNotes, stylesRegistry);
  }
  if (node.type === 'omiCitation' || node.type === 'omiCrossReference') return typeof node.attrs?.label === 'string' ? escape(node.attrs.label) : '';
  if (node.type === 'hardBreak') return '<text:line-break/>';
  if (node.type === 'omiTab') return '<text:tab/>';
  if (node.type === 'omiNote') {
    const noteId = node.attrs?.noteId;
    return typeof noteId === 'string' ? renderRun({ text: '', semantics: [], noteId }, notes, usedNotes, stylesRegistry) : '';
  }
  const children = (node.content ?? []).map((child) => renderOdtNode(child, notes, usedNotes, stylesRegistry)).join('');
  if (node.type === 'bulletList' || node.type === 'orderedList') return `<text:list text:style-name="${node.type === 'orderedList' ? 'OMINumbers' : 'OMIBullets'}">${children}</text:list>`;
  if (node.type === 'listItem') return `<text:list-item>${children}</text:list-item>`;
  if (node.type === 'paragraph') {
    const style = stylesRegistry.paragraph(node.attrs);
    return `<text:p${style ? ` text:style-name="${style}"` : ''}>${children}</text:p>`;
  }
  if (node.type === 'blockquote') return `<text:p text:style-name="OMIQuote">${children}</text:p>`;
  return children;
}

function renderRun(run: OmiInlineRun, notes: Map<string, OmiManuscript['annotations'][number]>, usedNotes: Set<string>, stylesRegistry: AutomaticStyles): string {
  let value = escape(run.text);
  if (run.noteId) {
    const note = notes.get(run.noteId);
    if (note) {
      usedNotes.add(note.id);
      const noteClass = getNoteKind(note) === 'endnote' ? 'endnote' : 'footnote';
      let body = `<text:p>${escape(note.body)}</text:p>`;
      if (note.bodyContent) {
        try { body = (JSON.parse(note.bodyContent) as OdtJsonNode).content?.map(node => renderOdtNode(node, new Map(), usedNotes, stylesRegistry)).join('') || body; } catch { /* Preserve plain note fallback. */ }
      }
      value += `<text:note text:note-class="${noteClass}" text:id="${safeId(note.id)}"><text:note-citation/><text:note-body>${body}</text:note-body></text:note>`;
    }
  }
  const style = stylesRegistry.character(run);
  if (style) value = `<text:span text:style-name="${style}">${value}</text:span>`;
  if (run.link && /^(https?:|mailto:)/i.test(run.link)) value = `<text:a xlink:type="simple" xlink:href="${escape(run.link)}">${value}</text:a>`;
  return value.replace(/\n/g, '<text:line-break/>').replace(/\t/g, '<text:tab/>');
}


/** Per-export style registry; no shared mutable state or arbitrary XML. */
class AutomaticStyles {
  private readonly definitions = new Map<string, { name: string; family: 'text' | 'paragraph' | 'table-row' | 'table-cell'; properties: Record<string, string>; children: string }>();
  private register(family: 'text' | 'paragraph' | 'table-row' | 'table-cell', properties: Record<string, string>, prefix: string, children = ''): string | undefined {
    if (!Object.keys(properties).length && !children) return undefined;
    const key = JSON.stringify([family, prefix, children, Object.entries(properties).sort(([a], [b]) => a.localeCompare(b))]);
    const existing = this.definitions.get(key);
    if (existing) return existing.name;
    const name = prefix + (this.definitions.size + 1);
    this.definitions.set(key, { name, family, properties, children });
    return name;
  }
  character(run: OmiInlineRun): string | undefined {
    const staticNames: Record<string, string> = { strong:'OMIStrong', emphasis:'OMIEmphasis', underline:'OMIUnderline', strike:'OMIStrike' };
    if (run.semantics.length === 1 && !run.language && !run.sourceFontFamily && !odtRunHasDirectFormatting(run)) {
      const name = staticNames[run.semantics[0]!];
      if (name) return name;
    }
    return this.register('text', odtCharacterProperties(run), run.directFormatting?.omiHighlight ? 'OMIHighlight' : 'OMIChar');
  }
  paragraph(attrs: Record<string, unknown> | undefined): string | undefined {
    const tabs = paragraphTabs(attrs).filter(t=>t.alignment!=='clear');
    const leader: Record<string,string> = {dot:'.',hyphen:'-',underscore:'_',middleDot:'·',heavy:'_'};
    const content = tabs.map(t=>'<style:tab-stop style:position="'+t.position+'pt" style:type="'+(t.alignment==='decimal'?'char':t.alignment)+'"'+(t.alignment==='decimal'?' style:char="."':'')+(t.leader==='none'?'':' style:leader-style="solid" style:leader-text="'+leader[t.leader]+'"')+'/>').join('');
    return this.register('paragraph', odtParagraphProperties(attrs), 'OMIPara', content?'<style:tab-stops>'+content+'</style:tab-stops>':'');
  }
  tableCell(format: ReturnType<typeof tableCellFormat>): string | undefined {
    const props: Record<string,string>={...(format.verticalAlign?{'style:vertical-align':format.verticalAlign}:{}),...(format.backgroundColor?{'fo:background-color':format.backgroundColor}:{})};
    for(const side of TABLE_CELL_SIDES){
      const edge=format.borders?.[side];
      if(edge) props['fo:border-'+side]=edge.style==='none'?'none':edge.widthPt+'pt '+edge.style+' '+edge.color;
      const padding=format.paddingPt?.[side];
      if(padding!==undefined) props['fo:padding-'+side]=padding+'pt';
    }
    return this.register('table-cell',props,'OMICell');
  }
  cellParagraph(horizontal: string | undefined): string | undefined {
    return this.register('paragraph',horizontal?{'fo:text-align':horizontal}:{},'OMICellPara');
  }
  tableRow(policy: 'keep' | 'allow'): string {
    return this.register('table-row', {'fo:keep-together':policy==='keep'?'always':'auto'}, 'OMIRow')!;
  }
  xml(): string {
    return [...this.definitions.values()].map(({ name, family, properties, children }) => {
      const tag = family === 'text' ? 'style:text-properties' : family==='table-row' ? 'style:table-row-properties' : family==='table-cell' ? 'style:table-cell-properties' : 'style:paragraph-properties';
      const attributes = Object.entries(properties).map(([key, value]) => ' ' + key + '="' + escape(value) + '"').join('');
      return '<style:style style:name="' + name + '" style:family="' + family + '"><' + tag + attributes + (children ? '>' + children + '</' + tag + '>' : '/>') + '</style:style>';
    }).join('');
  }
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
