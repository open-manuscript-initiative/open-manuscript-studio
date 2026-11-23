import type { ReactNode } from 'react';
import { tableToChartDataset } from '../model/visualBlocks';
import type { OmiChartBlockData } from '../types/omi';

interface Props { data: OmiChartBlockData; emptyLabel: string }
const COLORS: Record<NonNullable<OmiChartBlockData['stylePreset']>, string[]> = {
  color: ['#4263eb', '#0b806b', '#bd6b00', '#c1356a', '#7950b4', '#00788b'],
  editorial: ['#214e59', '#a06c26', '#637d58', '#845e70', '#556b8a', '#776a57'],
  monochrome: ['#262626', '#606060', '#999999', '#434343', '#bababa', '#767676'],
  contrast: ['#0046a8', '#a53e00', '#00805a', '#9c1476', '#5b31ae', '#704800'],
};
const WIDTH = 720, HEIGHT = 390;
const PLOT = { left: 76, top: 28, width: 552, height: 275 };
const MAX_VISIBLE = 12;
const compact = (value: number): string => Number.isInteger(value) ? value.toLocaleString('en-US') : Number(value.toFixed(2)).toLocaleString('en-US');
const short = (label: string, limit = 15): string => label.length > limit ? `${label.slice(0, limit - 1)}…` : label;
const point = (cx: number, cy: number, radius: number, angle: number) => ({ x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
const scale = (value: number, min: number, max: number, size: number): number => ((value - min) / (max - min || 1)) * size;

function Legend({ labels, colors, x = 78, y = 358, vertical = false }: { labels: string[]; colors: string[]; x?: number; y?: number; vertical?: boolean }) {
  return <g className="omi-chart-legend-list">
    {labels.slice(0, vertical ? 10 : 5).map((label, index) =>
      <g key={`${index}-${label}`} transform={`translate(${vertical ? x : x + index * 130}, ${vertical ? y + index * 26 : y})`}>
        <rect x={0} y={-10} width={12} height={12} fill={colors[index % colors.length]} />
        <text x={18} y={0} fill="currentColor" fontSize={12}>{short(label, vertical ? 19 : 15)}</text>
      </g>)}
  </g>;
}

function Grid({ min, max, horizontal = false, show = true }: { min: number; max: number; horizontal?: boolean; show?: boolean }) {
  const { left, top, width, height } = PLOT;
  return <g className="omi-chart-axis" fill="currentColor" fontSize={11}>
    {Array.from({ length: 5 }, (_, index) => {
      const value = min + (max - min) * index / 4;
      if (horizontal) {
        const x = left + index * width / 4;
        return <g key={index}>
          {show ? <line x1={x} x2={x} y1={top} y2={top + height} stroke="currentColor" strokeOpacity=".14" /> : null}
          <text x={x} y={top + height + 20} textAnchor="middle">{compact(value)}</text>
        </g>;
      }
      const y = top + height - index * height / 4;
      return <g key={index}>
        {show ? <line x1={left} x2={left + width} y1={y} y2={y} stroke="currentColor" strokeOpacity=".14" /> : null}
        <text x={left - 10} y={y + 4} textAnchor="end">{compact(value)}</text>
      </g>;
    })}
    <line x1={left} x2={left} y1={top} y2={top + height} stroke="currentColor" strokeOpacity=".55" />
    <line x1={left} x2={left + width} y1={top + height} y2={top + height} stroke="currentColor" strokeOpacity=".55" />
  </g>;
}

function CategoryLabels({ labels, horizontal = false }: { labels: string[]; horizontal?: boolean }) {
  const { left, top, width, height } = PLOT;
  return <g className="omi-chart-labels">
    {labels.map((label, index) => {
      const value = short(label, horizontal ? 11 : 14);
      return horizontal
        ? <text key={index} x={left - 8} y={top + (index + .5) * height / labels.length + 4} textAnchor="end">{value}</text>
        : <text key={index} x={left + (index + .5) * width / labels.length} y={top + height + 23} textAnchor="middle">{value}</text>;
    })}
  </g>;
}

function SectorChart({ data, labels, values, colors, donut, showValues, showLegend }: {
  data: OmiChartBlockData; labels: string[]; values: number[]; colors: string[]; donut: boolean; showValues: boolean; showLegend: boolean
}) {
  const total = values.reduce((sum, v) => sum + Math.max(0, v), 0);
  if (total <= 0) return null;
  const cx = showLegend ? 255 : 360, cy = 175, radius = 121, inner = donut ? 63 : 0;
  let angle = -Math.PI / 2;
  return <>
    {values.map((original, index) => {
      const value = Math.max(0, original), sweep = 2 * Math.PI * value / total;
      const start = angle; angle += sweep;
      if (value === 0) return null;
      const outerStart = point(cx, cy, radius, start), outerEnd = point(cx, cy, radius, angle);
      const innerStart = point(cx, cy, inner, start), innerEnd = point(cx, cy, inner, angle);
      const fullCircle = sweep >= Math.PI * 2 - 0.000001;
      const d = inner
        ? fullCircle ? undefined : `M ${outerStart.x} ${outerStart.y} A ${radius} ${radius} 0 ${sweep > Math.PI ? 1 : 0} 1 ${outerEnd.x} ${outerEnd.y} L ${innerEnd.x} ${innerEnd.y} A ${inner} ${inner} 0 ${sweep > Math.PI ? 1 : 0} 0 ${innerStart.x} ${innerStart.y} Z`
        : fullCircle ? undefined : `M ${cx} ${cy} L ${outerStart.x} ${outerStart.y} A ${radius} ${radius} 0 ${sweep > Math.PI ? 1 : 0} 1 ${outerEnd.x} ${outerEnd.y} Z`;
      const mid = start + sweep / 2, labelPoint = point(cx, cy, inner ? 93 : 78, mid);
      return <g key={index}>
        {fullCircle ? <circle cx={cx} cy={cy} r={radius} fill={colors[index % colors.length]} /> : <path d={d} fill={colors[index % colors.length]} stroke="white" strokeWidth={1.5} />}
        {showValues && sweep > .34 ? <text x={labelPoint.x} y={labelPoint.y + 4} fontSize={12} fontWeight="600" fill="white" textAnchor="middle">{Math.round(100 * value / total)}%</text> : null}
      </g>;
    })}
    {donut ? <circle cx={cx} cy={cy} r={inner} fill="white" /> : null}
    {showLegend ? <Legend labels={labels} colors={colors} x={445} y={72} vertical /> : null}
    {donut && !showLegend ? <text x={cx} y={cy + 5} fontSize={15} textAnchor="middle" fill="currentColor">{compact(total)}</text> : null}
  </>;
}

function RadarChart({ labels, series, colors, showLegend, showGrid, showValues }: {
  labels: string[]; series: { name: string; values: number[] }[]; colors: string[]; showLegend: boolean; showGrid: boolean; showValues: boolean
}) {
  const cx = showLegend ? 285 : 355, cy = 173, radius = 116;
  const max = Math.max(1, ...series.flatMap(s => s.values.map(v => Math.max(0, v))));
  const vertex = (index: number, value: number) => point(cx, cy, radius * value / max, -Math.PI / 2 + index * 2 * Math.PI / labels.length);
  return <>
    {showGrid ? [1, 2, 3, 4].map(tick =>
      <polygon key={tick} points={labels.map((_, index) => { const p = vertex(index, max * tick / 4); return `${p.x},${p.y}`; }).join(' ')} fill="none" stroke="currentColor" strokeOpacity=".19" />
    ) : null}
    {labels.map((label, index) => {
      const end = vertex(index, max), textPoint = point(cx, cy, radius + 19, -Math.PI / 2 + index * 2 * Math.PI / labels.length);
      return <g key={index}>
        <line x1={cx} y1={cy} x2={end.x} y2={end.y} stroke="currentColor" strokeOpacity=".24" />
        <text x={textPoint.x} y={textPoint.y + 4} textAnchor="middle" fill="currentColor" fontSize={11}>{short(label, 12)}</text>
      </g>;
    })}
    {series.map((item, index) => {
      const vertices = labels.map((_, i) => vertex(i, Math.max(0, item.values[i] ?? 0)));
      return <g key={index}>
        <polygon points={vertices.map(v => `${v.x},${v.y}`).join(' ')} fill={colors[index % colors.length]} fillOpacity=".16" stroke={colors[index % colors.length]} strokeWidth="2.5" />
        {vertices.map((v, i) => <g key={i}><circle cx={v.x} cy={v.y} r={3.5} fill={colors[index % colors.length]} />
          {showValues && labels.length <= 8 ? <text x={v.x + 5} y={v.y - 6} fontSize={10} fill="currentColor">{compact(item.values[i] ?? 0)}</text> : null}
        </g>)}
      </g>;
    })}
    {showLegend ? <Legend labels={series.map(s=>s.name)} colors={colors} x={510} y={85} vertical /> : null}
  </>;
}

export function ChartPreview({ data, emptyLabel }: Props) {
  const dataset = tableToChartDataset(data.cells);
  const visibleLabels = dataset.labels.slice(0, MAX_VISIBLE);
  const series = dataset.series.map(s => ({ ...s, values: s.values.slice(0, MAX_VISIBLE) }));
  if (!visibleLabels.length || !series.length) return <div className="omi-chart-empty">{emptyLabel}</div>;
  const colors = COLORS[data.stylePreset ?? 'color'] ?? COLORS.color;
  const showGrid = data.showGrid ?? true, showLegend = data.showLegend ?? true, showValues = data.showValues ?? false;
  const chartType = data.chartType;
  const isCircular = chartType === 'pie' || chartType === 'donut';
  const isRadar = chartType === 'radar';
  const label = data.title?.trim() || `Chart: ${chartType}`;
  const frame = (children: ReactNode) =>
    <svg className="omi-chart-svg" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={label} data-chart-type={chartType} data-chart-style={data.stylePreset ?? 'color'} style={{ fontFamily: data.stylePreset === 'editorial' ? 'Georgia, serif' : 'inherit' }}>
      <title>{label}</title>{children}
    </svg>;
  if (isCircular) {
    const values = series[0]?.values ?? [];
    if (!values.some(v => v > 0)) return <div className="omi-chart-empty">{emptyLabel}</div>;
    return frame(<SectorChart data={data} labels={visibleLabels} values={values} colors={colors} donut={chartType === 'donut'} showValues={showValues} showLegend={showLegend} />);
  }
  if (isRadar) return frame(<RadarChart labels={visibleLabels} series={series} colors={colors} showLegend={showLegend} showGrid={showGrid} showValues={showValues} />);
  const { left, top, width, height } = PLOT;
  const allValues = series.flatMap(s => s.values);
  const stacked = chartType === 'stacked-bar' || chartType === 'stacked-100';
  const horizontal = chartType === 'horizontal-bar';
  const positiveTotals = visibleLabels.map((_, i) => series.reduce((sum, s) => sum + Math.max(0, s.values[i] ?? 0), 0));
  const negativeTotals = visibleLabels.map((_, i) => series.reduce((sum, s) => sum + Math.min(0, s.values[i] ?? 0), 0));
  const min = chartType === 'stacked-100' ? 0 : stacked ? Math.min(0, ...negativeTotals) : Math.min(0, ...allValues);
  const max = chartType === 'stacked-100' ? 100 : stacked ? Math.max(1, ...positiveTotals) : Math.max(1, ...allValues);
  const axisY = (n: number) => top + height - scale(n, min, max, height);
  const axisX = (n: number) => left + scale(n, min, max, width);
  const baseline = axisY(0);
  const svgParts: ReactNode[] = [];
  if (horizontal) {
    svgParts.push(<Grid key="grid" min={min} max={max} horizontal show={showGrid} />, <CategoryLabels key="labels" labels={visibleLabels} horizontal />);
    const band = height / visibleLabels.length, seriesBand = band * .78 / series.length;
    visibleLabels.forEach((_, i) => series.forEach((item, j) => {
      const value = item.values[i] ?? 0, x = axisX(value), zero = axisX(0);
      const yy = top + band * (i + .11) + j * seriesBand;
      svgParts.push(<g key={`${i}-${j}`}>
        <rect x={Math.min(x, zero)} y={yy} width={Math.max(0, Math.abs(x - zero))} height={Math.max(2, seriesBand - 2)} fill={colors[j % colors.length]} />
        {showValues && series.length * visibleLabels.length <= 30 ? <text x={value >= 0 ? x + 5 : x - 5} y={yy + seriesBand / 2 + 4} textAnchor={value >= 0 ? 'start' : 'end'} fontSize={10} fill="currentColor">{compact(value)}</text> : null}
      </g>);
    }));
  } else if (chartType === 'scatter') {
    const xValues = series[0]?.values ?? [], yValues = series[1]?.values ?? xValues;
    const xMin = Math.min(...xValues), xMax = Math.max(...xValues);
    const yMin = Math.min(0, ...yValues), yMax = Math.max(1, ...yValues);
    const yPlot = (v: number) => top + height - scale(v, yMin, yMax, height);
    svgParts.push(<Grid key="grid" min={yMin} max={yMax} show={showGrid} />);
    yValues.forEach((v, i) => {
      const cx = left + (xMax === xMin ? width / 2 : scale(xValues[i] ?? xMin, xMin, xMax, width)), cy = yPlot(v);
      svgParts.push(<g key={i}><circle cx={cx} cy={cy} r={5} fill={colors[0]} />
        {showValues && i < 20 ? <text x={cx + 7} y={cy - 6} fontSize={10} fill="currentColor">{compact(v)}</text> : null}
      </g>);
    });
    svgParts.push(<text key="x-min" x={left} y={top + height + 24} fill="currentColor" fontSize={11}>{compact(xMin)}</text>,
      <text key="x-max" x={left + width} y={top + height + 24} textAnchor="end" fill="currentColor" fontSize={11}>{compact(xMax)}</text>);
  } else if (chartType === 'line' || chartType === 'area') {
    svgParts.push(<Grid key="grid" min={min} max={max} show={showGrid} />, <CategoryLabels key="labels" labels={visibleLabels} />);
    series.forEach((item, j) => {
      const vertices = item.values.map((v, i) => ({ x: left + width * (visibleLabels.length === 1 ? .5 : i / (visibleLabels.length - 1)), y: axisY(v) }));
      const points = vertices.map(p => `${p.x},${p.y}`).join(' ');
      const d = vertices.map(p => `${p.x} ${p.y}`).join(' L ');
      svgParts.push(<g key={j}>
        {chartType === 'area' ? <path d={`M ${vertices[0]!.x} ${baseline} L ${d} L ${vertices[vertices.length - 1]!.x} ${baseline} Z`} fill={colors[j % colors.length]} fillOpacity=".2" /> : null}
        <polyline points={points} fill="none" stroke={colors[j % colors.length]} strokeWidth="3" strokeLinejoin="round" />
        {vertices.map((p, i) => <g key={i}><circle cx={p.x} cy={p.y} r={3} fill={colors[j % colors.length]} />
          {showValues && series.length * visibleLabels.length <= 24 ? <text x={p.x + 4} y={p.y - 8} fontSize={10} fill="currentColor">{compact(item.values[i] ?? 0)}</text> : null}
        </g>)}
      </g>);
    });
  } else {
    svgParts.push(<Grid key="grid" min={min} max={max} show={showGrid} />, <CategoryLabels key="labels" labels={visibleLabels} />);
    const band = width / visibleLabels.length, groupWidth = band * .78;
    visibleLabels.forEach((_, i) => {
      let pos = 0, neg = 0;
      series.forEach((item, j) => {
        const raw = item.values[i] ?? 0;
        const value = chartType === 'stacked-100' ? (positiveTotals[i] ? 100 * Math.max(0, raw) / positiveTotals[i] : 0) : raw;
        const start = stacked ? (value < 0 ? neg : pos) : 0, end = start + value;
        if (stacked) { if (value < 0) neg = end; else pos = end; }
        const xx = left + i * band + (band - groupWidth) / 2 + (stacked ? 0 : j * groupWidth / series.length);
        const ww = stacked ? groupWidth : groupWidth / series.length;
        const y1 = axisY(start), y2 = axisY(end);
        svgParts.push(<g key={`${i}-${j}`}>
          <rect x={xx} y={Math.min(y1, y2)} width={Math.max(2, ww - (stacked ? 0 : 2))} height={Math.max(0, Math.abs(y1 - y2))} fill={colors[j % colors.length]} />
          {showValues && series.length * visibleLabels.length <= 24 && value !== 0 ? <text x={xx + ww / 2} y={y2 - (value >= 0 ? 5 : -13)} textAnchor="middle" fontSize={10} fill="currentColor">{chartType === 'stacked-100' ? `${Math.round(value)}%` : compact(value)}</text> : null}
        </g>);
      });
    });
  }
  if (showLegend && chartType !== 'scatter' && series.length > 1) svgParts.push(<Legend key="legend" labels={series.map(s=>s.name)} colors={colors} />);
  return frame(svgParts);
}
