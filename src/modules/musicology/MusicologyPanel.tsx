import { useRef, useState } from 'react';
import { downloadWorkspaceJson, newWorkspaceId, safeWorkspaceFileName, useLocalWorkspace } from '../disciplineWorkspace';
import '../disciplineWorkspaces.css';

interface MusicEvent { id:string; measure:string; beat:string; part:string; pitch:string; duration:string; annotation:string; recordingTime:string }
interface MusicProject { title:string; composer:string; source:string; language:string; key:string; meter:string; tempo:string; recordingUrl:string; events:MusicEvent[] }
interface Props { locale?:string; storageKey?:string }
const words={
 hu:{intro:'Kezelje a kotta alapadatait, a zenei eseményeket és a felvételhez illesztett megjegyzéseket. A MusicXML-import a szólamokat és hangokat szerkeszthető eseményekké bontja.',title:'Mű címe',composer:'Szerző / zeneszerző',source:'Forrás / kiadás',key:'Hangnem',meter:'Ütemmutató',tempo:'Tempó',recording:'Felvétel URL-je',import:'MusicXML importálása',events:'Zenei események',add:'Esemény hozzáadása',measure:'Ütem',beat:'Ütés',part:'Szólam',pitch:'Hang / esemény',duration:'Időtartam',annotation:'Elemzés / változat',recordingTime:'Felvétel időpontja',remove:'Eltávolítás',export:'Projekt JSON letöltése',empty:'Még nincs zenei esemény. Importáljon MusicXML-t vagy vegyen fel egy sort.',error:'A MusicXML nem olvasható vagy hibás.',language:'A kotta nyelve'},
 en:{intro:'Record score metadata, musical events, and notes aligned to a recording. MusicXML import extracts parts and notes into editable events.',title:'Work title',composer:'Composer / creator',source:'Source / edition',key:'Key',meter:'Time signature',tempo:'Tempo',recording:'Recording URL',import:'Import MusicXML',events:'Musical events',add:'Add event',measure:'Measure',beat:'Beat',part:'Part',pitch:'Pitch / event',duration:'Duration',annotation:'Analysis / variant',recordingTime:'Recording time',remove:'Remove',export:'Download project JSON',empty:'No musical events yet. Import MusicXML or add an event.',error:'The MusicXML file is unreadable or invalid.',language:'Score language'},
 de:{intro:'Erfassen Sie Notendaten, musikalische Ereignisse und mit einer Aufnahme verknüpfte Anmerkungen. Der MusicXML-Import zerlegt Stimmen und Noten in bearbeitbare Ereignisse.',title:'Werktitel',composer:'Komponist / Urheber',source:'Quelle / Ausgabe',key:'Tonart',meter:'Taktart',tempo:'Tempo',recording:'Aufnahme-URL',import:'MusicXML importieren',events:'Musikalische Ereignisse',add:'Ereignis hinzufügen',measure:'Takt',beat:'Zählzeit',part:'Stimme',pitch:'Ton / Ereignis',duration:'Dauer',annotation:'Analyse / Variante',recordingTime:'Aufnahmezeit',remove:'Entfernen',export:'Projekt-JSON herunterladen',empty:'Noch keine musikalischen Ereignisse. Importieren Sie MusicXML oder fügen Sie ein Ereignis hinzu.',error:'Die MusicXML-Datei ist unlesbar oder ungültig.',language:'Sprache der Partitur'}
};
const fresh=(language:string):MusicProject=>({title:'',composer:'',source:'',language,key:'',meter:'',tempo:'',recordingUrl:'',events:[]});
function xmlText(parent:Element|null,selector:string):string{return parent?.querySelector(selector)?.textContent?.trim()??''}
function parseMusicXml(xml:string):{project:Partial<MusicProject>;events:MusicEvent[]}{
 const document=new DOMParser().parseFromString(xml,'application/xml');
 if(document.querySelector('parsererror'))throw new Error('invalid xml');
 const partNames=new Map(Array.from(document.querySelectorAll('score-part')).map((part)=>[part.getAttribute('id')??'',xmlText(part,'part-name')]));
 const events:MusicEvent[]=[];
 for(const part of Array.from(document.querySelectorAll('part'))){
  const divisions=Number(xmlText(part,'divisions'))||1; const partId=part.getAttribute('id')??'';
  for(const measure of Array.from(part.querySelectorAll(':scope > measure'))){
   let tick=0; const number=measure.getAttribute('number')??'';
   for(const child of Array.from(measure.children)){
    if(child.localName==='backup'){tick-=Number(xmlText(child,'duration'))||0;continue}
    if(child.localName==='forward'){tick+=Number(xmlText(child,'duration'))||0;continue}
    if(child.localName!=='note')continue;
    const durationTicks=Number(xmlText(child,'duration'))||0;
    const step=xmlText(child,'pitch step'); const alter=Number(xmlText(child,'pitch alter'))||0; const octave=xmlText(child,'pitch octave');
    const pitch=child.querySelector('rest')?'rest':step?step+(alter===1?'♯':alter===-1?'♭':alter?String(alter):'')+octave:'unpitched';
    const chord=Boolean(child.querySelector('chord')); const beat=(tick/divisions+1).toFixed(2);
    events.push({id:newWorkspaceId(),measure:number,beat,part:partNames.get(partId)??partId,pitch,duration:(durationTicks/divisions).toFixed(2),annotation:'',recordingTime:''});
    if(!chord)tick+=durationTicks;
   }
  }
 }
 return {project:{title:xmlText(document,'work-title')||xmlText(document,'movement-title'),composer:xmlText(document,'creator[type="composer"]')||xmlText(document,'creator'),meter:xmlText(document,'time beats')+'/'+xmlText(document,'time beat-type'),key:xmlText(document,'fifths'),tempo:xmlText(document,'sound[tempo]')},events};
}
export function MusicologyPanel({locale='hu',storageKey='default'}:Props){
 const t=words[locale as keyof typeof words]??words.en; const fileRef=useRef<HTMLInputElement>(null);
 const [project,setProject]=useLocalWorkspace(`omi:musicology:v1:${storageKey}`,()=>fresh(locale));
 const [error,setError]=useState('');
 const update=(patch:Partial<MusicProject>)=>setProject((current)=>({...current,...patch}));
 async function importScore(file:File|undefined){if(!file)return;try{const parsed=parseMusicXml(await file.text());setProject(current=>({...current,...parsed.project,source:file.name,events:[...current.events,...parsed.events]}));setError('')}catch{setError(t.error)}}
 const updateEvent=(id:string,patch:Partial<MusicEvent>)=>setProject(current=>({...current,events:current.events.map(event=>event.id===id?{...event,...patch}:event)}));
 return <div className="discipline-workspace"><p className="discipline-intro">{t.intro}</p>
  <section className="discipline-card"><div className="discipline-grid">
   <label>{t.title}<input value={project.title} onChange={e=>update({title:e.target.value})}/></label><label>{t.composer}<input value={project.composer} onChange={e=>update({composer:e.target.value})}/></label>
   <label>{t.source}<input value={project.source} onChange={e=>update({source:e.target.value})}/></label><label>{t.language}<input value={project.language} onChange={e=>update({language:e.target.value})}/></label>
   <label>{t.key}<input value={project.key} onChange={e=>update({key:e.target.value})}/></label><label>{t.meter}<input value={project.meter} onChange={e=>update({meter:e.target.value})}/></label><label>{t.tempo}<input value={project.tempo} onChange={e=>update({tempo:e.target.value})}/></label><label>{t.recording}<input type="url" value={project.recordingUrl} onChange={e=>update({recordingUrl:e.target.value})}/></label>
  </div><div className="discipline-actions" style={{marginTop:'.6rem'}}><button type="button" onClick={()=>fileRef.current?.click()}>{t.import}</button><button type="button" onClick={()=>setProject(c=>({...c,events:[...c.events,{id:newWorkspaceId(),measure:'',beat:'',part:'',pitch:'',duration:'',annotation:'',recordingTime:''}]}))}>＋ {t.add}</button><button type="button" onClick={()=>downloadWorkspaceJson(safeWorkspaceFileName(project.title,'musicology')+'.json',project)}>{t.export}</button><input ref={fileRef} className="discipline-file" type="file" accept=".musicxml,.xml,application/vnd.recordare.musicxml+xml,text/xml" onChange={e=>{void importScore(e.target.files?.[0]);e.currentTarget.value=''}}/></div>{error&&<p role="alert">{error}</p>}</section>
  <section className="discipline-card"><div className="discipline-heading"><h5>{t.events}</h5><small>{project.events.length}</small></div>{project.events.length===0?<p className="discipline-empty">{t.empty}</p>:<div className="discipline-list">{project.events.map(event=><div className="discipline-row" key={event.id}>
   <label>{t.measure}<input value={event.measure} onChange={e=>updateEvent(event.id,{measure:e.target.value})}/></label><label>{t.beat}<input value={event.beat} onChange={e=>updateEvent(event.id,{beat:e.target.value})}/></label><label>{t.part}<input value={event.part} onChange={e=>updateEvent(event.id,{part:e.target.value})}/></label><label>{t.pitch}<input value={event.pitch} onChange={e=>updateEvent(event.id,{pitch:e.target.value})}/></label><label>{t.duration}<input value={event.duration} onChange={e=>updateEvent(event.id,{duration:e.target.value})}/></label><label>{t.recordingTime}<input value={event.recordingTime} onChange={e=>updateEvent(event.id,{recordingTime:e.target.value})}/></label><label>{t.annotation}<input value={event.annotation} onChange={e=>updateEvent(event.id,{annotation:e.target.value})}/></label><button className="discipline-danger" type="button" onClick={()=>setProject(c=>({...c,events:c.events.filter(item=>item.id!==event.id)}))}>{t.remove}</button>
  </div>)}</div>}</section>
 </div>
}
