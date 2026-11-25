import { DOMParser } from '@xmldom/xmldom';

const M = 'http://schemas.openxmlformats.org/officeDocument/2006/math';
const XML = 'http://www.w3.org/XML/1998/namespace';
const XMLNS = 'http://www.w3.org/2000/xmlns/';
const MAX_SOURCE = 131072;
const MAX_DEPTH = 64;
const MAX_NODES = 4096;
// Presentation-only OMML subset. No Word fields, links, external relationships,
// embedded objects, arbitrary markup or review history are copied.
const containers = new Set([
  'oMath','r','f','num','den','rad','deg','e','sSup','sSub','sSubSup','sup','sub','sPre',
  'd','nary','limLow','limUpp','lim','func','fName','acc','bar','groupChr','box','borderBox',
  'm','mr','eqArr','phant','mc','mcs','rPr','fPr','radPr','sSupPr','sSubPr','sSubSupPr',
  'sPrePr','dPr','naryPr','limLowPr','limUppPr','funcPr','accPr','barPr','groupChrPr',
  'boxPr','borderBoxPr','mPr','mcPr','eqArrPr','phantPr',
]);
const properties = new Set([
  'type','degHide','chr','begChr','endChr','sepChr','grow','shp','limLoc','subHide','supHide',
  'pos','vertJc','sty','scr','nor','lit','aln','alnScr','brk','opEmu','noBreak','diff',
  'hideTop','hideBot','hideLeft','hideRight','strikeH','strikeV','strikeBLTR','strikeTLBR',
  'baseJc','rSpRule','rSp','cSp','cGp','cGpRule','plcHide','count','mcJc','maxDist','objDist',
  'zeroAsc','zeroDesc','zeroWid','show','transp','smallFrac',
]);
const xml = (value:string) => value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');

/** Rebuild known OMML instead of interpolating imported XML into document.xml.
 * Unsupported input returns undefined so callers retain their visible fallback. */
export function nativeOmml(source:string):string|undefined {
  if (typeof source!=='string'||!source.trim()||source.length>MAX_SOURCE||/<!|<\?/i.test(source)) return undefined;
  try {
    const parsed = new DOMParser({onError:()=>{throw new Error('Invalid math XML');}}).parseFromString(source,'application/xml');
    const root=parsed.documentElement;
    if(!root||root.namespaceURI!==M||root.localName!=='oMath')return undefined;
    let count=0;
    const render=(element:Element,depth:number):string=>{
      if(++count>MAX_NODES||depth>MAX_DEPTH||element.namespaceURI!==M)throw new Error('Unsupported math node');
      const name=element.localName;
      if(!name||(!containers.has(name)&&!properties.has(name)&&name!=='t'))throw new Error('Unsupported math element');
      if(depth>0&&name==='oMath')throw new Error('Nested math root');
      let attrs=depth===0?' xmlns:m="'+M+'"':'';
      for(const attr of Array.from(element.attributes)){
        if(attr.namespaceURI===XMLNS)continue;
        if(name==='t'&&attr.namespaceURI===XML&&attr.localName==='space'&&['preserve','default'].includes(attr.value)){attrs+=' xml:space="'+attr.value+'"';continue;}
        if(properties.has(name)&&attr.namespaceURI===M&&attr.localName==='val'&&attr.value.length<=128){attrs+=' m:val="'+xml(attr.value)+'"';continue;}
        if(name==='brk'&&attr.namespaceURI===M&&attr.localName==='alnAt'&&/^[0-9]{1,3}$/.test(attr.value)){attrs+=' m:alnAt="'+attr.value+'"';continue;}
        throw new Error('Unsupported math attribute');
      }
      let body='';
      for(const child of Array.from(element.childNodes)){
        if(child.nodeType===1){
          if(name==='t'||properties.has(name))throw new Error('Unsupported math child');
          body+=render(child as unknown as Element,depth+1);
        }else if(child.nodeType===3||child.nodeType===4){
          const text=child.nodeValue??'';
          if(name==='t')body+=xml(text);
          else if(text.trim())throw new Error('Unexpected math text');
        }else throw new Error('Unsupported math content');
      }
      return body?'<m:'+name+attrs+'>'+body+'</m:'+name+'>':'<m:'+name+attrs+'/>';
    };
    // xmldom's DOM type differs from the browser DOM type, but its element API
    // above is shared by both runtimes.
    const output=render(root as unknown as Element,0);
    return output.includes('<m:t')?output:undefined;
  }catch{return undefined;}
}
