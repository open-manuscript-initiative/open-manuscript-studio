import type { OmiTableBlockData, OmiTableCellFormat, OmiBlock, OmiSection } from '../types/omi';
import { normalizeTableCellAppearance, normalizeTableCellEdges, tableCellFormat, tableHeaderRows, tableRangeAnchors, pruneTableCellFormats, prunePublicationCellStyles, tableMergeLayout, parseTableCellContent, cellNestedTable, MAX_NESTED_TABLE_DEPTH, type TableCellPosition } from './tableLayout';

export type CellStylePreset={kind:'cell';name:string;format:OmiTableCellFormat};
export type TableStylePreset={kind:'table';name:string;basedOn?:string;header:OmiTableCellFormat;body:OmiTableCellFormat;alternate?:OmiTableCellFormat;firstColumn?:OmiTableCellFormat;lastColumn?:OmiTableCellFormat;summary?:OmiTableCellFormat;conditions?:TableCondition[]};
export type TableConditionOperator='eq'|'contains'|'lt'|'lte'|'gt'|'gte'|'empty'|'nonempty';
export type TableCondition={operator:TableConditionOperator;value?:string;format:OmiTableCellFormat};
export const MAX_TABLE_CONDITIONS=24;
const CONDITION_OPERATORS=['eq','contains','lt','lte','gt','gte','empty','nonempty'] as const;
export type TableStyleRegion='header'|'body'|'alternate'|'firstColumn'|'lastColumn'|'summary';
const OPTIONAL_REGIONS=['alternate','firstColumn','lastColumn','summary'] as const;
export type TableAppearancePreset=CellStylePreset|TableStylePreset;
export const TABLE_STYLE_STORAGE_KEY='omi.table-appearance-presets.v1';
export const MAX_TABLE_PRESETS=50;
const line={style:'solid',widthPt:0.5,color:'#555555'} as const;
const none={style:'none'} as const;
const padding={top:3,right:5,bottom:3,left:5};
const grid={top:line,right:line,bottom:line,left:line};
const horizontal={top:none,right:none,bottom:line,left:none};
export const BUILTIN_TABLE_STYLES={
  grid:{kind:'table',name:'grid',header:{backgroundColor:'#E6E6E6',borders:grid,paddingPt:padding},body:{borders:grid,paddingPt:padding}},
  minimal:{kind:'table',name:'minimal',header:{borders:{...horizontal,top:line},paddingPt:padding},body:{borders:horizontal,paddingPt:padding}},
  banded:{kind:'table',name:'banded',header:{backgroundColor:'#DCE6F1',borders:grid,paddingPt:padding},body:{borders:grid,paddingPt:padding},alternate:{backgroundColor:'#F1F4F7',borders:grid,paddingPt:padding}},
} satisfies Record<string,TableStylePreset>;

/** Presets contain presentation only, never cell text or document identifiers. */
export function normalizePresetFormat(value:unknown,includeDirection:boolean):OmiTableCellFormat {
  const raw=value&&typeof value==='object'?value as OmiTableCellFormat:undefined;
  const format=tableCellFormat(raw?{'0:0':raw}:undefined,0,0);
  return {...(includeDirection?{textRotation:format.textRotation,textDirection:format.textDirection}:{}),...normalizeTableCellAppearance(format),...normalizeTableCellEdges(format)};
}
export function normalizeAppearancePreset(value:unknown):TableAppearancePreset|undefined {
  if(!value||typeof value!=='object') return undefined;
  const raw=value as Record<string,unknown>;
  const name=typeof raw.name==='string'?raw.name.trim():'';
  if(!name||name.length>80) return undefined;
  if(raw.kind==='cell'&&raw.format&&typeof raw.format==='object') return {kind:'cell',name,format:normalizePresetFormat(raw.format,true)};
  if(raw.kind==='table'&&raw.header&&typeof raw.header==='object'&&raw.body&&typeof raw.body==='object'){
    const result:TableStylePreset={kind:'table',name,header:normalizePresetFormat(raw.header,false),body:normalizePresetFormat(raw.body,false)};
    if(typeof raw.basedOn==='string'&&raw.basedOn.length>0&&raw.basedOn.length<=80&&raw.basedOn.trim()===raw.basedOn)result.basedOn=raw.basedOn;
    for(const region of OPTIONAL_REGIONS)if(raw[region]&&typeof raw[region]==='object'&&!Array.isArray(raw[region]))result[region]=normalizePresetFormat(raw[region],false);
    if(Array.isArray(raw.conditions))result.conditions=raw.conditions.slice(0,MAX_TABLE_CONDITIONS).flatMap(entry=>{const rule=normalizeTableCondition(entry);return rule?[rule]:[];});
    return result;
  }
  return undefined;
}
/** Strict decimal input, including a single comma decimal separator. No
 * grouping, units, exponent, formula, or locale-dependent coercion. */
