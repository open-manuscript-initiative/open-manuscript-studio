import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import { generateHTML } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { OMI_CONTINUOUS_RICH_TEXT_EXTENSIONS } from '../editor/extensions/OmiRichTextExtensions';
import { getRichTextCopy } from '../i18n/richText';
import { useFormattingEditor } from '../editor/useFormattingEditor';
import type { NoteJsonNode } from '../model/noteRichText';
import { ChartPreview } from './ChartPreview';
import { TextBoxCanvas } from './TextBoxCanvas';
import { createTextBox } from '../model/textBoxes';
import { getTextBoxCopy } from '../i18n/textBoxes';
import { Fragment, useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import {
  BarChart3,
  FileText,
  Plus,
  Merge,
  Split,
  ArrowDown,
  ArrowRight,
  Trash2,
} from 'lucide-react';

import {
  stageConvertTableToText,
  stageInsertBlocks,
  stageRemoveBlock,
  stageUpdateVisualBlock,
} from '../app/visualBlockActions';
import { useTranslation } from '../i18n';
import { getVisualElementsCopy } from '../i18n/visualElements';
import { EquationEditor } from '../modules/mathematics/EquationEditor';
import {
  addTableColumn,
  addTableRow,
  createChartBlock,
  removeTableColumn,
  removeTableRow,
  updateTableCell,
} from '../model/visualBlocks';
import type {
  OmiBlock,
  OmiImageBlockData,
  OmiChartBlockData,
  OmiChartType,
  OmiChartStyle,
  OmiTableBlockData,
  OmiTableCellFormat,
  OmiVisualBlockData,
  OmiMusicScoreBlockData,
} from '../types/omi';
import { AssetBackedImage } from './AssetBackedImage';
import { pruneTableCellFormats, resizeTableColumn, tableCellFormat, tableCellTextStyle, tableColumnWidths, tableHeaderRows, tableMergeLayout, extendTableMerge, splitTableMerge, tableRowSplitDefault, tableRowSplitPolicy, setTableRowSplitOverride, pruneTableRowSplitOverrides, tableCellAppearanceStyle, TABLE_CELL_SIDES, normalizeTableCellEdges, tableRowHeight, tableRowHeightStyle, setTableRowHeight, pruneTableRowHeights, tableCellDocument, plainTableCellDocument, tableCellPlainText, parseTableCellContent, pruneTableCellContent, normalizeCellParagraphAttrs } from '../model/tableLayout';
import { TablePaginationContext } from './TablePaginationContext';
import { PublicationPreviewContext } from './PublicationPreviewContext';
import { PublicationGraphicsContext } from './publicationViewOptions';

interface VisualBlockEditorProps {
  block: OmiBlock & { visual: OmiVisualBlockData };
  sectionId: string;
  blockIndex: number;
}

export function VisualBlockEditor({
  block,
  sectionId,
  blockIndex,
}: VisualBlockEditorProps) {
  const { locale } = useTranslation();
  const copy = getVisualElementsCopy(locale);
  const visual = block.visual;
  const previewOnly = useContext(PublicationPreviewContext);
  const graphicsMode = useContext(PublicationGraphicsContext);

  // A lightweight, non-editable proxy avoids chart, equation and text-box renderers
  // while typesetting. Tables remain real text because they affect line measurement.
  if ((graphicsMode === 'simplified' || graphicsMode === 'outlines') && visual.kind !== 'table') {
    const label = visualLabel(visual.kind, copy);
    const image = visual.kind === 'image' ? visual : null;
    const description = image?.alt || (visual.kind === 'chart' ? visual.title : '')
      || ('caption' in visual && typeof visual.caption === 'string' ? visual.caption : '') || label;
    return (
      <article className={`omi-visual-block omi-visual-block--lightweight omi-visual-block--${graphicsMode}`}
        data-block-id={block.id} data-graphics-mode={graphicsMode}
        aria-label={description}>
        <div className="omi-visual-lightweight-placeholder" role="img" aria-label={description}>
          {graphicsMode === 'simplified' && image ? <AssetBackedImage visual={image} lightweight /> : null}
          {graphicsMode === 'simplified' ? <span className="omi-visual-lightweight-label">{label}{description !== label ? `: ${description}` : ''}</span> : null}
        </div>
      </article>
    );
  }

  function update(next: OmiVisualBlockData): void {
    if (!previewOnly) stageUpdateVisualBlock(block.id, next);
  }

  function remove(): void {
    if (window.confirm(copy.confirmDelete)) stageRemoveBlock(block.id);
  }

  return (
    <article className={`omi-visual-block omi-visual-block--${visual.kind}${previewOnly ? ' omi-visual-block--preview' : ''}`} data-block-id={block.id}>
      {!previewOnly ? <header className="omi-visual-block-header">
        <strong>{visualLabel(visual.kind, copy)}</strong>
        <button type="button" className="omi-visual-delete" onClick={remove}>
          <Trash2 size={14} aria-hidden="true" />
          {copy.deleteElement}
        </button>
      </header> : null}

      {visual.kind === 'image' ? (
        <figure className="omi-image-block">
          <EditableImage visual={visual} readOnly={previewOnly} screenResolution={graphicsMode === 'screen'} onChange={update} />
          <figcaption>
            <label>
              <span>{copy.altText}</span>
              <input
                value={visual.alt}
                onChange={(event) => update({ ...visual, alt: event.target.value })}
              />
            </label>
            <label>
              <span>{copy.caption}</span>
              <input
                value={visual.caption ?? ''}
                onChange={(event) => update({ ...visual, caption: event.target.value })}
              />
            </label>
          </figcaption>
        </figure>
      ) : null}

      {visual.kind === 'text-box' ? <TextBoxCanvas standalone boxes={[visual.textBox]} width={Math.max(visual.textBox.width + visual.textBox.x, 240)} height={Math.max(visual.textBox.height + visual.textBox.y, 90)} readOnly={previewOnly} onChange={(boxes) => update({ ...visual, textBox: boxes[0] })} /> : null}

      {visual.kind === 'table' ? (
        <>
          <EditableGrid
            blockId={block.id}
            data={visual}
            onChange={(next) => update(next)}
            copy={copy}
          />
          {!previewOnly ? <div className="omi-visual-secondary-actions">
            <button
              type="button"
              onClick={() =>
                stageInsertBlocks(
                  sectionId,
                  blockIndex + 1,
                  [
                    createChartBlock(visual.cells, {
                      provenance: visual.provenance,
                    }),
                  ],
                  'Created chart from manuscript table',
                )
              }
            >
              <BarChart3 size={15} aria-hidden="true" />
              {copy.createChart}
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm(copy.confirmTableToText)) {
                  stageConvertTableToText(block.id);
                }
              }}
            >
              <FileText size={15} aria-hidden="true" />
              {copy.tableToText}
            </button>
          </div> : null}
        </>
      ) : null}

      {visual.kind === 'chart' ? (
        <div className="omi-chart-block">
          <div className="omi-chart-settings">
            <label>
              <span>{copy.chartType}</span>
              <select
                value={visual.chartType}
                onChange={(event) =>
                  update({ ...visual, chartType: event.target.value as OmiChartType })
                }
              >
                <option value="bar">{copy.chartBar}</option>
                <option value="line">{copy.chartLine}</option>
                <option value="pie">{copy.chartPie}</option>
                <option value="scatter">{copy.chartScatter}</option>
                <option value="horizontal-bar">{copy.chartHorizontal}</option>
                <option value="stacked-bar">{copy.chartStacked}</option>
                <option value="stacked-100">{copy.chartStacked100}</option>
                <option value="area">{copy.chartArea}</option>
                <option value="donut">{copy.chartDonut}</option>
                <option value="radar">{copy.chartRadar}</option>
              </select>
            </label>
            <label>
              <span>{copy.chartStyle}</span>
              <select value={visual.stylePreset ?? 'color'} onChange={(event) => update({ ...visual, stylePreset: event.target.value as OmiChartStyle })}>
                <option value="color">{copy.chartStyleColor}</option>
                <option value="editorial">{copy.chartStyleEditorial}</option>
                <option value="monochrome">{copy.chartStyleMonochrome}</option>
                <option value="contrast">{copy.chartStyleContrast}</option>
              </select>
            </label>
            <label className="omi-chart-option"><input type="checkbox" checked={visual.showGrid ?? true} onChange={(event) => update({ ...visual, showGrid: event.target.checked })} /><span>{copy.chartShowGrid}</span></label>
            <label className="omi-chart-option"><input type="checkbox" checked={visual.showLegend ?? true} onChange={(event) => update({ ...visual, showLegend: event.target.checked })} /><span>{copy.chartShowLegend}</span></label>
            <label className="omi-chart-option"><input type="checkbox" checked={visual.showValues ?? false} onChange={(event) => update({ ...visual, showValues: event.target.checked })} /><span>{copy.chartShowValues}</span></label>
            <label>
              <span>{copy.chartTitle}</span>
              <input
                value={visual.title ?? ''}
                onChange={(event) => update({ ...visual, title: event.target.value })}
              />
            </label>
            <label>
              <span>{copy.caption}</span>
              <input
                value={visual.caption ?? ''}
                onChange={(event) => update({ ...visual, caption: event.target.value })}
              />
            </label>
          </div>

          {visual.title ? <h4>{visual.title}</h4> : null}
          <ChartPreview data={visual} emptyLabel={copy.emptyChart} />

          <details className="omi-chart-source">
            <summary>{copy.source}</summary>
            <EditableGrid data={visual} onChange={(next) => update(next)} copy={copy} />
          </details>
        </div>
      ) : null}

      {visual.kind === 'equation' ? (
        <div className="omi-equation-block">
          <EquationEditor
            locale={locale}
            value={visual.latex ?? (visual.notation === 'latex' ? visual.source : '')}
            mathmlSource={visual.notation === 'mathml' ? visual.source : undefined}
            onChange={(value) => update({ ...visual, notation: 'latex', source: value, latex: value })}
          />
          <div className="omi-equation-meta">
            <label>
              <span>{copy.equationLabel}</span>
              <input
                value={visual.label ?? ''}
                onChange={(event) => update({ ...visual, label: event.target.value })}
              />
            </label>
            <label>
              <span>{copy.caption}</span>
              <input
                value={visual.caption ?? ''}
                onChange={(event) => update({ ...visual, caption: event.target.value })}
              />
            </label>
          </div>
        </div>
      ) : null}

      {visual.kind === 'music-score' ? <MusicScorePreview visual={visual} /> : null}

      {previewOnly && visual.kind !== 'table' && visual.caption ? <p className="omi-table-preview-caption">{visual.caption}</p> : null}
      {!previewOnly && visual.provenance ? (
        <small className="omi-import-provenance">
          {copy.importedFrom}: {visual.provenance.fileName ?? visual.provenance.sourceFormat}
          {visual.provenance.sourcePart ? ` · ${visual.provenance.sourcePart}` : ''}
        </small>
      ) : null}
    </article>
  );
}

