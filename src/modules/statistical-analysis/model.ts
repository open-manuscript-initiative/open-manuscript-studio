export type StatisticalDataset = {
  id: string;
  title: string;
  sourceStudy: string;
  importedAt: string;
  columns: string[];
  rows: string[][];
};

export type ExperimentalDesign = {
  hypothesis: string;
  primaryOutcome: string;
  groups: string[];
  alpha: number;
  power: number;
  standardizedEffect: number;
  randomizationSeed: string;
  inclusionCriteria: string[];
  exclusionCriteria: string[];
  analysisPlan: string;
  preregisteredAt: string | null;
  preregisteredSnapshot: string | null;
  deviations: { date: string; description: string }[];
};

export type StatisticalWorkspace = {
  schemaVersion: 1;
  dataset: StatisticalDataset | null;
  analysisTitle: string;
  configuration: { valueColumn: string; groupColumn: string; regressionX: string; regressionY: string };
  design: ExperimentalDesign;
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

export function createExperimentalDesign(): ExperimentalDesign {
  return {
    hypothesis: '', primaryOutcome: '', groups: ['Control', 'Treatment'], alpha: 0.05,
    power: 0.8, standardizedEffect: 0.5, randomizationSeed: 'omi-seed',
    inclusionCriteria: [], exclusionCriteria: [], analysisPlan: '',
    preregisteredAt: null, preregisteredSnapshot: null, deviations: [],
  };
}

export function estimateTwoGroupSampleSize(alpha: number, power: number, standardizedEffect: number): number | null {
  if (!(alpha > 0 && alpha < 1) || !(power > 0.5 && power < 1) || !(standardizedEffect > 0) ||
    ![alpha, power, standardizedEffect].every(Number.isFinite)) return null;
  const z = (p: number) => inverseNormal(p);
  return Math.ceil(2 * ((z(1 - alpha / 2) + z(power)) / standardizedEffect) ** 2);
}

function inverseNormal(p: number): number {
  const a = [-39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472, 2.50662827745924];
  const b = [-54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857];
  const c = [-0.00778489400243029, -0.322396458041136, -2.40075827716184, -2.54973253934373, 4.37466414146497, 2.93816398269878];
  const d = [0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742];
  const low = 0.02425, high = 1 - low;
  if (p < low) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0]!*q+c[1]!)*q+c[2]!)*q+c[3]!)*q+c[4]!)*q+c[5]!) / ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1); }
  if (p > high) { const q = Math.sqrt(-2 * Math.log(1-p)); return -(((((c[0]!*q+c[1]!)*q+c[2]!)*q+c[3]!)*q+c[4]!)*q+c[5]!) / ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1); }
  const q = p - 0.5, r = q * q;
  return (((((a[0]!*r+a[1]!)*r+a[2]!)*r+a[3]!)*r+a[4]!)*r+a[5]!)*q / (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1);
}

