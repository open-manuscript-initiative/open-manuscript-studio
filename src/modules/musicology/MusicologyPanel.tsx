import { useRef, useState } from 'react';
import { DOMParser as XmlParser, type Document as XmlDocument, type Element as XmlElement } from '@xmldom/xmldom';
import { downloadWorkspaceJson, newWorkspaceId, safeWorkspaceFileName, useLocalWorkspace } from '../disciplineWorkspace';
import '../disciplineWorkspaces.css';

interface MusicEvent { id:string; measure:string; beat:string; part:string; pitch:string; duration:string; annotation:string; recordingTime:string }
interface MusicProject { title:string; composer:string; source:string; language:string; key:string; meter:string; tempo:string; recordingUrl:string; events:MusicEvent[] }
interface Props { locale?:string; storageKey?:string }
const words={
 hu:{intro:'Kezelje a kotta alapadatait, a zenei eseményeket és a felvételhez illesztett megjegyzéseket. A MusicXML- és MIDI-import szerkeszthető eseményekké alakítja a kottát vagy a hangjegyeket.',title:'Mű címe',composer:'Szerző / zeneszerző',source:'Forrás / kiadás',key:'Hangnem',meter:'Ütemmutató',tempo:'Tempó',recording:'Felvétel URL-je',import:'MusicXML / MIDI importálása',events:'Zenei események',add:'Esemény hozzáadása',measure:'Ütem',beat:'Ütés',part:'Szólam',pitch:'Hang / esemény',duration:'Időtartam',annotation:'Elemzés / változat',recordingTime:'Felvétel időpontja',remove:'Eltávolítás',export:'Projekt JSON letöltése',empty:'Még nincs zenei esemény. Importáljon MusicXML- vagy MIDI-fájlt, vagy vegyen fel egy sort.',error:'A zenei fájl nem olvasható vagy hibás.',language:'A kotta nyelve'},
 en:{intro:'Record score metadata, musical events, and notes aligned to a recording. MusicXML and MIDI imports create editable musical events.',title:'Work title',composer:'Composer / creator',source:'Source / edition',key:'Key',meter:'Time signature',tempo:'Tempo',recording:'Recording URL',import:'Import MusicXML / MIDI',events:'Musical events',add:'Add event',measure:'Measure',beat:'Beat',part:'Part',pitch:'Pitch / event',duration:'Duration',annotation:'Analysis / variant',recordingTime:'Recording time',remove:'Remove',export:'Download project JSON',empty:'No musical events yet. Import a MusicXML or MIDI file, or add an event.',error:'The music file is unreadable or invalid.',language:'Score language'},
 de:{intro:'Erfassen Sie Notendaten, musikalische Ereignisse und mit einer Aufnahme verknüpfte Anmerkungen. MusicXML- und MIDI-Import erstellen bearbeitbare musikalische Ereignisse.',title:'Werktitel',composer:'Komponist / Urheber',source:'Quelle / Ausgabe',key:'Tonart',meter:'Taktart',tempo:'Tempo',recording:'Aufnahme-URL',import:'MusicXML / MIDI importieren',events:'Musikalische Ereignisse',add:'Ereignis hinzufügen',measure:'Takt',beat:'Zählzeit',part:'Stimme',pitch:'Ton / Ereignis',duration:'Dauer',annotation:'Analyse / Variante',recordingTime:'Aufnahmezeit',remove:'Entfernen',export:'Projekt-JSON herunterladen',empty:'Noch keine musikalischen Ereignisse. Importieren Sie eine MusicXML- oder MIDI-Datei oder fügen Sie ein Ereignis hinzu.',error:'Die Musikdatei ist unlesbar oder ungültig.',language:'Sprache der Partitur'}
};
const fresh=(language:string):MusicProject=>({title:'',composer:'',source:'',language,key:'',meter:'',tempo:'',recordingUrl:'',events:[]});
function xmlElements(root: XmlDocument | XmlElement, selector: string): XmlElement[] {
 const segments=selector.trim().split(/\\s+/);
 let roots: Array<XmlDocument | XmlElement>=[root];
 for(const segment of segments){
  const match=/^([A-Za-z_][\\w:.-]*)(?:\\[([A-Za-z_:.-]+)(?:=["']([^"']*)["'])?\\])?$/.exec(segment);
  if(!match) return [];
  const [,tag,attribute,expected]=match;
  roots=roots.flatMap(node=>Array.from(node.getElementsByTagNameNS('*',tag)).filter(element=>{
   if(!attribute)return true;
   const actual=element.getAttribute(attribute);
   return expected===undefined?actual!==null:actual===expected;
  }));
 }
 return roots as XmlElement[];
}
function xmlText(parent: XmlDocument | XmlElement | null, selector: string): string {
 return parent ? xmlElements(parent,selector)[0]?.textContent?.trim() ?? '' : '';
}
function directElements(parent: XmlElement): XmlElement[] {
 return Array.from(parent.childNodes).filter(node=>node.nodeType===1) as XmlElement[];
}
function parseMusicXml(xml:string):{project:Partial<MusicProject>;events:MusicEvent[]}{
 if(/<!ENTITY\\b/i.test(xml))throw new Error('MusicXML entity declarations are not supported');
 const document=new XmlParser({onError:()=>{throw new Error('Invalid MusicXML')}}).parseFromString(xml,'application/xml');
 if(document.documentElement?.localName!=='score-partwise')throw new Error('Expected a score-partwise document');
 const partNames=new Map(xmlElements(document,'score-part').map(part=>[part.getAttribute('id')??'',xmlText(part,'part-name')]));
 const events:MusicEvent[]=[];
 for(const part of xmlElements(document,'part')){
  const divisions=Number(xmlText(part,'measure attributes divisions'))||Number(xmlText(part,'divisions'))||1;
  const partId=part.getAttribute('id')??'';
  for(const measure of directElements(part).filter(element=>element.localName==='measure')){
   let tick=0; const number=measure.getAttribute('number')??'';
   for(const child of directElements(measure)){
    if(child.localName==='backup'){tick-=Number(xmlText(child,'duration'))||0;continue}
    if(child.localName==='forward'){tick+=Number(xmlText(child,'duration'))||0;continue}
    if(child.localName!=='note')continue;
    const durationTicks=Number(xmlText(child,'duration'))||0;
    const step=xmlText(child,'pitch step'); const alter=Number(xmlText(child,'pitch alter'))||0; const octave=xmlText(child,'pitch octave');
    const pitch=xmlElements(child,'rest').length?'rest':step?step+(alter===1?'♯':alter===-1?'♭':alter?String(alter):'')+octave:'unpitched';
    const chord=xmlElements(child,'chord').length>0; const beat=(tick/divisions+1).toFixed(2);
    events.push({id:newWorkspaceId(),measure:number,beat,part:partNames.get(partId)??partId,pitch,duration:(durationTicks/divisions).toFixed(2),annotation:'',recordingTime:''});
    if(!chord)tick+=durationTicks;
   }
  }
 }
 return {project:{title:xmlText(document,'work-title')||xmlText(document,'movement-title'),composer:xmlElements(document,'creator[type="composer"]').map(e=>e.textContent?.trim()).find(Boolean)||xmlText(document,'creator'),meter:xmlText(document,'time beats')+'/'+xmlText(document,'time beat-type'),key:xmlText(document,'fifths'),tempo:xmlElements(document,'sound[tempo]').map(e=>e.getAttribute('tempo')).find((value): value is string => Boolean(value))},events};
}

