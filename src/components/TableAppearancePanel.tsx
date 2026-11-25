import { useEffect, useState } from 'react';
import type { OmiTableBlockData } from '../types/omi';
import type { VisualElementsCopy } from '../i18n/visualElements';
import type { TableCellPosition } from '../model/tableLayout';
import { applyAppearancePreset, BUILTIN_TABLE_STYLES, captureCellPreset, captureTablePreset, MAX_TABLE_PRESETS, normalizeAppearancePreset, readAppearancePresets, TABLE_STYLE_STORAGE_KEY, type TableAppearancePreset } from '../model/tableAppearancePresets';

function loadPresets():TableAppearancePreset[]{
  try{return readAppearancePresets(localStorage.getItem(TABLE_STYLE_STORAGE_KEY));}catch{return [];}
}
export function TableAppearancePanel({table,start,end,copy,onChange}:{table:OmiTableBlockData;start:TableCellPosition;end:TableCellPosition;copy:VisualElementsCopy;onChange:(next:OmiTableBlockData)=>void}){
  const [presets,setPresets]=useState(loadPresets);
  const [selected,setSelected]=useState('builtin:grid');
  const [name,setName]=useState('');
  const [kind,setKind]=useState<'cell'|'table'>('cell');
  const [banded,setBanded]=useState(false);
  const [error,setError]=useState(false);
  useEffect(()=>{
    const refresh=(event:StorageEvent)=>{if(event.key===TABLE_STYLE_STORAGE_KEY||event.key===null)setPresets(loadPresets());};
    window.addEventListener('storage',refresh);
    return ()=>window.removeEventListener('storage',refresh);
  },[]);
  const builtins=[{key:'builtin:grid',label:copy.tableStyleGrid,preset:BUILTIN_TABLE_STYLES.grid},{key:'builtin:minimal',label:copy.tableStyleMinimal,preset:BUILTIN_TABLE_STYLES.minimal},{key:'builtin:banded',label:copy.tableStyleBanded,preset:BUILTIN_TABLE_STYLES.banded}];
  const choices=[...builtins,...presets.map(preset=>({key:'custom:'+preset.name,label:preset.name+' ('+(preset.kind==='cell'?copy.cellStyleLabel:copy.tableStyleLabel)+')',preset}))];
  const choice=choices.find(item=>item.key===selected);
  function persist(next:TableAppearancePreset[]):boolean{
    try{localStorage.setItem(TABLE_STYLE_STORAGE_KEY,JSON.stringify(next));setPresets(next);setError(false);return true;}catch{setError(true);return false;}
  }
  function save(){
    const preset=normalizeAppearancePreset(kind==='cell'?captureCellPreset(table,start,name):captureTablePreset(table,name,banded));
    const current=loadPresets();
    if(!preset||current.length>=MAX_TABLE_PRESETS||current.some(p=>p.name===preset.name)){setError(true);return;}
    if(persist([...current,preset])){setSelected('custom:'+preset.name);setName('');}
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
      <button type="button" disabled={!choice} onClick={()=>{if(choice)onChange(applyAppearancePreset(table,choice.preset,start,end));}}>{copy.applyTableStyle}</button>
      <button type="button" disabled={!choice||!selected.startsWith('custom:')} onClick={remove}>{copy.deleteTableStyle}</button>
    </div>
    <small>{copy.tableStyleApplyHint}</small>
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
