import type { OmiTableCellFormat, OmiTableCellMerge, OmiTableBlockData, OmiTableRowSplitPolicy } from '../types/omi';

/** Relative widths keep the same table editable on screen and within print margins. */
export function tableColumnWidths(cells: readonly (readonly string[])[], widths?: readonly number[]): number[] {
  const count = cells.reduce((max, row) => Math.max(max, row.length), 0);
  if (!count) return [];
  const valid = widths?.length === count && widths.every((width) => Number.isFinite(width) && width > 0);
  const values = valid ? widths! : Array<number>(count).fill(1);
  const largest = Math.max(...values);
  const scaled = values.map((value) => value / largest);
  const total = scaled.reduce((sum, value) => sum + value, 0);
  return scaled.map((value) => Math.round(value * 100_000_000 / total) / 1_000_000);
}

/** Move one boundary while preserving the combined width of its two columns. */
export function resizeTableColumn(widths: readonly number[], index: number, requested: number): number[] {
  const next = [...widths];
  if (!Number.isFinite(requested) || index < 0 || index >= next.length - 1) return next;
  const pair = next[index]! + next[index + 1]!;
  const minimum = Math.min(3, pair / 4);
  next[index] = Math.min(pair - minimum, Math.max(minimum, requested));
  next[index + 1] = pair - next[index]!;
  return next;
}

export function tableCellFormat(formats: Record<string, OmiTableCellFormat> | undefined, row: number, column: number): Required<OmiTableCellFormat> {
  const format = formats?.[`${row}:${column}`];
  return {
    textRotation: format?.textRotation === -90 || format?.textRotation === 90 || format?.textRotation === 180 ? format.textRotation : 0,
    textDirection: format?.textDirection === 'ltr' || format?.textDirection === 'rtl' ? format.textDirection : 'auto',
  };
}

export function pruneTableCellFormats(cells: readonly (readonly string[])[], formats?: Record<string, OmiTableCellFormat>): Record<string, OmiTableCellFormat> {
  return Object.fromEntries(Object.entries(formats ?? {}).filter(([key]) => {
    const match = /^(\d+):(\d+)$/.exec(key);
    return match && Number(match[1]) < cells.length && Number(match[2]) < (cells[Number(match[1])]?.length ?? 0);
  }));
}

/** Writing mode gives quarter-turn text real layout dimensions, unlike a CSS
 * transform alone. Half turns stay within the same measured rectangle. */
export function tableCellTextStyle(rotation: Required<OmiTableCellFormat>['textRotation']) {
  const vertical = rotation === 90 || rotation === -90;
  return {
    display: 'inline-block',
    boxSizing: 'border-box',
    writingMode: vertical ? 'vertical-rl' : 'horizontal-tb',
    textOrientation: vertical ? 'sideways' : 'mixed',
    transform: rotation === -90 || rotation === 180 ? 'rotate(180deg)' : 'none',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
    textAlign: 'start',
    maxWidth: '100%',
    maxHeight: vertical ? '18em' : 'none',
    minHeight: '1.3em',
  } as const;
}

/** Header rows are a contiguous prefix of the table. */
export function tableHeaderRows(cells: readonly (readonly string[])[], count: unknown): number {
  return typeof count === 'number' && Number.isFinite(count) ? Math.max(0, Math.min(cells.length, Math.trunc(count))) : 0;
}

/** Validate rectangles once per rendering. Never hide nonempty covered cells,
 * overlap another accepted rectangle, or span separate header/body groups. */
