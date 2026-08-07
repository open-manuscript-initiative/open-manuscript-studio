import {
  BarChart3,
  Plus,
  Trash2,
} from 'lucide-react';

import {
  stageInsertBlocks,
  stageRemoveBlock,
  stageUpdateVisualBlock,
} from '../app/visualBlockActions';
import { useTranslation } from '../i18n';
import { getVisualElementsCopy } from '../i18n/visualElements';
import {
  latexToMathMl,
  sanitizeMathMlForPreview,
} from '../model/equationRendering';
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
  OmiVisualBlockData,
} from '../types/omi';
import { AssetBackedImage } from './AssetBackedImage';

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

  function update(next: OmiVisualBlockData): void {
    stageUpdateVisualBlock(block.id, next);
  }

  function remove(): void {
    if (window.confirm(copy.confirmDelete)) stageRemoveBlock(block.id);
  }

  return (
    <article className={`omi-visual-block omi-visual-block--${visual.kind}`} data-block-id={block.id}>
      <header className="omi-visual-block-header">
        <strong>{visualLabel(visual.kind, copy)}</strong>
        <button type="button" className="omi-visual-delete" onClick={remove}>
          <Trash2 size={14} aria-hidden="true" />
          {copy.deleteElement}
        </button>
      </header>

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
            data={visual}
            onChange={(next) => update(next)}
            copy={copy}
          />
          <div className="omi-visual-secondary-actions">
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
          </div>
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
          <div
            className="omi-equation-preview"
            dangerouslySetInnerHTML={{
              __html:
                visual.notation === 'mathml'
                  ? sanitizeMathMlForPreview(visual.source)
                  : latexToMathMl(visual.latex ?? visual.source),
            }}
          />
          <label>
            <span>{copy.equationLatex}</span>
            <textarea
              spellCheck={false}
              value={visual.latex ?? (visual.notation === 'latex' ? visual.source : '')}
              onChange={(event) =>
                update({
                  ...visual,
                  notation: 'latex',
                  source: event.target.value,
                  latex: event.target.value,
                })
              }
            />
          </label>
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

      {visual.provenance ? (
        <small className="omi-import-provenance">
          {copy.importedFrom}: {visual.provenance.fileName ?? visual.provenance.sourceFormat}
          {visual.provenance.sourcePart ? ` · ${visual.provenance.sourcePart}` : ''}
        </small>
      ) : null}
    </article>
  );
}

function EditableGrid({
  data,
  onChange,
  copy,
}: {
  data: OmiTableBlockData | OmiChartBlockData;
  onChange: (next: typeof data) => void;
  copy: ReturnType<typeof getVisualElementsCopy>;
}) {
  const cells = data.cells;

  return (
    <div className="omi-table-editor-wrap">
      <div className="omi-table-scroll">
        <table className="omi-table-editor">
          <tbody>
            {cells.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, columnIndex) => {
                  const Cell = data.kind === 'table' && rowIndex < (data.headerRows ?? 0) ? 'th' : 'td';
                  return (
                    <Cell key={columnIndex}>
                      <input
                        value={cell}
                        onChange={(event) =>
                          onChange({
                            ...data,
                            cells: updateTableCell(cells, rowIndex, columnIndex, event.target.value),
                          })
                        }
                      />
                    </Cell>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="omi-table-actions">
        <button type="button" onClick={() => onChange({ ...data, cells: addTableRow(cells) })}>
          <Plus size={14} aria-hidden="true" /> {copy.addRow}
        </button>
        <button type="button" onClick={() => onChange({ ...data, cells: addTableColumn(cells) })}>
          <Plus size={14} aria-hidden="true" /> {copy.addColumn}
        </button>
        <button type="button" onClick={() => onChange({ ...data, cells: removeTableRow(cells, cells.length - 1) })}>
          {copy.removeRow}
        </button>
        <button type="button" onClick={() => onChange({ ...data, cells: removeTableColumn(cells, (cells[0]?.length ?? 1) - 1) })}>
          {copy.removeColumn}
        </button>
      </div>
      {data.kind === 'table' ? (
        <label className="omi-table-caption">
          <span>{copy.caption}</span>
          <input
            value={data.caption ?? ''}
            onChange={(event) => onChange({ ...data, caption: event.target.value })}
          />
        </label>
      ) : null}
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
  }
}