function conditionNumber(value:string):number|undefined{
  const text=value.trim();
  if(!/^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(text))return undefined;
  const n=Number(text.replace(',','.'));
  return Number.isFinite(n)?n:undefined;
}
export function normalizeTableCondition(value:unknown):TableCondition|undefined{
  if(!value||typeof value!=='object'||Array.isArray(value))return undefined;
  const raw=value as Record<string,unknown>;
  const operator=CONDITION_OPERATORS.find(op=>op===raw.operator);
  if(!operator||!raw.format||typeof raw.format!=='object'||Array.isArray(raw.format))return undefined;
  const format=normalizePresetFormat(raw.format,false);
  if(!Object.keys(format).length)return undefined;
  if(operator==='empty'||operator==='nonempty')return {operator,format};
  if(typeof raw.value!=='string'||raw.value.length>256||!raw.value.trim())return undefined;
  const operand=raw.value.trim();
  if(operator!=='eq'&&operator!=='contains'&&conditionNumber(operand)===undefined)return undefined;
  return {operator,value:operand,format};
}
export function matchesTableCondition(rule:TableCondition,cell:string):boolean{
  const text=cell.trim(),operand=rule.value??'';
  if(rule.operator==='empty')return !text;
  if(rule.operator==='nonempty')return !!text;
  if(rule.operator==='eq')return text===operand;
  if(rule.operator==='contains')return text.includes(operand);
  const a=conditionNumber(text),b=conditionNumber(operand);
  if(a===undefined||b===undefined)return false;
  switch(rule.operator){case 'lt':return a<b;case 'lte':return a<=b;case 'gt':return a>b;case 'gte':return a>=b;default:return false;}
}
export function readAppearancePresets(json:string|null):TableAppearancePreset[]{
  if(!json||json.length>1000000) return [];
  try{
    const raw:unknown=JSON.parse(json);
    if(!Array.isArray(raw)) return [];
    const result:TableAppearancePreset[]=[];
    for(const item of raw.slice(0,MAX_TABLE_PRESETS)){
      const preset=normalizeAppearancePreset(item);
      if(preset&&!result.some(p=>p.name===preset.name)) result.push(preset);
    }
    return result;
  }catch{return [];}
}
export function captureCellPreset(table:OmiTableBlockData,position:TableCellPosition,name:string):CellStylePreset{
  const anchor=tableRangeAnchors(table.cells,position,position,table.cellMerges,table.headerRows)[0]??position;
  return {kind:'cell',name,format:normalizePresetFormat(table.cellFormats?.[anchor.row+':'+anchor.column],true)};
}
/** Capture representative header and first body rows, not table contents or geometry. */
export function captureTablePreset(table:OmiTableBlockData,name:string,banded:boolean):TableStylePreset{
  const headerRows=tableHeaderRows(table.cells,table.headerRows);
  const last=Math.max(0,table.cells.length-1);
  const sample=(row:number)=>normalizePresetFormat(table.cellFormats?.[Math.min(row,last)+':0'],false);
  return {kind:'table',name,header:sample(0),body:sample(headerRows),...(banded&&headerRows+1<=last?{alternate:sample(headerRows+1)}:{})};
}
/** Materialize styles into existing cell properties so existing exporters and OMI
 * reopening need no access to a local preset catalog. Table styles leave text
 * direction and rotation unchanged; cell styles replace them explicitly. */