function MusicScorePreview({ visual }: { visual: OmiMusicScoreBlockData }) {
  const notes = visual.notes.slice(0, 64);
  const width = Math.max(520, notes.length * 26 + 40);
  return <figure className="omi-music-score-block">
    <div className="omi-music-score-meta"><strong>{visual.title || (visual.format === 'midi' ? 'MIDI-score' : 'MusicXML-score')}</strong>{visual.composer ? <span> · {visual.composer}</span> : null}</div>
    <div className="omi-music-score-scroll" role="img" aria-label={visual.title || 'Imported music score'}>
      <svg viewBox={`0 0 ${width} 150`} width={width} height="150" xmlns="http://www.w3.org/2000/svg">
        {[45, 57, 69, 81, 93].map((y) => <line key={y} x1="20" x2={width - 20} y1={y} y2={y} stroke="currentColor" strokeWidth="1" />)}
        <text x="25" y="82" fontSize="44" fontFamily="serif">𝄞</text>
        {notes.map((note, index) => note.rest ? <rect key={index} x={78 + index * 24} y="66" width="10" height="8" fill="currentColor" /> : <g key={index}><ellipse cx={82 + index * 24} cy={pitchY(note)} rx="6" ry="4" fill="currentColor" transform={`rotate(-12  ${82 + index * 24} ${pitchY(note)})`} /><line x1={88 + index * 24} x2={88 + index * 24} y1={pitchY(note)} y2={pitchY(note) - 28} stroke="currentColor" /></g>)}
      </svg>
    </div>
    <figcaption>{visual.caption || `${visual.notes.length} note events · ${visual.format.toUpperCase()}`}</figcaption>
  </figure>;
}

