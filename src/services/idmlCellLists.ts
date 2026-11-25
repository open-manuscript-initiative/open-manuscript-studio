import { normalizeListAttribute, type ListAttribute } from '../model/directListFormatting';
import type { NoteJsonNode } from '../model/noteRichText';

type Props=Record<string,string>;
type ListAttrs=Record<string,unknown>;
type Report=(code:string)=>void;
export interface IdmlCellParagraph {node:NoteJsonNode;properties?:Props}
interface ListInfo {
  kind:'orderedList'|'bulletList';
  level:number;
  sequence:string;
  attrs:ListAttrs;
  start:number;
  restart:boolean;
  continues:boolean;
}
const FORMATS:Record<string,string>={
  '1, 2, 3, 4...':'decimal','I, II, III, IV...':'upperRoman','i, ii, iii, iv...':'lowerRoman',
  'A, B, C, D...':'upperLetter','a, b, c, d...':'lowerLetter','01, 02, 03, 04...':'decimalZero',
};
function finite(value:string|undefined):number|undefined{
  if(value===undefined||!value.trim())return undefined;
  const n=Number(value);return Number.isFinite(n)?n:undefined;
}
function sequenceName(p:Props):string{
  return p.AppliedNumberingList&&p.AppliedNumberingList!=='n'?p.AppliedNumberingList:'';
}
function readList(p:Props,report:Report):ListInfo|undefined{
  const type=p.BulletsAndNumberingListType;
  if(type!=='NumberedList'&&type!=='BulletList')return undefined;
  const ordered=type==='NumberedList';
  const attrs:ListAttrs={};
  const put=(name:ListAttribute,value:unknown)=>{
    const normalized=normalizeListAttribute(name,value);
    if(normalized!==undefined)attrs[name]=normalized;
    else if(value!==undefined)report('native-list-property-partial');
  };
  const rawLevel=finite(p.NumberingLevel);
  const level=typeof rawLevel==='number'&&Number.isInteger(rawLevel)&&rawLevel>=1&&rawLevel<=9?rawLevel-1:0;
  if(rawLevel!==undefined&&rawLevel!==level+1)report('native-list-level-partial');
  put('omiListLevel',level);
  const left=finite(p.LeftIndent),first=finite(p.FirstLineIndent);
  if(left!==undefined)put('omiListLeft',Math.round(left*20));
  if(first!==undefined){
    if(first<=0)put('omiListHanging',Math.round(-first*20));
    else report('native-list-positive-first-indent');
  }
  let start=1;
  if(ordered){
    const format=p.NumberingFormat&&Object.hasOwn(FORMATS,p.NumberingFormat)?FORMATS[p.NumberingFormat]!:'decimal';
    if(p.NumberingFormat&&!Object.hasOwn(FORMATS,p.NumberingFormat))report('native-list-format-partial');
    put('omiListFormat',format);
    const validStart=normalizeListAttribute('omiListStart',p.NumberingStartAt);
    if(typeof validStart==='number')start=validStart;
    else if(p.NumberingStartAt!==undefined)report('native-list-start-partial');
    const raw=p.NumberingExpression??'^#.^t';
    const expression=raw.endsWith('^t')?raw.slice(0,-2):raw;
    if(!raw.endsWith('^t'))report('native-list-separator-partial');
    // Parent counters and special InDesign escapes cannot be inferred.
    if((expression.match(/\^#/g)??[]).length===1&&!expression.replace('^#','').includes('^')&&!/%[1-9]/.test(expression)){
      put('omiListLabel',expression.replace('^#','%'+(level+1)));
    }else{
      put('omiListLabel','%'+(level+1)+'.');
      report('native-list-pattern-partial');
    }
  }else{
    put('omiListFormat','bullet');
    const code=finite(p.BulletCharacterValue);
    if(code!==undefined&&Number.isInteger(code)&&code>=32&&code<=0x10ffff&&!(code>=0xd800&&code<=0xdfff)&&p.BulletCharacterType!=='GlyphWithFont'){
      put('omiListLabel',String.fromCodePoint(code));
      if(p.BulletCharacterType==='UnicodeWithFont')report('native-list-bullet-font-partial');
    }else{
      put('omiListLabel','•');
      if(p.BulletCharacterValue!==undefined||p.BulletCharacterType==='GlyphWithFont')report('native-list-bullet-partial');
    }
    if(p.BulletsTextAfter&&p.BulletsTextAfter!=='^t')report('native-list-separator-partial');
  }
  if(p.NumberingCharacterStyle&&p.NumberingCharacterStyle!=='CharacterStyle/$ID/[None]'&&p.NumberingCharacterStyle!=='n')report('native-list-marker-style-partial');
  if(p.BulletsCharacterStyle&&p.BulletsCharacterStyle!=='CharacterStyle/$ID/[None]'&&p.BulletsCharacterStyle!=='n')report('native-list-marker-style-partial');
  return {kind:ordered?'orderedList':'bulletList',level,sequence:sequenceName(p),attrs,start,restart:ordered&&p.NumberingContinue==='false',continues:ordered&&p.NumberingContinue==='true'};
}
interface Frame {info:ListInfo;list:NoteJsonNode;last:NoteJsonNode;signature:string;count:number}
export interface IdmlListImportContext {
  ids:Map<string,string>;
  seenCells:Set<string>;
  nextId:number;
}
/** Rebuild a bounded list tree from a cell's paragraph stream. A nested table
 * or ordinary paragraph ends a list; only a matching explicit list reference
 * can identify an unnumbered continuation. Never synthesize missing parents. */
export function reconstructIdmlCellLists(records:readonly IdmlCellParagraph[],context:IdmlListImportContext,report:Report):NoteJsonNode[]{
  const result:NoteJsonNode[]=[];
  const stack:Frame[]=[];
  const counters=new Map<string,number>();
  const seenHere=new Set<string>();
  const counterKey=(info:ListInfo)=>JSON.stringify([info.sequence,info.level,info.kind]);
  for(const record of records){
    const p=record.properties??{};
    const info=record.node.type==='paragraph'?readList(p,report):undefined;
    if(!info){
      const reference=sequenceName(p);
      // Studio emits a named list reference on a NoList continuation; plain
      // indented paragraphs are never guessed to belong to a list.
      let continuation=-1;
      if(p.BulletsAndNumberingListType==='NoList'&&reference){
        for(let i=stack.length-1;i>=0;i--)if(stack[i]!.info.sequence===reference){continuation=i;break;}
      }
      if(continuation>=0&&record.node.type==='paragraph'){
        stack.length=continuation+1;
        stack[continuation]!.last.content!.push(record.node);
      }else{
        stack.length=0;result.push(record.node);
      }
      continue;
    }
    const key=counterKey(info);
    if(info.sequence&&!seenHere.has(info.sequence)){
      if(context.seenCells.has(info.sequence)&&info.continues)report('native-list-cross-cell-continuation');
      context.seenCells.add(info.sequence);seenHere.add(info.sequence);
    }
    while(stack.length&&stack.at(-1)!.info.level>info.level)stack.pop();
    const signature=JSON.stringify([info.kind,info.sequence,info.attrs]);
    const top=stack.at(-1);
    let frame:Frame|undefined;
    if(top?.info.level===info.level){
      if(top.signature===signature&&!info.restart)frame=top;
      else stack.pop();
    }
    if(!frame){
      const parent=stack.at(-1);
      if(parent&&info.level>parent.info.level+1)report('native-list-level-gap');
      if(stack.length>=8){stack.length=0;report('native-list-level-gap');}
      const attrs={...info.attrs};
      if(info.sequence){
        let id=context.ids.get(info.sequence);
        if(!id){id='idml-list-'+(++context.nextId);context.ids.set(info.sequence,id);}
        attrs.omiListId=id;
      }
      let start=info.start;
      if(info.kind==='orderedList'){
        const previous=counters.get(key);
        if(!info.restart&&info.sequence&&previous!==undefined){
          if(previous>=999999){report('native-list-start-partial');start=999999;}
          else start=previous+1;
        }else if(info.continues&&previous===undefined)report('native-list-continuation-start-unknown');
        attrs.start=start;attrs.omiListStart=start;
        if(info.restart)attrs.omiListOverrideStart=start;
      }
      const list:NoteJsonNode={type:info.kind,attrs,content:[]};
      const item:NoteJsonNode={type:'listItem',content:[record.node]};
      list.content!.push(item);
      const activeParent=stack.at(-1);
      if(activeParent)activeParent.last.content!.push(list);else result.push(list);
      frame={info,list,last:item,signature,count:start};
      stack.push(frame);
    }else{
      const item:NoteJsonNode={type:'listItem',content:[record.node]};
      frame.list.content!.push(item);frame.last=item;frame.count++;
    }
    if(info.kind==='orderedList')counters.set(key,frame.count);
  }
  return result;
}