export function applyAppearancePreset(table:OmiTableBlockData,preset:TableAppearancePreset,start:TableCellPosition,end:TableCellPosition):OmiTableBlockData{
  const valid=normalizeAppearancePreset(preset);
  if(!valid) return table;
  const last={row:table.cells.length-1,column:(table.cells[0]?.length??0)-1};
  const targets=valid.kind==='table'?tableRangeAnchors(table.cells,{row:0,column:0},last,table.cellMerges,table.headerRows):tableRangeAnchors(table.cells,start,end,table.cellMerges,table.headerRows);
  if(!targets.length) return table;
  const formats=pruneTableCellFormats(table.cells,table.cellFormats);
  const bindings=prunePublicationCellStyles(table.cells,table.publicationCellStyles);
  const headers=tableHeaderRows(table.cells,table.headerRows);
  for(const {row,column} of targets){
    const key=row+':'+column;
    if(valid.kind==='cell'){formats[key]=normalizePresetFormat(valid.format,true);delete bindings[key];}
    else{
      if(bindings[key])continue;
      const source=regionFormat(valid,row,headers,column,table.cells.length,table.cells[row]?.length??0,table.cells[row]?.[column]??'');
      const existing=tableCellFormat(formats,row,column);
      formats[key]={textRotation:existing.textRotation,textDirection:existing.textDirection,...normalizePresetFormat(source,false)};
    }
  }
  // Applying a non-publication table preset explicitly replaces the live link.
  const next={...table,cellFormats:formats};
  if(Object.keys(bindings).length)next.publicationCellStyles=bindings;else delete next.publicationCellStyles;
  if(valid.kind==='table')delete next.publicationTableStyle;
  return next;
}

/** Portable, presentation-only catalog embedded in a publication style snapshot. */
export interface PublicationTableStyles {
  items:TableAppearancePreset[];
  defaultTableStyle?:string;
}
export function normalizePublicationTableStyles(value:unknown):PublicationTableStyles|undefined{
  if(!value||typeof value!=='object'||Array.isArray(value))return undefined;
  const raw=value as Record<string,unknown>;
  if(!Array.isArray(raw.items))return undefined;
  const items:TableAppearancePreset[]=[];
  for(const entry of raw.items.slice(0,MAX_TABLE_PRESETS)){
    const preset=normalizeAppearancePreset(entry);
    if(preset&&!items.some(p=>p.name===preset.name))items.push(preset);
  }
  // Strip invalid links during tolerant normalization; strict import validation
  // rejects the resulting mismatch, including missing parents and cycles.
  const validParents=items.filter((p):p is TableStylePreset=>p.kind==='table');
  for(let i=0;i<items.length;i++){
    const preset=items[i];
    if(preset?.kind==='table'&&preset.basedOn&&!resolveTablePreset(validParents,preset.name)){
      const flat={...preset};delete flat.basedOn;items[i]=flat;
    }
  }
  const defaultTableStyle=typeof raw.defaultTableStyle==='string'&&items.some(p=>p.kind==='table'&&p.name===raw.defaultTableStyle)?raw.defaultTableStyle:undefined;
  return {items,...(defaultTableStyle?{defaultTableStyle}:{})};
}
/** Reject untrusted extra fields and noncanonical property values at the
 * template/profile boundary. Existing documents without a catalog stay valid. */
export function validatePublicationTableStyles(value:unknown):void{
  const normalized=normalizePublicationTableStyles(value);
  const canonical=(v:unknown):unknown=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).filter(([,x])=>x!==undefined).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,x])=>[k,canonical(x)])):v;
  if(!normalized||JSON.stringify(canonical(value))!==JSON.stringify(canonical(normalized)))throw new Error('Invalid publication table styles.');
}
export function putPublicationTablePreset(catalog:PublicationTableStyles|undefined,preset:TableAppearancePreset):PublicationTableStyles|undefined{
  const current=normalizePublicationTableStyles(catalog)??{items:[]};
  const valid=normalizeAppearancePreset(preset);
  if(!valid||current.items.length>=MAX_TABLE_PRESETS||current.items.some(p=>p.name===valid.name))return undefined;
  const next={...current,items:[...current.items,valid]};
  if(valid.kind==='table'&&!resolveTablePreset(next.items,valid.name))return undefined;
  return next;
}
export function removePublicationTablePreset(catalog:PublicationTableStyles,name:string):PublicationTableStyles{
  const items=catalog.items.filter(p=>p.name!==name).map(p=>p.kind==='table'&&p.basedOn===name?resolveTablePreset(catalog.items,p.name)??p:p);
  return {items,...(catalog.defaultTableStyle&&catalog.defaultTableStyle!==name?{defaultTableStyle:catalog.defaultTableStyle}:{})};
}
/** Apply a snapshot default only to deliberately created, blank tables.
 * Never implicitly restyle imported data or existing publication tables. */
