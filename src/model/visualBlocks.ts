import type {
  OmiBlock,
  OmiChartBlockData,
  OmiChartType,
  OmiEquationBlockData,
  OmiImageBlockData,
  OmiImportProvenance,
  OmiTableBlockData,
  OmiVisualBlockData,
} from '../types/omi';

export const MAX_VISUAL_IMPORT_BYTES = 25 * 1024 * 1024;
export const MAX_TABLE_CELLS = 10_000;

export function createImageBlock(
  data: Omit<OmiImageBlockData, 'kind'>,
  id = crypto.randomUUID(),
): OmiBlock {
  return {
    id,
    type: 'image',
    content: '',
    visual: {
      kind: 'image',
      ...data,
    },
  };
}

export function createTableBlock(
  cells: string[][] = [['', ''], ['', '']],
  options: {
    caption?: string;
    headerRows?: number;
    provenance?: OmiImportProvenance;
  } = {},
  id = crypto.randomUUID(),
): OmiBlock {
  return {
    id,
    type: 'table',
    content: '',
    visual: {
      kind: 'table',
      cells: normalizeCellMatrix(cells),
      headerRows: options.headerRows ?? 1,
      caption: options.caption,
      provenance: options.provenance,
    },
  };
}

export function createChartBlock(
  cells: string[][] = [['Category', 'Value'], ['', '']],
  options: {
    chartType?: OmiChartType;
    title?: string;
    caption?: string;
    provenance?: OmiImportProvenance;
  } = {},
  id = crypto.randomUUID(),
): OmiBlock {
  return {
    id,
    type: 'chart',
    content: '',
    visual: {
      kind: 'chart',
      chartType: options.chartType ?? 'bar',
      cells: normalizeCellMatrix(cells),
      title: options.title,
      caption: options.caption,
      provenance: options.provenance,
    },
  };
}

export function createEquationBlock(
  source = '',
  options: {
    notation?: OmiEquationBlockData['notation'];
    latex?: string;
    label?: string;
    caption?: string;
    provenance?: OmiImportProvenance;
  } = {},
  id = crypto.randomUUID(),
): OmiBlock {
  const notation = options.notation ?? 'latex';

  return {
    id,
    type: 'equation',
    content: '',
    visual: {
      kind: 'equation',
      notation,
      source,
      latex: options.latex ?? (notation === 'latex' ? source : undefined),
      label: options.label,
      caption: options.caption,
      provenance: options.provenance,
    },
  };
}

export function isVisualBlock(
  block: OmiBlock,
): block is OmiBlock & { visual: OmiVisualBlockData } {
  return Boolean(block.visual);
}

export function normalizeCellMatrix(cells: string[][]): string[][] {
  if (cells.length === 0) {
    return [['']];
  }

  const width = Math.max(1, ...cells.map((row) => row.length));
  const normalized = cells.map((row) =>
    Array.from({ length: width }, (_, columnIndex) =>
      String(row[columnIndex] ?? '').trim(),
    ),
  );

  if (normalized.length * width > MAX_TABLE_CELLS) {
    throw new Error(`Table exceeds the ${MAX_TABLE_CELLS}-cell import limit.`);
  }

  return normalized;
}

export function parseDelimitedTable(
  input: string,
  delimiter?: string,
): string[][] {
  const normalizedInput = input.replace(/\r\n?/g, '\n').trimEnd();
  if (!normalizedInput) {
    return [['']];
  }

  const selectedDelimiter = delimiter ?? inferDelimiter(normalizedInput);
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < normalizedInput.length; index += 1) {
    const character = normalizedInput[index] ?? '';
    const next = normalizedInput[index + 1] ?? '';

    if (character === '"') {
      if (quoted && next === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (!quoted && character === selectedDelimiter) {
      row.push(value);
      value = '';
      continue;
    }

    if (!quoted && character === '\n') {
      row.push(value);
      rows.push(row);
      row = [];
      value = '';
      continue;
    }

    value += character;
  }

  row.push(value);
  rows.push(row);

  return normalizeCellMatrix(rows);
}

function inferDelimiter(input: string): string {
  const sample = input.split('\n').slice(0, 6).join('\n');
  const counts = [
    ['\t', countOutsideQuotes(sample, '\t')],
    [';', countOutsideQuotes(sample, ';')],
    [',', countOutsideQuotes(sample, ',')],
  ] as const;

  return [...counts].sort((first, second) => second[1] - first[1])[0]?.[0] ?? '\t';
}

function countOutsideQuotes(input: string, token: string): number {
  let quoted = false;
  let count = 0;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index] ?? '';
    const next = input[index + 1] ?? '';

    if (character === '"') {
      if (quoted && next === '"') {
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (!quoted && character === token) {
      count += 1;
    }
  }

  return count;
}

export interface ChartSeries {
  name: string;
  values: number[];
}

export interface ChartDataset {
  labels: string[];
  series: ChartSeries[];
}

export function tableToChartDataset(cells: string[][]): ChartDataset {
  const normalized = normalizeCellMatrix(cells);
  const header = normalized[0] ?? [];
  const dataRows = normalized.slice(1).filter((row) =>
    row.some((cell) => cell.trim().length > 0),
  );
  const labels = dataRows.map((row, index) => row[0]?.trim() || String(index + 1));
  const series: ChartSeries[] = [];

  for (let columnIndex = 1; columnIndex < header.length; columnIndex += 1) {
    const values = dataRows.map((row) => parseChartNumber(row[columnIndex] ?? ''));
    if (!values.some((value) => Number.isFinite(value))) {
      continue;
    }

    series.push({
      name: header[columnIndex]?.trim() || `Series ${columnIndex}`,
      values: values.map((value) => (Number.isFinite(value) ? value : 0)),
    });
  }

  return { labels, series };
}

export function parseChartNumber(value: string): number {
  const normalized = value
    .trim()
    .replace(/\s+/g, '')
    .replace(/(?<=\d),(?=\d{1,2}$)/, '.')
    .replace(/[^0-9+\-.eE]/g, '');
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : Number.NaN;
}

export function updateTableCell(
  cells: string[][],
  rowIndex: number,
  columnIndex: number,
  value: string,
): string[][] {
  const next = normalizeCellMatrix(cells).map((row) => [...row]);
  if (!next[rowIndex] || columnIndex < 0 || columnIndex >= next[rowIndex].length) {
    return next;
  }
  next[rowIndex][columnIndex] = value;
  return next;
}

export function addTableRow(cells: string[][]): string[][] {
  const normalized = normalizeCellMatrix(cells);
  return normalizeCellMatrix([
    ...normalized,
    Array.from({ length: normalized[0]?.length ?? 1 }, () => ''),
  ]);
}

export function addTableColumn(cells: string[][]): string[][] {
  return normalizeCellMatrix(
    normalizeCellMatrix(cells).map((row) => [...row, '']),
  );
}

export function removeTableRow(cells: string[][], rowIndex: number): string[][] {
  const normalized = normalizeCellMatrix(cells);
  if (normalized.length <= 1) return normalized;
  return normalizeCellMatrix(normalized.filter((_, index) => index !== rowIndex));
}

export function removeTableColumn(
  cells: string[][],
  columnIndex: number,
): string[][] {
  const normalized = normalizeCellMatrix(cells);
  if ((normalized[0]?.length ?? 0) <= 1) return normalized;
  return normalizeCellMatrix(
    normalized.map((row) => row.filter((_, index) => index !== columnIndex)),
  );
}

export function cloneVisualData<T extends OmiVisualBlockData>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T;
}
