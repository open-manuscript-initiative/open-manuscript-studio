import { tableCellFormat, tableColumnWidths, tableHeaderRows, tableMergeLayout, tableRowSplitPolicy, tableRowHeight, tableCellDocument, effectiveCellParagraphAttrs, cellDocumentWithDefaults, cellNestedTable } from '../model/tableLayout';
import { normalizeListAttribute } from '../model/directListFormatting';
import { SourceWordStyleRegistry } from './sourceWordStyleExport';
import { resolveSourceStyle } from '../model/sourceWordStyles';
import { WORD_HYPHENATION_EXTENSION, wordHyphenationSettingsXml } from '../model/wordHyphenation';
import { getDocumentStructureProfile } from '../model/documentProfile';
import { getAppliedPublicationTemplate } from '../model/publicationTemplates';
import { resolvePublicationParagraphStyle } from './publicationStyleExport';
import { paragraphFormattingWordXml } from '../model/directParagraphFormatting';
import { directFormattingFromMarks, directFormattingWordXml } from '../model/directFormatting';
import { visualTextBoxText } from '../model/textBoxes';
import { publicationSemanticLossDiagnostics, semanticLossWarnings, type PublicationSemanticLoss } from '../model/publicationSemanticLoss';
import { publicPublicationManuscript } from '../model/publicationAnnotations';
import { officeMetadataConversion, metadataConversionWarnings, type MetadataConversionObservation } from '../model/metadataConversion';
import {
  extractOmiInlineRuns,
  inlineLanguageFromMarks,
  inlineSourceFontFamilyFromMarks,
  inlineSourceWordStyle,
  semanticKindsFromMarks,
  type OmiInlineRun,
  type OmiInlineSemanticKind,
} from '../model/inlineSemantics';
import type { OmiIndexEntry } from '../model/indexing';
import { getNoteKind, getNoteCustomMark, isNoteAnnotation } from '../model/notes';
import { getManuscriptFundingStatement } from '../model/semanticFields';
import { createNoteBodyDocument, type NoteJsonNode } from '../model/noteRichText';
import { contributorNameParts } from '../model/contributorName';
import { buildPublicationRenderingContext, type OmiRenderedContributor } from '../model/publicationRendering';
import { resolvePublicationProfile } from '../model/publicationProfile';
import type { OmiBlock, OmiManuscript, OmiTableBlockData } from '../types/omi';
import { createStoreZip, textZipEntry } from './simpleZip';

export interface DocxExportResult {
  blob: Blob;
  bytes: Uint8Array;
  fileName: string;
  semanticLosses: PublicationSemanticLoss[];
  warnings: string[];
  metadataConversion: MetadataConversionObservation[];
}

/**
 * Produces a portable WordprocessingML DOCX from the shared publication view.
 * Headings use real Word Heading styles and inline OMI semantics use named
 * Word character styles instead of direct font formatting.
 *
 * OMI index markers remain semantic during editing. DOCX export writes real XE
 * fields at their target paragraphs plus a generated INDEX field. Word can then
 * calculate and deduplicate page numbers from the final pagination.
 */