export function applyDefaultPublicationTableStyle(table:OmiTableBlockData,catalog:PublicationTableStyles|undefined):OmiTableBlockData{
  const valid=normalizePublicationTableStyles(catalog);
  const preset=valid?.items.find(p=>p.kind==='table'&&p.name===valid.defaultTableStyle);
  if(!preset||table.provenance||table.cellContent||Object.keys(table.cellFormats??{}).length||table.cells.some(row=>row.some(cell=>cell!=='')))return table;
  return bindPublicationTableStyle(table,valid,preset.name);
}

/** Bind by catalog name; retain materialized formatting for portable exports. */
export function bindPublicationTableStyle(table:OmiTableBlockData,catalog:PublicationTableStyles|undefined,name:string):OmiTableBlockData{
  const preset=resolvePublicationTablePreset(catalog,name);
  if(!preset)return table;
  return {...applyAppearancePreset(table,preset,{row:0,column:0},{row:0,column:0}),publicationTableStyle:name};
}
export function detachPublicationTableStyle(table:OmiTableBlockData):OmiTableBlockData{
  if(!table.publicationTableStyle)return table;
  const next={...table};delete next.publicationTableStyle;return next;
}
/** Replace a definition without changing its name or default assignment. */
export function replacePublicationTablePreset(catalog:PublicationTableStyles,preset:TableAppearancePreset):PublicationTableStyles|undefined{
  const valid=normalizeAppearancePreset(preset);
  if(!valid||!catalog.items.some(p=>p.kind===valid.kind&&p.name===valid.name))return undefined;
  const next={...catalog,items:catalog.items.map(p=>p.name===valid.name?valid:p)};
  if(valid.kind==='table'&&!resolveTablePreset(next.items,valid.name))return undefined;
  return next;
}
function sameFormat(a:unknown,b:unknown):boolean{
  return JSON.stringify(a)===JSON.stringify(b);
}
/** A definition edit updates only cells that are linked to that named style.
 * Explicit cell-level overrides survive (borders and padding are atomic groups).
 * Removing a definition freezes the current appearance and detaches its tables. */
export function refreshPublicationTableStyle(table:OmiTableBlockData,previous:PublicationTableStyles|undefined,next:PublicationTableStyles|undefined):OmiTableBlockData{
  const name=table.publicationTableStyle;
  if(!name)return table;
  const old=resolvePublicationTablePreset(previous,name);
  const current=resolvePublicationTablePreset(next,name);
  if(!current||current.kind!=='table')return detachPublicationTableStyle(table);
  if(sameFormat(old,current))return table;
  if(!old||old.kind!=='table')return bindPublicationTableStyle(table,next,name);
  return materializeInheritedGeometry(table,table,old,current);
}
/** Resolve sparse child patches without mutating the portable definitions. */
function resolveTablePreset(items:readonly TableAppearancePreset[],name:string,seen=new Set<string>()):TableStylePreset|undefined{
  if(seen.has(name)||seen.size>=MAX_TABLE_PRESETS)return undefined;
  const preset=items.find(p=>p.kind==='table'&&p.name===name);
  if(!preset||preset.kind!=='table')return undefined;
  if(!preset.basedOn)return preset;
  const parent=resolveTablePreset(items,preset.basedOn,new Set([...seen,name]));
  if(!parent)return undefined;
  const result:TableStylePreset={kind:'table',name,header:{...parent.header,...preset.header},body:{...parent.body,...preset.body}};
  for(const region of OPTIONAL_REGIONS){
    if(parent[region]||preset[region])result[region]={...parent[region],...preset[region]};
  }
  if(preset.conditions!==undefined||parent.conditions!==undefined)result.conditions=preset.conditions??parent.conditions;
  return result;
}
export function resolvePublicationTablePreset(catalog:PublicationTableStyles|undefined,name:string):TableStylePreset|undefined{
  return resolveTablePreset(normalizePublicationTableStyles(catalog)?.items??[],name);
}
export function derivePublicationTablePreset(catalog:PublicationTableStyles,name:string,basedOn:string):PublicationTableStyles|undefined{
  return putPublicationTablePreset(catalog,{kind:'table',name,basedOn,header:{},body:{}});
}
/** Header wins over body regions. Within body: base, band, first column,
 * last column, summary (last body row), then named cell/direct overrides. */
