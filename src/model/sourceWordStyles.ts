/** Imported Word styles are source typography, not publisher style IDs.
 * Only bounded, typed data is stored; never persist raw XML or CSS. */
export type SourceStyle = {
  id: string; name: string; kind: 'paragraph' | 'character';
  basedOn?: string; next?: string; bold?: boolean; italic?: boolean; color?: string;
};
export type SourceStyleBundle = { selected: string; styles: SourceStyle[] };
const validId = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(v);
const safeText = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 160 && Array.from(v).every(c => c.charCodeAt(0)>=32 && c.charCodeAt(0)!==127);
export function sourceStyleBundle(input: unknown): SourceStyleBundle | undefined {
  try {
    const data = (typeof input === 'string' ? JSON.parse(input) : input) as SourceStyleBundle;
    if (!data || !validId(data.selected) || !Array.isArray(data.styles) || data.styles.length > 64) return undefined;
    const styles: SourceStyle[] = [];
    for (const item of data.styles) {
      if (!item || !validId(item.id) || !safeText(item.name) || !['paragraph','character'].includes(item.kind) || styles.some(s=>s.id===item.id)) return undefined;
      const style: SourceStyle = {id:item.id,name:item.name,kind:item.kind};
      if (validId(item.basedOn)) style.basedOn=item.basedOn;
      if (validId(item.next)) style.next=item.next;
      if (typeof item.bold==='boolean') style.bold=item.bold;
      if (typeof item.italic==='boolean') style.italic=item.italic;
      if (typeof item.color==='string' && /^#[0-9a-f]{6}$/i.test(item.color)) style.color=item.color.toUpperCase();
      styles.push(style);
    }
    if (!styles.some(s=>s.id===data.selected)) return undefined;
    return {selected:data.selected,styles};
  } catch { return undefined; }
}
export function normalizeSourceStyle(input:unknown): string | undefined {
  const bundle=sourceStyleBundle(input);
  return bundle ? JSON.stringify(bundle) : undefined;
}
export function resolveSourceStyle(input:unknown): Pick<SourceStyle,'bold'|'italic'|'color'> {
  const bundle=sourceStyleBundle(input);
  const chain: SourceStyle[]=[];
  const seen=new Set<string>();
  let id=bundle?.selected;
  while(id && !seen.has(id)) {
    seen.add(id);
    const style=bundle?.styles.find(s=>s.id===id);
    if(!style) break;
    chain.unshift(style);
    id=style.basedOn;
  }
  const result: Pick<SourceStyle,'bold'|'italic'|'color'>={};
  // Word style toggle properties: true toggles the inherited value,
  // false leaves it unchanged. Direct run properties are absolute.
  for(const style of chain) {
    if(style.bold===true) result.bold=!result.bold;
    if(style.italic===true) result.italic=!result.italic;
    if(style.color) result.color=style.color;
  }
  return result;
}
export function sourceStyleName(input:unknown):string|undefined {
  const bundle=sourceStyleBundle(input);
  return bundle?.styles.find(s=>s.id===bundle.selected)?.name;
}