interface MidiNote { tick:number; endTick:number; channel:number; pitch:number; trackName:string }
function readMidiVlq(bytes:Uint8Array, offset:number, end:number):{value:number;offset:number}{
 let value=0; let count=0;
 while(offset<end&&count<4){const byte=bytes[offset++]??0;value=(value<<7)|(byte&0x7f);count++;if(!(byte&0x80))return {value,offset};}
 throw new Error('Invalid MIDI variable-length quantity');
}
function midiAscii(bytes:Uint8Array,offset:number,length:number):string{return String.fromCharCode(...bytes.subarray(offset,offset+length))}
function midiText(bytes:Uint8Array,start:number,end:number):string{return new TextDecoder().decode(bytes.subarray(start,end)).trim()}
function midiPitch(value:number):string{
 const steps=['C','C','D','D','E','F','F','G','G','A','A','B']; const alters=[0,1,0,1,0,0,1,0,1,0,1,0]; const index=value%12;
 return `${steps[index]??'C'}${alters[index]?'♯':''}${Math.floor(value/12)-1}`;
}
function parseMidi(buffer:ArrayBuffer):{project:Partial<MusicProject>;events:MusicEvent[]}{
 const bytes=new Uint8Array(buffer); const view=new DataView(buffer);
 if(bytes.length<14||midiAscii(bytes,0,4)!=='MThd')throw new Error('The MIDI file has no valid header');
 const headerLength=view.getUint32(4,false); if(headerLength<6||8+headerLength>bytes.length)throw new Error('Invalid MIDI header');
 const trackCount=view.getUint16(10,false); const division=view.getUint16(12,false);
 if((division&0x8000)!==0||division===0)throw new Error('SMPTE-timed MIDI files are not supported');
 const ticksPerBeat=division; let offset=8+headerLength; let numerator=4; let denominator=4; let tempo=0;
 const notes:MidiNote[]=[];
 for(let trackIndex=0;trackIndex<trackCount&&offset+8<=bytes.length;trackIndex++){
  if(midiAscii(bytes,offset,4)!=='MTrk')throw new Error('Invalid MIDI track');
  const length=view.getUint32(offset+4,false); const trackStart=offset+8; const end=trackStart+length;
  if(end>bytes.length)throw new Error('Truncated MIDI track');
  offset=end; let cursor=trackStart; let tick=0; let runningStatus=0; let trackName='';
  const pending=new Map<string,Array<{tick:number;pitch:number;channel:number}>>();
  while(cursor<end){
   const delta=readMidiVlq(bytes,cursor,end); cursor=delta.offset; tick+=delta.value;
   let status=bytes[cursor]??0;
   if(status<0x80){if(runningStatus<0x80)throw new Error('Invalid MIDI running status');status=runningStatus;}
   else {cursor++;if(status<0xf0)runningStatus=status;else runningStatus=0;}
   if(status===0xff){
    if(cursor>=end)throw new Error('Truncated MIDI meta event');
    const type=bytes[cursor++]??0; const metaLength=readMidiVlq(bytes,cursor,end); cursor=metaLength.offset; const metaEnd=cursor+metaLength.value;
    if(metaEnd>end)throw new Error('Truncated MIDI meta event');
    if(type===0x03)trackName=midiText(bytes,cursor,metaEnd);
    if(type===0x58&&metaLength.value>=2){numerator=bytes[cursor]??4;denominator=2**(bytes[cursor+1]??2);}
    if(type===0x51&&metaLength.value===3){const micros=((bytes[cursor]??0)<<16)|((bytes[cursor+1]??0)<<8)|(bytes[cursor+2]??0);if(micros>0)tempo=Math.round(60_000_000/micros);}
    cursor=metaEnd; continue;
   }
   if(status===0xf0||status===0xf7){const payload=readMidiVlq(bytes,cursor,end);cursor=payload.offset+payload.value;if(cursor>end)throw new Error('Truncated MIDI system-exclusive event');continue;}
   const command=status&0xf0; const channel=status&0x0f;
   if(command<0x80||command>0xe0)throw new Error('Unsupported MIDI event');
   const dataLength=command===0xc0||command===0xd0?1:2;
   if(cursor+dataLength>end)throw new Error('Truncated MIDI event');
   const pitch=bytes[cursor++]??0; const velocity=dataLength===2?(bytes[cursor++]??0):0;
   if(command===0x90&&velocity>0){
    const key=`${channel}:${pitch}`; const queue=pending.get(key)??[];queue.push({tick,pitch,channel});pending.set(key,queue);
   }else if(command===0x80||(command===0x90&&velocity===0)){
    const key=`${channel}:${pitch}`;const queue=pending.get(key);const start=queue?.shift();
    if(start)notes.push({tick:start.tick,endTick:Math.max(tick,start.tick),channel,pitch:start.pitch,trackName});
   }
  }
 }
 if(notes.length===0)throw new Error('The MIDI file contains no complete note events');
 const barTicks=ticksPerBeat*numerator*4/denominator;
 const events=notes.sort((a,b)=>a.tick-b.tick).slice(0,20000).map(note=>{
  const measure=Math.floor(note.tick/barTicks)+1; const beat=(note.tick%barTicks)/ticksPerBeat+1;
  return {id:newWorkspaceId(),measure:String(measure),beat:beat.toFixed(2),part:note.trackName||`Track ${note.channel+1}`,pitch:midiPitch(note.pitch),duration:((note.endTick-note.tick)/ticksPerBeat).toFixed(2),annotation:'',recordingTime:''};
 });
 return {project:{meter:`${numerator}/${denominator}`,...(tempo?{tempo:String(tempo)}:{})},events};
}
export function MusicologyPanel({locale='hu',storageKey='default'}:Props){
 const t=words[locale as keyof typeof words]??words.en; const fileRef=useRef<HTMLInputElement>(null);
 const [project,setProject]=useLocalWorkspace(`omi:musicology:v1:${storageKey}`,()=>fresh(locale));
 const [error,setError]=useState('');
 const update=(patch:Partial<MusicProject>)=>setProject((current)=>({...current,...patch}));
 async function importScore(file:File|undefined){
  if(!file)return;
  try{
   const isMidi=/\\.midi?$/i.test(file.name)||file.type==='audio/midi'||file.type==='audio/x-midi';
   const parsed=isMidi?parseMidi(await file.arrayBuffer()):parseMusicXml(await file.text());
   setProject(current=>({...current,...parsed.project,source:file.name,events:[...current.events,...parsed.events]}));setError('');
  }catch{setError(t.error)}
 }
 const updateEvent=(id:string,patch:Partial<MusicEvent>)=>setProject(current=>({...current,events:current.events.map(event=>event.id===id?{...event,...patch}:event)}));
 return <div className="discipline-workspace"><p className="discipline-intro">{t.intro}</p>
  <section className="discipline-card"><div className="discipline-grid">
   <label>{t.title}<input value={project.title} onChange={e=>update({title:e.target.value})}/></label><label>{t.composer}<input value={project.composer} onChange={e=>update({composer:e.target.value})}/></label>
   <label>{t.source}<input value={project.source} onChange={e=>update({source:e.target.value})}/></label><label>{t.language}<input value={project.language} onChange={e=>update({language:e.target.value})}/></label>
   <label>{t.key}<input value={project.key} onChange={e=>update({key:e.target.value})}/></label><label>{t.meter}<input value={project.meter} onChange={e=>update({meter:e.target.value})}/></label><label>{t.tempo}<input value={project.tempo} onChange={e=>update({tempo:e.target.value})}/></label><label>{t.recording}<input type="url" value={project.recordingUrl} onChange={e=>update({recordingUrl:e.target.value})}/></label>
  </div><div className="discipline-actions" style={{marginTop:'.6rem'}}><button type="button" onClick={()=>fileRef.current?.click()}>{t.import}</button><button type="button" onClick={()=>setProject(c=>({...c,events:[...c.events,{id:newWorkspaceId(),measure:'',beat:'',part:'',pitch:'',duration:'',annotation:'',recordingTime:''}]}))}>＋ {t.add}</button><button type="button" onClick={()=>downloadWorkspaceJson(safeWorkspaceFileName(project.title,'musicology')+'.json',project)}>{t.export}</button><input ref={fileRef} className="discipline-file" type="file" accept=".musicxml,.xml,.mid,.midi,application/vnd.recordare.musicxml+xml,application/xml,text/xml,audio/midi,audio/x-midi" onChange={e=>{void importScore(e.target.files?.[0]);e.currentTarget.value=''}}/></div>{error&&<p role="alert">{error}</p>}</section>
  <section className="discipline-card"><div className="discipline-heading"><h5>{t.events}</h5><small>{project.events.length}</small></div>{project.events.length===0?<p className="discipline-empty">{t.empty}</p>:<div className="discipline-list">{project.events.map(event=><div className="discipline-row" key={event.id}>
   <label>{t.measure}<input value={event.measure} onChange={e=>updateEvent(event.id,{measure:e.target.value})}/></label><label>{t.beat}<input value={event.beat} onChange={e=>updateEvent(event.id,{beat:e.target.value})}/></label><label>{t.part}<input value={event.part} onChange={e=>updateEvent(event.id,{part:e.target.value})}/></label><label>{t.pitch}<input value={event.pitch} onChange={e=>updateEvent(event.id,{pitch:e.target.value})}/></label><label>{t.duration}<input value={event.duration} onChange={e=>updateEvent(event.id,{duration:e.target.value})}/></label><label>{t.recordingTime}<input value={event.recordingTime} onChange={e=>updateEvent(event.id,{recordingTime:e.target.value})}/></label><label>{t.annotation}<input value={event.annotation} onChange={e=>updateEvent(event.id,{annotation:e.target.value})}/></label><button className="discipline-danger" type="button" onClick={()=>setProject(c=>({...c,events:c.events.filter(item=>item.id!==event.id)}))}>{t.remove}</button>
  </div>)}</div>}</section>
 </div>
}
