import { normalizeParagraphValue, type ParagraphFormat } from './directParagraphFormatting';
import type { NoteJsonNode } from './noteRichText';
import { DIRECT_FORMAT_NAMES, normalizeDirectValue, type DirectFormat, normalizeUnderlineStyle } from './directFormatting';
import { normalizeExternalHref, normalizeInlineLanguageTag } from './richText';
import type { OmiTableCellFormat, OmiTableCellMerge, OmiTableBlockData, OmiTableRowSplitPolicy, OmiTableCellSide, OmiTableCellBorder, OmiTableRowHeight } from '../types/omi';

/** Relative widths keep the same table editable on screen and within print margins. */
export function tableColumnWidths(cells: readonly (readonly string[])[], widths?: readonly number[]): number[] {
  const count = cells.reduce((max, row) => Math.max(max, row.length), 0);
  if (!count) return [];
  const valid = widths?.length === count && widths.every((width) => Number.isFinite(width) && width > 0);
  const values = valid ? widths! : Array<number>(count).fill(1);
  const largest = Math.max(...values);
  const scaled = values.map((value) => value / largest);
  const total = scaled.reduce((sum, value) => sum + value, 0);
  return scaled.map((value) => Math.round(value * 100_000_000 / total) / 1_000_000);
}

/** Move one boundary while preserving the combined width of its two columns. */
export function resizeTableColumn(widths: readonly number[], index: number, requested: number): number[] {
  const next = [...widths];
  if (!Number.isFinite(requested) || index < 0 || index >= next.length - 1) return next;
  const pair = next[index]! + next[index + 1]!;
  const minimum = Math.min(3, pair / 4);
  next[index] = Math.min(pair - minimum, Math.max(minimum, requested));
  next[index + 1] = pair - next[index]!;
  return next;
}

export function tableCellFormat(formats: Record<string, OmiTableCellFormat> | undefined, row: number, column: number): OmiTableCellFormat & Required<Pick<OmiTableCellFormat,'textRotation'|'textDirection'>> {
  const format = formats?.[`${row}:${column}`];
  return {
    textRotation: format?.textRotation === -90 || format?.textRotation === 90 || format?.textRotation === 180 ? format.textRotation : 0,
    textDirection: format?.textDirection === 'ltr' || format?.textDirection === 'rtl' ? format.textDirection : 'auto',
    ...normalizeTableCellAppearance(format),
    ...normalizeTableCellEdges(format),
  };
}

export function pruneTableCellFormats(cells: readonly (readonly string[])[], formats?: Record<string, OmiTableCellFormat>): Record<string, OmiTableCellFormat> {
  return Object.fromEntries(Object.entries(formats ?? {}).filter(([key]) => {
    const match = /^(\d+):(\d+)$/.exec(key);
    return match && Number(match[1]) < cells.length && Number(match[2]) < (cells[Number(match[1])]?.length ?? 0);
  }));
}

/** Writing mode gives quarter-turn text real layout dimensions, unlike a CSS
 * transform alone. Half turns stay within the same measured rectangle. */
export function tableCellTextStyle(rotation: Required<OmiTableCellFormat>['textRotation']) {
  const vertical = rotation === 90 || rotation === -90;
  return {
    display: 'inline-block',
    boxSizing: 'border-box',
    writingMode: vertical ? 'vertical-rl' : 'horizontal-tb',
    textOrientation: vertical ? 'sideways' : 'mixed',
    transform: rotation === -90 || rotation === 180 ? 'rotate(180deg)' : 'none',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
    textAlign: 'start',
    maxWidth: '100%',
    maxHeight: vertical ? '18em' : 'none',
    minHeight: '1.3em',
  } as const;
}

/** Header rows are a contiguous prefix of the table. */
export function tableHeaderRows(cells: readonly (readonly string[])[], count: unknown): number {
  return typeof count === 'number' && Number.isFinite(count) ? Math.max(0, Math.min(cells.length, Math.trunc(count))) : 0;
}

/** Validate rectangles once per rendering. Never hide nonempty covered cells,
 * overlap another accepted rectangle, or span separate header/body groups. */
