import { useState, type CSSProperties } from 'react';
import type { VisualElementsCopy } from '../i18n/visualElements';
import type { OmiTableCellFormat } from '../types/omi';
import { tableCellAppearanceStyle, tableCellFormat, tableCellTextStyle } from '../model/tableLayout';
import { BUILTIN_TABLE_STYLES, MAX_TABLE_CONDITIONS, derivePublicationTablePreset, duplicatePublicationTablePreset, normalizePublicationTableStyles, normalizePresetFormat, normalizeTableCondition, publicationTableStylePreview, putPublicationTablePreset, removePublicationTablePreset, replacePublicationTablePreset, resolvePublicationTablePreset, type PublicationTableStyles, type TableStyleRegion, type TableConditionOperator } from '../model/tableAppearancePresets';

type Props={catalog?:PublicationTableStyles;copy:VisualElementsCopy;onChange:(catalog:PublicationTableStyles)=>void};
export function PublicationTableStylesPanel({catalog:source,copy,onChange}:Props){
  const catalog=normalizePublicationTableStyles(source)??{items:[]};
  const [selection,setSelection]=useState('');
  const [name,setName]=useState('');
  const [kind,setKind]=useState<'table'|'cell'>('table');
  const [region,setRegion]=useState<TableStyleRegion>('body');
  const [error,setError]=useState(false);
  const [op,setOp]=useState<TableConditionOperator>('lt');
  const [operand,setOperand]=useState('0');
  const [ruleColor,setRuleColor]=useState('#F4CCCC');
  const preset=catalog.items.find(p=>p.name===selection)??catalog.items[0];
  const local=preset?.kind==='table'?preset[region]??{}:preset?.kind==='cell'?preset.format:{};
  const resolved=preset?.kind==='table'?resolvePublicationTablePreset(catalog,preset.name):undefined;
  const effective=preset?.kind==='table'?resolved?.[region]??{}:local;
  const rules=resolved?.conditions??[];
  function commit(next:PublicationTableStyles|undefined,select?:string){
    if(!next){setError(true);return;}
    setError(false);onChange(next);
    if(select!==undefined)setSelection(select);
  }
  function create(){
    const value=name.trim();
    const next=putPublicationTablePreset(catalog,kind==='table'?{...BUILTIN_TABLE_STYLES.grid,name:value}:{kind:'cell',name:value,format:{}});
    if(next){commit(next,value);setName('');}else setError(true);
  }
  function editFormat(patch:Partial<OmiTableCellFormat>){
    if(!preset)return;
    const value=normalizePresetFormat({...local,...patch},preset.kind==='cell');
    commit(replacePublicationTablePreset(catalog,preset.kind==='table'?{...preset,[region]:value}:{...preset,format:value}));
  }
  function changeRules(conditions:NonNullable<typeof resolved>['conditions']){
    if(!preset||preset.kind!=='table')return;
    const next={...preset};if(conditions===undefined)delete next.conditions;else next.conditions=conditions;
    commit(replacePublicationTablePreset(catalog,next));
  }
  const preview=preset?publicationTableStylePreview(catalog,preset.name):undefined;
  const labels:Record<TableStyleRegion,string>={header:copy.tableRegionHeader,body:copy.tableRegionBody,alternate:copy.tableStyleBanded,firstColumn:copy.tableRegionFirst,lastColumn:copy.tableRegionLast,summary:copy.tableRegionSummary};
  const operators:Record<TableConditionOperator,string>={eq:'=',contains:copy.tableConditionContains,lt:'<',lte:'≤',gt:'>',gte:'≥',empty:copy.tableConditionEmpty,nonempty:copy.tableConditionNonempty};
  return <fieldset className="publication-table-style-manager">
    <legend>{copy.tableAppearanceStyles}</legend>
    <div className="publication-style-grid">
      <label><span>{copy.tableStyleLabel}</span><select value={preset?.name??''} onChange={e=>{setSelection(e.target.value);setError(false);}}>
        {!preset?<option value="">—</option>:null}{catalog.items.map(p=><option key={p.name} value={p.name}>{p.name} ({p.kind==='cell'?copy.cellStyleLabel:copy.tableStyleLabel})</option>)}
      </select></label>
      <label><span>{copy.defaultPublicationTableStyle}</span><select value={catalog.defaultTableStyle??''} onChange={e=>commit({items:catalog.items,...(e.target.value?{defaultTableStyle:e.target.value}:{})})}><option value="">{copy.noDefaultPublicationTableStyle}</option>{catalog.items.filter(p=>p.kind==='table').map(p=><option key={p.name}>{p.name}</option>)}</select></label>
      <label><span>{copy.tableStyleName}</span><input maxLength={80} value={name} onChange={e=>setName(e.target.value)}/></label>
      <label><span>{copy.tableStyleSaveAs}</span><select value={kind} onChange={e=>setKind(e.target.value==='cell'?'cell':'table')}><option value="table">{copy.tableStyleLabel}</option><option value="cell">{copy.cellStyleLabel}</option></select></label>
    </div>
    <div className="omi-table-actions">
      <button type="button" disabled={!name.trim()} onClick={create}>{copy.newTableStyle}</button>
      <button type="button" disabled={!preset||!name.trim()} onClick={()=>{if(preset){const next=duplicatePublicationTablePreset(catalog,preset.name,name.trim());commit(next,next?name.trim():undefined);if(next)setName('');}}}>{copy.duplicateTableStyle}</button>
      <button type="button" disabled={preset?.kind!=='table'||!name.trim()} onClick={()=>{if(preset?.kind==='table'){const next=derivePublicationTablePreset(catalog,name.trim(),preset.name);commit(next,next?name.trim():undefined);if(next)setName('');}}}>{copy.deriveTableStyle}</button>
      <button type="button" disabled={!preset} onClick={()=>{if(preset)commit(removePublicationTablePreset(catalog,preset.name),'');}}>{copy.removeStyleFromPublication}</button>
    </div>
    {preset?<><div className="publication-style-grid">
      {preset.kind==='table'?<label><span>{copy.tableStyleRegions}</span><select value={region} onChange={e=>setRegion(e.target.value as TableStyleRegion)}>{(Object.keys(labels) as TableStyleRegion[]).map(key=><option key={key} value={key}>{labels[key]}</option>)}</select></label>:null}
      {preset.kind==='table'&&preset.basedOn?<p>{copy.tableStyleBasedOn}: {preset.basedOn}</p>:null}
      <label><span>{copy.cellHorizontalAlign}</span><select value={local.horizontalAlign??''} onChange={e=>editFormat({horizontalAlign:(e.target.value||undefined) as OmiTableCellFormat['horizontalAlign']})}><option value="">{copy.tableStyleInheritValue}</option><option value="left">{copy.cellAlignLeft}</option><option value="center">{copy.cellAlignCenter}</option><option value="right">{copy.cellAlignRight}</option><option value="justify">{copy.cellAlignJustify}</option></select></label>
      <label><span>{copy.cellVerticalAlign}</span><select value={local.verticalAlign??''} onChange={e=>editFormat({verticalAlign:(e.target.value||undefined) as OmiTableCellFormat['verticalAlign']})}><option value="">{copy.tableStyleInheritValue}</option><option value="top">{copy.cellAlignTop}</option><option value="middle">{copy.cellAlignMiddle}</option><option value="bottom">{copy.cellAlignBottom}</option></select></label>
      <label><span>{copy.cellBackground}</span><input type="color" value={effective.backgroundColor??'#FFFFFF'} onChange={e=>editFormat({backgroundColor:e.target.value})}/></label>
      <button type="button" onClick={()=>editFormat({backgroundColor:undefined})}>{copy.cellClearBackground}</button>
      <label><span>{copy.cellPadding} (pt)</span><input type="number" min={0} max={144} step={0.5} value={local.paddingPt?.top??''} placeholder={String(effective.paddingPt?.top??'')} onChange={e=>{const n=e.target.valueAsNumber;editFormat({paddingPt:Number.isFinite(n)?{top:n,right:n,bottom:n,left:n}:undefined});}}/></label>
      <label><span>{copy.cellBorderStyle}</span><select value={local.borders?.top?.style??''} onChange={e=>{const value=e.target.value;if(!value){editFormat({borders:undefined});return;}const border=value==='none'?{style:'none' as const}:{style:value as 'solid'|'dashed'|'dotted'|'double',widthPt:0.5,color:'#555555'};editFormat({borders:{top:border,right:border,bottom:border,left:border}});}}><option value="">{copy.tableStyleInheritValue}</option><option value="none">{copy.cellBorderNone}</option><option value="solid">{copy.cellBorderSolid}</option><option value="dashed">{copy.cellBorderDashed}</option><option value="dotted">{copy.cellBorderDotted}</option><option value="double">{copy.cellBorderDouble}</option></select></label>
      {preset.kind==='cell'?<><label><span>{copy.textRotation}</span><select value={local.textRotation??0} onChange={e=>editFormat({textRotation:Number(e.target.value) as OmiTableCellFormat['textRotation']})}><option value={0}>{copy.rotationNone}</option><option value={90}>{copy.rotationClockwise}</option><option value={-90}>{copy.rotationCounterclockwise}</option><option value={180}>{copy.rotationUpsideDown}</option></select></label><label><span>{copy.textDirection}</span><select value={local.textDirection??'auto'} onChange={e=>editFormat({textDirection:e.target.value as OmiTableCellFormat['textDirection']})}><option value="auto">{copy.directionAuto}</option><option value="ltr">{copy.directionLtr}</option><option value="rtl">{copy.directionRtl}</option></select></label></>:null}
    </div>
    {preset.kind==='table'?<details><summary>{copy.tableConditions}</summary><div className="publication-style-grid">
      <label><span>{copy.tableConditions}</span><select value={op} onChange={e=>setOp(e.target.value as TableConditionOperator)}>{(Object.keys(operators) as TableConditionOperator[]).map(key=><option key={key} value={key}>{operators[key]}</option>)}</select></label>
      <label><span>{copy.tableConditionValue}</span><input maxLength={256} disabled={op==='empty'||op==='nonempty'} value={operand} onChange={e=>setOperand(e.target.value)}/></label>
      <label><span>{copy.cellBackground}</span><input type="color" value={ruleColor} onChange={e=>setRuleColor(e.target.value)}/></label>
      <button type="button" disabled={rules.length>=MAX_TABLE_CONDITIONS} onClick={()=>{const rule=normalizeTableCondition({operator:op,value:operand,format:{backgroundColor:ruleColor}});if(rule)changeRules([...rules,rule]);else setError(true);}}>{copy.addTableCondition}</button>
    </div><small>{copy.tableConditionHint}</small>
    {rules.map((rule,i)=><div className="omi-table-actions" key={i}><span>{operators[rule.operator]} {rule.value} {rule.format.backgroundColor}</span><button type="button" onClick={()=>changeRules(rules.filter((_,j)=>i!==j))}>{copy.deleteTableStyle}</button></div>)}
    {preset.basedOn&&preset.conditions!==undefined?<button type="button" onClick={()=>changeRules(undefined)}>{copy.clearTableRegion}</button>:null}
    </details>:null}
    {preview?<figure style={{margin:'12px 0',overflowX:'auto'}}><figcaption>{copy.tableStylePreview}</figcaption><table aria-label={copy.tableStylePreview} style={{borderCollapse:'collapse',width:'100%',background:'#FFFFFF',color:'#111111'}}><tbody>{preview.cells.map((row,r)=><tr key={r}>{row.map((value,c)=>{const format=tableCellFormat(preview.cellFormats,r,c);const Cell=r===0?'th':'td';return <Cell key={c} style={tableCellAppearanceStyle(format) as CSSProperties} dir={format.textDirection}><span style={tableCellTextStyle(format.textRotation)}>{value||'\u00a0'}</span></Cell>;})}</tr>)}</tbody></table></figure>:null}
    </>:null}
    {error?<p role="alert">{copy.tableStyleError}</p>:null}
  </fieldset>;
}