export function tableMergeLayout(cells: readonly (readonly string[])[], merges?: readonly OmiTableCellMerge[], headerRows?: number) {
  const accepted: OmiTableCellMerge[] = [];
  const positions = new Map<string, OmiTableCellMerge>();
  const headers = tableHeaderRows(cells, headerRows);
  for (const raw of Array.isArray(merges) ? merges : []) {
    if (!raw || typeof raw !== 'object') continue;
    const {row,column,rowSpan,colSpan}=raw;
    if (![row,column,rowSpan,colSpan].every(Number.isSafeInteger) || row<0 || column<0 || rowSpan<1 || colSpan<1 || (rowSpan===1 && colSpan===1)) continue;
    if (row+rowSpan>cells.length || (row<headers && row+rowSpan>headers)) continue;
    let valid=true;
    for(let r=row;r<row+rowSpan && valid;r++) {
      if(column+colSpan>(cells[r]?.length??0)) {valid=false;break;}
      for(let c=column;c<column+colSpan;c++) {
        if(positions.has(r+':'+c) || ((r!==row||c!==column) && cells[r]![c]!=='')) {valid=false;break;}
      }
    }
    if(!valid) continue;
    const merge={row,column,rowSpan,colSpan};
    accepted.push(merge);
    for(let r=row;r<row+rowSpan;r++) for(let c=column;c<column+colSpan;c++) positions.set(r+':'+c,merge);
  }
  return {
    merges:accepted,
    at:(row:number,column:number)=>positions.get(row+':'+column),
    covered:(row:number,column:number)=>{
      const m=positions.get(row+':'+column);
      return !!m && (m.row!==row || m.column!==column);
    },
  };
}

/** Extend the selected anchor to the right or down by one logical cell.
 * Nonempty cells and overlapping merges are rejected rather than discarded. */
export function extendTableMerge(cells: readonly (readonly string[])[], merges: readonly OmiTableCellMerge[] | undefined, row:number,column:number, direction:'right'|'down',headerRows?:number): OmiTableCellMerge[] | undefined {
  const layout=tableMergeLayout(cells,merges,headerRows);
  if(layout.covered(row,column)) return undefined;
  const old=layout.at(row,column);
  const next={row,column,rowSpan:(old?.rowSpan??1)+(direction==='down'?1:0),colSpan:(old?.colSpan??1)+(direction==='right'?1:0)};
  const others=layout.merges.filter(m=>m!==old);
  const candidate=tableMergeLayout(cells,[...others,next],headerRows);
  return candidate.merges.length===others.length+1 ? candidate.merges : undefined;
}
export function splitTableMerge(cells: readonly (readonly string[])[], merges: readonly OmiTableCellMerge[] | undefined,row:number,column:number,headerRows?:number): OmiTableCellMerge[] {
  const layout=tableMergeLayout(cells,merges,headerRows);
  const selected=layout.at(row,column);
  return layout.merges.filter(m=>m!==selected);
}

/** Keep legacy screen/print behavior unless a source or editor explicitly opts in. */
export function tableRowSplitDefault(value: unknown): OmiTableRowSplitPolicy {
  return value === 'allow' ? 'allow' : 'keep';
}
export function tableRowSplitPolicy(table: Pick<OmiTableBlockData,'rowSplitDefault'|'rowSplitOverrides'>, row: number): OmiTableRowSplitPolicy {
  const value=table.rowSplitOverrides?.[String(row)];
  return value === 'allow' || value === 'keep' ? value : tableRowSplitDefault(table.rowSplitDefault);
}
export function pruneTableRowSplitOverrides(cells: readonly (readonly string[])[], overrides?: Record<string,OmiTableRowSplitPolicy>): Record<string,OmiTableRowSplitPolicy> {
  return Object.fromEntries(Object.entries(overrides??{}).filter(([key,value])=>
    /^(0|[1-9][0-9]*)$/.test(key) && Number(key)<cells.length && (value==='keep'||value==='allow')
  ));
}
export function setTableRowSplitOverride(table: OmiTableBlockData,row:number,policy: OmiTableRowSplitPolicy | 'inherit'): Record<string,OmiTableRowSplitPolicy> {
  const next=pruneTableRowSplitOverrides(table.cells,table.rowSplitOverrides);
  if(!Number.isSafeInteger(row)||row<0||row>=table.cells.length) return next;
  if(policy==='inherit') delete next[String(row)];
  else if(policy==='allow'||policy==='keep') next[String(row)]=policy;
  return next;
}
