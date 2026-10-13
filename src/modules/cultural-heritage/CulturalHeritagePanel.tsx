import { getResearchModuleCopyByLocale } from '../moduleTranslationCatalog';
import { normalizeModuleLocale } from '../moduleLocale';
import { useState } from 'react';
import { downloadWorkspaceJson, newWorkspaceId, safeWorkspaceFileName, safeExternalUrl, useLocalWorkspace } from '../disciplineWorkspace';
import '../disciplineWorkspaces.css';

interface Region {id:string;x:number;y:number;width:number;height:number;label:string;note:string}
interface HeritageRecord {id:string;title:string;identifier:string;kind:string;creator:string;date:string;place:string;institution:string;rights:string;sourceUrl:string;imageUrl:string;iiifUrl:string;description:string;relatedPeople:string;regions:Region[]}
interface Props {locale?:string;storageKey?:string}
const words=getResearchModuleCopyByLocale('cultural-heritage-cultural-heritage-panel/words');
const freshRecord=():HeritageRecord=>({id:newWorkspaceId(),title:'',identifier:'',kind:'',creator:'',date:'',place:'',institution:'',rights:'',sourceUrl:'',imageUrl:'',iiifUrl:'',description:'',relatedPeople:'',regions:[]});
export function CulturalHeritagePanel({locale='en',storageKey='default'}:Props){
 const t=words[normalizeModuleLocale(locale)];
 const [project,setProject]=useLocalWorkspace(`omi:cultural-heritage:v1:${storageKey}`,()=>({records:[] as HeritageRecord[]}));
 const [selectedId,setSelectedId]=useState('');
 const [region,setRegion]=useState({x:'0',y:'0',width:'10',height:'10',label:'',note:''});
 const [error,setError]=useState('');
 const selected=project.records.find(record=>record.id===selectedId)??project.records[0];
 const selectedImageUrl=selected?safeExternalUrl(selected.imageUrl):null;
 const selectedIiifUrl=selected?safeExternalUrl(selected.iiifUrl):null;
 const addRecord=()=>{const record=freshRecord();setProject(p=>({...p,records:[...p.records,record]}));setSelectedId(record.id)};
 const update=(id:string,patch:Partial<HeritageRecord>)=>setProject(p=>({...p,records:p.records.map(record=>record.id===id?{...record,...patch}:record)}));
 const addRegion=()=>{
  if(!selected)return;
  const x=Number(region.x),y=Number(region.y),width=Number(region.width),height=Number(region.height);
  if([x,y,width,height].some(n=>!Number.isFinite(n)||n<0||n>100)||x+width>100||y+height>100){setError(t.invalid);return}
  const item:Region={id:newWorkspaceId(),x,y,width,height,label:region.label,note:region.note};
  update(selected.id,{regions:[...selected.regions,item]});setRegion(v=>({...v,label:'',note:''}));setError('');
 };
 return <div className="discipline-workspace"><p className="discipline-intro">{t.intro}</p>
  <section className="discipline-card"><div className="discipline-heading"><h5>{t.records}</h5><div className="discipline-actions"><button type="button" onClick={addRecord}>＋ {t.add}</button><button type="button" onClick={()=>downloadWorkspaceJson(safeWorkspaceFileName('cultural-heritage','heritage')+'.json',project)}>{t.export}</button></div></div>
   {project.records.length===0?<p className="discipline-empty">{t.empty}</p>:<div className="discipline-list">{project.records.map(record=>{const sourceUrl=safeExternalUrl(record.sourceUrl);return <article className="discipline-card" key={record.id}>
    <div className="discipline-grid">
     <label>{t.title}<input value={record.title} onChange={e=>update(record.id,{title:e.target.value})}/></label><label>{t.id}<input value={record.identifier} onChange={e=>update(record.id,{identifier:e.target.value})}/></label><label>{t.kind}<input value={record.kind} onChange={e=>update(record.id,{kind:e.target.value})}/></label><label>{t.creator}<input value={record.creator} onChange={e=>update(record.id,{creator:e.target.value})}/></label><label>{t.date}<input value={record.date} onChange={e=>update(record.id,{date:e.target.value})}/></label><label>{t.place}<input value={record.place} onChange={e=>update(record.id,{place:e.target.value})}/></label><label>{t.institution}<input value={record.institution} onChange={e=>update(record.id,{institution:e.target.value})}/></label><label>{t.rights}<input value={record.rights} onChange={e=>update(record.id,{rights:e.target.value})}/></label><label>{t.source}<input type="url" value={record.sourceUrl} onChange={e=>update(record.id,{sourceUrl:e.target.value})}/></label><label>{t.image}<input type="url" value={record.imageUrl} onChange={e=>update(record.id,{imageUrl:e.target.value})}/></label><label>{t.iiif}<input type="url" value={record.iiifUrl} onChange={e=>update(record.id,{iiifUrl:e.target.value})}/></label><label>{t.people}<input value={record.relatedPeople} onChange={e=>update(record.id,{relatedPeople:e.target.value})}/></label>
     <label>{t.description}<textarea rows={3} value={record.description} onChange={e=>update(record.id,{description:e.target.value})}/></label>
     <div className="discipline-actions"><button type="button" className="discipline-danger" onClick={()=>setProject(p=>({records:p.records.filter(item=>item.id!==record.id)}))}>{t.remove}</button><button type="button" onClick={()=>setSelectedId(record.id)}>{t.regions} ({record.regions.length})</button>{sourceUrl&&<a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="discipline-link">{t.source}</a>}</div>
    </div>
   </article>;})}</div>}
  </section>
  <section className="discipline-card"><div className="discipline-heading"><h5>{t.regions}</h5>{selected&&<small>{selected.title||selected.identifier}</small>}</div>
   {!selected?<p className="discipline-empty">{t.select}</p>:<>
    {selectedImageUrl&&<div className="discipline-preview"><img src={selectedImageUrl} alt={selected.title||selected.identifier}/>{selected.regions.map(r=><div key={r.id} className="discipline-region" title={r.label} style={{left:r.x+'%',top:r.y+'%',width:r.width+'%',height:r.height+'%'}}/>)}</div>}
    {selectedIiifUrl&&<p><a href={selectedIiifUrl} target="_blank" rel="noopener noreferrer" className="discipline-link">{t.iiif}</a></p>}
    <div className="discipline-grid"><label>{t.x}<input type="number" min="0" max="100" value={region.x} onChange={e=>setRegion(v=>({...v,x:e.target.value}))}/></label><label>{t.y}<input type="number" min="0" max="100" value={region.y} onChange={e=>setRegion(v=>({...v,y:e.target.value}))}/></label><label>{t.width}<input type="number" min="0" max="100" value={region.width} onChange={e=>setRegion(v=>({...v,width:e.target.value}))}/></label><label>{t.height}<input type="number" min="0" max="100" value={region.height} onChange={e=>setRegion(v=>({...v,height:e.target.value}))}/></label><label>{t.label}<input value={region.label} onChange={e=>setRegion(v=>({...v,label:e.target.value}))}/></label><label>{t.note}<input value={region.note} onChange={e=>setRegion(v=>({...v,note:e.target.value}))}/></label></div>
    <button type="button" style={{marginTop:'.5rem'}} onClick={addRegion}>{t.addRegion}</button>{error&&<p role="alert">{error}</p>}
    {selected.regions.length>0&&<ul>{selected.regions.map(r=><li key={r.id}>{r.label} ({r.x},{r.y},{r.width},{r.height}) — {r.note}<button type="button" className="discipline-danger" onClick={()=>update(selected.id,{regions:selected.regions.filter(x=>x.id!==r.id)})}>{t.remove}</button></li>)}</ul>}
   </>}
  </section>
 </div>
}
