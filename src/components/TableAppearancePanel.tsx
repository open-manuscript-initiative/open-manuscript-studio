import { useEffect, useState } from 'react';
import { useStudioStore } from '../app/useStudioStore';
import { stageAppliedPublicationStyle } from '../app/publicationTemplateActions';
import { getAppliedPublicationTemplate } from '../model/publicationTemplates';
import { loadPublicationStyle } from '../services/publicationStyleExport';
import type { OmiTableBlockData } from '../types/omi';
import type { VisualElementsCopy } from '../i18n/visualElements';
import type { TableCellPosition } from '../model/tableLayout';
import { derivePublicationTablePreset, normalizePresetFormat, type TableStyleRegion, bindPublicationCellStyle, detachPublicationCellStyles, selectedPublicationCellStyles, resetInheritedCellAppearance, bindPublicationTableStyle, detachPublicationTableStyle, replacePublicationTablePreset, applyAppearancePreset, BUILTIN_TABLE_STYLES, captureCellPreset, captureTablePreset, MAX_TABLE_PRESETS, normalizeAppearancePreset, readAppearancePresets, TABLE_STYLE_STORAGE_KEY, normalizePublicationTableStyles, putPublicationTablePreset, removePublicationTablePreset, type PublicationTableStyles, type TableAppearancePreset } from '../model/tableAppearancePresets';

