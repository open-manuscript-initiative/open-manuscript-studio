import type { OmiTableCellFormat } from '../types/omi';

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