function regionFormat(preset:TableStylePreset,row:number,headers:number,column:number,rows:number,columns:number,value:string):OmiTableCellFormat{
  if(row<headers)return normalizePresetFormat(preset.header,false);
  // Legacy alternate formats replace the body; extended regions overlay it.
  const base=preset.alternate&&(row-headers)%2===1?preset.alternate:preset.body;
  const format={...base,...(column===0?preset.firstColumn:{}),...(column===columns-1?preset.lastColumn:{}),...(row===rows-1?preset.summary:{})};
  for(const condition of preset.conditions??[])if(matchesTableCondition(condition,value))Object.assign(format,condition.format);
  return normalizePresetFormat(format,false);
}
/** Map old visible anchors to their new coordinates; new anchors inherit the
 * new region, while direct appearance differences and text direction travel
 * with existing anchors. Covered cells keep their dormant formatting. */
function materializeInheritedGeometry(previous:OmiTableBlockData,next:OmiTableBlockData,old:TableStylePreset,current:TableStylePreset,sourceAt:(p:TableCellPosition)=>TableCellPosition=p=>p):OmiTableBlockData{
  const formats=pruneTableCellFormats(next.cells,next.cellFormats);
  const oldLayout=tableMergeLayout(previous.cells,previous.cellMerges,previous.headerRows);
  const oldHeaders=tableHeaderRows(previous.cells,previous.headerRows);
  const headers=tableHeaderRows(next.cells,next.headerRows);
  const fields=['horizontalAlign','verticalAlign','backgroundColor','borders','paddingPt'] as const;
  for(const {row,column} of tableRangeAnchors(next.cells,{row:0,column:0},{row:next.cells.length-1,column:(next.cells[0]?.length??0)-1},next.cellMerges,next.headerRows)){
    const key=row+':'+column;
    if(next.publicationCellStyles?.[key])continue;
    const source=sourceAt({row,column});
    const oldKey=source.row+':'+source.column;
    const existingAnchor=previous.cells[source.row]?.[source.column]!==undefined&&!oldLayout.covered(source.row,source.column);
    const orientation=tableCellFormat(formats,row,column);
    const format:OmiTableCellFormat={textRotation:orientation.textRotation,textDirection:orientation.textDirection,...regionFormat(current,row,headers,column,next.cells.length,next.cells[row]?.length??0,next.cells[row]?.[column]??'')};
    if(existingAnchor&&previous.cellFormats?.[oldKey]){
      const baseline=regionFormat(old,source.row,oldHeaders,source.column,previous.cells.length,previous.cells[source.row]?.length??0,previous.cells[source.row]?.[source.column]??'');
      const existing=normalizePresetFormat(previous.cellFormats[oldKey],false);
      for(const field of fields){
        if(!sameFormat(existing[field],baseline[field])){
          Object.assign(format,{[field]:existing[field]});
          if(existing[field]===undefined)delete format[field];
        }
      }
    }
    formats[key]=format;
  }
  return sameFormat(formats,next.cellFormats)?next:{...next,cellFormats:formats};
}
/** Recompute banding after append/remove/move/split; sourceAt maps new
 * coordinates back to the old matrix (identity for append/remove/split). */
export function inheritPublicationTableGeometry(previous:OmiTableBlockData,next:OmiTableBlockData,catalog:PublicationTableStyles|undefined,sourceAt?:(p:TableCellPosition)=>TableCellPosition):OmiTableBlockData{
  if(!next.publicationTableStyle||previous.publicationTableStyle!==next.publicationTableStyle)return next;
  const preset=resolvePublicationTablePreset(catalog,next.publicationTableStyle);
  return preset?.kind==='table'?materializeInheritedGeometry(previous,next,preset,preset,sourceAt):next;
}
/** Rich cells store nested tables in their canonical JSON documents. Update
 * only changed documents; the plain text projection and anchors are unchanged. */
