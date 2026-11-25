import { DOMParser as XmlParser, type Element as XmlElement } from '@xmldom/xmldom';
import { OdtZip } from './odtZip';
import { reconstructIdmlCellLists, type IdmlCellParagraph, type IdmlListImportContext } from './idmlCellLists';
import { MAX_VISUAL_IMPORT_BYTES, createTableBlock } from '../model/visualBlocks';
import { MAX_NESTED_TABLE_DEPTH, TABLE_CELL_SIDES, normalizeTableCellAppearance, normalizeTableCellEdges, normalizeTableRowHeight, normalizeCellParagraphAttrs, tableColumnWidths, tableMergeLayout, parseTableCellContent, tableCellPlainText } from '../model/tableLayout';
import { normalizeDirectValue, type DirectFormat } from '../model/directFormatting';
import type { NoteJsonNode } from '../model/noteRichText';
import type { OmiBlock, OmiTableBlockData, OmiTableCellFormat, OmiTableCellMerge, OmiTableRowHeight } from '../types/omi';

type Props=Record<string,string>;
interface Context {styles:Map<string,XmlElement>;colors:Map<string,string>;budget:{cells:number};warnings:Set<string>;lists:IdmlListImportContext}
export interface IdmlTableImportResult {blocks:OmiBlock[];warnings:string[]}
const direct=(node:XmlElement,name:string)=>Array.from(node.children).filter(child=>child.localName===name);
const descendants=(node:XmlElement,name:string)=>Array.from(node.getElementsByTagNameNS('*',name));
function xml(value:string):XmlElement {
  if(/<!DOCTYPE\b|<!ENTITY\b/i.test(value))throw new Error('IDML XML declarations and entities are not supported.');
  const doc=new XmlParser({onError:()=>{throw new Error('Invalid IDML XML.');}}).parseFromString(value,'application/xml');
  if(!doc.documentElement)throw new Error('Invalid IDML XML.');
  return doc.documentElement;
}
function properties(node:XmlElement):Props {
  const result:Props=Object.create(null) as Props;
  for(const attr of Array.from(node.attributes))result[attr.localName??attr.name]=attr.value;
  for(const container of direct(node,'Properties'))for(const child of Array.from(container.children)){
    if(child.localName==='BulletChar'){
      result.BulletCharacterType=child.getAttribute('BulletCharacterType')??'';
      result.BulletCharacterValue=child.getAttribute('BulletCharacterValue')??'';
    }else if(!child.children.length)result[child.localName??child.tagName]=child.textContent??'';
  }
  return result;
}
function resolvedStyle(id:string|undefined,context:Context,seen=new Set<string>()):Props {
  if(!id||id==='n')return {};
  if(seen.has(id)||seen.size>=32){context.warnings.add('style-inheritance-cycle');return {};}
  const style=context.styles.get(id);
  if(!style){if(!id.includes('$ID/'))context.warnings.add('missing-style');return {};}
  const local=properties(style);
  return {...resolvedStyle(local.BasedOn,context,new Set([...seen,id])),...local};
}
function number(value:unknown):number|undefined {
  if(typeof value!=='string'||!value.trim())return undefined;
  const n=Number(value);
  return Number.isFinite(n)?n:undefined;
}
function integer(value:unknown):number|undefined {
  const n=number(value);return n!==undefined&&Number.isSafeInteger(n)&&n>=0?n:undefined;
}
function color(value:string|undefined,context:Context):string|undefined {
  if(!value||value==='Swatch/None'||value==='Color/None'||value==='n'||value.includes('$ID/None'))return undefined;
  if(value==='Color/Black'||value==='Color/$ID/Black')return '#000000';
  if(value==='Color/Paper'||value==='Color/$ID/Paper')return '#FFFFFF';
  const found=context.colors.get(value);
  if(!found)context.warnings.add('unsupported-swatch');
  return found;
}
function registerColors(root:XmlElement,context:Context):void {
  for(const el of descendants(root,'Color')){
    const p=properties(el),values=(p.ColorValue??'').trim().split(/\s+/).map(Number);
    if(!p.Self||!values.every(Number.isFinite))continue;
    const rgb=p.Space==='RGB'&&values.length===3&&values.every(v=>v>=0&&v<=255)?values:undefined;
    if(rgb)context.colors.set(p.Self,'#'+rgb.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('').toUpperCase());
  }
}
function paragraphAttrs(p:Props):Record<string,unknown> {
  const attrs:Record<string,unknown>={};
  for(const [source,target] of [['LeftIndent','omiLeftIndent'],['RightIndent','omiRightIndent'],['FirstLineIndent','omiFirstLineIndent'],['SpaceBefore','omiSpaceBefore'],['SpaceAfter','omiSpaceAfter']])attrs[target!]=number(p[source!]);
  attrs.omiAlign=({LeftAlign:'left',CenterAlign:'center',RightAlign:'right',LeftJustified:'justify',CenterJustified:'justify',RightJustified:'justify',FullyJustified:'justify'} as Props)[p.Justification??''];
  if(p.Leading==='Auto'){const n=number(p.AutoLeading);if(n!==undefined){attrs.omiLineRule='auto';attrs.omiLineSpacing=n/100;}}
  else if(number(p.Leading)!==undefined){attrs.omiLineRule='exact';attrs.omiLineSpacing=number(p.Leading);}
  return normalizeCellParagraphAttrs(attrs);
}
function characterMarks(p:Props,context:Context):NonNullable<NoteJsonNode['marks']>{
  const marks:NonNullable<NoteJsonNode['marks']>=[];
  const toggle=(type:string,on:boolean)=>{if(on)marks.push({type});};
  const value=(type:DirectFormat,raw:unknown)=>{const v=normalizeDirectValue(type,raw);if(v!==undefined)marks.push({type,attrs:{value:v}});};
  const style=p.FontStyle??'';
  toggle('bold',/bold|black|heavy/i.test(style));toggle('italic',/italic|oblique/i.test(style));
  toggle('omiUnderline',p.Underline==='true');toggle('strike',p.StrikeThru==='true');
  toggle('omiSmallCaps',p.Capitalization==='SmallCaps'||p.Capitalization==='AllSmallCaps');
  toggle('omiSuperscript',p.Position==='Superscript'||p.Position==='OTSuperscript');
  toggle('omiSubscript',p.Position==='Subscript'||p.Position==='OTSubscript');
  if(p.AppliedFont&&!p.AppliedFont.startsWith('$ID/')&&p.AppliedFont!=='n')marks.push({type:'omiSourceFont',attrs:{family:p.AppliedFont.replace(/^FontFamily\//,'')}});
  if(p.AppliedLanguage&&!p.AppliedLanguage.startsWith('$ID/'))marks.push({type:'omiLanguage',attrs:{lang:p.AppliedLanguage}});
  value('omiFontSize',p.PointSize);value('omiTextColor',color(p.FillColor,context));value('omiBaseline',p.BaselineShift);value('omiCharacterScale',p.HorizontalScale);
  const size=number(p.PointSize),tracking=number(p.Tracking);
  if(size!==undefined&&tracking!==undefined)value('omiTracking',size*tracking/1000);
  if(p.KerningMethod==='$ID/None')value('omiKerning',0);
  if(p.Capitalization==='AllCaps')value('omiUppercase',true);
  if(p.Ligatures!==undefined||p.OTFDiscretionaryLigature==='true'){
    const standard=p.Ligatures==='true',discretionary=p.OTFDiscretionaryLigature==='true';
    value('omiLigatures',standard?(discretionary?'standardDiscretional':'standard'):discretionary?'discretional':'none');
  }
  return marks;
}
function parseCellBlocks(cell:XmlElement,context:Context,depth:number):NoteJsonNode[]{
  const result:IdmlCellParagraph[]=[];
  function readParagraph(element:XmlElement):void{
    const raw=properties(element),p={...resolvedStyle(raw.AppliedParagraphStyle,context),...raw};
    const attrs=paragraphAttrs(p);
    let inline:NoteJsonNode[]=[];
    const flush=(force=false)=>{if(inline.length||force)result.push({node:{type:'paragraph',...(Object.keys(attrs).length?{attrs}:{}),content:inline},properties:p,continuationReference:raw.BulletsAndNumberingListType==='NoList'?raw.AppliedNumberingList:undefined});inline=[];};
    let ended=false;
    function read(el:XmlElement,inherited:Props):void{
      const name=el.localName;
      if(name==='Properties')return;
      if(name==='Table'){flush();result.push({node:{type:'omiCellTable',attrs:{table:parseTable(el,context,depth+1)}}});ended=true;return;}
      if(name==='Content'){
        const marks=characterMarks(inherited,context);
        for(const part of (el.textContent??'').split(/(\r\n|\r|\n|\t)/)){
          if(!part)continue;
          if(part==='\t')inline.push({type:'omiTab'});
          else if(/^[\r\n]+$/.test(part))inline.push({type:'hardBreak'});
          else inline.push({type:'text',text:part,...(marks.length?{marks}:{})});
        }
        ended=false;return;
      }
      if(name==='Br'){flush(!ended);ended=true;return;}
      if(name==='CharacterStyleRange'){
        const local=properties(el),effective={...inherited,...resolvedStyle(local.AppliedCharacterStyle,context),...local};
        for(const child of Array.from(el.children))read(child,effective);
        return;
      }
      if(name==='Footnote'||name==='Endnote'){
        context.warnings.add('native-note-projected-as-text');
        const value=descendants(el,'Content').map(n=>n.textContent??'').join(' ');
        if(value)inline.push({type:'text',text:' ['+value+']'});
        ended=false;return;
      }
      // Unknown containers with text must not silently disappear.
      if(descendants(el,'Content').length||descendants(el,'Table').length)context.warnings.add('unsupported-cell-content');
      for(const child of Array.from(el.children))read(child,inherited);
    }
    for(const child of Array.from(element.children))read(child,p);
    if(inline.length||!ended)flush(true);
  }
  for(const child of Array.from(cell.children)){
    if(child.localName==='ParagraphStyleRange')readParagraph(child);
    else if(child.localName==='Table')result.push({node:{type:'omiCellTable',attrs:{table:parseTable(child,context,depth+1)}}});
    else if(child.localName!=='Properties')context.warnings.add('unsupported-cell-content');
  }
  return result.length?reconstructIdmlCellLists(result,context.lists,code=>context.warnings.add(code)):[{type:'paragraph',content:[]}];
}
function cellFormat(p:Props,context:Context):OmiTableCellFormat {
  const result:OmiTableCellFormat={};
  const angle=number(p.RotationAngle);
  if(angle!==undefined){const rotation=((360-angle)%360+360)%360;if(rotation===0||rotation===90||rotation===180||rotation===270)result.textRotation=rotation===270?-90:rotation;else context.warnings.add('unsupported-cell-rotation');}
  result.verticalAlign=({TopAlign:'top',CenterAlign:'middle',BottomAlign:'bottom'} as Record<string,OmiTableCellFormat['verticalAlign']>)[p.VerticalJustification??''];
  result.backgroundColor=color(p.FillColor,context);
  if(p.FillTint&&p.FillTint!=='100'&&p.FillTint!=='-1')context.warnings.add('unsupported-color-tint');
  const borders:NonNullable<OmiTableCellFormat['borders']>={},paddingPt:NonNullable<OmiTableCellFormat['paddingPt']>={};
  for(const side of TABLE_CELL_SIDES){
    const cap=side[0]!.toUpperCase()+side.slice(1);
    const padding=number(p[cap+'Inset']??p['Text'+cap+'Inset']);if(padding!==undefined)paddingPt[side]=padding;
    const weight=number(p[cap+'EdgeStrokeWeight']);
    if(weight===0){borders[side]={style:'none'};continue;}
    if(weight===undefined||weight<0)continue;
    const stroke=p[cap+'EdgeStrokeType']??'Solid';
    const style=/dotted/i.test(stroke)?'dotted':/dashed/i.test(stroke)?'dashed':/thinthin|double/i.test(stroke)?'double':'solid';
    if(!/solid|dotted|dashed|thinthin|double/i.test(stroke))context.warnings.add('unsupported-stroke-pattern');
    borders[side]={style,widthPt:weight,color:color(p[cap+'EdgeStrokeColor'],context)??'#000000'};
  }
  return {...(result.textRotation!==undefined?{textRotation:result.textRotation}:{}),...normalizeTableCellAppearance(result),...normalizeTableCellEdges({borders,paddingPt})};
}
function parseTable(element:XmlElement,context:Context,depth=0):OmiTableBlockData{
  if(depth>MAX_NESTED_TABLE_DEPTH)throw new Error('IDML nested table depth exceeded.');
  const p=properties(element),header=integer(p.HeaderRowCount)??0,footer=integer(p.FooterRowCount)??0,body=integer(p.BodyRowCount),width=integer(p.ColumnCount);
  const rows=direct(element,'Row'),columns=direct(element,'Column');
  const height=body===undefined?rows.length:header+body+footer;
  if(!width||!height||header>height||width*height>context.budget.cells)throw new Error('Invalid IDML table dimensions or cell quota exceeded.');
  context.budget.cells-=width*height;
  if(footer)context.warnings.add('footer-rows-imported-as-body');
  const cells=Array.from({length:height},()=>Array<string>(width).fill(''));
  const occupied=new Set<string>(),cellMerges:OmiTableCellMerge[]=[],cellFormats:Record<string,OmiTableCellFormat>={},cellContent:Record<string,string>={},rowHeights:Record<string,OmiTableRowHeight>={};
  const columnSizes=Array<number>(width).fill(0);
  for(const col of columns){const cp=properties(col),index=integer(cp.Name),size=number(cp.SingleColumnWidth);if(index!==undefined&&index<width&&size!==undefined&&size>0)columnSizes[index]=size;}
  if(columnSizes.some(v=>!v))context.warnings.add('missing-column-width');
  for(const row of rows){
    const rp=properties(row),index=integer(rp.Name);
    if(index===undefined||index>=height)continue;
    const mode=rp.AutoGrow==='false'?'exact':'minimum';
    const size=number(mode==='exact'?rp.SingleRowHeight:rp.MinimumHeight);
    const normalized=normalizeTableRowHeight({mode,heightPt:size});
    if(normalized.mode!=='auto')rowHeights[String(index)]=normalized;
  }
  const tableStyle=resolvedStyle(p.AppliedTableStyle,context);
  for(const cell of direct(element,'Cell')){
    const raw=properties(cell),match=/^(\d+):(\d+)$/.exec(raw.Name??'');
    if(!match)throw new Error('Invalid IDML cell coordinate.');
    const c=Number(match[1]),r=Number(match[2]),rs=integer(raw.RowSpan)??1,cs=integer(raw.ColumnSpan)??1;
    if(!rs||!cs||r+rs>height||c+cs>width||(r<header&&r+rs>header))throw new Error('Invalid IDML merged-cell geometry.');
    for(let rr=r;rr<r+rs;rr++)for(let cc=c;cc<c+cs;cc++){
      const key=rr+':'+cc;if(occupied.has(key))throw new Error('Overlapping IDML cells.');occupied.add(key);
    }
    const key=r+':'+c;
    if(rs>1||cs>1)cellMerges.push({row:r,column:c,rowSpan:rs,colSpan:cs});
    const regionStyle=r<header?tableStyle.HeaderRegionCellStyle:r>=height-footer?tableStyle.FooterRegionCellStyle:tableStyle.BodyRegionCellStyle;
    const format=cellFormat({...resolvedStyle(regionStyle,context),...resolvedStyle(raw.AppliedCellStyle,context),...raw},context);
    if(Object.keys(format).length)cellFormats[key]=format;
    const doc=parseTableCellContent(JSON.stringify({type:'doc',content:parseCellBlocks(cell,context,depth)}),depth);
    if(!doc)throw new Error('Unsupported or invalid IDML rich cell content.');
    cells[r]![c]=tableCellPlainText(doc);
    cellContent[key]=JSON.stringify(doc);
  }
  if(occupied.size!==width*height||tableMergeLayout(cells,cellMerges,header).merges.length!==cellMerges.length)throw new Error('Incomplete or invalid IDML table geometry.');
  return {kind:'table',cells,headerRows:header,rowSplitDefault:'keep',columnWidths:tableColumnWidths(cells,columnSizes),cellMerges,cellFormats,cellContent,rowHeights};
}
/** Table-only import. Read story references from designmap, not spreads or master-page content. */
export async function importIdmlTables(file:File):Promise<IdmlTableImportResult>{
  if(!/\.idml$/i.test(file.name)||file.size>MAX_VISUAL_IMPORT_BYTES)throw new Error('Invalid or oversized IDML package.');
  const zip=new OdtZip(await file.arrayBuffer());
  if(!zip.has('designmap.xml'))throw new Error('IDML designmap.xml missing.');
  const map=xml(await zip.text('designmap.xml'));
  if(map.localName!=='Document')throw new Error('Invalid IDML design map.');
  const context:Context={styles:new Map(),colors:new Map(),budget:{cells:10000},warnings:new Set(),lists:{ids:new Map(),seenCells:new Set(),nextId:0}};
  if(zip.has('Resources/Styles.xml')){
    const styles=xml(await zip.text('Resources/Styles.xml'));
    for(const name of ['TableStyle','CellStyle','ParagraphStyle','CharacterStyle'])for(const node of descendants(styles,name)){
      const id=node.getAttribute('Self');if(id)context.styles.set(id,node);
    }
  }
  if(zip.has('Resources/Graphic.xml'))registerColors(xml(await zip.text('Resources/Graphic.xml')),context);
  const paths=[...new Set(descendants(map,'Story').map(node=>node.getAttribute('src')).filter((name):name is string=>!!name))];
  if(paths.some(path=>!/^Stories\/[^/]+\.xml$/i.test(path)||!zip.has(path)))throw new Error('Invalid IDML story reference.');
  const blocks:OmiBlock[]=[];
  for(const path of paths){
    const root=xml(await zip.text(path));
    for(const node of descendants(root,'Table')){
      let parent=node.parentNode,nested=false;
      while(parent&&parent.nodeType===1){if((parent as XmlElement).localName==='Table'){nested=true;break;}parent=parent.parentNode;}
      if(nested)continue;
      const table=parseTable(node,context);
      const provenance={sourceFormat:'idml',fileName:file.name,importedAt:new Date().toISOString(),sourcePart:path};
      const block=createTableBlock(table.cells,{...table,provenance});
      blocks.push({...block,visual:{...table,provenance}});
    }
  }
  return {blocks,warnings:[...context.warnings]};
}