export function buildDocxExport(manuscript: OmiManuscript): DocxExportResult {
  manuscript = publicPublicationManuscript(manuscript, { preserveHiddenText: true });
  const profile = resolvePublicationProfile(manuscript);
  const context = buildPublicationRenderingContext(manuscript, profile);
  const metadataConversion = officeMetadataConversion(manuscript, context);
  const semanticLosses = publicationSemanticLossDiagnostics(manuscript, 'DOCX');
  const warnings: string[] = [...metadataConversionWarnings(metadataConversion), ...semanticLossWarnings(semanticLosses)];
  if (JSON.stringify(manuscript).includes('omiHiddenText')) warnings.push('Editable DOCX preserves hidden text. Hidden formatting is not redaction; do not distribute this file as a redacted document.');
  const body: string[] = [];
  const sourceStyles = new SourceWordStyleRegistry();
  const numbering = new WordListNumbering();
  const fundingStatement = profile.rules.notes.fundingStarNote
    ? getManuscriptFundingStatement(manuscript)
    : '';
  const localNoteLayout = profile.rules.notes.localNotePlacement ?? 'inline';
  const indexEntriesByBlock = collectIndexEntriesByBlock(manuscript.indexEntries ?? []);
  const annotationsById = new Map(
    manuscript.annotations.filter(isNoteAnnotation).map((annotation) => [annotation.id, annotation]),
  );
  const footnotes: WordNoteBody[] = [];
  const endnotes: WordNoteBody[] = [];
  const publicationStyle=getAppliedPublicationTemplate(manuscript)?.style;
  const continueFootnotes=publicationStyle?resolvePublicationParagraphStyle(publicationStyle,publicationStyle.paragraphStyles.items.find(item=>item.role==='note')?.id).footnoteContinueOnNextPage!==false: true;
  const noteReferenceIds = { footnote: new Map<string, number>(), endnote: new Map<string, number>() };
  const referencedNoteIds = new Set<string>();

  body.push(paragraph(context.title, 'Title'));
  if (context.subtitle) body.push(paragraph(context.subtitle, 'Subtitle'));
  if (context.contributors.length) {
    body.push(authorParagraph(context.contributors));
  }
  if (context.abstract) {
    body.push(paragraph(localizedLabel(context.locale, 'abstract'), 'Heading1'));
    body.push(paragraph(context.abstract));
  }
  if (context.keywords.length) {
    body.push(paragraph(`${localizedLabel(context.locale, 'keywords')}: ${context.keywords.join('; ')}`));
  }

    const resolveNote = (noteId: string): WordNoteReference | undefined => {
      const note = annotationsById.get(noteId);
      if (!note) {
        warnings.push(`DOCX note anchor ${noteId} has no matching OMI note.`);
        return undefined;
      }
      const semanticKind = getNoteKind(note);
      if (semanticKind === 'author-note' && localNoteLayout !== 'with-notes') {
        referencedNoteIds.add(noteId);
        if (localNoteLayout === 'margin') {
          warnings.push(`DOCX margin placement for local note ${noteId} is not supported; the note is preserved inline in parentheses.`);
        }
        return { text: ` (${note.body})`, semantics: [] };
      }
      const kind = semanticKind === 'endnote' ? 'endnote' : 'footnote';
      let id = noteReferenceIds[kind].get(noteId);
      if (id === undefined) {
        id = noteReferenceIds[kind].size + 1;
        noteReferenceIds[kind].set(noteId, id);
        referencedNoteIds.add(noteId);
        const citationRules = manuscript.embeddedPublicationProfile?.rules.citations;
        const precedingNotes = manuscript.annotations
          .slice(0, manuscript.annotations.indexOf(note))
          .filter(isNoteAnnotation);
        const previouslyCitedTargets = [...new Set(precedingNotes.flatMap((annotation) =>
          annotation.noteCitations?.map((citation) => citation.target) ?? [],
        ))];
        const noteDocument = createNoteBodyDocument(
          note,
          manuscript.bibliographicRecords ?? [],
          citationRules?.noteFirstStyle ?? manuscript.citationStyle ?? 'apa-7',
          manuscript.locale,
          {
            subsequentStyle: citationRules?.noteSubsequentStyle,
            previouslyCitedTargets,
          },
        );
        const target = kind === 'footnote' ? footnotes : endnotes;
        target.push({ id, body: noteDocument, customMark:getNoteCustomMark(note) });
      }
      return { kind, id, customMark:getNoteCustomMark(note) };
    };

  const noteScope=getDocumentStructureProfile(manuscript).noteNumberingScope;
  const restartNotes=noteScope!=='continuous';
  const sectionXml=()=>'<w:sectPr>'+(restartNotes?'<w:footnotePr><w:numRestart w:val="eachSect"/></w:footnotePr><w:endnotePr><w:numRestart w:val="eachSect"/></w:endnotePr><w:type w:val="continuous"/>':'')+'<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>';
  let lastScope:string|undefined;
  const renderSections = (sections: typeof context.sections,studyRoot?:string) => {
    for (const section of sections) {
      const root=studyRoot??section.id;
      const scope=noteScope==='study'?root:section.id;
      if(restartNotes&&lastScope!==undefined&&lastScope!==scope)body.push('<w:p><w:pPr>'+sectionXml()+'</w:pPr></w:p>');
      lastScope=scope;
      const level = Math.min(6, section.depth + 1);
      const heading = section.number ? `${section.number} ${section.title}` : section.title;
      if (section.title.trim()) body.push(paragraph(heading, `Heading${level}`));
      for (const block of section.blocks) {
        const indexFields = renderWordIndexEntryFields(indexEntriesByBlock.get(block.id) ?? []);
        if (block.visual?.kind === 'table' && block.visual.cells.length && block.visual.cells.some(row=>row.length)) {
          if (indexFields) body.push(paragraph('', undefined, indexFields));
          if (block.visual.caption?.trim()) body.push(paragraph(block.visual.caption));
          body.push(wordTable(block.visual, warnings, numbering, sourceStyles,resolveNote));
          continue;
        }
        if (block.visual) {
          const text = blockPlainText(block);
          if (text || indexFields) body.push(paragraph(text, undefined, indexFields));
          warnings.push(`Structured ${block.visual.kind} object ${block.id} was exported as descriptive text in DOCX.`);
          continue;
        }
        const lists = renderWordLists(block.content, numbering, resolveNote, indexFields, sourceStyles);
        if (lists !== undefined) { body.push(lists); continue; }
        const rendered = renderWordContent(block.content, resolveNote);
        if (rendered) body.push(richParagraph(rendered, indexFields, block.content, sourceStyles));
        else {
          const text = blockPlainText(block);
          if (text || indexFields) body.push(paragraph(text, undefined, indexFields));
        }
      }
      renderSections(section.children,root);
    }
  };
  renderSections(context.sections);

  const unanchoredNotes = manuscript.annotations.filter(
    (annotation) => isNoteAnnotation(annotation) && !referencedNoteIds.has(annotation.id),
  );
  if (unanchoredNotes.length) {
    warnings.push(`${unanchoredNotes.length} OMI note(s) have no inline anchor and were omitted from DOCX notes.`);
    body.push(paragraph(localizedLabel(context.locale, 'unanchoredNotes'), 'Heading1'));
    unanchoredNotes.forEach((note, index) => {
      body.push(paragraph(`${index + 1}. ${note.body}`));
    });
  }

  if ((manuscript.generatedIndexes?.length ?? 0) > 0 && indexEntriesByBlock.size > 0) {
    const title = manuscript.generatedIndexes?.[0]?.title?.trim() || localizedIndexLabel(context.locale);
    body.push(paragraph(title, 'Heading1'));
    body.push(renderWordGeneratedIndexField(context.locale));
  }

  if(fundingStatement){
    // Allocate after ordinary note IDs, but put the anchor at the title.
    // Word custom marks do not advance automatic numbering.
    const id=footnotes.length+1;
    footnotes.unshift({id,customMark:'*',funding:true,body:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:fundingStatement}]}]}});
    body[0]=paragraph(context.title,'Title',wordNoteReference('footnote',id,'*'));
  }
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="w14"><w:body>${body.join('')}${sectionXml()}</w:body></w:document>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="character" w:default="1" w:styleId="DefaultParagraphFont"><w:name w:val="Default Paragraph Font"/><w:uiPriority w:val="1"/><w:semiHidden/><w:unhideWhenUsed/></w:style>
${style('Title', 'Title', 32, true)}${style('Subtitle', 'Subtitle', 24, false)}${style('Author', 'Author', 22, false)}${noteParagraphStyle('FundingNote', 'funding note')}
${noteParagraphStyle('FootnoteText', 'footnote text')}${noteParagraphStyle('EndnoteText', 'endnote text')}
${characterStyle('FootnoteReference', 'footnote reference', '<w:vertAlign w:val="superscript"/>')}${characterStyle('EndnoteReference', 'endnote reference', '<w:vertAlign w:val="superscript"/>')}
${[1,2,3,4,5,6].map((level) => headingStyle(level)).join('')}
${characterStylesXml()}${sourceStyles.xml()}
</w:styles>`;

  const settingsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${wordHyphenationSettingsXml(manuscript.extensions?.[WORD_HYPHENATION_EXTENSION])}<w:updateFields w:val="true"/></w:settings>`;

  const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(context.title)}</dc:title><dc:language>${xml(context.locale)}</dc:language><cp:lastModifiedBy>Open Manuscript Studio</cp:lastModifiedBy><dcterms:modified xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:modified></cp:coreProperties>`;

  const entries = [
    textZipEntry('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>${numbering.size ? '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>' : ''}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>${footnotes.length ? '<Override PartName="/word/footnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml"/>' : ''}${endnotes.length ? '<Override PartName="/word/endnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.endnotes+xml"/>' : ''}</Types>`),
    textZipEntry('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`),
    textZipEntry('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>${numbering.size ? '<Relationship Id="rIdNumbering" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>' : ''}${footnotes.length ? '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes" Target="footnotes.xml"/>' : ''}${endnotes.length ? `<Relationship Id="rId${footnotes.length ? 4 : 3}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/endnotes" Target="endnotes.xml"/>` : ''}</Relationships>`),
    textZipEntry('word/document.xml', documentXml),
    textZipEntry('word/styles.xml', stylesXml),
    textZipEntry('word/settings.xml', settingsXml),
    ...(numbering.size ? [textZipEntry('word/numbering.xml', numbering.xml())] : []),
    textZipEntry('docProps/core.xml', core),
    ...(footnotes.length ? [textZipEntry('word/footnotes.xml', renderWordNotes('footnote', footnotes, continueFootnotes))] : []),
    ...(endnotes.length ? [textZipEntry('word/endnotes.xml', renderWordNotes('endnote', endnotes))] : []),
  ];
  const bytes = createStoreZip(entries);
  const copy = bytes.slice();
  return {
    semanticLosses,
    bytes,
    blob: new Blob([copy.buffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
    fileName: `${fileStem(manuscript)}.docx`,
    warnings,
    metadataConversion,
  };
}

type NumberingGroup = { id: number; levels: Map<number,string>; overrides: Map<number,number> };
class WordListNumbering {
  private readonly groups: NumberingGroup[] = [];
  private readonly bySource = new Map<string,NumberingGroup>();
  get size(): number { return this.groups.length; }
  register(node: NoteJsonNode, depth: number, parent?: NumberingGroup): { group: NumberingGroup; level: number } {
    const attrs = node.attrs;
    const v = (name: Parameters<typeof normalizeListAttribute>[0]) => normalizeListAttribute(name,attrs?.[name]);
    // The tree depth reflects current editing (including indent/outdent).
    // Imported roots can themselves start at a non-zero Word level.
    const level = Math.min(8, Math.max(0, depth));
    const source = v('omiListId');
    const format = v('omiListFormat') ?? (node.type === 'bulletList' ? 'bullet' : 'decimal');
    const start = normalizeListAttribute('omiListStart',attrs?.start) ?? v('omiListStart') ?? 1;
    const label = v('omiListLabel') ?? (node.type === 'bulletList' ? '•' : '%' + (level+1) + '.');
    const left = v('omiListLeft') ?? (level+1)*720;
    const hanging = v('omiListHanging') ?? 360;
    const definition = '<w:lvl w:ilvl="' + level + '"><w:start w:val="' + start + '"/><w:numFmt w:val="' + format + '"/><w:lvlText w:val="' + xml(String(label)) + '"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="' + left + '" w:hanging="' + hanging + '"/></w:pPr></w:lvl>';
    let group = typeof source === 'string' ? this.bySource.get(source) : parent;
    if (!group || (group.levels.has(level) && group.levels.get(level) !== definition)) {
      group = {id:this.groups.length+1,levels:new Map(parent?.levels ?? []),overrides:new Map(parent?.overrides ?? [])};
      this.groups.push(group);
      if (typeof source === 'string') this.bySource.set(source,group);
    }
    group.levels.set(level,definition);
    const override = v('omiListOverrideStart');
    if (typeof override === 'number') group.overrides.set(level,override);
    return {group,level};
  }
  xml(): string {
    const abstracts = this.groups.map(group => '<w:abstractNum w:abstractNumId="' + group.id + '"><w:multiLevelType w:val="multilevel"/>' + [...group.levels].sort(([a],[b])=>a-b).map(([,definition])=>definition).join('') + '</w:abstractNum>').join('');
    const nums = this.groups.map(group=>'<w:num w:numId="' + group.id + '"><w:abstractNumId w:val="' + group.id + '"/>' + [...group.overrides].sort(([a],[b])=>a-b).map(([level,start])=>'<w:lvlOverride w:ilvl="'+level+'"><w:startOverride w:val="'+start+'"/></w:lvlOverride>').join('') + '</w:num>').join('');
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' + abstracts + nums + '</w:numbering>';
  }
}
function renderWordLists(content: string, numbering: WordListNumbering, resolveNote: (id:string)=>WordNoteReference|undefined, suffix: string, sourceStyles: SourceWordStyleRegistry): string | undefined {
  let root: NoteJsonNode;
  try { root = JSON.parse(content) as NoteJsonNode; } catch { return undefined; }
  const list = (node: NoteJsonNode) => node.type === 'orderedList' || node.type === 'bulletList';
  const nodes = root.type === 'doc' ? root.content ?? [] : [root];
  if (!nodes.some(list)) return undefined;
  const output: string[] = [];
  const renderParagraph = (node: NoteJsonNode, numPr = '') => {
    const runs = renderJsonNode(node,resolveNote);
    const last = runs.at(-1);
    if (last && !('kind' in last) && last.text === '\n') runs.pop();
    const sourceParagraph = node.attrs?.omiWordParagraphStyle;
    const styleId = sourceStyles.register(sourceParagraph);
    const properties = (styleId ? '<w:pStyle w:val="'+styleId+'"/>' : '') + numPr + paragraphFormattingWordXml(node.attrs);
    output.push('<w:p>' + (properties ? '<w:pPr>'+properties+'</w:pPr>' : '') + runs.map(run=>'kind' in run ? wordNoteReference(run.kind,run.id,run.customMark) : wordRun(run, sourceStyles, sourceParagraph)).join('') + (output.length === 0 ? suffix : '') + '</w:p>');
  };
  const renderList = (node: NoteJsonNode, depth: number, parent?: NumberingGroup) => {
    const {group,level} = numbering.register(node,depth,parent);
    for (const item of node.content ?? []) {
      if (item.type !== 'listItem') continue;
      let first = true;
      for (const child of item.content ?? []) {
        if (list(child)) { renderList(child,level+1,group); continue; }
        const numPr = first ? '<w:numPr><w:ilvl w:val="'+level+'"/><w:numId w:val="'+group.id+'"/></w:numPr>' : '';
        renderParagraph(child,numPr);
        first = false;
      }
    }
  };
  for (const node of nodes) {
    if (list(node)) {
      const level = normalizeListAttribute('omiListLevel',node.attrs?.omiListLevel);
      renderList(node,typeof level === 'number' ? level : 0);
    } else renderParagraph(node);
  }
  return output.join('');
}

/** Native editable tables; the model intentionally stores plain rectangular cells. */
function wordTable(table: OmiTableBlockData, warnings: string[],numbering:WordListNumbering,sourceStyles:SourceWordStyleRegistry,resolveNote:(id:string)=>WordNoteReference|undefined,availableWidth=9026): string {
  const widths = tableColumnWidths(table.cells, table.columnWidths).map(percent=>Math.max(1,Math.round(percent*availableWidth/100)));
  const headerRows = tableHeaderRows(table.cells, table.headerRows);
  const layout = tableMergeLayout(table.cells,table.cellMerges,headerRows);
  let partial = false;
  const rows = table.cells.map((row,r)=>{
    const cells = widths.map((width,c)=>{
      const merge=layout.at(r,c);
      if(merge && c!==merge.column) return '';
      const continuing=!!merge && r!==merge.row;
      const cellWidth=merge?widths.slice(c,c+merge.colSpan).reduce((sum,w)=>sum+w,0):width;
      const format = tableCellFormat(table.cellFormats,merge?.row??r,c);
      const rotation = format.textRotation === -90 ? 'btLr' : format.textRotation === 90 ? 'tbRl' : undefined;
      if (format.textRotation === 180 || format.textDirection !== 'auto') partial = true;
      const borderXml=(['top','left','bottom','right'] as const).map(side=>{
        const edge=format.borders?.[side];
        if(!edge) return '';
        // Suppress internal top/bottom borders of vertical merge continuations.
        if(merge && merge.rowSpan>1 && ((side==='top'&&continuing)||(side==='bottom'&&r<merge.row+merge.rowSpan-1))) return '<w:'+side+' w:val="nil"/>';
        if(edge.style==='none') return '<w:'+side+' w:val="nil"/>';
        const val=edge.style==='solid'?'single':edge.style;
        return '<w:'+side+' w:val="'+val+'" w:sz="'+Math.round((edge.widthPt??0.5)*8)+'" w:color="'+(edge.color??'#000000').slice(1)+'"/>';
      }).join('');
      const marginXml=(['top','left','bottom','right'] as const).map(side=>{
        const n=format.paddingPt?.[side];
        return n===undefined?'':'<w:'+side+' w:w="'+Math.round(n*20)+'" w:type="dxa"/>';
      }).join('');
      const properties = '<w:tcW w:w="'+cellWidth+'" w:type="dxa"/>'
        + (merge && merge.colSpan>1?'<w:gridSpan w:val="'+merge.colSpan+'"/>':'')
        + (merge && merge.rowSpan>1?'<w:vMerge w:val="'+(continuing?'continue':'restart')+'"/>':'')
        + (borderXml?'<w:tcBorders>'+borderXml+'</w:tcBorders>':'')
        + (format.backgroundColor?'<w:shd w:val="clear" w:color="auto" w:fill="'+format.backgroundColor.slice(1)+'"/>':'')
        + (marginXml?'<w:tcMar>'+marginXml+'</w:tcMar>':'')
        + (rotation ? '<w:textDirection w:val="'+rotation+'"/>' : '')
        + (format.verticalAlign?'<w:vAlign w:val="'+(format.verticalAlign==='middle'?'center':format.verticalAlign)+'"/>':'');
      const doc=continuing?undefined:tableCellDocument(table,r,c);
      const rich=doc?.content?.map(p=>{
        const nested=cellNestedTable(p);
        if(nested) return wordTable(nested,warnings,numbering,sourceStyles,resolveNote,Math.max(1,cellWidth));
        if(p.type==='orderedList'||p.type==='bulletList') return renderWordLists(JSON.stringify({type:'doc',content:[cellDocumentWithDefaults(p,format.horizontalAlign)]}),numbering,resolveNote,'',sourceStyles)??'';
        const runs=(p.content??[]).map(n=>n.type==='hardBreak'?'<w:r><w:br/></w:r>':n.type==='omiTab'?'<w:r><w:tab/></w:r>':renderJsonNode(n,resolveNote).map(run=>'kind' in run?wordNoteReference(run.kind,run.id,run.customMark):wordRun(run,undefined,{})).join('')).join('');
        const properties=paragraphFormattingWordXml(effectiveCellParagraphAttrs(p.attrs,format.horizontalAlign));
        return '<w:p>'+(properties?'<w:pPr>'+properties+'</w:pPr>':'')+runs+'</w:p>';
      }).join('');
      const content = rich ?? (row[c] ?? '').split(/\r\n?|\n/).map(line=>{
        const runs = line.split('\t').map(part=>wordStyledText(part)).join('<w:r><w:tab/></w:r>');
        const pPr=format.horizontalAlign?'<w:pPr><w:jc w:val="'+(format.horizontalAlign==='justify'?'both':format.horizontalAlign)+'"/></w:pPr>':'';
        return '<w:p>'+pPr+runs+'</w:p>';
      }).join('');
      return '<w:tc><w:tcPr>'+properties+'</w:tcPr>'+content+(content.endsWith('</w:tbl>')?'<w:p/>':'')+'</w:tc>';
    }).join('');
    const split=tableRowSplitPolicy(table,r);
    const height=tableRowHeight(table,r);
    const heightXml=height.mode==='auto'?'':'<w:trHeight w:val="'+Math.round(height.heightPt*20)+'" w:hRule="'+(height.mode==='exact'?'exact':'atLeast')+'"/>';
    const properties=(split==='keep'?'<w:cantSplit/>':'<w:cantSplit w:val="0"/>')+heightXml+(r<headerRows?'<w:tblHeader/>':'');
    return '<w:tr><w:trPr>'+properties+'</w:trPr>'+cells+'</w:tr>';
  }).join('');
  if (table.cells.some((_,r)=>tableRowHeight(table,r).mode==='exact')) warnings.push('Exact row heights in Word can clip overflowing text; review the target document.');
  if (partial) warnings.push('Some cell rotation or writing direction has no exact DOCX table mapping.');
  if (table.fontSizeReduction !== 0) warnings.push('DOCX table font reduction is not preserved.');
  const total = widths.reduce((sum,width)=>sum+width,0);
  return '<w:tbl><w:tblPr><w:tblW w:w="'+total+'" w:type="dxa"/><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>'+widths.map(width=>'<w:gridCol w:w="'+width+'"/>').join('')+'</w:tblGrid>'+rows+'</w:tbl>';
}

function paragraph(value: string, styleId?: string, suffix = ''): string {
  const pPr = styleId ? `<w:pPr><w:pStyle w:val="${xml(styleId)}"/></w:pPr>` : '';
  return `<w:p>${pPr}<w:r><w:t xml:space="preserve">${xml(value)}</w:t></w:r>${suffix}</w:p>`;
}

function authorParagraph(
  contributors: readonly OmiRenderedContributor[],
): string {
  const runs: string[] = [];
  contributors.forEach((contributor, contributorIndex) => {
    contributorNameParts(contributor).forEach((part, partIndex) => {
      if (partIndex > 0) runs.push(wordStyledText(' '));
      const styleId =
        part.kind === 'given'
          ? 'OMIAuthorGivenName'
          : part.kind === 'family'
            ? 'OMIAuthorFamilyName'
            : undefined;
      runs.push(wordStyledText(part.text, styleId));
    });
    if (contributorIndex < contributors.length - 1) {
      runs.push(wordStyledText(', '));
    }
  });
  return `<w:p><w:pPr><w:pStyle w:val="Author"/></w:pPr>${runs.join('')}</w:p>`;
}

function wordStyledText(value: string, styleId?: string): string {
  const rPr = styleId ? `<w:rPr><w:rStyle w:val="${xml(styleId)}"/></w:rPr>` : '';
  return `<w:r>${rPr}<w:t xml:space="preserve">${xml(value)}</w:t></w:r>`;
}

function richParagraph(runs: readonly WordInlinePart[], suffix = '', content = '', sourceStyles?: SourceWordStyleRegistry): string {
  let properties = '';
  let sourceParagraph: unknown;
  try {
    const root = JSON.parse(content) as NoteJsonNode;
    const paragraph = root.type === 'paragraph' ? root : root.content?.[0];
    if (paragraph?.type === 'paragraph') {
      sourceParagraph = paragraph.attrs?.omiWordParagraphStyle;
      const id = sourceStyles?.register(sourceParagraph);
      properties = (id ? `<w:pStyle w:val="${id}"/>` : '') + paragraphFormattingWordXml(paragraph.attrs);
    }
  } catch { /* Plain-text fallback has no local paragraph overrides. */ }
  const rendered = runs.map((run) => 'kind' in run ? wordNoteReference(run.kind, run.id, run.customMark) : wordRun(run, sourceStyles, sourceParagraph)).join('');
  return `<w:p>${properties ? `<w:pPr>${properties}</w:pPr>` : ''}${rendered}${suffix}</w:p>`;
}

type WordNoteKind = 'footnote' | 'endnote';
type WordNoteBody={id:number;body:NoteJsonNode;customMark?:'*';funding?:boolean};
type NativeWordNoteReference={kind:WordNoteKind;id:number;customMark?:'*'};
type WordInlinePart = OmiInlineRun | NativeWordNoteReference;
type WordNoteReference = NativeWordNoteReference | OmiInlineRun;

function wordNoteReference(kind: WordNoteKind, id: number, customMark?:'*'): string {
  const element = kind === 'footnote' ? 'footnoteReference' : 'endnoteReference';
  const styleId = kind === 'footnote' ? 'FootnoteReference' : 'EndnoteReference';
  return `<w:r><w:rPr><w:rStyle w:val="${styleId}"/></w:rPr><w:${element} w:id="${id}"${customMark?' w:customMarkFollows="1"':''}/>${customMark?'<w:t>*</w:t>':''}</w:r>`;
}

function renderWordContent(
  content: string,
  resolveNote: (noteId: string) => WordNoteReference | undefined,
): WordInlinePart[] {
  try {
    const runs = renderJsonNode(JSON.parse(content) as NoteJsonNode, resolveNote);
    const last = runs.at(-1);
    if (last && !('kind' in last) && last.text === '\n') runs.pop();
    return runs;
  } catch {
    return extractOmiInlineRuns(content);
  }
}

function renderJsonContent(document: NoteJsonNode): string {
  const runs = renderJsonNode(document);
  const last = runs.at(-1);
  if (last && !('kind' in last) && last.text === '\n') runs.pop();
  return runs.map((run) => 'kind' in run ? '' : wordRun(run)).join('');
}

function renderJsonNode(
  node: NoteJsonNode,
  resolveNote?: (noteId: string) => WordNoteReference | undefined,
): WordInlinePart[] {
  if (typeof node.text === 'string') {
    return [{
      text: node.text,
      semantics: semanticKindsFromMarks(node.marks),
      language: inlineLanguageFromMarks(node.marks),
      sourceFontFamily: inlineSourceFontFamilyFromMarks(node.marks),
      sourceWordStyle: inlineSourceWordStyle(node.marks),
      directFormatting: directFormattingFromMarks(node.marks),
    }];
  }
  if (node.type === 'hardBreak') return [{ text: '\n', semantics: [] }];
  if (node.type === 'omiTab') return [{ text: '\t', semantics: [] }];
  if (node.type === 'omiNote') {
    const id = node.attrs?.noteId;
    const reference = typeof id === 'string' ? resolveNote?.(id) : undefined;
    if (reference) return [reference];
    const label = node.attrs?.label;
    return typeof label === 'string' ? [{ text: label, semantics: [] }] : [];
  }
  if (node.type === 'omiCitation' || node.type === 'omiCrossReference') {
    const label = node.attrs?.label;
    return typeof label === 'string' ? [{ text: label, semantics: [] }] : [];
  }
  const children = (node.content ?? []).flatMap((child) => renderJsonNode(child, resolveNote));
  if ((node.type === 'paragraph' || node.type === 'blockquote' || node.type === 'codeBlock') && children.length) {
    children.push({ text: '\n', semantics: [] });
  }
  return children;
}

function renderWordNotes(kind: WordNoteKind, notes: readonly WordNoteBody[], allowContinuation = true): string {
  const root = kind === 'footnote' ? 'footnotes' : 'endnotes';
  const item = kind === 'footnote' ? 'footnote' : 'endnote';
  const reference = kind === 'footnote' ? 'footnoteRef' : 'endnoteRef';
  const separator = kind === 'footnote' ? 'footnote' : 'endnote';
  const notesXml = notes.map(note=>{
    const paragraphs:NoteJsonNode[]=[];
    // Keep actual paragraph boundaries, including blank paragraphs. Other
    // structures retain the existing text projection rather than losing text.
    const collect=(node:NoteJsonNode)=>{
      if(node.type==='doc'||node.type==='blockquote'){for(const child of node.content??[])collect(child);}
      else paragraphs.push(node);
    };
    collect(note.body);
    if(!paragraphs.length)paragraphs.push({type:'paragraph'});
    const marker=`<w:r><w:rPr><w:rStyle w:val="${kind==='footnote'?'FootnoteReference':'EndnoteReference'}"/></w:rPr>${note.customMark?'<w:t>*</w:t>':`<w:${reference}/>`}</w:r><w:r><w:t xml:space="preserve"> </w:t></w:r>`;
    const content=paragraphs.map((p,index)=>{
      const attrs={...p.attrs};
      if(kind==='footnote'){
        if(attrs.omiKeepLines===undefined)attrs.omiKeepLines=!allowContinuation;
        if(!allowContinuation&&index<paragraphs.length-1&&attrs.omiKeepNext===undefined)attrs.omiKeepNext=true;
      }
      return `<w:p><w:pPr><w:pStyle w:val="${note.funding?'FundingNote':kind==='footnote'?'FootnoteText':'EndnoteText'}"/>${paragraphFormattingWordXml(attrs)}</w:pPr>${index===0?marker:''}${renderJsonContent(p)}</w:p>`;
    }).join('');
    return `<w:${item} w:id="${note.id}">${content}</w:${item}>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:${root} xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="w14"><w:${separator} w:type="separator" w:id="-1"><w:p><w:r><w:separator/></w:r></w:p></w:${separator}><w:${separator} w:type="continuationSeparator" w:id="0"><w:p><w:r><w:continuationSeparator/></w:r></w:p></w:${separator}>${notesXml}</w:${root}>`;
}

function noteParagraphStyle(id: string, name: string): string {
  return `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/><w:qFormat/></w:style>`;
}

function wordRun(run: OmiInlineRun, sourceStyles?: SourceWordStyleRegistry, sourceParagraph?: unknown): string {
  const imported = sourceStyles?.register(run.sourceWordStyle);
  const styleId = imported ?? (sourceParagraph ? undefined : wordCharacterStyleId(run.semantics));
  const paragraphStyle = resolveSourceStyle(sourceParagraph);
  const characterStyle = resolveSourceStyle(run.sourceWordStyle);
  const inheritedBold = Boolean(paragraphStyle.bold) !== Boolean(characterStyle.bold);
  const inheritedItalic = Boolean(paragraphStyle.italic) !== Boolean(characterStyle.italic);
  const lang = run.language
    ? `<w:lang w:val="${xml(run.language)}"/>`
    : '';
  // A named character style represents only one semantic (or strong+emphasis).
  // Write the remaining semantics as direct Word properties rather than losing them.
  const styleSemantics = styleId === 'OMIStrongEmphasis'
    ? ['strong', 'emphasis']
    : run.semantics.filter((kind) => WORD_STYLE_IDS[kind] === styleId);
  const extras = run.semantics.filter((kind) => !styleSemantics.includes(kind));
  const properties: Partial<Record<OmiInlineSemanticKind, string>> = {
    strong: '<w:b/>',
    emphasis: '<w:i/>',
    strike: '<w:strike/>',
    underline: '<w:u w:val="single"/>',
    'small-caps': '<w:smallCaps/>',
    superscript: '<w:vertAlign w:val="superscript"/>',
    subscript: '<w:vertAlign w:val="subscript"/>',
  };
  const family = run.sourceFontFamily || (extras.includes('code') ? 'Courier New' : undefined);
  const font = family ? `<w:rFonts w:ascii="${xml(family)}" w:hAnsi="${xml(family)}"/>` : '';
  const direct = extras.filter(kind => kind !== 'underline' || !run.directFormatting?.underlineStyle).map((kind) => properties[kind] ?? '').join('')
    + (inheritedBold && !run.semantics.includes('strong') ? '<w:b w:val="0"/>' : '')
    + (inheritedItalic && !run.semantics.includes('emphasis') ? '<w:i w:val="0"/>' : '')
    + directFormattingWordXml(run.directFormatting ?? {})
    + ((paragraphStyle.color || characterStyle.color) && !run.directFormatting?.omiTextColor ? '<w:color w:val="auto"/>' : '');
  const rPr = styleId || lang || font || direct
    ? `<w:rPr>${styleId ? `<w:rStyle w:val="${styleId}"/>` : ''}${font}${direct}${lang}</w:rPr>`
    : '';

  return run.text
    .split(/([\n\t])/)
    .filter((part) => part.length > 0)
    .map((part) => {
      if (part === '\n') return `<w:r>${rPr}<w:br/></w:r>`;
      if (part === '\t') return `<w:r>${rPr}<w:tab/></w:r>`;
      return `<w:r>${rPr}<w:t xml:space="preserve">${xml(part)}</w:t></w:r>`;
    })
    .join('');
}

function collectIndexEntriesByBlock(entries: readonly OmiIndexEntry[]): Map<string, OmiIndexEntry[]> {
  const result = new Map<string, OmiIndexEntry[]>();
  for (const entry of entries) {
    if (!entry.targetBlockId || (entry.relation && entry.relation !== 'location')) continue;
    const bucket = result.get(entry.targetBlockId) ?? [];
    bucket.push(entry);
    result.set(entry.targetBlockId, bucket);
  }
  return result;
}

export function renderWordIndexEntryFields(entries: readonly OmiIndexEntry[]): string {
  return entries.map((entry) => {
    const term = entry.terms.map((item) => item.trim()).filter(Boolean).join(':');
    if (!term) return '';
    const instruction = ` XE "${escapeWordFieldTerm(term)}" `;
    return `<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve">${xml(instruction)}</w:instrText></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>`;
  }).join('');
}

export function renderWordGeneratedIndexField(locale = 'en'): string {
  const instruction = ' INDEX ';
  const placeholder = locale.toLowerCase().startsWith('hu')
    ? 'A névmutató oldalszámai a dokumentum megnyitásakor frissülnek.'
    : locale.toLowerCase().startsWith('de')
      ? 'Die Seitenzahlen des Registers werden beim Öffnen aktualisiert.'
      : 'Index page numbers update when the document is opened.';
  return `<w:p><w:r><w:fldChar w:fldCharType="begin" w:dirty="true"/></w:r><w:r><w:instrText xml:space="preserve">${xml(instruction)}</w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t xml:space="preserve">${xml(placeholder)}</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>`;
}

function escapeWordFieldTerm(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function wordCharacterStyleId(semantics: readonly OmiInlineSemanticKind[]): string | undefined {
  if (semantics.includes('strong') && semantics.includes('emphasis')) return 'OMIStrongEmphasis';
  const priority: OmiInlineSemanticKind[] = [
    'emphasis', 'strong', 'small-caps', 'superscript', 'subscript', 'underline', 'strike', 'code',
  ];
  const selected = priority.find((kind) => semantics.includes(kind));
  return selected ? WORD_STYLE_IDS[selected] : undefined;
}

const WORD_STYLE_IDS: Record<OmiInlineSemanticKind, string> = {
  emphasis: 'OMIEmphasis',
  strong: 'OMIStrong',
  strike: 'OMIStrike',
  underline: 'OMIUnderline',
  'small-caps': 'OMISmallCaps',
  superscript: 'OMISuperscript',
  subscript: 'OMISubscript',
  code: 'OMICode',
};

function characterStylesXml(): string {
  return [
    characterStyle('OMIEmphasis', 'OMI Emphasis', '<w:i/>'),
    characterStyle('OMIStrong', 'OMI Strong', '<w:b/>'),
    characterStyle('OMIStrongEmphasis', 'OMI Strong Emphasis', '<w:b/><w:i/>'),
    characterStyle('OMIStrike', 'OMI Strike', '<w:strike/>'),
    characterStyle('OMIUnderline', 'OMI Underline', '<w:u w:val="single"/>'),
    characterStyle('OMISmallCaps', 'OMI Small Caps', '<w:smallCaps/>'),
    characterStyle('OMISuperscript', 'OMI Superscript', '<w:vertAlign w:val="superscript"/>'),
    characterStyle('OMISubscript', 'OMI Subscript', '<w:vertAlign w:val="subscript"/>'),
    characterStyle('OMICode', 'OMI Code', '<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/>'),
    characterStyle('OMIAuthorGivenName', 'OMI Author Given Name', ''),
    characterStyle('OMIAuthorFamilyName', 'OMI Author Family Name', ''),
  ].join('');
}

function characterStyle(id: string, name: string, properties: string): string {
  return `<w:style w:type="character" w:customStyle="1" w:styleId="${id}"><w:name w:val="${xml(name)}"/><w:basedOn w:val="DefaultParagraphFont"/><w:uiPriority w:val="10"/><w:qFormat/><w:rPr>${properties}</w:rPr></w:style>`;
}

function style(id: string, name: string, size: number, bold: boolean): string {
  return `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/><w:qFormat/><w:rPr>${bold ? '<w:b/>' : ''}<w:sz w:val="${size}"/></w:rPr></w:style>`;
}

function headingStyle(level: number): string {
  const size = Math.max(22, 32 - (level - 1) * 2);
  return `<w:style w:type="paragraph" w:styleId="Heading${level}"><w:name w:val="heading ${level}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:outlineLvl w:val="${level - 1}"/><w:keepNext/></w:pPr><w:rPr><w:b/><w:sz w:val="${size}"/></w:rPr></w:style>`;
}

function blockPlainText(block: OmiBlock): string {
  if (block.visual) {
    const caption = 'caption' in block.visual ? block.visual.caption : undefined;
    const label = block.visual.kind.charAt(0).toUpperCase() + block.visual.kind.slice(1);
    return [caption?.trim() ? `[${label}: ${caption.trim()}]` : `[${label}]`, visualTextBoxText(block.visual)].filter(Boolean).join('\n');
  }
  const runs = extractOmiInlineRuns(block.content);
  if (runs.length) return runs.map((run) => run.text).join('').replace(/\s+/g, ' ').trim();
  return block.content.trim();
}

function localizedLabel(locale: string, key: 'abstract' | 'keywords' | 'notes' | 'unanchoredNotes'): string {
  const language = locale.toLowerCase().split(/[-_]/)[0];
  const labels = language === 'hu'
    ? { abstract: 'Absztrakt', keywords: 'Kulcsszavak', notes: 'Jegyzetek', unanchoredNotes: 'Horgony nélküli jegyzetek' }
    : language === 'de'
      ? { abstract: 'Zusammenfassung', keywords: 'Schlüsselwörter', notes: 'Anmerkungen', unanchoredNotes: 'Nicht verankerte Anmerkungen' }
      : { abstract: 'Abstract', keywords: 'Keywords', notes: 'Notes', unanchoredNotes: 'Unanchored notes' };
  return labels[key];
}

function localizedIndexLabel(locale: string): string {
  const language = locale.toLowerCase().split(/[-_]/)[0];
  return language === 'hu' ? 'Névmutató' : language === 'de' ? 'Personenregister' : 'Name index';
}

function xml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function fileStem(manuscript: Pick<OmiManuscript, 'title' | 'id'>): string {
  return manuscript.title.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 72) || manuscript.id || 'manuscript';
}
