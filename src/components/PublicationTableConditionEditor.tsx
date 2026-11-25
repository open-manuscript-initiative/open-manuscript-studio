import { useState } from 'react';
import type { VisualElementsCopy } from '../i18n/visualElements';
import type { OmiTableCellFormat, OmiTableCellSide, OmiTableCellBorder } from '../types/omi';
import { TABLE_CELL_SIDES } from '../model/tableLayout';
import { MAX_TABLE_CONDITIONS, moveTableCondition, normalizeTableCondition, type TableCondition, type TableConditionOperator } from '../model/tableAppearancePresets';

type Props={rules:TableCondition[];copy:VisualElementsCopy;onChange:(rules:TableCondition[])=>void;canInherit:boolean;onInherit:()=>void};
export function PublicationTableConditionEditor({rules,copy,onChange,canInherit,onInherit}:Props){
  const [operator,setOperator]=useState<TableConditionOperator>('lt');
  const [operand,setOperand]=useState('0');
  const [format,setFormat]=useState<OmiTableCellFormat>({backgroundColor:'#F4CCCC'});
  const [editing,setEditing]=useState<number|null>(null);
  const [error,setError]=useState(false);
  const operators:Record<TableConditionOperator,string>={eq:'=',contains:copy.tableConditionContains,lt:'<',lte:'≤',gt:'>',gte:'≥',empty:copy.tableConditionEmpty,nonempty:copy.tableConditionNonempty};
  const sideLabel=(side:OmiTableCellSide)=>({top:'↑',right:'→',bottom:'↓',left:'←'})[side];
  const patch=(value:Partial<OmiTableCellFormat>)=>setFormat(current=>({...current,...value}));
  function border(side:OmiTableCellSide,value:OmiTableCellBorder|undefined){
    setFormat(current=>{const next={...current.borders};if(value)next[side]=value;else delete next[side];return {...current,borders:next};});
  }
  function padding(side:OmiTableCellSide,value:number){
    setFormat(current=>{const next={...current.paddingPt};if(Number.isFinite(value))next[side]=value;else delete next[side];return {...current,paddingPt:next};});
  }
  function cancel(){setEditing(null);setOperator('lt');setOperand('0');setFormat({backgroundColor:'#F4CCCC'});setError(false);}
  function edit(index:number){const rule=rules[index];if(!rule)return;setEditing(index);setOperator(rule.operator);setOperand(rule.value??'');setFormat({...rule.format});setError(false);}
  function save(){
    const rule=normalizeTableCondition({operator,value:operand,format});
    if(!rule||editing===null&&rules.length>=MAX_TABLE_CONDITIONS||editing!==null&&!rules[editing]){setError(true);return;}
    onChange(editing===null?[...rules,rule]:rules.map((old,i)=>i===editing?rule:old));cancel();
  }
  return <details><summary>{copy.tableConditions}</summary>
    <div className="omi-table-cell-formatting-fields">
      <label><span>{copy.tableConditions}</span><select value={operator} onChange={e=>setOperator(e.target.value as TableConditionOperator)}>{(Object.keys(operators) as TableConditionOperator[]).map(op=><option key={op} value={op}>{operators[op]}</option>)}</select></label>
      <label><span>{copy.tableConditionValue}</span><input maxLength={256} disabled={operator==='empty'||operator==='nonempty'} value={operand} onChange={e=>setOperand(e.target.value)}/></label>
      <label><input type="checkbox" checked={format.backgroundColor!==undefined} onChange={e=>patch({backgroundColor:e.target.checked?'#F4CCCC':undefined})}/>{copy.cellBackground}</label>
      <input type="color" aria-label={copy.cellBackground} disabled={format.backgroundColor===undefined} value={format.backgroundColor??'#FFFFFF'} onChange={e=>patch({backgroundColor:e.target.value})}/>
      <label><span>{copy.cellHorizontalAlign}</span><select value={format.horizontalAlign??''} onChange={e=>patch({horizontalAlign:(e.target.value||undefined) as OmiTableCellFormat['horizontalAlign']})}><option value="">{copy.tableStyleInheritValue}</option><option value="left">{copy.cellAlignLeft}</option><option value="center">{copy.cellAlignCenter}</option><option value="right">{copy.cellAlignRight}</option><option value="justify">{copy.cellAlignJustify}</option></select></label>
      <label><span>{copy.cellVerticalAlign}</span><select value={format.verticalAlign??''} onChange={e=>patch({verticalAlign:(e.target.value||undefined) as OmiTableCellFormat['verticalAlign']})}><option value="">{copy.tableStyleInheritValue}</option><option value="top">{copy.cellAlignTop}</option><option value="middle">{copy.cellAlignMiddle}</option><option value="bottom">{copy.cellAlignBottom}</option></select></label>
    </div>
    <details><summary>{copy.cellEdges}</summary>
      {TABLE_CELL_SIDES.map(side=>{const edge=format.borders?.[side];return <div key={side} className="omi-table-cell-formatting-fields">
        <label><span>{sideLabel(side)} {copy.cellBorderStyle}</span><select value={edge?.style??''} onChange={e=>{const style=e.target.value;if(!style)border(side,undefined);else if(style==='none')border(side,{style:'none'});else border(side,{style:style as 'solid'|'dashed'|'dotted'|'double',widthPt:edge?.widthPt??0.5,color:edge?.color??'#555555'});}}><option value="">{copy.tableStyleInheritValue}</option><option value="none">{copy.cellBorderNone}</option><option value="solid">{copy.cellBorderSolid}</option><option value="dashed">{copy.cellBorderDashed}</option><option value="dotted">{copy.cellBorderDotted}</option><option value="double">{copy.cellBorderDouble}</option></select></label>
        <label><span>{copy.cellBorderWidth} (pt)</span><input type="number" min={0.125} max={12} step={0.125} disabled={!edge||edge.style==='none'} value={edge?.widthPt??0.5} onChange={e=>{if(edge&&edge.style!=='none'&&Number.isFinite(e.target.valueAsNumber))border(side,{...edge,widthPt:e.target.valueAsNumber});}}/></label>
        <label><span>{copy.cellBorderColor}</span><input type="color" disabled={!edge||edge.style==='none'} value={edge?.color??'#555555'} onChange={e=>{if(edge&&edge.style!=='none')border(side,{...edge,color:e.target.value});}}/></label>
        <label><span>{sideLabel(side)} {copy.cellPadding} (pt)</span><input type="number" min={0} max={144} step={0.5} value={format.paddingPt?.[side]??''} onChange={e=>padding(side,e.target.valueAsNumber)}/></label>
      </div>;})}
    </details>
    <div className="omi-table-actions"><button type="button" disabled={editing===null&&rules.length>=MAX_TABLE_CONDITIONS} onClick={save}>{editing===null?copy.addTableCondition:copy.saveTableStyle}</button>{editing!==null?<button type="button" onClick={cancel}>{copy.cancelConditionEdit}</button>:null}</div>
    <small>{copy.tableConditionHint}</small>
    {error?<p role="alert">{copy.tableStyleError}</p>:null}
    {rules.map((rule,i)=><div key={i} className="omi-table-cell-formatting-fields">
      <span>{i+1}. {operators[rule.operator]} {rule.value??''} — {copy.conditionAppearance}: {[rule.format.backgroundColor,rule.format.horizontalAlign?copy.cellHorizontalAlign:undefined,rule.format.verticalAlign?copy.cellVerticalAlign:undefined,rule.format.borders?copy.cellBorderStyle:undefined,rule.format.paddingPt?copy.cellPadding:undefined].filter(Boolean).join(', ')}</span>
      <button type="button" disabled={editing!==null} onClick={()=>edit(i)}>{copy.editTableCondition}</button>
      <button type="button" disabled={editing!==null||i===0} onClick={()=>onChange(moveTableCondition(rules,i,-1))}>{copy.moveConditionUp}</button>
      <button type="button" disabled={editing!==null||i===rules.length-1} onClick={()=>onChange(moveTableCondition(rules,i,1))}>{copy.moveConditionDown}</button>
      <button type="button" disabled={editing!==null} onClick={()=>onChange(rules.filter((_,j)=>i!==j))}>{copy.deleteTableStyle}</button>
    </div>)}
    {canInherit?<button type="button" disabled={editing!==null} onClick={onInherit}>{copy.clearTableRegion}</button>:null}
  </details>;
}