function pitchY(note: OmiMusicScoreBlockData['notes'][number]): number {
  const order: Record<string, number> = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
  return 93 - ((note.octave - 4) * 7 + (order[note.step] ?? 0)) * 3;
}

const cellExtensions=()=>[StarterKit.configure({heading:false,blockquote:false,bulletList:false,orderedList:false,listItem:false,codeBlock:false,horizontalRule:false,link:false,underline:false}),...OMI_CONTINUOUS_RICH_TEXT_EXTENSIONS.filter(e=>!['omiBlockTypeMenu','omiListFormatting','omiSourceWordParagraphStyle','omiWordCharacterStyle'].includes(e.name))];

function RichCellEditor({doc,onChange,label}:{doc:NoteJsonNode;onChange:(doc:NoteJsonNode)=>void;label:string}){
  const {locale}=useTranslation();
  const copy=getRichTextCopy(locale);
  const change=useRef(onChange);change.current=onChange;
  const editor=useEditor({extensions:cellExtensions(),content:doc,editorProps:{attributes:{role:'textbox','aria-label':label,'aria-multiline':'true',class:'omi-table-rich-editor'},handleKeyDown:(_view,event)=>{event.stopPropagation();return false;}},onUpdate:({editor:current})=>{
    const parsed=parseTableCellContent(JSON.stringify(current.getJSON()));
    if(parsed) change.current(parsed);
  }});
  useFormattingEditor(editor);
  const marks=['bold','italic','omiUnderline','strike','omiSmallCaps','omiSuperscript','omiSubscript'];
  const active=useEditorState({editor,selector:({editor:e})=>marks.map(m=>e?.isActive(m)??false)});
  const paragraph=useEditorState({editor,selector:({editor:e})=>normalizeCellParagraphAttrs(e?.getAttributes('paragraph'))})??{};
  const visualCopy=getVisualElementsCopy(locale);
  const setParagraph=(name:string,value:string|number|null)=>editor?.chain().focus().updateAttributes('paragraph',{[name]:value}).run();
  useEffect(()=>{
    if(!editor) return;
    const next=editor.schema.nodeFromJSON(doc).toJSON();
    if(JSON.stringify(next)!==JSON.stringify(editor.getJSON())) editor.commands.setContent(next,{emitUpdate:false});
  },[editor,doc]);
  return <div onMouseDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}>
    <div className="omi-table-actions" role="group" aria-label={copy.toolbar}>
      {[copy.bold,copy.italic,copy.underline,copy.strike,copy.smallCaps,copy.superscript,copy.subscript].map((title,i)=><button type="button" key={marks[i]} title={title} aria-label={title} aria-pressed={active?.[i]??false} onMouseDown={e=>e.preventDefault()} onClick={()=>editor?.chain().focus().toggleMark(marks[i]!).run()}>{['B','I','U','S','Aa','x²','x₂'][i]}</button>)}
      <button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>editor?.chain().focus().unsetAllMarks().run()}>{copy.clearMarks}</button>
    </div>
    <details>
      <summary>{visualCopy.cellParagraphFormatting}</summary>
      <div className="omi-table-cell-formatting-fields">
        <label><span>{visualCopy.cellHorizontalAlign}</span><select value={String(paragraph.omiAlign??'')} onChange={e=>setParagraph('omiAlign',e.target.value||null)}>
          <option value="">{visualCopy.cellAppearanceDefault}</option><option value="left">{visualCopy.cellAlignLeft}</option><option value="center">{visualCopy.cellAlignCenter}</option><option value="right">{visualCopy.cellAlignRight}</option><option value="justify">{visualCopy.cellAlignJustify}</option>
        </select></label>
        {([['omiLeftIndent',visualCopy.cellParagraphLeftIndent],['omiRightIndent',visualCopy.cellParagraphRightIndent],['omiFirstLineIndent',visualCopy.cellParagraphFirstIndent],['omiSpaceBefore',visualCopy.cellParagraphBefore],['omiSpaceAfter',visualCopy.cellParagraphAfter],['omiLineSpacing',visualCopy.cellParagraphLineSpacing]] as const).map(([name,title])=><label key={name}><span>{title}{name==='omiLineSpacing'&&(!paragraph.omiLineRule||paragraph.omiLineRule==='auto')?' (×)':' (pt)'}</span>
          <input type="number" step="any" min={name==='omiFirstLineIndent'?-1000:name==='omiLineSpacing'?0.05:0} max={1000} value={String(paragraph[name]??'')} placeholder={visualCopy.cellAppearanceDefault} onChange={e=>{if(e.target.value==='')setParagraph(name,null);else if(Number.isFinite(e.target.valueAsNumber))setParagraph(name,e.target.valueAsNumber);}}/>
        </label>)}
        <label><span>{visualCopy.cellParagraphLineRule}</span><select value={String(paragraph.omiLineRule??'auto')} onChange={e=>{const rule=e.target.value;editor?.chain().focus().updateAttributes('paragraph',{omiLineRule:rule,omiLineSpacing:paragraph.omiLineRule===rule?paragraph.omiLineSpacing??(rule==='auto'?1:12):rule==='auto'?1:12}).run();}}>
          <option value="auto">{visualCopy.rowHeightAuto}</option><option value="exact">{visualCopy.rowHeightExact}</option><option value="atLeast">{visualCopy.rowHeightMinimum}</option>
        </select></label>
      </div>
    </details><EditorContent editor={editor}/>
  </div>;
}
function richCellPreview(doc:NoteJsonNode):string|undefined{
  try{return generateHTML(doc,cellExtensions());}catch{return undefined;}
}

