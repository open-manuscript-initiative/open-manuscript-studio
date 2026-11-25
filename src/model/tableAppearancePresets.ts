import type { OmiTableBlockData, OmiTableCellFormat } from '../types/omi';
import { normalizeTableCellAppearance, normalizeTableCellEdges, tableCellFormat, tableHeaderRows, tableRangeAnchors, pruneTableCellFormats, type TableCellPosition } from './tableLayout';

export type CellStylePreset={kind:'cell';name:string;format:OmiTableCellFormat};
export type TableStylePreset={kind:'table';name:string;header:OmiTableCellFormat;body:OmiTableCellFormat;alternate?:OmiTableCellFormat};
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
  if(raw.kind==='table'&&raw.header&&typeof raw.header==='object'&&raw.body&&typeof raw.body==='object') return {kind:'table',name,header:normalizePresetFormat(raw.header,false),body:normalizePresetFormat(raw.body,false),...(raw.alternate&&typeof raw.alternate==='object'?{alternate:normalizePresetFormat(raw.alternate,false)}:{})};
  return undefined;
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
  const headers=tableHeaderRows(table.cells,table.headerRows);
  for(const {row,column} of targets){
    const key=row+':'+column;
    if(valid.kind==='cell') formats[key]=normalizePresetFormat(valid.format,true);
    else{
      const source=row<headers?valid.header:valid.alternate&&(row-headers)%2===1?valid.alternate:valid.body;
      const existing=tableCellFormat(formats,row,column);
      formats[key]={textRotation:existing.textRotation,textDirection:existing.textDirection,...normalizePresetFormat(source,false)};
    }
  }
  return {...table,cellFormats:formats};
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
  return {...current,items:[...current.items,valid]};
}
export function removePublicationTablePreset(catalog:PublicationTableStyles,name:string):PublicationTableStyles{
  return {items:catalog.items.filter(p=>p.name!==name),...(catalog.defaultTableStyle&&catalog.defaultTableStyle!==name?{defaultTableStyle:catalog.defaultTableStyle}:{})};
}
/** Apply a snapshot default only to deliberately created, blank tables.
 * Never implicitly restyle imported data or existing publication tables. */
export function applyDefaultPublicationTableStyle(table:OmiTableBlockData,catalog:PublicationTableStyles|undefined):OmiTableBlockData{
  const valid=normalizePublicationTableStyles(catalog);
  const preset=valid?.items.find(p=>p.kind==='table'&&p.name===valid.defaultTableStyle);
  if(!preset||table.provenance||table.cellContent||Object.keys(table.cellFormats??{}).length||table.cells.some(row=>row.some(cell=>cell!=='')))return table;
  return applyAppearancePreset(table,preset,{row:0,column:0},{row:0,column:0});
}
