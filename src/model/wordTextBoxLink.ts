/** Source VML chain identifiers, not executable CSS or XML. */
export const WORD_TEXT_BOX_LINK_EXTENSION='https://openmanuscript.org/extensions/word-text-box-link/1';
export interface WordTextBoxLink {name:string;next?:string}
export function normalizeWordTextBoxLink(input:unknown):WordTextBoxLink|undefined{
  if(!input||typeof input!=='object'||Array.isArray(input))return undefined;
  const v=input as Record<string,unknown>;
  const valid=(s:unknown):s is string=>typeof s==='string'&&/^[A-Za-z_][A-Za-z0-9_.-]{0,79}$/.test(s);
  if(!valid(v.name)||Object.keys(v).some(k=>k!=='name'&&k!=='next')||(v.next!==undefined&&!valid(v.next)))return undefined;
  return {name:v.name,...(v.next!==undefined?{next:v.next as string}:{})};
}
