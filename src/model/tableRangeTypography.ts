import type { OmiTableBlockData } from '../types/omi';
import type { NoteJsonNode } from './noteRichText';
import { normalizeDirectValue, type DirectFormat } from './directFormatting';
import { normalizeParagraphValue } from './directParagraphFormatting';
import { CELL_PARAGRAPH_FORMATS, normalizeCellParagraphAttrs, parseTableCellContent, plainTableCellDocument, tableCellDocument, tableCellPlainText, tableRangeAnchors, type TableCellPosition } from './tableLayout';

export const RANGE_MARKS=['bold','italic','omiUnderline','strike','omiSmallCaps','omiSuperscript','omiSubscript'] as const;
export type RangeMark=typeof RANGE_MARKS[number];
export const RANGE_DIRECT_FORMATS=['omiFontSize','omiTextColor','omiCharacterBackground','omiTracking','omiBaseline','omiCharacterScale','omiKerning'] as const satisfies readonly DirectFormat[];
export type RangeDirectFormat=typeof RANGE_DIRECT_FORMATS[number];
export type RangeParagraphFormat=typeof CELL_PARAGRAPH_FORMATS[number];
export type RangeTypographyChange=
  |{kind:'mark';name:RangeMark;enabled:boolean}
  |{kind:'direct';name:RangeDirectFormat;value:string|number|null}
  |{kind:'paragraph';name:RangeParagraphFormat;value:string|number|null}
  |{kind:'lineSpacing';rule:'auto'|'exact'|'atLeast';value:number|null};

function visitParagraphs(doc:NoteJsonNode,visit:(paragraph:NoteJsonNode)=>void):void {
  // A nested table has its own independent selection and formatting scope.
  if(doc.type==='omiCellTable') return;
  if(doc.type==='paragraph'){visit(doc);return;}
  for(const child of doc.content??[]) visitParagraphs(child,visit);
}
function selectedDocuments(table:OmiTableBlockData,start:TableCellPosition,end:TableCellPosition){
  return tableRangeAnchors(table.cells,start,end,table.cellMerges,table.headerRows).flatMap(({row,column})=>{
    const key=row+':'+column;
    const rich=tableCellDocument(table,row,column);
    // Do not overwrite an invalid existing rich document with plain text.
    if(table.cellContent?.[key]!==undefined&&!rich) return [];
    return [{key,doc:rich??plainTableCellDocument(table.cells[row]?.[column]??'')}];
  });
}
export type RangeMarkState='on'|'off'|'mixed'|'empty';
export function rangeMarkStates(table:OmiTableBlockData,start:TableCellPosition,end:TableCellPosition):Record<RangeMark,RangeMarkState>{
  const counts=new Map<RangeMark,number>(RANGE_MARKS.map(name=>[name,0]));
  let total=0;
  for(const {doc} of selectedDocuments(table,start,end)) visitParagraphs(doc,p=>{
    for(const node of p.content??[]){
      if(node.type!=='text'||!node.text)continue;
      total++;
      for(const name of RANGE_MARKS) if(node.marks?.some(mark=>mark.type===name))counts.set(name,(counts.get(name)??0)+1);
    }
  });
  return Object.fromEntries(RANGE_MARKS.map(name=>[name,total===0?'empty':counts.get(name)===0?'off':counts.get(name)===total?'on':'mixed'])) as Record<RangeMark,RangeMarkState>;
}
/** Change exactly one property in existing text/paragraphs, retaining unrelated
 * marks, list structure, note atoms, nested tables and the plain matrix.
 * Null removes a direct override; invalid values never act as a reset. */
export function applyRangeTypography(table:OmiTableBlockData,start:TableCellPosition,end:TableCellPosition,change:RangeTypographyChange):OmiTableBlockData {
  let value:string|number|boolean|undefined;
  if(change.kind==='mark'&&!RANGE_MARKS.includes(change.name))return table;
  if(change.kind==='direct'){
    if(!RANGE_DIRECT_FORMATS.includes(change.name))return table;
    value=change.value===null?undefined:normalizeDirectValue(change.name,change.value);
    if(change.value!==null&&value===undefined)return table;
  }
  if(change.kind==='paragraph'){
    if(!CELL_PARAGRAPH_FORMATS.includes(change.name)||change.name==='omiLineRule'||change.name==='omiLineSpacing')return table;
    value=change.value===null?undefined:normalizeParagraphValue(change.name,change.value);
    if(change.value!==null&&value===undefined)return table;
  }
  if(change.kind==='lineSpacing'){
    if(!['auto','exact','atLeast'].includes(change.rule))return table;
    value=change.value===null?undefined:normalizeParagraphValue('omiLineSpacing',change.value);
    if(change.value!==null&&value===undefined)return table;
  }
  const targets=tableRangeAnchors(table.cells,start,end,table.cellMerges,table.headerRows);
  const docs=selectedDocuments(table,start,end);
  if(docs.length!==targets.length)return table;
  const cellContent={...table.cellContent};
  let changed=false;
  for(const {key,doc} of docs){
    const before=JSON.stringify(doc);
    visitParagraphs(doc,p=>{
      if(change.kind==='paragraph'||change.kind==='lineSpacing'){
        const attrs={...p.attrs};
        if(change.kind==='lineSpacing'){
          if(value===undefined){delete attrs.omiLineSpacing;delete attrs.omiLineRule;}
          else{attrs.omiLineSpacing=value;attrs.omiLineRule=change.rule;}
        }else if(value===undefined)delete attrs[change.name];
        else attrs[change.name]=value;
        const normalized=normalizeCellParagraphAttrs(attrs);
        if(Object.keys(normalized).length)p.attrs=normalized;else delete p.attrs;
        return;
      }
      for(const node of p.content??[]){
        if(node.type!=='text'||!node.text)continue;
        const existing=node.marks??[];
        const enabled=change.kind==='mark'?change.enabled:value!==undefined;
        const other=change.kind==='mark'&&enabled?(change.name==='omiSuperscript'?'omiSubscript':change.name==='omiSubscript'?'omiSuperscript':undefined):undefined;
        const original=existing.find(mark=>mark.type===change.name);
        // Enabling underline must not replace an existing underline variant.
        const replacement=enabled?(change.kind==='mark'?(original??{type:change.name}):{type:change.name,attrs:{value}}):undefined;
        const marks=existing.filter(mark=>mark.type!==change.name&&(!other||mark.type!==other));
        if(replacement)marks.push(replacement);
        if(marks.length)node.marks=marks;else delete node.marks;
      }
    });
    const serialized=JSON.stringify(doc);
    if(before===serialized)continue;
    const valid=parseTableCellContent(serialized);
    const [row,column]=key.split(':').map(Number);
    if(!valid||tableCellPlainText(valid)!==table.cells[row!]?.[column!])return table;
    cellContent[key]=JSON.stringify(valid);changed=true;
  }
  return changed?{...table,cellContent}:table;
}
