import { MAX_RUNNING_PARAGRAPHS, MAX_RUNNING_TEXT, MAX_RUNNING_TOKENS, runningField, type RunningParagraph, type RunningToken, type RunningKind } from '../model/wordRunningMatter';
/** Parse the visible direct paragraphs and a small whitelist of native fields.
 * Ignore deleted content, instructions, comments and directly hidden runs. */
export function readWordRunningPart(root:Element,kind:RunningKind,warn:()=>void):RunningParagraph[]|undefined{
  if(root.localName!==(kind==='header'?'hdr':'ftr'))return undefined;
  const children=(el:Element)=>Array.from(el.children);
  const attr=(el:Element|undefined,name:string)=>el&&Array.from(el.attributes).find(a=>a.localName===name)?.value;
  const paragraphs:RunningParagraph[]=[];
  let count=0,total=0,overflow=false;
  for(const p of children(root)){
    if(p.localName!=='p'){warn();continue;}
    if(paragraphs.length>=MAX_RUNNING_PARAGRAPHS){overflow=true;break;}
    const pPr=children(p).find(x=>x.localName==='pPr');
    const rawAlign=pPr&&attr(children(pPr).find(x=>x.localName==='jc'),'val');
    const align=['left','center','right','both'].includes(rawAlign??'')?rawAlign as RunningParagraph['align']:undefined;
    if(pPr&&children(pPr).some(x=>!['jc','pStyle'].includes(x.localName)))warn();
    const tokens:RunningToken[]=[];
    let complex:{instruction:string;result:boolean;cached:RunningToken[];depth:number}|undefined;
    const emit=(token:RunningToken)=>{
      if(++count>MAX_RUNNING_TOKENS){overflow=true;return;}
      if(token.kind==='text'&&(total+=token.text.length)>MAX_RUNNING_TEXT){overflow=true;return;}
      if(complex){if(complex.result)complex.cached.push(token);}else tokens.push(token);
    };
    const flush=()=>{
      if(!complex)return;
      const field=runningField(complex.instruction),cached=complex.cached;
      complex=undefined;
      if(field)emit({kind:'field',field});else{warn();for(const token of cached)emit(token);}
    };
    const visit=(node:Element)=>{
      if(overflow)return;
      const name=node.localName;
      if(['pPr','rPr','del','moveFrom','commentRangeStart','commentRangeEnd','commentReference','bookmarkStart','bookmarkEnd'].includes(name))return;
      if(name==='r'){
        const rPr=children(node).find(x=>x.localName==='rPr');
        if(rPr){
          if(children(rPr).some(x=>['vanish','webHidden','specVanish'].includes(x.localName)&&!/^(?:0|false|off)$/i.test(attr(x,'val')??'1'))){warn();return;}
          if(children(rPr).length)warn();
        }
        for(const child of children(node))visit(child);
        return;
      }
      if(name==='fldSimple'){
        const field=runningField(attr(node,'instr'));
        if(field)emit({kind:'field',field});else{warn();for(const child of children(node))visit(child);}
        return;
      }
      if(name==='fldChar'){
        const type=attr(node,'fldCharType');
        if(type==='begin'){if(complex){complex.depth++;warn();}else complex={instruction:'',result:false,cached:[],depth:1};}
        else if(type==='separate'&&complex&&complex.depth===1)complex.result=true;
        else if(type==='end'&&complex&&--complex.depth===0)flush();
        return;
      }
      if(name==='instrText'){if(complex&&complex.depth===1&&!complex.result)complex.instruction+=(node.textContent??'').slice(0,100);return;}
      if(name==='t'){if(node.textContent)emit({kind:'text',text:node.textContent});return;}
      if(name==='tab'){emit({kind:'tab'});return;}
      if(name==='br'||name==='cr'){emit({kind:'break'});return;}
      if(name==='ins'||name==='moveTo'||name==='hyperlink'||name==='sdt'||name==='sdtContent'){warn();for(const child of children(node))visit(child);return;}
      warn();
    };
    for(const child of children(p))visit(child);
    if(complex){warn();flush();}
    if(overflow)return undefined;
    paragraphs.push({...align?{align}:{},tokens});
  }
  return overflow?undefined:paragraphs;
}
