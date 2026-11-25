import { useState } from 'react';
import type { OmiTableBlockData } from '../types/omi';
import type { TableCellPosition } from '../model/tableLayout';
import { DIRECT_FORMATS, normalizeDirectValue } from '../model/directFormatting';
import { normalizeParagraphValue } from '../model/directParagraphFormatting';
import { applyRangeTypography, rangeMarkStates, rangeTypographyValue, RANGE_MARKS, RANGE_DIRECT_FORMATS, type RangeTypographyChange, type RangeField } from '../model/tableRangeTypography';
import { useTranslation } from '../i18n';
import { getRichTextCopy } from '../i18n/richText';
import { getVisualElementsCopy } from '../i18n/visualElements';
import { tableRangeCharacterLabels } from './DirectFormattingPanel';

function ValueField({label,current,apply,reset,applyLabel,resetLabel,placeholder,valid,type='text',min,max,choices}:{
  label:string;current:{value:string;mixed:boolean};apply:(value:string)=>void;reset:()=>void;applyLabel:string;resetLabel:string;placeholder:string;valid:(value:string)=>boolean;
  type?:'text'|'number';min?:number;max?:number;choices?:{value:string;label:string}[];
}){
  const [draft,setDraft]=useState<string|null>(null);
  const value=draft??current.value;
  const submit=()=>{if(valid(value)){apply(value);setDraft(null);}};
  return <div className="omi-direct-format-field">
    <label><span>{label}</span>{choices?<select aria-label={label} value={value} onChange={e=>setDraft(e.target.value)}>
      <option value="" disabled>{current.mixed?placeholder:'—'}</option>{choices.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}
    </select>:<input aria-label={label} type={type} min={min} max={max} step={type==='number'?'any':undefined} value={value} placeholder={current.mixed?placeholder:undefined} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();submit();}}}/>}</label>
    <button type="button" aria-label={applyLabel+': '+label} disabled={!valid(value)} onClick={submit}>✓</button>
    <button type="button" aria-label={resetLabel+': '+label} onClick={()=>{reset();setDraft(null);}}>↺</button>
  </div>;
}

export function TableRangeTypographyPanel({table,start,end,onChange}:{table:OmiTableBlockData;start:TableCellPosition;end:TableCellPosition;onChange:(table:OmiTableBlockData)=>void}){
  const {locale}=useTranslation();
  const copy=getVisualElementsCopy(locale),rich=getRichTextCopy(locale),labels=tableRangeCharacterLabels(locale);
  const states=rangeMarkStates(table,start,end);
  const current=(field:RangeField)=>rangeTypographyValue(table,start,end,field);
  const commit=(change:RangeTypographyChange)=>{const next=applyRangeTypography(table,start,end,change);if(next!==table)onChange(next);};
  const common={applyLabel:rich.apply,resetLabel:labels.reset,placeholder:labels.mixed};
  const [rule,setRule]=useState<'auto'|'exact'|'atLeast'|null>(null);
  const lineRule=current('omiLineRule');
  const effectiveRule=rule??(lineRule.value==='exact'||lineRule.value==='atLeast'?lineRule.value:'auto');
  const names=[rich.bold,rich.italic,rich.underline,rich.strike,rich.smallCaps,rich.superscript,rich.subscript];
  return <details className="omi-table-cell-formatting">
    <summary>{copy.rangeTextFormatting}</summary>
    <small>{copy.rangeTextFormattingHint}</small>
    <details open><summary>{labels.title}</summary>
      <div className="omi-table-actions" role="group" aria-label={labels.title}>
        {RANGE_MARKS.map((name,i)=><button type="button" key={name} aria-label={names[i]} title={names[i]} disabled={states[name]==='empty'} aria-pressed={states[name]==='mixed'?'mixed':states[name]==='on'} onClick={()=>commit({kind:'mark',name,enabled:states[name]!=='on'})}>{['B','I','U','S','Aa','x²','x₂'][i]}</button>)}
      </div>
      <div className="omi-table-cell-formatting-fields">
        <ValueField {...common} label={labels.omiSourceFont} current={current('omiSourceFont')} valid={v=>!!v.trim()&&v.trim().length<=128&&Array.from(v.trim()).every(c=>{const code=c.charCodeAt(0);return code>=32&&code!==127&&!';{}<>'.includes(c);})} apply={value=>commit({kind:'font',value})} reset={()=>commit({kind:'font',value:null})}/>
        {RANGE_DIRECT_FORMATS.map(name=>{
          const d=DIRECT_FORMATS[name];
          return <ValueField key={name} {...common} label={labels[name]} current={current(name)} type={'min' in d?'number':'text'} min={'min' in d?d.min:undefined} max={'max' in d?d.max:undefined} valid={v=>normalizeDirectValue(name,v)!==undefined} apply={value=>commit({kind:'direct',name,value})} reset={()=>commit({kind:'direct',name,value:null})}/>;
        })}
      </div>
    </details>
    <details><summary>{copy.cellParagraphFormatting}</summary>
      <div className="omi-table-cell-formatting-fields">
        <ValueField {...common} label={copy.cellHorizontalAlign} current={current('omiAlign')} choices={[{value:'left',label:copy.cellAlignLeft},{value:'center',label:copy.cellAlignCenter},{value:'right',label:copy.cellAlignRight},{value:'justify',label:copy.cellAlignJustify}]} valid={v=>normalizeParagraphValue('omiAlign',v)!==undefined} apply={value=>commit({kind:'paragraph',name:'omiAlign',value})} reset={()=>commit({kind:'paragraph',name:'omiAlign',value:null})}/>
        {([['omiLeftIndent',copy.cellParagraphLeftIndent],['omiRightIndent',copy.cellParagraphRightIndent],['omiFirstLineIndent',copy.cellParagraphFirstIndent],['omiSpaceBefore',copy.cellParagraphBefore],['omiSpaceAfter',copy.cellParagraphAfter]] as const).map(([name,label])=><ValueField key={name} {...common} label={label+' (pt)'} current={current(name)} type="number" min={name==='omiFirstLineIndent'?-1000:0} max={1000} valid={v=>normalizeParagraphValue(name,v)!==undefined} apply={value=>commit({kind:'paragraph',name,value})} reset={()=>commit({kind:'paragraph',name,value:null})}/>)}
        <label><span>{copy.cellParagraphLineRule}</span><select value={rule??(lineRule.mixed?'mixed':effectiveRule)} onChange={e=>{if(e.target.value!=='mixed')setRule(e.target.value as 'auto'|'exact'|'atLeast');}}><option value="mixed" disabled>{labels.mixed}</option><option value="auto">{copy.rowHeightAuto}</option><option value="exact">{copy.rowHeightExact}</option><option value="atLeast">{copy.rowHeightMinimum}</option></select></label>
        <ValueField key={effectiveRule} {...common} label={copy.cellParagraphLineSpacing+(effectiveRule==='auto'?' (×)':' (pt)')} current={rule&&rule!==lineRule.value?{value:rule==='auto'?'1':'12',mixed:false}:current('omiLineSpacing')} type="number" min={0.05} max={1000} valid={v=>normalizeParagraphValue('omiLineSpacing',v)!==undefined} apply={value=>{commit({kind:'lineSpacing',rule:effectiveRule,value:Number(value)});setRule(null);}} reset={()=>{commit({kind:'lineSpacing',rule:effectiveRule,value:null});setRule(null);}}/>
      </div>
    </details>
  </details>;
}
