/** Bounded native Word page settings. Twips avoid conversion drift.
 * groupId identifies a physical source section spanning multiple headings. */
export interface WordSectionLayout {
  groupId:string;
  breakType?:'continuous'|'nextPage'|'oddPage'|'evenPage'|'nextColumn';
  pageWidthTwips?:number;
  pageHeightTwips?:number;
  orientation?:'portrait'|'landscape';
  margins?:Partial<Record<'top'|'right'|'bottom'|'left'|'header'|'footer'|'gutter',number>>;
  pageNumberStart?:number;
}
const breakTypes=['continuous','nextPage','oddPage','evenPage','nextColumn'] as const;
const sides=['top','right','bottom','left','header','footer','gutter'] as const;
function bounded(value:unknown,min:number,max:number):number|undefined{
  return typeof value==='number'&&Number.isSafeInteger(value)&&value>=min&&value<=max?value:undefined;
}
export function normalizeWordSectionLayout(input:unknown):WordSectionLayout|undefined{
  if(!input||typeof input!=='object'||Array.isArray(input))return undefined;
  const v=input as Record<string,unknown>;
  if(typeof v.groupId!=='string'||!/^[-A-Za-z0-9_]{1,80}$/.test(v.groupId))return undefined;
  const out:WordSectionLayout={groupId:v.groupId};
  if(breakTypes.includes(v.breakType as typeof breakTypes[number]))out.breakType=v.breakType as WordSectionLayout['breakType'];
  for(const key of ['pageWidthTwips','pageHeightTwips'] as const){const n=bounded(v[key],1,31680);if(n!==undefined)out[key]=n;}
  if(v.orientation==='portrait'||v.orientation==='landscape')out.orientation=v.orientation;
  const start=bounded(v.pageNumberStart,0,32767);if(start!==undefined)out.pageNumberStart=start;
  if(v.margins&&typeof v.margins==='object'&&!Array.isArray(v.margins)){
    const margins:NonNullable<WordSectionLayout['margins']>={};
    for(const side of sides){const n=bounded((v.margins as Record<string,unknown>)[side],side==='top'||side==='bottom'?-31680:0,31680);if(n!==undefined)margins[side]=n;}
    if(Object.keys(margins).length)out.margins=margins;
  }
  return out;
}
export function readWordSectionLayout(groupId:string,read:(tag:string,attr:string)=>string|undefined):WordSectionLayout{
  const number=(tag:string,attr:string)=>{const raw=read(tag,attr);return raw!==undefined&&/^-?\d+$/.test(raw)?Number(raw):undefined;};
  return normalizeWordSectionLayout({groupId,breakType:read('type','val'),pageWidthTwips:number('pgSz','w'),pageHeightTwips:number('pgSz','h'),orientation:read('pgSz','orient'),pageNumberStart:number('pgNumType','start'),margins:Object.fromEntries(sides.map(side=>[side,number('pgMar',side)]))})??{groupId};
}
export function wordSectionGeometryXml(value:unknown,columns?:number,gapMm?:number,defaultBreak?:string):string{
  const v=normalizeWordSectionLayout(value);
  const kind=v?.breakType??defaultBreak;
  const type=breakTypes.includes(kind as typeof breakTypes[number])?'<w:type w:val="'+kind+'"/>':'';
  const size='<w:pgSz w:w="'+(v?.pageWidthTwips??11906)+'" w:h="'+(v?.pageHeightTwips??16838)+'"'+(v?.orientation?' w:orient="'+v.orientation+'"':'')+'/>';
  const defaults={top:1440,right:1440,bottom:1440,left:1440,header:720,footer:720,gutter:0};
  const margins='<w:pgMar'+sides.map(side=>' w:'+side+'="'+(v?.margins?.[side]??defaults[side])+'"').join('')+'/>';
  const number=v?.pageNumberStart!==undefined?'<w:pgNumType w:start="'+v.pageNumberStart+'"/>':'';
  const cols=columns===2||columns===3?'<w:cols w:num="'+columns+'" w:space="'+Math.round((typeof gapMm==='number'&&Number.isFinite(gapMm)&&gapMm>=0&&gapMm<=50?gapMm:8)*1440/25.4)+'"/>':'';
  return type+size+margins+number+cols;
}
