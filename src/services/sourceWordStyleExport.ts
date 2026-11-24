import { sourceStyleBundle, type SourceStyle } from '../model/sourceWordStyles';

const escape = (s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
/** A per-export registry. Original IDs are kept unless another imported
 * document or the built-in styles already uses them. */
export class SourceWordStyleRegistry {
  private readonly definitions = new Map<string,string>();
  private readonly bundles = new Map<string,string>();
  register(input:unknown):string|undefined {
    const bundle=sourceStyleBundle(input);
    if(!bundle) return undefined;
    const key=JSON.stringify(bundle);
    const previous=this.bundles.get(key);
    if(previous) return previous;
    const ids=new Map<string,string>();
    const reserved=/^(?:Normal|DefaultParagraphFont|Title|Subtitle|Author|Heading[1-9]|FootnoteText|EndnoteText|FootnoteReference|EndnoteReference|FundingNote|OMI(?:Strong|Emphasis|StrongEmphasis|Strike|Underline|SmallCaps|Superscript|Subscript|Code|AuthorGivenName|AuthorFamilyName))$/;
    const canonical=(style:SourceStyle)=>JSON.stringify(style);
    // An identical definition may be referenced by several bundles.
    for(const style of bundle.styles){
      let id=style.id, n=1;
      while(reserved.test(id) || idsHas(ids,id) || (this.definitions.has(id) && this.definitions.get(id)!==canonical(style))) id=style.id+'_src'+n++;
      ids.set(style.id,id);
    }
    // A remapped ancestor requires its derived definition to be remapped too.
    for(const style of bundle.styles){
      const id=ids.get(style.id)!;
      if(this.definitions.has(id) && ((style.basedOn && ids.get(style.basedOn)!==style.basedOn) || (style.next && ids.get(style.next)!==style.next))){
        let n=1, replacement=style.id+'_src'+n;
        while(this.definitions.has(replacement)||idsHas(ids,replacement)) replacement=style.id+'_src'+(++n);
        ids.set(style.id,replacement);
      }
    }
    for(const style of bundle.styles){
      const id=ids.get(style.id)!;
      if(this.definitions.has(id)) continue;
      this.definitions.set(id,canonical(style));
      const based=style.basedOn && ids.get(style.basedOn);
      const next=style.next && ids.get(style.next);
      const flags=(style.bold!==undefined?'<w:b w:val="'+(style.bold?'1':'0')+'"/>':'')+(style.italic!==undefined?'<w:i w:val="'+(style.italic?'1':'0')+'"/>':'')+(style.color?'<w:color w:val="'+style.color.slice(1)+'"/>':'');
      this.xmlParts.push('<w:style w:type="'+style.kind+'" w:styleId="'+id+'"><w:name w:val="'+escape(style.name)+'"/>'+(based?'<w:basedOn w:val="'+based+'"/>':'')+(next&&style.kind==='paragraph'?'<w:next w:val="'+next+'"/>':'')+(flags?'<w:rPr>'+flags+'</w:rPr>':'')+'</w:style>');
    }
    const selected=ids.get(bundle.selected)!;
    this.bundles.set(key,selected);
    return selected;
  }
  private readonly xmlParts:string[]=[];
  xml():string{return this.xmlParts.join('');}
}
function idsHas(ids:Map<string,string>,id:string):boolean{return [...ids.values()].includes(id);}
