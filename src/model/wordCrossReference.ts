/** Explicit, bounded Word field semantics. Cached labels are display fallbacks
 * until a layout engine (for PAGEREF) or Word recalculates the field. */
export interface WordCrossReferenceField {
  kind:'REF'|'PAGEREF';
  cachedLabel:string;
  hyperlink?:boolean;
}
export function normalizeWordCrossReferenceField(input:unknown):WordCrossReferenceField|undefined{
  if(!input||typeof input!=='object'||Array.isArray(input))return undefined;
  const v=input as Record<string,unknown>;
  if((v.kind!=='REF'&&v.kind!=='PAGEREF')||typeof v.cachedLabel!=='string'||v.cachedLabel.length>4096||/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(v.cachedLabel))return undefined;
  if(v.hyperlink!==undefined&&typeof v.hyperlink!=='boolean')return undefined;
  if(Object.keys(v).some(key=>!['kind','cachedLabel','hyperlink'].includes(key)))return undefined;
  return {kind:v.kind,cachedLabel:v.cachedLabel,...(v.hyperlink!==undefined?{hyperlink:v.hyperlink}:{})};
}
export function parseWordCrossReference(instruction:string,cachedLabel:string):{name:string;field:WordCrossReferenceField}|undefined{
  // Only plain REF/PAGEREF and optional hyperlink switch. Numbering and
  // other switches have different semantics and must not silently change.
  const match=/^\s*(REF|PAGEREF)\s+(?:"([A-Za-z_][A-Za-z0-9_]{0,39})"|([A-Za-z_][A-Za-z0-9_]{0,39}))(?:\s+(\\h))?\s*$/i.exec(instruction);
  if(!match)return undefined;
  const field=normalizeWordCrossReferenceField({kind:match[1]!.toUpperCase(),cachedLabel,...(match[4]?{hyperlink:true}:{})});
  return field?{name:match[2]??match[3]!,field}:undefined;
}