function seededRandom(seed: string): () => number {
  let state = 2166136261;
  for (const char of seed) { state ^= char.charCodeAt(0); state = Math.imul(state, 16777619); }
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomizeParticipants(ids: string[], groups: string[], seed: string): { id: string; group: string }[] {
  if (!groups.length || groups.some(group => !group.trim())) return [];
  const random = seededRandom(seed);
  const shuffled = [...ids].map((id, index) => ({ id, key: random(), index })).sort((a, b) => a.key - b.key || a.index - b.index);
  return shuffled.map(({ id }, index) => ({ id, group: groups[index % groups.length]! }));
}

export function preregisterDesign(design: ExperimentalDesign, now = new Date().toISOString()): ExperimentalDesign {
  if (design.preregisteredSnapshot) return design;
  const snapshot = { ...design, preregisteredAt: now, preregisteredSnapshot: null, deviations: [] };
  return { ...design, preregisteredAt: now, preregisteredSnapshot: JSON.stringify(snapshot), deviations: [] };
}

export function addDesignDeviation(design: ExperimentalDesign, description: string, now = new Date().toISOString()): ExperimentalDesign {
  const value = description.trim();
  return value && design.preregisteredSnapshot
    ? { ...design, deviations: [...design.deviations, { date: now, description: value }] }
    : design;
}

export function createStatisticalWorkspace(): StatisticalWorkspace {
  return { schemaVersion: 1, dataset: null, analysisTitle: '', configuration: { valueColumn: '', groupColumn: '', regressionX: '', regressionY: '' }, design: createExperimentalDesign() };
}

export function parseDelimited(text: string, delimiter?: ',' | '\t'): { columns: string[]; rows: string[][] } | null {
  const source = text.replace(/^\uFEFF/, '');
  const selectedDelimiter = delimiter ?? (guessDelimiter(source) === '\t' ? '\t' : ',');
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
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[index + 1] === '\n') index += 1;
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

function guessDelimiter(source: string): ',' | '\t' {
  const header = source.split(/\r?\n/, 1)[0] ?? '';
  const count = (value: string) => [...header].filter((char) => char === value).length;
  return count('\t') > count(',') ? '\t' : ',';
}

export type LaboratoryMeasurementsImport = {
  projectTitle: string;
  columns: string[];
  rows: string[][];
};

export function parseLaboratoryMeasurements(json: string): LaboratoryMeasurementsImport | null {
  try {
    const root: unknown = JSON.parse(json);
    if (!root || typeof root !== 'object' || Array.isArray(root)) return null;
    const project = root as { schemaVersion?: unknown; title?: unknown; studies?: unknown };
    if (project.schemaVersion !== 1 || typeof project.title !== 'string' || !Array.isArray(project.studies)) return null;
    const columns = ['Project', 'Study', 'Assay', 'Technology', 'Samples', 'Measurement', 'Value', 'Unit', 'Uncertainty', 'Measured at', 'Instrument'];
    const rows: string[][] = [];
    for (const rawStudy of project.studies) {
      if (!rawStudy || typeof rawStudy !== 'object' || Array.isArray(rawStudy)) continue;
      const study = rawStudy as { title?: unknown; assays?: unknown; instruments?: unknown };
      if (typeof study.title !== 'string' || !Array.isArray(study.assays)) continue;
      const instruments = new Map<string, string>();
      if (Array.isArray(study.instruments)) {
        for (const rawInstrument of study.instruments) {
          if (!rawInstrument || typeof rawInstrument !== 'object' || Array.isArray(rawInstrument)) continue;
          const instrument = rawInstrument as { id?: unknown; name?: unknown; model?: unknown };
          if (typeof instrument.id === 'string') instruments.set(instrument.id, typeof instrument.name === 'string' && instrument.name ? instrument.name : typeof instrument.model === 'string' ? instrument.model : instrument.id);
        }
      }
      for (const rawAssay of study.assays) {
        if (!rawAssay || typeof rawAssay !== 'object' || Array.isArray(rawAssay)) continue;
        const assay = rawAssay as { title?: unknown; technology?: unknown; materialReferences?: unknown; measurements?: unknown };
        if (!Array.isArray(assay.measurements)) continue;
        for (const rawMeasurement of assay.measurements) {
          if (!rawMeasurement || typeof rawMeasurement !== 'object' || Array.isArray(rawMeasurement)) continue;
          const measurement = rawMeasurement as { name?: unknown; value?: unknown; unit?: unknown; uncertainty?: unknown; measuredAt?: unknown; instrumentId?: unknown };
          if (typeof measurement.value !== 'string' || measurement.value.trim() === '' || !Number.isFinite(Number(measurement.value))) continue;
          rows.push([
            project.title,
            study.title,
            typeof assay.title === 'string' ? assay.title : '',
            typeof assay.technology === 'string' ? assay.technology : '',
            typeof assay.materialReferences === 'string' ? assay.materialReferences : '',
            typeof measurement.name === 'string' ? measurement.name : '',
            measurement.value,
            typeof measurement.unit === 'string' ? measurement.unit : '',
            typeof measurement.uncertainty === 'string' ? measurement.uncertainty : '',
            typeof measurement.measuredAt === 'string' ? measurement.measuredAt : '',
            typeof measurement.instrumentId === 'string' ? instruments.get(measurement.instrumentId) ?? measurement.instrumentId : '',
          ]);
        }
      }
    }
    return rows.length ? { projectTitle: project.title, columns, rows } : null;
  } catch {
    return null;
  }
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

export type StatisticalAnalysisResult = {
  numericColumns: { name: string; index: number }[];
  groupingColumns: { name: string; index: number; values: string[] }[];
  values: number[];
  summary: DescriptiveSummary | null;
  groups: { label: string; values: number[] }[];
  tTest: MeanComparison | null;
  anova: AnovaResult | null;
  regression: LinearRegressionResult | null;
  histogram: number[];
  maxBin: number;
};

export function analyzeStatisticalDataset(dataset: StatisticalDataset, configuration: StatisticalWorkspace['configuration']): StatisticalAnalysisResult {
  const numericColumns = dataset.columns.flatMap((name, index) => numericColumnValues(dataset.rows, index).length >= 2 ? [{ name, index }] : []);
  const groupingColumns = dataset.columns.map((name, index) => ({
    name, index, values: [...new Set(dataset.rows.map(row => row[index]?.trim()).filter((value): value is string => Boolean(value)))],
  })).filter(column => column.values.length > 1 && column.values.length <= 20);
  const valueColumn = numericColumns.find(column => String(column.index) === configuration.valueColumn) ?? numericColumns[0];
  const xColumn = numericColumns.find(column => String(column.index) === configuration.regressionX) ?? numericColumns[0];
  const yColumn = numericColumns.find(column => String(column.index) === configuration.regressionY) ?? numericColumns[1];
  const groupColumn = groupingColumns.find(column => String(column.index) === configuration.groupColumn) ?? groupingColumns[0];
  const values = valueColumn ? numericColumnValues(dataset.rows, valueColumn.index) : [];
  const groups = valueColumn && groupColumn
    ? groupColumn.values.map(label => ({
      label,
      values: dataset.rows.flatMap(row => row[groupColumn.index]?.trim() === label
        ? [parseFiniteNumber(row[valueColumn.index])]
        : []).filter(Number.isFinite),
    })).filter(group => group.values.length >= 2)
    : [];
  const tTest = groups.length === 2 ? welchTTest(groups[0]!.values, groups[1]!.values) : null;
  const anova = groups.length >= 2 ? oneWayAnova(groups.map(group => group.values)) : null;
  const regression = xColumn && yColumn && xColumn.index !== yColumn.index
    ? linearRegression(dataset.rows.map(row => parseFiniteNumber(row[xColumn.index])), dataset.rows.map(row => parseFiniteNumber(row[yColumn.index])))
    : null;
  const min = values.length ? values.reduce((a,b) => Math.min(a,b), Infinity) : 0;
  const max = values.length ? values.reduce((a,b) => Math.max(a,b), -Infinity) : 0;
  const histogram = values.length ? Array.from({ length: 10 }, () => 0) : [];
  if (values.length && min === max) histogram[0] = values.length;
  else for (const value of values) histogram[Math.min(9, Math.floor((value - min) / (max - min) * 10))]! += 1;
  return { numericColumns, groupingColumns, values, summary: describe(values), groups, tTest, anova, regression, histogram, maxBin: histogram.reduce((a,b) => Math.max(a,b), 1) };
}

function parseFiniteNumber(value: string | undefined): number {
  if (value === undefined || value.trim() === '') return Number.NaN;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
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

function isExperimentalDesign(value: unknown): value is ExperimentalDesign {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const design = value as Partial<ExperimentalDesign>;
  return ['hypothesis', 'primaryOutcome', 'analysisPlan', 'randomizationSeed'].every(key => typeof design[key as keyof ExperimentalDesign] === 'string')
    && Array.isArray(design.groups) && design.groups.every(item => typeof item === 'string')
    && Array.isArray(design.inclusionCriteria) && design.inclusionCriteria.every(item => typeof item === 'string')
    && Array.isArray(design.exclusionCriteria) && design.exclusionCriteria.every(item => typeof item === 'string')
    && Array.isArray(design.deviations) && design.deviations.every(item => Boolean(item && typeof item.date === 'string' && typeof item.description === 'string'))
    && typeof design.alpha === 'number' && typeof design.power === 'number' && typeof design.standardizedEffect === 'number'
    && (design.preregisteredAt === null || typeof design.preregisteredAt === 'string')
    && (design.preregisteredSnapshot === null || typeof design.preregisteredSnapshot === 'string');
}

export function isStatisticalWorkspace(value: unknown): value is StatisticalWorkspace {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Partial<StatisticalWorkspace>;
  if (candidate.schemaVersion !== 1 || typeof candidate.analysisTitle !== 'string') return false;
  if (candidate.design !== undefined && !isExperimentalDesign(candidate.design)) return false;
  const configuration = candidate.configuration as StatisticalWorkspace['configuration'] | undefined;
  if (!configuration || !['valueColumn', 'groupColumn', 'regressionX', 'regressionY'].every((key) => typeof configuration[key as keyof typeof configuration] === 'string')) return false;
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
    if (!isStatisticalWorkspace(value)) return null;\n    return { ...value, design: value.design ?? createExperimentalDesign() };
  } catch {
    return null;
  }
}
