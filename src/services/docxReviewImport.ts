import type { OmiAnnotation } from '../types/omi';

const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const W14='http://schemas.microsoft.com/office/word/2010/wordml';
const W15='http://schemas.microsoft.com/office/word/2012/wordml';
type SourceComment={id:string; body:string; paraId?:string; parentParaId?:string; done:boolean; date?:string};
const attr=(element:Element,namespace:string,name:string)=>element.getAttributeNS(namespace,name)||undefined;
const elements=(root:Document|Element,namespace:string,name:string)=>Array.from(root.getElementsByTagNameNS(namespace,name));
const validDate=(value:string|undefined)=>value&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():undefined;

/** Read comment text and explicit reply links. Never promote reviewer identities
 * into the manuscript's public author/contributor list. */
export function readWordComments(comments:Document,extended?:Document):Map<string,SourceComment>{
  const metadata=new Map<string,{parent?:string;done:boolean}>();
  if(extended)for(const item of elements(extended,W15,'commentEx')){
    const key=attr(item,W15,'paraId');
    if(key)metadata.set(key,{parent:attr(item,W15,'paraIdParent'),done:attr(item,W15,'done')==='1'});
  }
  const result=new Map<string,SourceComment>();
  for(const item of elements(comments,W,'comment')){
    const id=attr(item,W,'id');
    if(!id||result.has(id)||result.size>=10000)continue;
    const paragraphs=elements(item,W,'p');
    const body=paragraphs.map(p=>elements(p,W,'t').map(t=>t.textContent??'').join('')).join('\n');
    if(!body.trim()||body.length>65536)continue;
    const paraId=paragraphs.map(p=>attr(p,W14,'paraId')).findLast(id=>Boolean(id));
    const info=paraId?metadata.get(paraId):undefined;
    result.set(id,{id,body,paraId,parentParaId:info?.parent,done:info?.done??false,date:validDate(attr(item,W,'date'))});
  }
  return result;
}

/** Only anchor comments to paragraphs where the source range can be resolved.
 * Replies inherit the resolved root range; missing/cyclic parents are ignored. */
export function importWordParagraphComments(paragraph:Element,blockId:string,comments:ReadonlyMap<string,SourceComment>,seen:Set<string>,timestamp:string):OmiAnnotation[]{
  const result:OmiAnnotation[]=[];
  const active=new Map<string,string>();
  const ranges=new Map<string,string>();
  const visit=(element:Element)=>{
    if(element.namespaceURI===W){
      const name=element.localName,id=attr(element,W,'id');
      if(name==='del'||name==='moveFrom')return;
      if(name==='commentRangeStart'&&id){active.set(id,'');return;}
      if(name==='commentRangeEnd'&&id){const value=active.get(id);if(value!==undefined)ranges.set(id,value);active.delete(id);return;}
      if(name==='t'){for(const [key,value] of active)active.set(key,value+(element.textContent??''));return;}
    }
    for(const child of Array.from(element.children))visit(child);
  };
  visit(paragraph);
  // One paragraph owns one imported range. Do not pretend that a multi-paragraph
  // or dangling range has an exact local selection.
  const byParent=new Map<string,SourceComment[]>();
  for(const comment of comments.values())if(comment.parentParaId){
    const list=byParent.get(comment.parentParaId)??[];list.push(comment);byParent.set(comment.parentParaId,list);
  }
  const add=(comment:SourceComment,targetText:string,parent?:string)=>{
    if(seen.has(comment.id))return;
    seen.add(comment.id);
    const date=comment.date??timestamp;
    const annotation:OmiAnnotation={id:crypto.randomUUID(),type:'comment',targetBlockId:blockId,targetText,body:comment.body,renderingHint:'popup',status:comment.done?'resolved':'open',visibility:'editor_only',createdAt:date,modifiedAt:date,...(comment.done?{resolvedAt:date}:{}),...(parent?{replyToCommentId:parent}:{})};
    result.push(annotation);
    // An iterative queue avoids recursion on maliciously deep reply chains.
    return annotation;
  };
  for(const [id,targetText] of ranges){
    const root=comments.get(id);
    if(!root||root.parentParaId||!targetText.trim())continue;
    const first=add(root,targetText);
    if(!first)continue;
    const queue=[{comment:root,annotation:first}];
    for(let i=0;i<queue.length;i++){
      const item=queue[i]!;
      if(!item.comment.paraId)continue;
      for(const reply of byParent.get(item.comment.paraId)??[]){
        const annotation=add(reply,targetText,item.annotation.id);
        if(annotation)queue.push({comment:reply,annotation});
      }
    }
  }
  return result;
}