export function tableMergeLayout(cells: readonly (readonly string[])[], merges?: readonly OmiTableCellMerge[], headerRows?: number) {
  const accepted: OmiTableCellMerge[] = [];
  const positions = new Map<string, OmiTableCellMerge>();
  const headers = tableHeaderRows(cells, headerRows);
  for (const raw of Array.isArray(merges) ? merges : []) {
    if (!raw || typeof raw !== 'object') continue;
    const {row,column,rowSpan,colSpan}=raw;
    if (![row,column,rowSpan,colSpan].every(Number.isSafeInteger) || row<0 || column<0 || rowSpan<1 || colSpan<1 || (rowSpan===1 && colSpan===1)) continue;
    if (row+rowSpan>cells.length || (row<headers && row+rowSpan>headers)) continue;
    let valid=true;
    for(let r=row;r<row+rowSpan && valid;r++) {
      if(column+colSpan>(cells[r]?.length??0)) {valid=false;break;}
      for(let c=column;c<column+colSpan;c++) {
        if(positions.has(r+':'+c) || ((r!==row||c!==column) && cells[r]![c]!=='')) {valid=false;break;}
      }
    }
    if(!valid) continue;
    const merge={row,column,rowSpan,colSpan};
    accepted.push(merge);
    for(let r=row;r<row+rowSpan;r++) for(let c=column;c<column+colSpan;c++) positions.set(r+':'+c,merge);
  }
  return {
    merges:accepted,
    at:(row:number,column:number)=>positions.get(row+':'+column),
    covered:(row:number,column:number)=>{
      const m=positions.get(row+':'+column);
      return !!m && (m.row!==row || m.column!==column);
    },
  };
}

/** Extend the selected anchor to the right or down by one logical cell.
 * Nonempty cells and overlapping merges are rejected rather than discarded. */
export function extendTableMerge(cells: readonly (readonly string[])[], merges: readonly OmiTableCellMerge[] | undefined, row:number,column:number, direction:'right'|'down',headerRows?:number): OmiTableCellMerge[] | undefined {
  const layout=tableMergeLayout(cells,merges,headerRows);
  if(layout.covered(row,column)) return undefined;
  const old=layout.at(row,column);
  const next={row,column,rowSpan:(old?.rowSpan??1)+(direction==='down'?1:0),colSpan:(old?.colSpan??1)+(direction==='right'?1:0)};
  const others=layout.merges.filter(m=>m!==old);
  const candidate=tableMergeLayout(cells,[...others,next],headerRows);
  return candidate.merges.length===others.length+1 ? candidate.merges : undefined;
}
export function splitTableMerge(cells: readonly (readonly string[])[], merges: readonly OmiTableCellMerge[] | undefined,row:number,column:number,headerRows?:number): OmiTableCellMerge[] {
  const layout=tableMergeLayout(cells,merges,headerRows);
  const selected=layout.at(row,column);
  return layout.merges.filter(m=>m!==selected);
}

/** Keep legacy screen/print behavior unless a source or editor explicitly opts in. */
export function tableRowSplitDefault(value: unknown): OmiTableRowSplitPolicy {
  return value === 'allow' ? 'allow' : 'keep';
}
export function tableRowSplitPolicy(table: Pick<OmiTableBlockData,'rowSplitDefault'|'rowSplitOverrides'>, row: number): OmiTableRowSplitPolicy {
  const value=table.rowSplitOverrides?.[String(row)];
  return value === 'allow' || value === 'keep' ? value : tableRowSplitDefault(table.rowSplitDefault);
}
export function pruneTableRowSplitOverrides(cells: readonly (readonly string[])[], overrides?: Record<string,OmiTableRowSplitPolicy>): Record<string,OmiTableRowSplitPolicy> {
  return Object.fromEntries(Object.entries(overrides??{}).filter(([key,value])=>
    /^(0|[1-9][0-9]*)$/.test(key) && Number(key)<cells.length && (value==='keep'||value==='allow')
  ));
}
export function setTableRowSplitOverride(table: OmiTableBlockData,row:number,policy: OmiTableRowSplitPolicy | 'inherit'): Record<string,OmiTableRowSplitPolicy> {
  const next=pruneTableRowSplitOverrides(table.cells,table.rowSplitOverrides);
  if(!Number.isSafeInteger(row)||row<0||row>=table.cells.length) return next;
  if(policy==='inherit') delete next[String(row)];
  else if(policy==='allow'||policy==='keep') next[String(row)]=policy;
  return next;
}

