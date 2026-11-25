/** Safe, bounded native running matter; never store executable field instructions
 * or untrusted OOXML fragments. Missing variants mean link to previous section;
 * explicit empty arrays mean an explicitly empty running header/footer. */
export const RUNNING_VARIANTS=['default','even','first'] as const;
export type RunningVariant=typeof RUNNING_VARIANTS[number];
export type RunningKind='header'|'footer';
export const RUNNING_FIELDS=['PAGE','NUMPAGES','SECTIONPAGES'] as const;
export type RunningField=typeof RUNNING_FIELDS[number];
export type RunningToken={kind:'text';text:string}|{kind:'field';field:RunningField}|{kind:'tab'|'break'};
export interface RunningParagraph{
  align?:'left'|'center'|'right'|'both';
  tokens:RunningToken[];
}
export type RunningVariants=Partial<Record<RunningVariant,RunningParagraph[]>>;
export const MAX_RUNNING_PARAGRAPHS=100;
export const MAX_RUNNING_TOKENS=1000;
export const MAX_RUNNING_TEXT=32000;
export function runningField(instruction:string|undefined):RunningField|undefined{
  const name=instruction?.trim().toUpperCase();
  return RUNNING_FIELDS.includes(name as RunningField)?name as RunningField:undefined;
}
export function normalizeRunningVariants(input:unknown):RunningVariants|undefined{
  if(!input||typeof input!=='object'||Array.isArray(input))return undefined;
  const raw=input as Record<string,unknown>,out:RunningVariants={};
  if(Object.keys(raw).some(key=>!RUNNING_VARIANTS.includes(key as RunningVariant)))return undefined;
  for(const variant of RUNNING_VARIANTS){
    if(!(variant in raw))continue;
    const paragraphs=raw[variant];
    if(!Array.isArray(paragraphs)||paragraphs.length>MAX_RUNNING_PARAGRAPHS)return undefined;
    const result:RunningParagraph[]=[];
    let count=0,total=0;
    for(const p of paragraphs){
      if(!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).some(key=>key!=='align'&&key!=='tokens')||!Array.isArray(p.tokens))return undefined;
      if(p.align!==undefined&&!['left','center','right','both'].includes(p.align))return undefined;
      const tokens:RunningToken[]=[];
      for(const t of p.tokens){
        if(!t||typeof t!=='object'||Array.isArray(t)||++count>MAX_RUNNING_TOKENS)return undefined;
        if(t.kind==='text'&&typeof t.text==='string'&&Object.keys(t).length===2){
          total+=t.text.length;
          if(total>MAX_RUNNING_TEXT||Array.from(t.text).some(character => { const code = character.charCodeAt(0); return code < 32 && code !== 9 && code !== 10 && code !== 13; }))return undefined;
          tokens.push({kind:'text',text:t.text});
        }else if(t.kind==='field'&&RUNNING_FIELDS.includes(t.field)&&Object.keys(t).length===2)tokens.push({kind:'field',field:t.field});
        else if((t.kind==='tab'||t.kind==='break')&&Object.keys(t).length===1)tokens.push({kind:t.kind});
        else return undefined;
      }
      result.push({...p.align?{align:p.align}:{},tokens});
    }
    out[variant]=result;
  }
  return Object.keys(out).length?out:undefined;
}