export function refreshPublicationTableTree(table:OmiTableBlockData,previous:PublicationTableStyles|undefined,next:PublicationTableStyles|undefined,depth=0):OmiTableBlockData{
  const refreshed=refreshPublicationCellStyles(refreshPublicationTableStyle(table,previous,next),previous,next);
  if(depth>=MAX_NESTED_TABLE_DEPTH||!refreshed.cellContent)return refreshed;
  let content:Record<string,string>|undefined;
  for(const [key,value] of Object.entries(refreshed.cellContent)){
    const doc=parseTableCellContent(value,depth);
    if(!doc)continue;
    let changed=false;
    const nodes=doc.content?.map(node=>{
      const nested=cellNestedTable(node);
      if(!nested)return node;
      const updated=refreshPublicationTableTree(nested,previous,next,depth+1);
      if(updated===nested)return node;
      changed=true;
      return {...node,attrs:{...node.attrs,table:updated}};
    });
    if(changed){
      content??={...refreshed.cellContent};
      content[key]=JSON.stringify({...doc,content:nodes});
    }
  }
  return content?{...refreshed,cellContent:content}:refreshed;
}
/** Traverse section and block trees without rewriting unrelated objects. */
export function refreshPublicationTables(sections:OmiSection[],previous:PublicationTableStyles|undefined,next:PublicationTableStyles|undefined):OmiSection[]{
  if(sameFormat(previous,next))return sections;
  function blocks(items:OmiBlock[]):OmiBlock[]{
    const result=items.map(block=>{
      const visual=block.visual?.kind==='table'?refreshPublicationTableTree(block.visual,previous,next):block.visual;
      const children=block.children?blocks(block.children):undefined;
      return visual===block.visual&&children===block.children?block:{...block,visual,children};
    });
    return result.every((block,i)=>block===items[i])?items:result;
  }
  function visit(items:OmiSection[]):OmiSection[]{
    const result=items.map(section=>{
      const nextBlocks=blocks(section.blocks);
      const children=section.children?visit(section.children):undefined;
      return nextBlocks===section.blocks&&children===section.children?section:{...section,blocks:nextBlocks,children};
    });
    return result.every((section,i)=>section===items[i])?items:result;
  }
  return visit(sections);
}

/** Named cell styles take precedence over the table region. Applying a local
 * cell preset removes that cell's link; applying a table preset keeps links. */
export function bindPublicationCellStyle(table:OmiTableBlockData,catalog:PublicationTableStyles|undefined,name:string,start:TableCellPosition,end:TableCellPosition):OmiTableBlockData{
  const preset=normalizePublicationTableStyles(catalog)?.items.find(p=>p.kind==='cell'&&p.name===name);
  if(!preset||preset.kind!=='cell')return table;
  const targets=tableRangeAnchors(table.cells,start,end,table.cellMerges,table.headerRows);
  if(!targets.length)return table;
  const next=applyAppearancePreset(table,preset,start,end);
  const bindings=prunePublicationCellStyles(next.cells,next.publicationCellStyles);
  for(const {row,column} of targets)bindings[row+':'+column]=name;
  return {...next,publicationCellStyles:bindings};
}
export function detachPublicationCellStyles(table:OmiTableBlockData,start:TableCellPosition,end:TableCellPosition):OmiTableBlockData{
  const bindings=prunePublicationCellStyles(table.cells,table.publicationCellStyles);
  for(const {row,column} of tableRangeAnchors(table.cells,start,end,table.cellMerges,table.headerRows))delete bindings[row+':'+column];
  if(sameFormat(bindings,table.publicationCellStyles??{}))return table;
  const next={...table};
  if(Object.keys(bindings).length)next.publicationCellStyles=bindings;else delete next.publicationCellStyles;
  return next;
}
export function selectedPublicationCellStyles(table:OmiTableBlockData,start:TableCellPosition,end:TableCellPosition):string[]{
  return [...new Set(tableRangeAnchors(table.cells,start,end,table.cellMerges,table.headerRows).flatMap(({row,column})=>{
    const name=table.publicationCellStyles?.[row+':'+column];return name?[name]:[];
  }))];
}
/** Reapply the selected cell's named definition, or its table region if
 * unbound. Table presets do not own rotation or writing direction. */
