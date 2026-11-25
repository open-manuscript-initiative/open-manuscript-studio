/** Source Word hyphenation defaults. These are interchange metadata, not
 * publisher layout rules. Only bounded scalar settings may be serialized. */
export const WORD_HYPHENATION_EXTENSION='https://openmanuscript.org/extensions/word-hyphenation/1';
export interface WordHyphenationSettings {
  automatic?:boolean;
  suppressCapitalized?:boolean;
  zoneTwips?:number;
  consecutiveLimit?:number;
}
export function normalizeWordHyphenation(value:unknown):WordHyphenationSettings|undefined {
  if(!value||typeof value!=='object'||Array.isArray(value))return undefined;
  const raw=value as Record<string,unknown>,out:WordHyphenationSettings={};
  for(const key of ['automatic','suppressCapitalized'] as const)if(typeof raw[key]==='boolean')out[key]=raw[key];
  for(const [key,max] of [['zoneTwips',31680],['consecutiveLimit',32767]] as const){
    const n=raw[key];
    if(typeof n==='number'&&Number.isSafeInteger(n)&&n>=0&&n<=max)out[key]=n;
  }
  return Object.keys(out).length?out:undefined;
}
export function readWordHyphenationSettings(read:(name:string)=>string|undefined,exists:(name:string)=>boolean):WordHyphenationSettings|undefined{
  const flag=(name:string)=>{
    const raw=read(name);
    if(raw===undefined&&!exists(name))return undefined;
    if(raw===undefined||/^(?:1|true|on)$/i.test(raw))return true;
    if(/^(?:0|false|off)$/i.test(raw))return false;
    return undefined;
  };
  const number=(name:string)=>{
    const raw=read(name);
    return raw!==undefined&&/^\d+$/.test(raw)?Number(raw):undefined;
  };
  return normalizeWordHyphenation({automatic:flag('autoHyphenation'),suppressCapitalized:flag('doNotHyphenateCaps'),zoneTwips:number('hyphenationZone'),consecutiveLimit:number('consecutiveHyphenLimit')});
}
export function wordHyphenationSettingsXml(input:unknown):string{
  const v=normalizeWordHyphenation(input);
  if(!v)return '';
  const element=(name:string,value:boolean|number|undefined)=>value===undefined?'':'<w:'+name+' w:val="'+(typeof value==='boolean'?(value?'1':'0'):value)+'"/>';
  return element('autoHyphenation',v.automatic)+element('consecutiveHyphenLimit',v.consecutiveLimit)+element('hyphenationZone',v.zoneTwips)+element('doNotHyphenateCaps',v.suppressCapitalized);
}
export function validateWordHyphenation(value:unknown):void{
  const normalized=normalizeWordHyphenation(value);
  if(!normalized||Object.keys(value as object).length!==Object.keys(normalized).length)throw new Error('Invalid Word hyphenation settings.');
}
