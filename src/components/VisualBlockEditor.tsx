import { Fragment, useContext, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import {
  BarChart3,
  FileText,
  Plus,
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
  tableToChartDataset,
  updateTableCell,
} from '../model/visualBlocks';
import type {
  OmiBlock,
  OmiChartBlockData,
  OmiChartType,
  OmiTableBlockData,
  OmiTableCellFormat,
  OmiVisualBlockData,
  OmiMusicScoreBlockData,
} from '../types/omi';
import { AssetBackedImage } from './AssetBackedImage';
import { pruneTableCellFormats, resizeTableColumn, tableCellFormat, tableCellTextStyle, tableColumnWidths } from '../model/tableLayout';
import { TablePaginationContext } from './TablePaginationContext';
import { PublicationPreviewContext } from './PublicationPreviewContext';

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
          <AssetBackedImage visual={visual} />
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
              </select>
            </label>
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
  const selectedRow = Math.max(0, Math.min(Math.trunc(selection.row), cells.length - 1));
  const selectedColumn = Math.max(0, Math.min(Math.trunc(selection.column), (cells[selectedRow]?.length ?? 1) - 1));
  const cellFormats = data.kind === 'table' ? data.cellFormats : undefined;
  const selectedFormat = tableCellFormat(cellFormats, selectedRow, selectedColumn);
  const columnWidths = data.kind === 'table' ? data.columnWidths : undefined;
  const widths = tableColumnWidths(cells, columnWidths);
  const pageBreaks = useContext(TablePaginationContext).filter((item) => item.targetBlockId === blockId);
  const drag = useRef<{ index: number; start: number; width: number; widths: number[] } | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const reduction = data.kind === 'table' && data.fontSizeReduction === 0 ? 0 : 1;

  function updateColumns(nextCells: string[][], nextWidths: number[]): void {
    onChange(data.kind === 'table'
      ? { ...data, cells: nextCells, columnWidths: tableColumnWidths(nextCells, nextWidths), cellFormats: pruneTableCellFormats(nextCells, cellFormats) }
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
                <tr key={rowIndex}>
                  {row.map((cell, columnIndex) => {
                    const Cell = data.kind === 'table' && rowIndex < (data.headerRows ?? 0) ? 'th' : 'td';
                    const format = tableCellFormat(cellFormats, rowIndex, columnIndex);
                    const showText = previewOnly || format.textRotation !== 0;
                    return (
                      <Cell key={columnIndex}
                        data-cell-selected={!previewOnly && selection.row === rowIndex && selection.column === columnIndex ? 'true' : undefined}
                        tabIndex={!previewOnly && showText ? 0 : undefined}
                        onFocus={() => { if (!previewOnly) setSelection({ row: rowIndex, column: columnIndex }); }}
                        onClick={() => { if (!previewOnly) setSelection({ row: rowIndex, column: columnIndex }); }}
                      >
                        {showText ? (
                          <span className="omi-table-cell-text" dir={format.textDirection} data-text-rotation={format.textRotation} style={tableCellTextStyle(format.textRotation)}>{cell || '\u00a0'}</span>
                        ) : <textarea
                          rows={1}
                          dir={format.textDirection}
                          aria-label={`${copy.cell} ${rowIndex + 1}, ${columnIndex + 1}`}
                          value={cell}
                          onChange={(event) =>
                            onChange({
                              ...data,
                              cells: updateTableCell(cells, rowIndex, columnIndex, event.target.value),
                            })
                          }
                        />}
                        {!previewOnly && data.kind === 'table' && rowIndex === 0 && columnIndex < widths.length - 1 ? (
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
      <div className="omi-table-actions">
        <button type="button" onClick={() => onChange({ ...data, cells: addTableRow(cells) })}>
          <Plus size={14} aria-hidden="true" /> {copy.addRow}
        </button>
        <button type="button" onClick={() => updateColumns(addTableColumn(cells), [...widths, 100 / Math.max(1, widths.length)])}>
          <Plus size={14} aria-hidden="true" /> {copy.addColumn}
        </button>
        <button type="button" onClick={() => {
          const nextCells = removeTableRow(cells, cells.length - 1);
          onChange(data.kind === 'table' ? { ...data, cells: nextCells, cellFormats: pruneTableCellFormats(nextCells, cellFormats) } : { ...data, cells: nextCells });
        }}>
          {copy.removeRow}
        </button>
        <button type="button" onClick={() => updateColumns(removeTableColumn(cells, (cells[0]?.length ?? 1) - 1), widths.length > 1 ? widths.slice(0, -1) : widths)}>
          {copy.removeColumn}
        </button>
      </div>
      {data.kind === 'table' ? (
        <details className="omi-table-cell-formatting">
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
          </div>
          {selectedFormat.textRotation !== 0 ? <label className="omi-table-cell-text-editor"><span>{copy.editCellText}</span><textarea rows={2} dir={selectedFormat.textDirection} value={cells[selectedRow]?.[selectedColumn] ?? ''} onChange={(event) => onChange({ ...data, cells: updateTableCell(cells, selectedRow, selectedColumn, event.target.value) })} /></label> : null}
        </details>
      ) : null}
      {data.kind === 'table' ? (
        <label className="omi-table-font-size">
          <span>{copy.tableFontSize}</span>
          <select value={reduction} onChange={(event) => onChange({ ...data, fontSizeReduction: event.target.value === '0' ? 0 : 1 })}>
            <option value={0}>{copy.bodyFontSize}</option>
            <option value={1}>{copy.smallerFontSize}</option>
          </select>
        </label>
      ) : null}
      {data.kind === 'table' ? (
        <label className="omi-table-caption">
          <span>{copy.caption}</span>
          <input
            value={data.caption ?? ''}
            onChange={(event) => onChange({ ...data, caption: event.target.value })}
          />
        </label>
      ) : null}
      </> : data.kind === 'table' && data.caption ? <p className="omi-table-preview-caption">{data.caption}</p> : null}
    </div>
  );
}

function ChartPreview({
  data,
  emptyLabel,
}: {
  data: OmiChartBlockData;
  emptyLabel: string;
}) {
  const dataset = tableToChartDataset(data.cells);
  if (dataset.series.length === 0 || dataset.labels.length === 0) {
    return <div className="omi-chart-empty">{emptyLabel}</div>;
  }

  if (data.chartType === 'pie') {
    const values = dataset.series[0]?.values.map((value) => Math.max(0, value)) ?? [];
    const total = values.reduce((sum, value) => sum + value, 0);
    if (total <= 0) return <div className="omi-chart-empty">{emptyLabel}</div>;
    let angle = -Math.PI / 2;
    return (
      <svg className="omi-chart-svg" viewBox="0 0 640 320" role="img" aria-label={data.title ?? 'Pie chart'}>
        {values.map((value, index) => {
          const sweep = (value / total) * Math.PI * 2;
          const start = polar(250, 155, 115, angle);
          const end = polar(250, 155, 115, angle + sweep);
          const large = sweep > Math.PI ? 1 : 0;
          const path = `M 250 155 L ${start.x} ${start.y} A 115 115 0 ${large} 1 ${end.x} ${end.y} Z`;
          angle += sweep;
          return <path key={index} d={path} className={`omi-chart-series omi-chart-series--${index % 6}`} />;
        })}
        {dataset.labels.map((label, index) => (
          <text key={label + index} x="400" y={50 + index * 22} className={`omi-chart-legend omi-chart-legend--${index % 6}`}>
            {label}
          </text>
        ))}
      </svg>
    );
  }

  const allValues = dataset.series.flatMap((series) => series.values);
  const minValue = Math.min(0, ...allValues);
  const maxValue = Math.max(0, ...allValues);
  const range = maxValue - minValue || 1;
  const left = 58;
  const top = 24;
  const width = 550;
  const height = 230;
  const y = (value: number) => top + height - ((value - minValue) / range) * height;
  const baseline = y(0);

  if (data.chartType === 'scatter') {
    const xValues = dataset.series[0]?.values ?? [];
    const yValues = dataset.series[1]?.values ?? dataset.series[0]?.values ?? [];
    const xMin = Math.min(...xValues);
    const xMax = Math.max(...xValues);
    const xRange = xMax - xMin || 1;
    return (
      <svg className="omi-chart-svg" viewBox="0 0 640 320" role="img" aria-label={data.title ?? 'Scatter chart'}>
        <Axis left={left} top={top} width={width} height={height} baseline={baseline} />
        {yValues.map((value, index) => {
          const xValue = xValues[index] ?? index;
          const cx = left + ((xValue - xMin) / xRange) * width;
          return <circle key={index} cx={cx} cy={y(value)} r="5" className="omi-chart-series omi-chart-series--0" />;
        })}
      </svg>
    );
  }

  if (data.chartType === 'line') {
    return (
      <svg className="omi-chart-svg" viewBox="0 0 640 320" role="img" aria-label={data.title ?? 'Line chart'}>
        <Axis left={left} top={top} width={width} height={height} baseline={baseline} />
        {dataset.series.map((series, seriesIndex) => {
          const points = series.values.map((value, index) => {
            const x = left + (dataset.labels.length <= 1 ? width / 2 : (index / (dataset.labels.length - 1)) * width);
            return `${x},${y(value)}`;
          }).join(' ');
          return <polyline key={series.name} points={points} fill="none" className={`omi-chart-line omi-chart-series--${seriesIndex % 6}`} />;
        })}
        <CategoryLabels labels={dataset.labels} left={left} width={width} y={280} />
      </svg>
    );
  }

  const categoryWidth = width / Math.max(1, dataset.labels.length);
  const seriesWidth = categoryWidth * 0.72 / Math.max(1, dataset.series.length);
  return (
    <svg className="omi-chart-svg" viewBox="0 0 640 320" role="img" aria-label={data.title ?? 'Bar chart'}>
      <Axis left={left} top={top} width={width} height={height} baseline={baseline} />
      {dataset.labels.map((label, categoryIndex) =>
        dataset.series.map((series, seriesIndex) => {
          const value = series.values[categoryIndex] ?? 0;
          const valueY = y(value);
          const x = left + categoryIndex * categoryWidth + categoryWidth * 0.14 + seriesIndex * seriesWidth;
          return (
            <rect
              key={`${label}:${series.name}`}
              x={x}
              y={Math.min(valueY, baseline)}
              width={Math.max(2, seriesWidth - 3)}
              height={Math.max(1, Math.abs(baseline - valueY))}
              className={`omi-chart-series omi-chart-series--${seriesIndex % 6}`}
            />
          );
        }),
      )}
      <CategoryLabels labels={dataset.labels} left={left} width={width} y={280} />
    </svg>
  );
}

function Axis({ left, top, width, height, baseline }: { left: number; top: number; width: number; height: number; baseline: number }) {
  return (
    <g className="omi-chart-axis">
      <line x1={left} y1={top} x2={left} y2={top + height} />
      <line x1={left} y1={baseline} x2={left + width} y2={baseline} />
    </g>
  );
}

function CategoryLabels({ labels, left, width, y }: { labels: string[]; left: number; width: number; y: number }) {
  return (
    <g className="omi-chart-labels">
      {labels.slice(0, 12).map((label, index) => (
        <text
          key={label + index}
          x={left + ((index + 0.5) / labels.length) * width}
          y={y}
          textAnchor="middle"
        >
          {label.length > 14 ? `${label.slice(0, 12)}…` : label}
        </text>
      ))}
    </g>
  );
}

function polar(cx: number, cy: number, radius: number, angle: number): { x: number; y: number } {
  return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
}

function visualLabel(
  kind: OmiVisualBlockData['kind'],
  copy: ReturnType<typeof getVisualElementsCopy>,
): string {
  switch (kind) {
    case 'image': return copy.image;
    case 'table': return copy.table;
    case 'chart': return copy.chart;
    case 'equation': return copy.equation;
    case 'music-score': return copy.musicScore;
  }
}
