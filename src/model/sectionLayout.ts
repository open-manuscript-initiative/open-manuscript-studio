import type {
  OmiSectionColumnCount,
  OmiSectionLayout,
} from '../types/omi';

const DEFAULT_SECTION_COLUMNS: OmiSectionColumnCount = 1;
export const DEFAULT_SECTION_COLUMN_GAP_MM = 8;
export const DEFAULT_TAB_INTERVAL_MM = 12.5;
const MAX_SECTION_TAB_STOP_MM = 240;

export function normalizeSectionLayout(
  layout: OmiSectionLayout | undefined,
): OmiSectionLayout | undefined {
  if (!layout) return undefined;

  const columns = normalizeColumnCount(layout.columns);
  const columnGapMm = finiteInRange(
    layout.columnGapMm,
    0,
    50,
    DEFAULT_SECTION_COLUMN_GAP_MM,
  );
  const tabStopsMm = normalizeTabStops(layout.tabStopsMm);

  const normalized: OmiSectionLayout = {};
  if (columns !== DEFAULT_SECTION_COLUMNS) normalized.columns = columns;
  if (
    columns !== DEFAULT_SECTION_COLUMNS
    && Math.abs(columnGapMm - DEFAULT_SECTION_COLUMN_GAP_MM) > 0.001
  ) {
    normalized.columnGapMm = columnGapMm;
  }
  if (tabStopsMm.length) normalized.tabStopsMm = tabStopsMm;

  return Object.keys(normalized).length ? normalized : undefined;
}

export function normalizeColumnCount(value: unknown): OmiSectionColumnCount {
  const numeric = Number(value);
  if (numeric === 2 || numeric === 3) return numeric;
  return 1;
}

export function normalizeTabStops(
  stops: readonly number[] | undefined,
): number[] {
  if (!stops?.length) return [];
  const unique = new Set<number>();

  for (const value of stops) {
    if (!Number.isFinite(value)) continue;
    const rounded = Math.round(Number(value) * 10) / 10;
    if (rounded <= 0 || rounded > MAX_SECTION_TAB_STOP_MM) continue;
    unique.add(rounded);
  }

  return [...unique].sort((left, right) => left - right);
}

export function toggleTabStop(
  stops: readonly number[] | undefined,
  positionMm: number,
  toleranceMm = 1.5,
): number[] {
  const normalized = normalizeTabStops(stops);
  const existing = normalized.find(
    (value) => Math.abs(value - positionMm) <= toleranceMm,
  );
  if (existing !== undefined) {
    return normalized.filter((value) => value !== existing);
  }
  return normalizeTabStops([...normalized, positionMm]);
}

export function nextTabStopMm(
  stops: readonly number[] | undefined,
  currentMm: number,
): number {
  const normalized = normalizeTabStops(stops);
  const explicit = normalized.find((value) => value > currentMm + 0.1);
  if (explicit !== undefined) return explicit;

  const interval = DEFAULT_TAB_INTERVAL_MM;
  return Math.max(
    interval,
    Math.ceil((Math.max(0, currentMm) + 0.1) / interval) * interval,
  );
}

function finiteInRange(
  value: number | undefined,
  minimum: number,
  maximum: number,
  fallback: number,
): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(minimum, Math.min(maximum, Number(value)));
}