export function resetInheritedCellAppearance(table:OmiTableBlockData,catalog:PublicationTableStyles|undefined,start:TableCellPosition,end:TableCellPosition):OmiTableBlockData{
  const items=normalizePublicationTableStyles(catalog)?.items??[];
  const preset=table.publicationTableStyle?resolvePublicationTablePreset(catalog,table.publicationTableStyle):undefined;
  const headers=tableHeaderRows(table.cells,table.headerRows);
  const formats=pruneTableCellFormats(table.cells,table.cellFormats);
  for(const {row,column} of tableRangeAnchors(table.cells,start,end,table.cellMerges,table.headerRows)){
    const key=row+':'+column;
    const cell=items.find(p=>p.kind==='cell'&&p.name===table.publicationCellStyles?.[key]);
    if(cell?.kind==='cell')formats[key]=normalizePresetFormat(cell.format,true);
    else if(preset?.kind==='table'){
      const existing=tableCellFormat(formats,row,column);
      formats[key]={textRotation:existing.textRotation,textDirection:existing.textDirection,...regionFormat(preset,row,headers,column,table.cells.length,table.cells[row]?.length??0,table.cells[row]?.[column]??'')};
    }
  }
  return sameFormat(formats,table.cellFormats??{})?table:{...table,cellFormats:formats};
}
/** Definition changes retain direct differences, including direction/rotation.
 * Deleting a definition freezes the resolved cell appearance and removes its link. */
export function refreshPublicationCellStyles(table:OmiTableBlockData,previous:PublicationTableStyles|undefined,next:PublicationTableStyles|undefined):OmiTableBlockData{
  if(!table.publicationCellStyles)return table;
  const before=normalizePublicationTableStyles(previous)?.items??[];
  const after=normalizePublicationTableStyles(next)?.items??[];
  const bindings=prunePublicationCellStyles(table.cells,table.publicationCellStyles);
  const formats=pruneTableCellFormats(table.cells,table.cellFormats);
  const fields=['textRotation','textDirection','horizontalAlign','verticalAlign','backgroundColor','borders','paddingPt'] as const;
  for(const [key,name] of Object.entries(bindings)){
    const old=before.find(p=>p.kind==='cell'&&p.name===name);
    const current=after.find(p=>p.kind==='cell'&&p.name===name);
    if(!current||current.kind!=='cell'){delete bindings[key];continue;}
    if(sameFormat(old,current))continue;
    const format=normalizePresetFormat(current.format,true);
    if(old?.kind==='cell'&&formats[key]){
      const baseline=normalizePresetFormat(old.format,true);
      const existing=normalizePresetFormat(formats[key],true);
      for(const field of fields)if(!sameFormat(existing[field],baseline[field])){
        Object.assign(format,{[field]:existing[field]});
        if(existing[field]===undefined)delete format[field];
      }
    }
    formats[key]=format;
  }
  if(sameFormat(bindings,table.publicationCellStyles)&&sameFormat(formats,table.cellFormats??{}))return table;
  const result={...table,cellFormats:formats};
  if(Object.keys(bindings).length)result.publicationCellStyles=bindings;else delete result.publicationCellStyles;
  return result;
}

/** Copy the raw definition (including ancestry), not its rendered snapshot. */
export function duplicatePublicationTablePreset(catalog:PublicationTableStyles,source:string,name:string):PublicationTableStyles|undefined{
  const preset=catalog.items.find(item=>item.name===source);
  return preset?putPublicationTablePreset(catalog,{...preset,name}):undefined;
}
/** Preview is an isolated sample, never part of the manuscript. */
export function publicationTableStylePreview(catalog:PublicationTableStyles,name:string):OmiTableBlockData{
  const table:OmiTableBlockData={kind:'table',headerRows:1,cells:[['A','B','C'],['1','-15','25'],['2','0',''],['3','10','50'],['Σ','-5','75']]};
  const preset=catalog.items.find(item=>item.name===name);
  if(preset?.kind==='cell')return bindPublicationCellStyle(table,catalog,name,{row:1,column:1},{row:2,column:1});
  return bindPublicationTableStyle(table,catalog,name);
}