function EditableGrid({
  data,
  onChange,
  copy,
  blockId,
}: {
  blockId?: string;
  data: OmiTableBlockData | OmiChartBlockData;
  onChange: (next: typeof data) => void;
  copy: ReturnType<typeof getVisualElementsCopy>;
}) {
  const cells = data.cells;
  const previewOnly = useContext(PublicationPreviewContext);
  const [selection, setSelection] = useState({ row: 0, column: 0 });
  const [edgeUnit,setEdgeUnit]=useState<'pt'|'mm'|'pc'>('pt');
  const edgeFactor=edgeUnit==='mm'?72/25.4:edgeUnit==='pc'?12:1;
  const rawRow = Math.max(0, Math.min(Math.trunc(selection.row), cells.length - 1));
  const rawColumn = Math.max(0, Math.min(Math.trunc(selection.column), (cells[rawRow]?.length ?? 1) - 1));
  const headerCount = data.kind==='table' ? tableHeaderRows(cells,data.headerRows) : 0;
  const mergeLayout = tableMergeLayout(cells,data.kind==='table'?data.cellMerges:undefined,headerCount);
  const selectedMerge=mergeLayout.at(rawRow,rawColumn);
  const selectedRow=selectedMerge?.row??rawRow;
  const selectedColumn=selectedMerge?.column??rawColumn;
  const selectedRowSplit=data.kind==='table'?data.rowSplitOverrides?.[String(rawRow)]:undefined;
  const selectedHeight=tableRowHeight(data.kind==='table'?data:{},rawRow);
  const mergeRight=extendTableMerge(cells,mergeLayout.merges,selectedRow,selectedColumn,'right',headerCount);
  const mergeDown=extendTableMerge(cells,mergeLayout.merges,selectedRow,selectedColumn,'down',headerCount);
  const cellFormats = data.kind === 'table' ? data.cellFormats : undefined;
  const selectedFormat = tableCellFormat(cellFormats, selectedRow, selectedColumn);
  const selectedDoc=data.kind==='table'?tableCellDocument(data,selectedRow,selectedColumn):undefined;
  const columnWidths = data.kind === 'table' ? data.columnWidths : undefined;
  const widths = tableColumnWidths(cells, columnWidths);
  const pageBreaks = useContext(TablePaginationContext).filter((item) => item.targetBlockId === blockId);
  const continuationStyle = (row: number): CSSProperties | undefined => {
    const offset = [...pageBreaks].reverse().find((item) => item.textOffset <= row);
    return offset?.shiftX !== undefined || offset?.shiftY !== undefined ? {
      position: 'relative',
      left: `calc(var(--omi-spread-projection, 1) * ${offset.shiftX ?? 0}px)`,
      top: `calc(var(--omi-spread-projection, 1) * ${offset.shiftY ?? 0}px)`,
    } : undefined;
  };
  const drag = useRef<{ index: number; start: number; width: number; widths: number[] } | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const reduction = data.kind === 'table' && data.fontSizeReduction === 0 ? 0 : 1;

  function updateColumns(nextCells: string[][], nextWidths: number[]): void {
    onChange(data.kind === 'table'
      ? { ...data, cells: nextCells, columnWidths: tableColumnWidths(nextCells, nextWidths), cellMerges: tableMergeLayout(nextCells,data.cellMerges,headerCount).merges, cellContent:pruneTableCellContent(nextCells,data.cellContent), cellFormats: pruneTableCellFormats(nextCells, cellFormats) }
      : { ...data, cells: nextCells });
  }

  function updateSelectedFormat(patch: OmiTableCellFormat): void {
    if (data.kind !== 'table' || previewOnly) return;
    onChange({ ...data, cellFormats: { ...pruneTableCellFormats(cells, cellFormats), [`${selectedRow}:${selectedColumn}`]: { ...selectedFormat, ...patch } } });
  }

  // Reset before measuring so shortening a cell can also shrink its row. Observe
  // column changes as well as edits: wrapping changes the required cell height.
  useLayoutEffect(() => {
    const table = tableRef.current;
    if (!table) return;
    const resize = () => {
      const inputs = Array.from(table.querySelectorAll('textarea'));
      inputs.forEach((input) => { input.style.height = '0px'; });
      const heights = inputs.map((input) => input.scrollHeight);
      inputs.forEach((input, index) => { input.style.height = `${heights[index]}px`; });
    };
    resize();
    let previousWidth = table.getBoundingClientRect().width;
    const observer = new ResizeObserver(() => {
      const width = table.getBoundingClientRect().width;
      if (Math.abs(previousWidth - width) > 0.5) { previousWidth = width; resize(); }
    });
    observer.observe(table);
    return () => observer.disconnect();
  }, [cells, columnWidths, reduction, cellFormats, previewOnly]);

  return (
    <div className="omi-table-editor-wrap">
      <div className="omi-table-scroll">
        <table ref={tableRef} className="omi-table-editor" style={{ '--omi-table-font-reduction': reduction } as CSSProperties}>
          <colgroup>{widths.map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}</colgroup>
          <tbody>
            {cells.map((row, rowIndex) => (
              <Fragment key={rowIndex}>
                {pageBreaks.filter((item) => item.textOffset === rowIndex).map((item) => (
                  <tr key={`break-${rowIndex}`} className="omi-publication-flow-break omi-table-page-break" aria-hidden="true" data-publication-flow-break="true">
                    <td colSpan={widths.length}><div style={{ height: item.height }} /></td>
                  </tr>
                ))}
                <tr key={rowIndex} data-omi-row-split={data.kind==='table'?tableRowSplitPolicy(data,rowIndex):undefined} data-omi-row-height={data.kind==='table'?tableRowHeight(data,rowIndex).mode:undefined} style={{...continuationStyle(rowIndex),...(data.kind==='table'?tableRowHeightStyle(tableRowHeight(data,rowIndex)):{})}}>
                  {row.map((cell, columnIndex) => {
                    if(mergeLayout.covered(rowIndex,columnIndex)) return null;
                    const merge=mergeLayout.at(rowIndex,columnIndex);
                    const Cell = data.kind === 'table' && rowIndex < tableHeaderRows(cells, data.headerRows) ? 'th' : 'td';
                    const format = tableCellFormat(cellFormats, rowIndex, columnIndex);
                    const rich=data.kind==='table'?tableCellDocument(data,rowIndex,columnIndex):undefined;
                    const richHtml=rich?richCellPreview(rich):undefined;
                    const showText = previewOnly || format.textRotation !== 0 || !!rich;
                    return (
                      <Cell key={columnIndex} rowSpan={merge?.rowSpan} colSpan={merge?.colSpan} style={tableCellAppearanceStyle(format)}
                        data-cell-selected={!previewOnly && selectedRow === rowIndex && selectedColumn === columnIndex ? 'true' : undefined}
                        tabIndex={!previewOnly && showText ? 0 : undefined}
                        onFocus={() => { if (!previewOnly) setSelection({ row: rowIndex, column: columnIndex }); }}
                        onClick={() => { if (!previewOnly) setSelection({ row: rowIndex, column: columnIndex }); }}
                      >
                        {richHtml!==undefined ? <div className="omi-table-cell-text omi-table-rich-preview" dir={format.textDirection} style={{...tableCellTextStyle(format.textRotation),textAlign:format.horizontalAlign??'start'}} dangerouslySetInnerHTML={{__html:richHtml}}/> : showText ? (
                          <span className="omi-table-cell-text" dir={format.textDirection} data-text-rotation={format.textRotation} style={{...tableCellTextStyle(format.textRotation),...(format.horizontalAlign?{textAlign:format.horizontalAlign,...(format.textRotation===0?{width:'100%'}:{})}:{})}}>{cell || '\u00a0'}</span>
                        ) : <textarea
                          rows={1}
                          dir={format.textDirection}
                          style={{textAlign:format.horizontalAlign}}
                          aria-label={`${copy.cell} ${rowIndex + 1}, ${columnIndex + 1}`}
                          value={cell}
                          onChange={(event) =>
                            onChange({
                              ...data,
                              cells: updateTableCell(cells, rowIndex, columnIndex, event.target.value),
                            })
                          }
                        />}
                        {!previewOnly && data.kind === 'table' && rowIndex === 0 && !merge && columnIndex < widths.length - 1 ? (
                          <span
                            className="omi-table-column-resize"
                            role="separator"
                            tabIndex={0}
                            aria-label={`${copy.resizeColumn} ${columnIndex + 1}`}
                            aria-orientation="vertical"
                            aria-valuenow={Math.round(widths[columnIndex]!)}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            onKeyDown={(event) => {
                              if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
                              event.preventDefault();
                              onChange({ ...data, columnWidths: resizeTableColumn(widths, columnIndex, widths[columnIndex]! + (event.key === 'ArrowRight' ? 1 : -1)) });
                            }}
                            onPointerDown={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              drag.current = { index: columnIndex, start: event.clientX, width: tableRef.current!.getBoundingClientRect().width, widths };
                              event.currentTarget.setPointerCapture(event.pointerId);
                            }}
                            onPointerMove={(event) => {
                              const current = drag.current;
                              if (!current || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
                              onChange({ ...data, columnWidths: resizeTableColumn(current.widths, current.index, current.widths[current.index]! + (event.clientX - current.start) * 100 / current.width) });
                            }}
                            onPointerUp={(event) => { drag.current = null; event.currentTarget.releasePointerCapture(event.pointerId); }}
                            onLostPointerCapture={() => { drag.current = null; }}
                          />
                        ) : null}
                      </Cell>
                    );
                  })}
                </tr>
              </Fragment>
            ))}
            {pageBreaks.filter((item) => item.textOffset === cells.length).map((item) => (
              <tr key="break-after-rows" className="omi-publication-flow-break omi-table-page-break" aria-hidden="true" data-publication-flow-break="true">
                <td colSpan={widths.length}><div style={{ height: item.height }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!previewOnly ? <>
      <div className="omi-table-actions" style={continuationStyle(cells.length)}>
        <button type="button" onClick={() => onChange({ ...data, cells: addTableRow(cells) })}>
          <Plus size={14} aria-hidden="true" /> {copy.addRow}
        </button>
        <button type="button" onClick={() => updateColumns(addTableColumn(cells), [...widths, 100 / Math.max(1, widths.length)])}>
          <Plus size={14} aria-hidden="true" /> {copy.addColumn}
        </button>
        <button type="button" onClick={() => {
          const nextCells = removeTableRow(cells, cells.length - 1);
          onChange(data.kind === 'table' ? { ...data, cells: nextCells, headerRows: tableHeaderRows(nextCells, data.headerRows), rowSplitOverrides: pruneTableRowSplitOverrides(nextCells,data.rowSplitOverrides), rowHeights:pruneTableRowHeights(nextCells,data.rowHeights), cellContent:pruneTableCellContent(nextCells,data.cellContent), cellMerges: tableMergeLayout(nextCells,data.cellMerges,tableHeaderRows(nextCells,data.headerRows)).merges, cellFormats: pruneTableCellFormats(nextCells, cellFormats) } : { ...data, cells: nextCells });
        }}>
          {copy.removeRow}
        </button>
        <button type="button" onClick={() => updateColumns(removeTableColumn(cells, (cells[0]?.length ?? 1) - 1), widths.length > 1 ? widths.slice(0, -1) : widths)}>
          {copy.removeColumn}
        </button>
      </div>
      {data.kind === 'table' ? (
        <details className="omi-table-cell-formatting" style={continuationStyle(cells.length)}>
          <summary>{copy.cellFormatting}</summary>
          <div className="omi-table-cell-formatting-fields">
            <label><span>{copy.cellRow}</span><input type="number" min={1} max={cells.length} value={selectedRow + 1} onChange={(event) => setSelection({ row: Math.max(0, Number(event.target.value) - 1), column: selectedColumn })} /></label>
            <label><span>{copy.cellColumn}</span><input type="number" min={1} max={cells[selectedRow]?.length ?? 1} value={selectedColumn + 1} onChange={(event) => setSelection({ row: selectedRow, column: Math.max(0, Number(event.target.value) - 1) })} /></label>
            <label><span>{copy.textRotation}</span><select value={selectedFormat.textRotation} onChange={(event) => updateSelectedFormat({ textRotation: Number(event.target.value) as OmiTableCellFormat['textRotation'] })}>
              <option value={0}>{copy.rotationNone}</option><option value={90}>{copy.rotationClockwise}</option><option value={-90}>{copy.rotationCounterclockwise}</option><option value={180}>{copy.rotationUpsideDown}</option>
            </select></label>
            <label><span>{copy.textDirection}</span><select value={selectedFormat.textDirection} onChange={(event) => updateSelectedFormat({ textDirection: event.target.value as OmiTableCellFormat['textDirection'] })}>
              <option value="auto">{copy.directionAuto}</option><option value="ltr">{copy.directionLtr}</option><option value="rtl">{copy.directionRtl}</option>
            </select></label>
            <label><span>{copy.cellHorizontalAlign}</span><select value={selectedFormat.horizontalAlign??''} onChange={event=>updateSelectedFormat({horizontalAlign:(event.target.value||undefined) as OmiTableCellFormat['horizontalAlign']})}>
              <option value="">{copy.cellAppearanceDefault}</option><option value="left">{copy.cellAlignLeft}</option><option value="center">{copy.cellAlignCenter}</option><option value="right">{copy.cellAlignRight}</option><option value="justify">{copy.cellAlignJustify}</option>
            </select></label>
            <label><span>{copy.cellVerticalAlign}</span><select value={selectedFormat.verticalAlign??''} onChange={event=>updateSelectedFormat({verticalAlign:(event.target.value||undefined) as OmiTableCellFormat['verticalAlign']})}>
              <option value="">{copy.cellAppearanceDefault}</option><option value="top">{copy.cellAlignTop}</option><option value="middle">{copy.cellAlignMiddle}</option><option value="bottom">{copy.cellAlignBottom}</option>
            </select></label>
            <label><span>{copy.cellBackground}</span><input type="color" value={selectedFormat.backgroundColor??'#ffffff'} onChange={event=>updateSelectedFormat({backgroundColor:event.target.value})}/></label>
            <button type="button" disabled={!selectedFormat.backgroundColor} onClick={()=>updateSelectedFormat({backgroundColor:undefined})}>{copy.cellClearBackground}</button>
          </div>
          <div className="omi-table-actions">
            <button type="button" disabled={!mergeRight} onClick={()=>{if(mergeRight) onChange({...data,cellMerges:mergeRight});}} title={copy.mergeRight}><Merge size={14} aria-hidden="true"/><ArrowRight size={12} aria-hidden="true"/>{copy.mergeRight}</button>
            <button type="button" disabled={!mergeDown} onClick={()=>{if(mergeDown) onChange({...data,cellMerges:mergeDown});}} title={copy.mergeDown}><Merge size={14} aria-hidden="true"/><ArrowDown size={12} aria-hidden="true"/>{copy.mergeDown}</button>
            <button type="button" disabled={!selectedMerge} onClick={()=>onChange({...data,cellMerges:splitTableMerge(cells,data.cellMerges,selectedRow,selectedColumn,headerCount)})}><Split size={14} aria-hidden="true"/>{copy.splitCell}</button>
          </div>
          <details>
            <summary>{copy.cellEdges}</summary>
            <label><span>{copy.cellEdgeUnit}</span><select value={edgeUnit} onChange={event=>setEdgeUnit(event.target.value==='mm'?'mm':event.target.value==='pc'?'pc':'pt')}><option value="pt">pt</option><option value="mm">mm</option><option value="pc">pica</option></select></label>
            {TABLE_CELL_SIDES.map(side=>{
              const edge=selectedFormat.borders?.[side];
              const padding=selectedFormat.paddingPt?.[side];
              const sideLabel={top:copy.cellAlignTop,right:copy.cellAlignRight,bottom:copy.cellAlignBottom,left:copy.cellAlignLeft}[side];
              const setEdge=(next:NonNullable<OmiTableCellFormat['borders']>[typeof side])=>{
                const borders={...selectedFormat.borders};
                if(next) borders[side]=next; else delete borders[side];
                updateSelectedFormat({borders:normalizeTableCellEdges({borders}).borders});
              };
              return <fieldset key={side}>
                <legend>{sideLabel}</legend>
                <div className="omi-table-cell-formatting-fields">
                  <label><span>{copy.cellBorderStyle}</span><select value={edge?.style??''} onChange={event=>{
                    const style=event.target.value;
                    setEdge(style===''?undefined:style==='none'?{style:'none'}:{style:style as 'solid'|'dashed'|'dotted'|'double',widthPt:edge?.widthPt??0.5,color:edge?.color??'#000000'});
                  }}><option value="">{copy.cellAppearanceDefault}</option><option value="none">{copy.cellBorderNone}</option><option value="solid">{copy.cellBorderSolid}</option><option value="dashed">{copy.cellBorderDashed}</option><option value="dotted">{copy.cellBorderDotted}</option><option value="double">{copy.cellBorderDouble}</option></select></label>
                  <label><span>{copy.cellBorderWidth} ({edgeUnit})</span><input type="number" min={0.125/edgeFactor} max={12/edgeFactor} step="any" disabled={!edge||edge.style==='none'} value={edge?.widthPt===undefined?'':Number((edge.widthPt/edgeFactor).toFixed(3))} onChange={event=>{if(edge&&Number.isFinite(event.target.valueAsNumber)) setEdge({...edge,widthPt:event.target.valueAsNumber*edgeFactor});}}/></label>
                  <label><span>{copy.cellBorderColor}</span><input type="color" disabled={!edge||edge.style==='none'} value={edge?.color??'#000000'} onChange={event=>{if(edge) setEdge({...edge,color:event.target.value});}}/></label>
                  <label><span>{copy.cellPadding} ({edgeUnit})</span><input type="number" min={0} max={144/edgeFactor} step="any" placeholder={copy.cellAppearanceDefault} value={padding===undefined?'':Number((padding/edgeFactor).toFixed(3))} onChange={event=>{
                    const paddingPt={...selectedFormat.paddingPt};
                    if(event.target.value==='') delete paddingPt[side];
                    else if(Number.isFinite(event.target.valueAsNumber)) paddingPt[side]=event.target.valueAsNumber*edgeFactor;
                    updateSelectedFormat({paddingPt:normalizeTableCellEdges({paddingPt}).paddingPt});
                  }}/></label>
                </div>
              </fieldset>;
            })}
          </details>
          <small>{copy.mergeHint}</small>
          <details>
            <summary>{copy.editCellText}</summary>
            <RichCellEditor key={selectedRow+':'+selectedColumn} doc={selectedDoc??plainTableCellDocument(cells[selectedRow]?.[selectedColumn]??'')} label={copy.editCellText} onChange={doc=>{
              const nextCells=updateTableCell(cells,selectedRow,selectedColumn,tableCellPlainText(doc));
              const content=pruneTableCellContent(nextCells,data.cellContent);
              content[selectedRow+':'+selectedColumn]=JSON.stringify(doc);
              onChange({...data,cells:nextCells,cellContent:content});
            }}/>
          </details>
        </details>
      ) : null}
      {data.kind === 'table' ? (
        <details className="omi-table-cell-formatting" style={continuationStyle(cells.length)}>
          <summary>{copy.rowPagination}</summary>
          <div className="omi-table-cell-formatting-fields">
            <label><span>{copy.rowSplitDefault}</span><select value={tableRowSplitDefault(data.rowSplitDefault)} onChange={event=>onChange({...data,rowSplitDefault:event.target.value==='allow'?'allow':'keep'})}>
              <option value="keep">{copy.rowSplitKeep}</option><option value="allow">{copy.rowSplitAllow}</option>
            </select></label>
            <label><span>{copy.cellRow}</span><input type="number" min={1} max={cells.length} value={rawRow+1} onChange={event=>{if(Number.isFinite(event.target.valueAsNumber)) setSelection({row:Math.max(0,event.target.valueAsNumber-1),column:rawColumn});}}/></label>
            <label><span>{copy.rowSplitSelected}</span><select value={selectedRowSplit==='keep'||selectedRowSplit==='allow'?selectedRowSplit:'inherit'} onChange={event=>onChange({...data,rowSplitOverrides:setTableRowSplitOverride(data,rawRow,event.target.value==='keep'?'keep':event.target.value==='allow'?'allow':'inherit')})}>
              <option value="inherit">{copy.rowSplitInherit}</option><option value="keep">{copy.rowSplitKeep}</option><option value="allow">{copy.rowSplitAllow}</option>
            </select></label>
          </div>
          <small>{copy.rowSplitHint}</small>
          <div className="omi-table-cell-formatting-fields">
            <label><span>{copy.rowHeightMode}</span><select value={selectedHeight.mode} onChange={event=>{
              const mode=event.target.value;
              onChange({...data,rowHeights:setTableRowHeight(data,rawRow,mode==='minimum'||mode==='exact'?{mode,heightPt:selectedHeight.mode==='auto'?18:selectedHeight.heightPt}:{mode:'auto'})});
            }}><option value="auto">{copy.rowHeightAuto}</option><option value="minimum">{copy.rowHeightMinimum}</option><option value="exact">{copy.rowHeightExact}</option></select></label>
            <label><span>{copy.cellEdgeUnit}</span><select value={edgeUnit} onChange={event=>setEdgeUnit(event.target.value==='mm'?'mm':event.target.value==='pc'?'pc':'pt')}><option value="pt">pt</option><option value="mm">mm</option><option value="pc">pica</option></select></label>
            <label><span>{copy.rowHeightValue} ({edgeUnit})</span><input type="number" min={0.05/edgeFactor} max={1584/edgeFactor} step="any" disabled={selectedHeight.mode==='auto'} value={selectedHeight.mode==='auto'?'':Number((selectedHeight.heightPt/edgeFactor).toFixed(3))} onChange={event=>{
              if(selectedHeight.mode!=='auto'&&Number.isFinite(event.target.valueAsNumber)&&event.target.valueAsNumber>0) onChange({...data,rowHeights:setTableRowHeight(data,rawRow,{mode:selectedHeight.mode,heightPt:event.target.valueAsNumber*edgeFactor})});
            }}/></label>
          </div>
          {selectedHeight.mode==='exact'?<small role="status">{copy.rowHeightExactHint}</small>:null}
        </details>
      ) : null}
      {data.kind === 'table' ? (
        <label className="omi-table-font-size" style={continuationStyle(cells.length)}>
          <span>{copy.tableHeaderRows}</span>
          <input type="number" min={0} max={cells.length} step={1} value={tableHeaderRows(cells,data.headerRows)} onChange={event=>{const headerRows=tableHeaderRows(cells,event.target.valueAsNumber); if(tableMergeLayout(cells,data.cellMerges,headerRows).merges.length===mergeLayout.merges.length) onChange({...data,headerRows});}} />
        </label>
      ) : null}
      {data.kind === 'table' ? (
        <label className="omi-table-font-size" style={continuationStyle(cells.length)}>
          <span>{copy.tableFontSize}</span>
          <select value={reduction} onChange={(event) => onChange({ ...data, fontSizeReduction: event.target.value === '0' ? 0 : 1 })}>
            <option value={0}>{copy.bodyFontSize}</option>
            <option value={1}>{copy.smallerFontSize}</option>
          </select>
        </label>
      ) : null}
      {data.kind === 'table' ? (
        <label className="omi-table-caption" style={continuationStyle(cells.length)}>
          <span>{copy.caption}</span>
          <input
            value={data.caption ?? ''}
            onChange={(event) => onChange({ ...data, caption: event.target.value })}
          />
        </label>
      ) : null}
      </> : data.kind === 'table' && data.caption ? <p className="omi-table-preview-caption" style={continuationStyle(cells.length)}>{data.caption}</p> : null}
    </div>
  );
}

function visualLabel(
  kind: OmiVisualBlockData['kind'],
  copy: ReturnType<typeof getVisualElementsCopy>,
): string {
  switch (kind) {
    case 'image': return copy.image;
    case 'text-box': return copy.textBox;
    case 'table': return copy.table;
    case 'chart': return copy.chart;
    case 'equation': return copy.equation;
    case 'music-score': return copy.musicScore;
  }
}

function EditableImage({ visual, readOnly, screenResolution = false, onChange }: {
  visual: OmiImageBlockData;
  readOnly: boolean;
  screenResolution?: boolean;
  onChange(visual: OmiImageBlockData): void;
}) {
  const { locale } = useTranslation(); const copy = getTextBoxCopy(locale);
  const [size, setSize] = useState({ width: 600, height: 300 });
  const width = visual.width || size.width, height = visual.height || size.height;
  const dimensions = (w: number, h: number) => setSize((old) => old.width === w && old.height === h ? old : { width: w, height: h });
  if (!visual.textBoxes?.length) return <><AssetBackedImage visual={visual} screenResolution={screenResolution} onDimensions={dimensions} />{!readOnly ? <button type="button" className="omi-text-box-add" onClick={() => onChange({ ...visual, width, height, textBoxes: [{ ...createTextBox(), x: 10, y: 10, width: Math.max(16, Math.min(240, width - 10)) }] })}>{copy.add}</button> : null}</>;
  return <TextBoxCanvas boxes={visual.textBoxes} width={width} height={height} readOnly={readOnly} onChange={(textBoxes) => onChange({ ...visual, width, height, textBoxes })}><AssetBackedImage visual={visual} screenResolution={screenResolution} onDimensions={dimensions} /></TextBoxCanvas>;
}