/** Strict whitelisting also prevents CSS/XML attribute injection by imported data. */
export function normalizeTableCellAppearance(format?: OmiTableCellFormat): Pick<OmiTableCellFormat,'horizontalAlign'|'verticalAlign'|'backgroundColor'> {
  const result: Pick<OmiTableCellFormat,'horizontalAlign'|'verticalAlign'|'backgroundColor'> = {};
  const horizontal=format?.horizontalAlign;
  const vertical=format?.verticalAlign;
  const color=format?.backgroundColor;
  if(horizontal==='left'||horizontal==='center'||horizontal==='right'||horizontal==='justify') result.horizontalAlign=horizontal;
  if(vertical==='top'||vertical==='middle'||vertical==='bottom') result.verticalAlign=vertical;
  if(typeof color==='string' && /^#[0-9a-f]{6}$/i.test(color)) result.backgroundColor=color.toUpperCase();
  return result;
}
export function tableCellAppearanceStyle(format: OmiTableCellFormat) {
  const normalized=normalizeTableCellAppearance(format);
  return {
    ...(normalized.horizontalAlign?{textAlign:normalized.horizontalAlign}:{}),
    ...(normalized.verticalAlign?{verticalAlign:normalized.verticalAlign}:{}),
    ...(normalized.backgroundColor?{backgroundColor:normalized.backgroundColor}:{}),
    ...tableCellEdgeStyle(format),
  };
}

export const TABLE_CELL_SIDES = ['top','right','bottom','left'] as const;
export function normalizeTableCellEdges(format?: OmiTableCellFormat): Pick<OmiTableCellFormat,'borders'|'paddingPt'> {
  const borders: Partial<Record<OmiTableCellSide,OmiTableCellBorder>>={};
  const paddingPt: Partial<Record<OmiTableCellSide,number>>={};
  for(const side of TABLE_CELL_SIDES){
    const border=format?.borders?.[side];
    if(border?.style==='none') borders[side]={style:'none'};
    else if(border && ['solid','dashed','dotted','double'].includes(border.style)){
      const width=typeof border.widthPt==='number' && Number.isFinite(border.widthPt)?border.widthPt:0.5;
      borders[side]={style:border.style,widthPt:Math.min(12,Math.max(0.125,Math.round(width*8)/8)),color:typeof border.color==='string'&&/^#[0-9a-f]{6}$/i.test(border.color)?border.color.toUpperCase():'#000000'};
    }
    const padding=format?.paddingPt?.[side];
    if(typeof padding==='number' && Number.isFinite(padding) && padding>=0) paddingPt[side]=Math.min(144,Math.round(padding*20)/20);
  }
  return {...(Object.keys(borders).length?{borders}:{}),...(Object.keys(paddingPt).length?{paddingPt}:{})};
}
export function tableCellEdgeStyle(format: OmiTableCellFormat): Record<string,string> {
  const normalized=normalizeTableCellEdges(format);
  const css: Record<string,string>={};
  for(const side of TABLE_CELL_SIDES){
    const key=side[0]!.toUpperCase()+side.slice(1);
    const border=normalized.borders?.[side];
    if(border) css['border'+key]=border.style==='none'?'none':border.widthPt+'pt '+border.style+' '+border.color;
    const padding=normalized.paddingPt?.[side];
    if(padding!==undefined) css['padding'+key]=padding+'pt';
  }
  return css;
}
/** ODF lengths: reject percentages, expressions and unitless nonzero values. */
export function tableLengthPt(value: string | undefined): number | undefined {
  if(value==='0') return 0;
  const m=/^(\d+(?:\.\d+)?|\.\d+)(pt|pc|in|cm|mm)$/i.exec(value?.trim()??'');
  if(!m) return undefined;
  const factor:Record<string,number>={pt:1,pc:12,in:72,cm:72/2.54,mm:72/25.4};
  const n=Number(m[1])*factor[m[2]!.toLowerCase()]!;
  return Number.isFinite(n)?n:undefined;
}
export function odtTableCellBorder(value: string | undefined): OmiTableCellBorder | undefined {
  if(value?.trim()==='none') return {style:'none'};
  const m=/^(\S+)\s+(solid|dashed|dotted|double)\s+(#[0-9a-f]{6})$/i.exec(value?.trim()??'');
  if(!m) return undefined;
  const widthPt=tableLengthPt(m[1]);
  return widthPt===undefined?undefined:{style:m[2]!.toLowerCase() as OmiTableCellBorder['style'],widthPt,color:m[3]};
}

/** Canonical twip precision; reject malformed or non-positive fixed dimensions. */
export function normalizeTableRowHeight(value: unknown): OmiTableRowHeight {
  if(value && typeof value==='object'){
    const candidate=value as {mode?:unknown;heightPt?:unknown};
    if((candidate.mode==='minimum'||candidate.mode==='exact')&&typeof candidate.heightPt==='number'&&Number.isFinite(candidate.heightPt)&&candidate.heightPt>0){
      return {mode:candidate.mode,heightPt:Math.min(1584,Math.max(0.05,Math.round(candidate.heightPt*20)/20))};
    }
  }
  return {mode:'auto'};
}
export function tableRowHeight(table:Pick<OmiTableBlockData,'rowHeights'>,row:number): OmiTableRowHeight {
  return normalizeTableRowHeight(table.rowHeights?.[String(row)]);
}
export function pruneTableRowHeights(cells: readonly (readonly string[])[],heights?: Record<string,OmiTableRowHeight>): Record<string,OmiTableRowHeight> {
  const next:Record<string,OmiTableRowHeight>={};
  for(const [key,value] of Object.entries(heights??{})){
    if(!/^(0|[1-9][0-9]*)$/.test(key)||Number(key)>=cells.length) continue;
    const height=normalizeTableRowHeight(value);
    if(height.mode!=='auto') next[key]=height;
  }
  return next;
}
export function setTableRowHeight(table:OmiTableBlockData,row:number,height:OmiTableRowHeight): Record<string,OmiTableRowHeight>{
  const next=pruneTableRowHeights(table.cells,table.rowHeights);
  if(!Number.isSafeInteger(row)||row<0||row>=table.cells.length) return next;
  const value=normalizeTableRowHeight(height);
  if(value.mode==='auto') delete next[String(row)]; else next[String(row)]=value;
  return next;
}
/** CSS table height is a minimum. In browser/print deliberately retain all text,
 * even for native exact rows; no clipping or content mutation. */
export function tableRowHeightStyle(height:OmiTableRowHeight): {height?:string} {
  return height.mode==='auto'?{}:{height:height.heightPt+'pt'};
}

/** Cell documents are deliberately limited to paragraphs and inline text. */
export function parseTableCellContent(value:unknown): NoteJsonNode | undefined {
  if(typeof value!=='string') return undefined;
  try {
    const root=JSON.parse(value) as NoteJsonNode;
    if(root?.type!=='doc'||!Array.isArray(root.content)||!root.content.length) return undefined;
    if(!root.content.every(p=>p?.type==='paragraph'&&(p.content===undefined||Array.isArray(p.content)&&p.content.every(n=>n?.type==='text'&&typeof n.text==='string'&&(n.marks===undefined||Array.isArray(n.marks)&&n.marks.every(m=>m&&typeof m.type==='string'))||n?.type==='hardBreak'||n?.type==='omiTab')))) return undefined;
    const marksAllowed=new Set(['bold','italic','strike','code','omiSmallCaps','omiSuperscript','omiSubscript']);
    for(const p of root.content){
      const attrs=normalizeCellParagraphAttrs(p.attrs);
      if(Object.keys(attrs).length) p.attrs=attrs; else delete p.attrs;
      for(const n of p.content??[]){
        if(n.type!=='text'){delete n.attrs;delete n.marks;continue;}
        n.marks=n.marks?.flatMap<NonNullable<NoteJsonNode['marks']>[number]>(mark=>{
          const name=mark.type!;
          if(marksAllowed.has(name)) return [{type:name}];
          if(DIRECT_FORMAT_NAMES.includes(name as DirectFormat)){
            const value=normalizeDirectValue(name as DirectFormat,mark.attrs?.value);
            return value===undefined?[]:[{type:name,attrs:{value}}];
          }
          if(name==='omiUnderline') return [{type:name,attrs:{variant:normalizeUnderlineStyle(mark.attrs?.variant)}}];
          if(name==='omiLink'){
            const href=normalizeExternalHref(typeof mark.attrs?.href==='string'?mark.attrs.href:undefined);
            return href?[{type:name,attrs:{href}}]:[];
          }
          if(name==='omiLanguage'){
            const lang=normalizeInlineLanguageTag(typeof mark.attrs?.lang==='string'?mark.attrs.lang:undefined);
            return lang?[{type:name,attrs:{lang}}]:[];
          }
          if(name==='omiSourceFont'){
            const family=mark.attrs?.family;
            return typeof family==='string'&&family.length>0&&family.length<=128&&Array.from(family).every(character=>{const code=character.charCodeAt(0);return code>=32&&code!==127&&!';{}<>'.includes(character);})?[{type:name,attrs:{family}}]:[];
          }
          return [];
        });
        if(!n.marks?.length) delete n.marks;
      }
    }
    return root;
  } catch {return undefined;}
}
export function tableCellPlainText(doc:NoteJsonNode):string {
  return (doc.content??[]).map(p=>(p.content??[]).map(n=>n.type==='hardBreak'?'\n':n.type==='omiTab'?'\t':n.text??'').join('')).join('\n');
}
export function plainTableCellDocument(text:string):NoteJsonNode {
  return {type:'doc',content:text.split('\n').map(line=>({type:'paragraph',content:line?[{type:'text',text:line}]:[]}))};
}
export function tableCellDocument(table:Pick<OmiTableBlockData,'cells'|'cellContent'>,row:number,column:number):NoteJsonNode|undefined {
  const doc=parseTableCellContent(table.cellContent?.[row+':'+column]);
  return doc&&tableCellPlainText(doc)===(table.cells[row]?.[column]??'')?doc:undefined;
}
export function pruneTableCellContent(cells:readonly (readonly string[])[],content?:Record<string,string>):Record<string,string>{
  const result:Record<string,string>={};
  for(const [key,value] of Object.entries(content??{})){
    if(!/^(0|[1-9][0-9]*):(0|[1-9][0-9]*)$/.test(key)) continue;
    const [r,c]=key.split(':').map(Number);
    const text=cells[r!]?.[c!];
    if(text===undefined) continue;
    const doc=parseTableCellContent(value);
    if(doc&&tableCellPlainText(doc)===text) result[key]=value;
  }
  return result;
}

/** Cell paragraphs inherit cell alignment unless explicitly overridden.
 * Page-level break commands are intentionally excluded inside table cells. */
export const CELL_PARAGRAPH_FORMATS = ['omiAlign','omiLeftIndent','omiRightIndent','omiFirstLineIndent','omiSpaceBefore','omiSpaceAfter','omiLineSpacing','omiLineRule','omiParagraphBackground','omiParagraphBorders','omiParagraphTabs'] as const satisfies readonly ParagraphFormat[];
export function normalizeCellParagraphAttrs(attrs:Record<string,unknown>|undefined):Record<string,unknown>{
  const result:Record<string,unknown>={};
  for(const name of CELL_PARAGRAPH_FORMATS){
    const value=normalizeParagraphValue(name,attrs?.[name]);
    if(value!==undefined) result[name]=value;
  }
  if(result.omiLineSpacing===undefined) delete result.omiLineRule;
  return result;
}
export function effectiveCellParagraphAttrs(attrs:Record<string,unknown>|undefined,alignment:OmiTableCellFormat['horizontalAlign']):Record<string,unknown>{
  return {...(alignment?{omiAlign:alignment}:{}),...normalizeCellParagraphAttrs(attrs)};
}
