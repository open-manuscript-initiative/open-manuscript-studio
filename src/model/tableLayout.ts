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
