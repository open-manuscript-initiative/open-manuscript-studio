export type StatisticalDataset = {
  id: string;
  title: string;
  sourceStudy: string;
  importedAt: string;
  columns: string[];
  rows: string[][];
};

export type StatisticalWorkspace = {
  schemaVersion: 1;
  dataset: StatisticalDataset | null;
  analysisTitle: string;
};

export type DescriptiveSummary = {
  n: number;
  mean: number;
  median: number;
  standardDeviation: number;
  minimum: number;
  q1: number;
  q3: number;
  maximum: number;
  confidenceLow: number;
  confidenceHigh: number;
};

export type MeanComparison = {
  statistic: number;
  degreesOfFreedom: number;
  pValue: number;
  meanDifference: number;
  confidenceLow: number;
  confidenceHigh: number;
};

export type AnovaResult = {
  fStatistic: number;
  degreesOfFreedomBetween: number;
  degreesOfFreedomWithin: number;
  pValue: number;
};

export type LinearRegressionResult = {
  n: number;
  intercept: number;
  slope: number;
  correlation: number;
  rSquared: number;
};

export function newStatisticalId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `stat-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createStatisticalWorkspace(): StatisticalWorkspace {
  return { schemaVersion: 1, dataset: null, analysisTitle: '' };
}

export function parseDelimited(text: string, delimiter?: ',' | '\${term}'): { columns: string[]; rows: string[][] } | null {
  const source = text.replace(/^\${term}/, '');
  const selectedDelimiter = delimiter ?? (guessDelimiter(source) === '\${term}' ? '\${term}' : ',');
  const records: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]!;
    if (inQuotes) {
      if (char === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"' && field.length === 0) {
      inQuotes = true;
    } else if (char === selectedDelimiter) {
      row.push(field);
      field = '';
    } else if (char === '\${term}' || char === '\${term}') {
      if (char === '\${term}' && source[index + 1] === '\${term}') index += 1;
      row.push(field);
      field = '';
      if (row.some((cell) => cell.trim() !== '')) records.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  if (inQuotes) return null;
  row.push(field);
  if (row.some((cell) => cell.trim() !== '')) records.push(row);
  if (records.length < 2) return null;

  const columns = records[0]!.map((value, index) => value.trim() || `Column ${index + 1}`);
  const rows = records.slice(1);
  if (rows.some((record) => record.length !== columns.length)) return null;
  return { columns, rows };
}

function guessDelimiter(source: string): ',' | '\${term}' {
  const header = source.split(/\${term}?\${term}/, 1)[0] ?? '';
  const count = (value: string) => [...header].filter((char) => char === value).length;
  return count('\${term}') > count(',') ? '\${term}' : ',';
}

export function numericColumnValues(rows: string[][], columnIndex: number): number[] {
  return rows.flatMap((row) => {
    const raw = row[columnIndex]?.trim() ?? '';
    if (!raw) return [];
    const value = Number(raw);
    return Number.isFinite(value) ? [value] : [];
  });
}

export function describe(values: number[]): DescriptiveSummary | null {
  const sorted = finiteSorted(values);
  if (sorted.length === 0) return null;
  const n = sorted.length;
  const mean = sorted.reduce((sum, value) => sum + value, 0) / n;
  const variance = n > 1 ? sorted.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (n - 1) : 0;
  const standardDeviation = Math.sqrt(variance);
  const critical = n > 1 ? studentTCritical975(n - 1) : 0;
  const margin = critical * standardDeviation / Math.sqrt(n);
  return {
    n,
    mean,
    median: quantile(sorted, 0.5),
    standardDeviation,
    minimum: sorted[0]!,
    q1: quantile(sorted, 0.25),
    q3: quantile(sorted, 0.75),
    maximum: sorted[sorted.length - 1]!,
    confidenceLow: mean - margin,
    confidenceHigh: mean + margin,
  };
}

export function welchTTest(first: number[], second: number[]): MeanComparison | null {
  const a = finiteSorted(first);
  const b = finiteSorted(second);
  if (a.length < 2 || b.length < 2) return null;
  const meanA = average(a);
  const meanB = average(b);
  const varA = sampleVariance(a, meanA);
  const varB = sampleVariance(b, meanB);
  const partA = varA / a.length;
  const partB = varB / b.length;
  const standardError = Math.sqrt(partA + partB);
  if (standardError === 0) return null;
  const degreesOfFreedom = (partA + partB) ** 2
    / (partA ** 2 / (a.length - 1) + partB ** 2 / (b.length - 1));
  const statistic = (meanA - meanB) / standardError;
  const pValue = studentTTwoSidedP(Math.abs(statistic), degreesOfFreedom);
  const critical = studentTCritical975(degreesOfFreedom);
  const meanDifference = meanA - meanB;
  return {
    statistic,
    degreesOfFreedom,
    pValue,
    meanDifference,
    confidenceLow: meanDifference - critical * standardError,
    confidenceHigh: meanDifference + critical * standardError,
  };
}

export function oneWayAnova(groups: number[][]): AnovaResult | null {
  const valid = groups.map(finiteSorted).filter((group) => group.length >= 2);
  if (valid.length < 2) return null;
  const totalN = valid.reduce((sum, group) => sum + group.length, 0);
  const grandMean = valid.reduce((sum, group) => sum + group.reduce((a, b) => a + b, 0), 0) / totalN;
  const between = valid.reduce((sum, group) => sum + group.length * (average(group) - grandMean) ** 2, 0);
  const within = valid.reduce((sum, group) => sum + group.reduce((s, value) => s + (value - average(group)) ** 2, 0), 0);
  const dfBetween = valid.length - 1;
  const dfWithin = totalN - valid.length;
  const meanWithin = within / dfWithin;
  if (meanWithin === 0) return null;
  const fStatistic = (between / dfBetween) / meanWithin;
  return {
    fStatistic,
    degreesOfFreedomBetween: dfBetween,
    degreesOfFreedomWithin: dfWithin,
    pValue: regularizedBeta(dfWithin / (dfWithin + dfBetween * fStatistic), dfWithin / 2, dfBetween / 2),
  };
}

export function linearRegression(xValues: number[], yValues: number[]): LinearRegressionResult | null {
  const pairs = xValues.flatMap((x, index) => Number.isFinite(x) && Number.isFinite(yValues[index]) ? [[x, yValues[index]!] as const] : []);
  if (pairs.length < 2) return null;
  const meanX = pairs.reduce((sum, [x]) => sum + x, 0) / pairs.length;
  const meanY = pairs.reduce((sum, [, y]) => sum + y, 0) / pairs.length;
  const ssX = pairs.reduce((sum, [x]) => sum + (x - meanX) ** 2, 0);
  const ssY = pairs.reduce((sum, [, y]) => sum + (y - meanY) ** 2, 0);
  if (ssX === 0 || ssY === 0) return null;
  const covariance = pairs.reduce((sum, [x, y]) => sum + (x - meanX) * (y - meanY), 0);
  const slope = covariance / ssX;
  const intercept = meanY - slope * meanX;
  const correlation = covariance / Math.sqrt(ssX * ssY);
  return { n: pairs.length, intercept, slope, correlation, rSquared: correlation ** 2 };
}

export function formatStat(value: number, digits = 4): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(value);
}

function finiteSorted(values: number[]): number[] {
  return values.filter(Number.isFinite).sort((a, b) => a - b);
}
function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
function sampleVariance(values: number[], mean = average(values)): number {
  return values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
}
function quantile(sorted: number[], probability: number): number {
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (position - lower);
}
function studentTCritical975(df: number): number {
  let low = 0;
  let high = 100;
  for (let i = 0; i < 70; i += 1) {
    const middle = (low + high) / 2;
    if (studentTCdf(middle, df) < 0.975) low = middle;
    else high = middle;
  }
  return (low + high) / 2;
}
function studentTTwoSidedP(t: number, df: number): number {
  return regularizedBeta(df / (df + t * t), df / 2, 0.5);
}
function studentTCdf(t: number, df: number): number {
  if (t === 0) return 0.5;
  const tail = 0.5 * regularizedBeta(df / (df + t * t), df / 2, 0.5);
  return t > 0 ? 1 - tail : tail;
}
function regularizedBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const factor = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log1p(-x));
  if (x < (a + 1) / (a + b + 2)) return factor * betaContinuedFraction(x, a, b) / a;
  return 1 - factor * betaContinuedFraction(1 - x, b, a) / b;
}
function betaContinuedFraction(x: number, a: number, b: number): number {
  const maxIterations = 200;
  const epsilon = 3e-14;
  const tiny = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - qab * x / qap;
  if (Math.abs(d) < tiny) d = tiny;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= maxIterations; m += 1) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < epsilon) break;
  }
  return h;
}
function logGamma(value: number): number {
  const coefficients = [
    676.5203681218851, -1259.1392167224028, 771.3234287776531,
    -176.6150291621406, 12.507343278686905, -0.13857109526572012,
    9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (value < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - logGamma(1 - value);
  const shifted = value - 1;
  let x = 0.99999999999980993;
  for (let i = 0; i < coefficients.length; i += 1) x += coefficients[i]! / (shifted + i + 1);
  const t = shifted + coefficients.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (shifted + 0.5) * Math.log(t) - t + Math.log(x);
}

export function isStatisticalWorkspace(value: unknown): value is StatisticalWorkspace {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Partial<StatisticalWorkspace>;
  if (candidate.schemaVersion !== 1 || typeof candidate.analysisTitle !== 'string') return false;
  if (candidate.dataset === null) return true;
  const dataset = candidate.dataset as StatisticalDataset | undefined;
  return Boolean(dataset && typeof dataset === 'object' && typeof dataset.id === 'string'
    && typeof dataset.title === 'string' && typeof dataset.sourceStudy === 'string'
    && typeof dataset.importedAt === 'string' && Array.isArray(dataset.columns)
    && dataset.columns.every((column) => typeof column === 'string')
    && Array.isArray(dataset.rows) && dataset.rows.every((row) => Array.isArray(row)
      && row.length === dataset.columns.length && row.every((cell) => typeof cell === 'string')));
}

export function parseStatisticalWorkspace(json: string): StatisticalWorkspace | null {
  try {
    const value: unknown = JSON.parse(json);
    return isStatisticalWorkspace(value) ? value : null;
  } catch {
    return null;
  }
}