function loadPresets():TableAppearancePreset[]{
  try{return readAppearancePresets(localStorage.getItem(TABLE_STYLE_STORAGE_KEY));}catch{return [];}
}
export function TableAppearancePanel({table,start,end,copy,onChange}:{table:OmiTableBlockData;start:TableCellPosition;end:TableCellPosition;copy:VisualElementsCopy;onChange:(next:OmiTableBlockData)=>void}){
  const manuscript=useStudioStore(state=>state.manuscript);
  const catalog:PublicationTableStyles=normalizePublicationTableStyles(getAppliedPublicationTemplate(manuscript)?.style.tableStyles)??{items:[]};
  const [presets,setPresets]=useState(loadPresets);
  const [selected,setSelected]=useState(table.publicationTableStyle?'publication:'+table.publicationTableStyle:'builtin:grid');
  const [name,setName]=useState('');
  const [kind,setKind]=useState<'cell'|'table'>('cell');
  const [banded,setBanded]=useState(false);
  const [region,setRegion]=useState<TableStyleRegion>('firstColumn');
  const [error,setError]=useState(false);
  useEffect(()=>{
    const refresh=(event:StorageEvent)=>{if(event.key===TABLE_STYLE_STORAGE_KEY||event.key===null)setPresets(loadPresets());};
    window.addEventListener('storage',refresh);
    return ()=>window.removeEventListener('storage',refresh);
  },[]);
  const builtins:{key:string;label:string;preset:TableAppearancePreset}[]=[{key:'builtin:grid',label:copy.tableStyleGrid,preset:BUILTIN_TABLE_STYLES.grid},{key:'builtin:minimal',label:copy.tableStyleMinimal,preset:BUILTIN_TABLE_STYLES.minimal},{key:'builtin:banded',label:copy.tableStyleBanded,preset:BUILTIN_TABLE_STYLES.banded}];
  const choices=[...builtins,...presets.map(preset=>({key:'custom:'+preset.name,label:preset.name+' ('+(preset.kind==='cell'?copy.cellStyleLabel:copy.tableStyleLabel)+')',preset})),...catalog.items.map(preset=>({key:'publication:'+preset.name,label:copy.publicationTableStyles+': '+preset.name+(preset.name===catalog.defaultTableStyle?' ★':''),preset}))];
  const choice=choices.find(item=>item.key===selected);
  const cellLinks=selectedPublicationCellStyles(table,start,end);
  const publicationTable=selected.startsWith('publication:')&&choice?.preset.kind==='table'?choice.preset:undefined;
  function updateRegion(clear:boolean){
    if(!publicationTable)return;
    const next={...publicationTable};
    if(clear){if(region==='header'||region==='body')next[region]={};else delete next[region];}
    else next[region]=normalizePresetFormat(captureCellPreset(table,start,publicationTable.name).format,false);
    const changed=replacePublicationTablePreset(catalog,next);
    if(changed)persistPublication(changed);else setError(true);
  }
  function persist(next:TableAppearancePreset[]):boolean{
    try{localStorage.setItem(TABLE_STYLE_STORAGE_KEY,JSON.stringify(next));setPresets(next);setError(false);return true;}catch{setError(true);return false;}
  }
  function save(){
    const preset=normalizeAppearancePreset(kind==='cell'?captureCellPreset(table,start,name):captureTablePreset(table,name,banded));
    const current=loadPresets();
    if(!preset||current.length>=MAX_TABLE_PRESETS||current.some(p=>p.name===preset.name)){setError(true);return;}
    if(persist([...current,preset])){setSelected('custom:'+preset.name);setName('');}
  }
  function persistPublication(next:PublicationTableStyles):boolean{
    const current=useStudioStore.getState().manuscript;
    if(current.id!==manuscript.id){setError(true);return false;}
    const style=loadPublicationStyle(current);
    try{stageAppliedPublicationStyle({...style,tableStyles:next});setError(false);return true;}catch{setError(true);return false;}
  }
  function copyToPublication(){
    if(!choice)return;
    const current=useStudioStore.getState().manuscript;
    const existing=normalizePublicationTableStyles(getAppliedPublicationTemplate(current)?.style.tableStyles);
    const next=putPublicationTablePreset(existing,choice.preset);
    if(!next){setError(true);return;}
    if(persistPublication(next))setSelected('publication:'+choice.preset.name);
  }
  function remove(){
    if(!choice||!selected.startsWith('custom:'))return;
    if(persist(loadPresets().filter(p=>p.name!==choice.preset.name)))setSelected('builtin:grid');
  }
  return <details className="omi-table-cell-formatting" onToggle={event=>{if(event.currentTarget.open)setPresets(loadPresets());}}>
    <summary>{copy.tableAppearanceStyles}</summary>
    <div className="omi-table-cell-formatting-fields">
      <label><span>{copy.tableStyleLabel}</span><select value={choice?selected:''} onChange={event=>{setSelected(event.target.value);setError(false);}}>
        {!choice?<option value="" disabled>{copy.tableStyleLabel}</option>:null}
        {choices.map(item=><option key={item.key} value={item.key}>{item.label}</option>)}
      </select></label>
      <button type="button" disabled={!choice} onClick={()=>{if(choice)onChange(selected.startsWith('publication:')?(choice.preset.kind==='table'?bindPublicationTableStyle(table,catalog,choice.preset.name):bindPublicationCellStyle(table,catalog,choice.preset.name,start,end)):applyAppearancePreset(table,choice.preset,start,end));}}>{copy.applyTableStyle}</button>
      <button type="button" disabled={!choice||!selected.startsWith('custom:')} onClick={remove}>{copy.deleteTableStyle}</button>
    </div>
    <small>{copy.tableStyleApplyHint}</small>
    <div className="omi-table-cell-formatting-fields">
      <button type="button" disabled={!choice||selected.startsWith('publication:')} onClick={copyToPublication}>{copy.saveStyleToPublication}</button>
      <button type="button" disabled={!choice||!selected.startsWith('publication:')} onClick={()=>{if(choice){if(persistPublication(removePublicationTablePreset(catalog,choice.preset.name)))setSelected('builtin:grid');}}}>{copy.removeStyleFromPublication}</button>
      <label><span>{copy.defaultPublicationTableStyle}</span><select value={catalog.defaultTableStyle??''} onChange={event=>persistPublication({items:catalog.items,...(event.target.value?{defaultTableStyle:event.target.value}:{})})}><option value="">{copy.noDefaultPublicationTableStyle}</option>{catalog.items.filter(p=>p.kind==='table').map(p=><option key={p.name} value={p.name}>{p.name}</option>)}</select></label>
    </div>
    {table.publicationTableStyle?<small>{copy.linkedPublicationTableStyle}: {table.publicationTableStyle}</small>:null}
    {cellLinks.length?<small>{copy.linkedPublicationCellStyle}: {cellLinks.join(', ')}</small>:null}
    <div className="omi-table-cell-formatting-fields">
      <button type="button" disabled={!cellLinks.length} onClick={()=>onChange(detachPublicationCellStyles(table,start,end))}>{copy.detachPublicationCellStyle}</button>
      <button type="button" disabled={!cellLinks.length&&!table.publicationTableStyle} onClick={()=>onChange(resetInheritedCellAppearance(table,catalog,start,end))}>{copy.resetInheritedCellAppearance}</button>
      <button type="button" disabled={!table.publicationTableStyle} onClick={()=>onChange(detachPublicationTableStyle(table))}>{copy.detachPublicationTableStyle}</button>
      <button type="button" disabled={!choice||!selected.startsWith('publication:')} onClick={()=>{if(choice){const next=replacePublicationTablePreset(catalog,choice.preset.kind==='cell'?captureCellPreset(table,start,choice.preset.name):{...choice.preset,...captureTablePreset(table,choice.preset.name,banded||!!choice.preset.alternate)});if(next)persistPublication(next);}}}>{copy.updatePublicationTableStyle}</button>
    </div>
    {publicationTable?<details><summary>{copy.tableStyleRegions}</summary>
      {publicationTable.basedOn?<small>{copy.tableStyleBasedOn}: {publicationTable.basedOn}</small>:null}
      <div className="omi-table-cell-formatting-fields">
        <label><span>{copy.tableStyleName}</span><input maxLength={80} value={name} onChange={event=>setName(event.target.value)}/></label>
        <button type="button" disabled={!name.trim()} onClick={()=>{const next=derivePublicationTablePreset(catalog,name,publicationTable.name);if(next&&persistPublication(next)){setSelected('publication:'+name.trim());setName('');}else setError(true);}}>{copy.deriveTableStyle}</button>
        <label><span>{copy.tableStyleRegions}</span><select value={region} onChange={event=>setRegion(event.target.value as TableStyleRegion)}>
          <option value="header">{copy.tableRegionHeader}</option><option value="body">{copy.tableRegionBody}</option><option value="alternate">{copy.tableStyleBanded}</option><option value="firstColumn">{copy.tableRegionFirst}</option><option value="lastColumn">{copy.tableRegionLast}</option><option value="summary">{copy.tableRegionSummary}</option>
        </select></label>
        <button type="button" onClick={()=>updateRegion(false)}>{copy.captureTableRegion}</button>
        <button type="button" onClick={()=>updateRegion(true)}>{copy.clearTableRegion}</button>
      </div>
    </details>:null}
    <small>{copy.publicationTableStyleHint}</small>
    <div className="omi-table-cell-formatting-fields">
      <label><span>{copy.tableStyleName}</span><input maxLength={80} value={name} onChange={event=>{setName(event.target.value);setError(false);}}/></label>
      <label><span>{copy.tableStyleSaveAs}</span><select value={kind} onChange={event=>setKind(event.target.value==='table'?'table':'cell')}>
        <option value="cell">{copy.cellStyleLabel}</option><option value="table">{copy.tableStyleLabel}</option>
      </select></label>
      {kind==='table'?<label><input type="checkbox" checked={banded} onChange={event=>setBanded(event.target.checked)}/>{copy.tableStyleBanded}</label>:null}
      <button type="button" disabled={!name.trim()} onClick={save}>{copy.saveTableStyle}</button>
    </div>
    <small>{copy.tableStyleSaveHint}</small>
    {error?<small role="alert">{copy.tableStyleError}</small>:null}
  </details>;
}
