import type {
  OmiBlock,
  OmiChartType,
  OmiEquationBlockData,
  OmiImageBlockData,
  OmiMusicScoreBlockData,
  OmiImportProvenance,
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

export function createMusicScoreBlock(
  data: Omit<OmiMusicScoreBlockData, 'kind'>,
  id = crypto.randomUUID(),
): OmiBlock {
  return { id, type: 'music-score', content: '', visual: { kind: 'music-score', ...data } };
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
  const normalizedInput = input
    .replace(/\r\n?/g, '\n')
    // A selection often ends at a paragraph boundary. Drop only those trailing
    // line breaks: trimEnd() would also erase a trailing tab and therefore an
    // intentional empty final cell.
    .replace(/\n+$/g, '');
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
  const sampleLines = input
    .split('\n')
    .filter((line) => line.length > 0)
    .slice(0, 12);

  if (sampleLines.length === 0) return '\t';

  // Tabs are unambiguous structural markers in manuscript text. If they occur
  // outside quoted values, prefer them over punctuation that may merely belong
  // to prose or decimal values.
  const tabProfile = delimiterProfile(sampleLines, '\t');
  if (tabProfile.rowsWithDelimiter > 0) return '\t';

  const candidates = [';', ','] as const;
  const profiles = candidates.map((token, priority) => ({
    token,
    priority,
    ...delimiterProfile(sampleLines, token),
  }));

  const structural = profiles
    .filter((profile) => profile.rowsWithDelimiter > 0)
    .sort((first, second) =>
      second.consistentRows - first.consistentRows
      || second.rowsWithDelimiter - first.rowsWithDelimiter
      || second.modeCount - first.modeCount
      || first.priority - second.priority,
    )[0];

  return structural?.token ?? '\t';
}

function delimiterProfile(
  lines: readonly string[],
  token: string,
): {
  rowsWithDelimiter: number;
  consistentRows: number;
  modeCount: number;
} {
  let quoted = false;
  const counts: number[] = [];

  for (const line of lines) {
    let count = 0;
    for (let index = 0; index < line.length; index += 1) {
      const character = line[index] ?? '';
      const next = line[index + 1] ?? '';

      if (character === '"') {
        if (quoted && next === '"') {
          index += 1;
        } else {
          quoted = !quoted;
        }
        continue;
      }

      if (!quoted && character === token) count += 1;
    }
    counts.push(count);
  }

  const positiveCounts = counts.filter((count) => count > 0);
  if (positiveCounts.length === 0) {
    return { rowsWithDelimiter: 0, consistentRows: 0, modeCount: 0 };
  }

  const frequencies = new Map<number, number>();
  for (const count of positiveCounts) {
    frequencies.set(count, (frequencies.get(count) ?? 0) + 1);
  }
  const [modeCount, consistentRows] = [...frequencies.entries()]
    .sort((first, second) => second[1] - first[1] || first[0] - second[0])[0]
    ?? [0, 0];

  return {
    rowsWithDelimiter: positiveCounts.length,
    consistentRows,
    modeCount,
  };
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

export function tableToDelimitedText(
  cells: readonly (readonly string[])[],
  delimiter = '\t',
): string {
  return normalizeCellMatrix(cells.map((row) => [...row]))
    .map((row) => row.map((cell) => normalizeTableTextCell(cell, delimiter)).join(delimiter))
    .join('\n');
}

export function tableRowsToParagraphBlocks(
  cells: readonly (readonly string[])[],
  firstBlockId?: string,
  createId: () => string = () => crypto.randomUUID(),
): OmiBlock[] {
  const normalized = normalizeCellMatrix(cells.map((row) => [...row]));
  return normalized.map((row, index) => {
    const normalizedRow = row.map((cell) => normalizeTableTextCell(cell, '\t'));
    const inlineContent = normalizedRow.flatMap((cell, columnIndex) => [
      ...(columnIndex > 0 ? [{ type: 'omiTab' }] : []),
      ...(cell ? [{ type: 'text', text: cell }] : []),
    ]);
    return {
      id: index === 0 && firstBlockId ? firstBlockId : createId(),
      type: 'paragraph',
      content: JSON.stringify({
        type: 'doc',
        content: [{
          type: 'paragraph',
          ...(inlineContent.length ? { content: inlineContent } : {}),
        }],
      }),
    };
  });
}

function normalizeTableTextCell(value: string, delimiter: string): string {
  return String(value)
    .replace(/[\r\n]+/g, ' ')
    .replace(delimiter === '\t' ? /\t/g : new RegExp(escapeRegExp(delimiter), 'g'), ' ')
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function cloneVisualData<T extends OmiVisualBlockData>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T;
}
