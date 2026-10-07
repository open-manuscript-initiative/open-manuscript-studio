import { useMemo, useRef, useState } from 'react';
import { downloadWorkspaceJson, safeWorkspaceFileName, useLocalWorkspace } from '../disciplineWorkspace';
import {
  createStatisticalWorkspace,
  describe,
  formatStat,
  isStatisticalWorkspace,
  linearRegression,
  newStatisticalId,
  numericColumnValues,
  oneWayAnova,
  parseDelimited,
  parseStatisticalWorkspace,
  welchTTest,
  type StatisticalDataset,
  type StatisticalWorkspace,
} from './model';
import '../disciplineWorkspaces.css';

type Locale = 'hu' | 'en' | 'de';
const copy = {
  hu: {
    title: 'Statisztikai és adatelemzés',
    intro: 'Táblázatos kutatási adatok leíró és összehasonlító elemzése, lineáris regressziója és megismételhető jelentése.',
    local: 'Az adatkészlet és a beállítások ezen az eszközön tárolódnak. A fájl tartalmát nem töltjük fel. Érzékeny vagy személyes adatot csak anonimizálás után importáljon.',
    sourceStudy: 'Kapcsolódó kutatás / kísérlet',
    titleField: 'Elemzés címe',
    importCsv: 'CSV / TSV importálása',
    importJson: 'Elemzés JSON importálása',
    export: 'Elemzés és adatok exportálása JSON-ként',
    dataset: 'Adatkészlet',
    noDataset: 'Importáljon fejlécsort és adatsorokat tartalmazó CSV- vagy TSV-fájlt.',
    rows: 'sor',
    columns: 'változó',
    preview: 'Adatelőnézet (első 15 sor)',
    column: 'Változó',
    n: 'Érvényes elemszám',
    mean: 'Átlag',
    median: 'Medián',
    sd: 'Mintaszórás',
    minimum: 'Minimum',
    q1: '1. kvartilis',
    q3: '3. kvartilis',
    maximum: 'Maximum',
    ci: '95%-os konfidenciaintervallum az átlagra',
    descriptive: 'Leíró statisztika',
    valueColumn: 'Vizsgált numerikus változó',
    histogram: 'Adateloszlás (hisztogram)',
    groupColumn: 'Csoportosító változó',
    comparison: 'Csoportok összehasonlítása',
    groups: 'Csoportok',
    meanDifference: 'Átlagkülönbség (1. − 2.)',
    t: 'Welch-féle t',
    df: 'Szabadságfok',
    p: 'Kétoldali p-érték',
    anova: 'Egyszempontos ANOVA',
    f: 'F-statisztika',
    dfBetween: 'Csoportok közötti szabadságfok',
    dfWithin: 'Csoporton belüli szabadságfok',
    regression: 'Lineáris regresszió (OLS)',
    x: 'Magyarázó változó (X)',
    y: 'Eredményváltozó (Y)',
    slope: 'Meredekség',
    intercept: 'Tengelymetszet',
    r: 'Pearson-korreláció (r)',
    r2: 'Megmagyarázott variancia (R²)',
    methods: 'Módszertani megjegyzés',
    methodNote: 'A t-próba Welch-féle, kétoldali változat; nem feltételez azonos csoportvarianciát. Az ANOVA hagyományos egyszempontos modell. Az OLS lineáris regresszió feltételezéseit, a hiányzó adatokat és a többszörös tesztelést a kutatónak kell mérlegelnie.',
    unsupported: 'A fájl nem érvényes OMI statisztikai munkatér vagy nem támogatott verzió.',
    csvError: 'A CSV/TSV nem olvasható: ellenőrizze a fejlécet, az idézőjeleket és a sorok oszlopszámát.',
    jsonError: 'Az OMI statisztikai JSON nem érvényes.',
    count: 'Elemszám',
    noNumeric: 'A kiválasztott oszlopban nincs elegendő érvényes numerikus adat.',
    noComparison: 'Csoportonként legalább két érvényes numerikus érték szükséges.',
    removeData: 'Adatkészlet eltávolítása',
  },
  en: {
    title: 'Statistical Analysis and Data',
    intro: 'Explore tabular research data with descriptive statistics, group comparisons, linear regression, and reproducible reports.',
    local: 'The dataset and settings stay on this device. File contents are not uploaded. Anonymize sensitive or personal data before importing.',
    sourceStudy: 'Related research / experiment',
    titleField: 'Analysis title',
    importCsv: 'Import CSV / TSV',
    importJson: 'Import analysis JSON',
    export: 'Export analysis and data as JSON',
    dataset: 'Dataset',
    noDataset: 'Import a CSV or TSV file with a header row and data rows.',
    rows: 'rows',
    columns: 'variables',
    preview: 'Data preview (first 15 rows)',
    column: 'Variable',
    n: 'Valid sample size',
    mean: 'Mean',
    median: 'Median',
    sd: 'Sample standard deviation',
    minimum: 'Minimum',
    q1: '1st quartile',
    q3: '3rd quartile',
    maximum: 'Maximum',
    ci: '95% confidence interval for the mean',
    descriptive: 'Descriptive statistics',
    valueColumn: 'Numeric variable',
    histogram: 'Distribution (histogram)',
    groupColumn: 'Grouping variable',
    comparison: 'Group comparison',
    groups: 'Groups',
    meanDifference: 'Mean difference (1 − 2)',
    t: "Welch's t",
    df: 'Degrees of freedom',
    p: 'Two-sided p-value',
    anova: 'One-way ANOVA',
    f: 'F statistic',
    dfBetween: 'Between-group degrees of freedom',
    dfWithin: 'Within-group degrees of freedom',
    regression: 'Linear regression (OLS)',
    x: 'Predictor (X)',
    y: 'Outcome (Y)',
    slope: 'Slope',
    intercept: 'Intercept',
    r: 'Pearson correlation (r)',
    r2: 'Explained variance (R²)',
    methods: 'Method note',
    methodNote: "The t-test is Welch's two-sided test and does not assume equal group variances. ANOVA is the conventional one-way model. Researchers should assess OLS assumptions, missing data, and multiple testing.",
    unsupported: 'This is not a valid OMI statistical workspace or the version is unsupported.',
    csvError: 'Could not read the CSV/TSV. Check the header, quotes, and consistent column counts.',
    jsonError: 'The OMI statistical JSON is invalid.',
    count: 'Count',
    noNumeric: 'The selected column has too few valid numeric values.',
    noComparison: 'Each group needs at least two valid numeric values.',
    removeData: 'Remove dataset',
  },
  de: {
    title: 'Statistik und Datenanalyse',
    intro: 'Tabellarische Forschungsdaten deskriptiv auswerten, Gruppen vergleichen, linear regressieren und Ergebnisse reproduzierbar dokumentieren.',
    local: 'Datensatz und Einstellungen bleiben auf diesem Gerät. Dateiinhalte werden nicht hochgeladen. Sensible oder personenbezogene Daten vor dem Import anonymisieren.',
    sourceStudy: 'Zugehörige Forschung / Untersuchung',
    titleField: 'Analysetitel',
    importCsv: 'CSV / TSV importieren',
    importJson: 'Analyse-JSON importieren',
    export: 'Analyse und Daten als JSON exportieren',
    dataset: 'Datensatz',
    noDataset: 'Importieren Sie eine CSV- oder TSV-Datei mit Kopf- und Datenzeilen.',
    rows: 'Zeilen',
    columns: 'Variablen',
    preview: 'Datenvorschau (erste 15 Zeilen)',
    column: 'Variable',
    n: 'Gültige Fallzahl',
    mean: 'Mittelwert',
    median: 'Median',
    sd: 'Stichprobenstandardabweichung',
    minimum: 'Minimum',
    q1: '1. Quartil',
    q3: '3. Quartil',
    maximum: 'Maximum',
    ci: '95%-Konfidenzintervall des Mittelwerts',
    descriptive: 'Deskriptive Statistik',
    valueColumn: 'Numerische Variable',
    histogram: 'Verteilung (Histogramm)',
    groupColumn: 'Gruppierungsvariable',
    comparison: 'Gruppenvergleich',
    groups: 'Gruppen',
    meanDifference: 'Mittelwertdifferenz (1 − 2)',
    t: 'Welch-t',
    df: 'Freiheitsgrade',
    p: 'Zweiseitiger p-Wert',
    anova: 'Einfaktorielle ANOVA',
    f: 'F-Statistik',
    dfBetween: 'Freiheitsgrade zwischen Gruppen',
    dfWithin: 'Freiheitsgrade innerhalb der Gruppen',
    regression: 'Lineare Regression (OLS)',
    x: 'Prädiktor (X)',
    y: 'Zielvariable (Y)',
    slope: 'Steigung',
    intercept: 'Achsenabschnitt',
    r: 'Pearson-Korrelation (r)',
    r2: 'Erklärte Varianz (R²)',
    methods: 'Methodischer Hinweis',
    methodNote: 'Der t-Test ist zweiseitig nach Welch und setzt keine gleichen Gruppenvarianzen voraus. Die ANOVA ist ein klassisches einfaktorielles Modell. OLS-Annahmen, fehlende Daten und multiples Testen sind zu prüfen.',
    unsupported: 'Kein gültiger OMI-Statistikarbeitsbereich oder nicht unterstützte Version.',
    csvError: 'CSV/TSV nicht lesbar: Kopfzeile, Anführungszeichen und einheitliche Spaltenzahl prüfen.',
    jsonError: 'Das OMI-Statistik-JSON ist ungültig.',
    count: 'Anzahl',
    noNumeric: 'Die ausgewählte Spalte enthält zu wenige gültige numerische Werte.',
    noComparison: 'Jede Gruppe benötigt mindestens zwei gültige numerische Werte.',
    removeData: 'Datensatz entfernen',
  },
} as const;

type Copy = typeof copy.en;

function cellNumber(value: string | undefined): number {
  if (value === undefined || value.trim() === '') return Number.NaN;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function StatisticalAnalysisPanel({ locale = 'hu', storageKey = 'statistical-analysis' }: { locale?: string; storageKey?: string }) {
  const t: Copy = copy[locale as Locale] ?? copy.hu;
  const [workspace, setWorkspace] = useLocalWorkspace<StatisticalWorkspace>(storageKey, createStatisticalWorkspace, isStatisticalWorkspace);
  const [error, setError] = useState('');
  const csvRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);
  const dataset = workspace.dataset;

  const numericColumns = useMemo(() => dataset?.columns.flatMap((name, index) => {
    const count = numericColumnValues(dataset.rows, index).filter(Number.isFinite).length;
    return count >= 2 ? [{ name, index }] : [];
  }) ?? [], [dataset]);
  const valueColumn = numericColumns[0];
  const xColumn = numericColumns[0];
  const yColumn = numericColumns[1] ?? numericColumns[0];
  const groupColumn = dataset?.columns.map((name, index) => ({
    name,
    index,
    values: [...new Set(dataset.rows.map(row => row[index]?.trim()).filter((value): value is string => Boolean(value)))],
  })).find(column => column.values.length > 1);
  const values = dataset && valueColumn ? numericColumnValues(dataset.rows, valueColumn.index).filter(Number.isFinite) : [];
  const summary = describe(values);
  const groups = dataset && valueColumn && groupColumn
    ? groupColumn.values.map(group => ({
      label: group,
      values: dataset.rows.flatMap(row => row[groupColumn.index]?.trim() === group
        ? [cellNumber(row[valueColumn.index])]
        : []).filter(Number.isFinite),
    })).filter(group => group.values.length >= 2)
    : [];
  const tTest = groups.length === 2 ? welchTTest(groups[0]!.values, groups[1]!.values) : null;
  const anova = groups.length >= 2 ? oneWayAnova(groups.map(group => group.values)) : null;
  const regression = dataset && xColumn && yColumn
    ? linearRegression(
      dataset.rows.map(row => cellNumber(row[xColumn.index])),
      dataset.rows.map(row => cellNumber(row[yColumn.index])),
    )
    : null;
  const histogram = useMemo(() => {
    if (!values.length) return [];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const bins = Array.from({ length: 10 }, () => 0);
    if (min === max) { bins[0] = values.length; return bins; }
    for (const value of values) bins[Math.min(9, Math.floor((value - min) / (max - min) * 10))]! += 1;
    return bins;
  }, [dataset, valueColumn?.index]);
  const maxBin = Math.max(1, ...histogram);
  const report = {
    schema: 'omi-statistical-analysis/1',
    generatedAt: new Date().toISOString(),
    analysisTitle: workspace.analysisTitle,
    dataset,
    methods: {
      descriptive: valueColumn?.name,
      independentGroupTest: tTest ? 'Welch two-sided t-test' : null,
      multiGroupTest: anova ? 'One-way ANOVA' : null,
      regression: regression ? 'Ordinary least squares linear regression' : null,
      confidenceInterval: 'Two-sided 95% Student t interval for mean',
    },
    results: { descriptive: summary, groups: groups.map(({ label, values }) => ({ label, n: values.length, mean: describe(values)?.mean })), tTest, anova, regression },
    caveat: 'Analysis output does not replace study design, assumption checks, missing-data assessment, or multiple-testing correction.',
  };

  async function importCsv(file?: File): Promise<void> {
    if (!file) return;
    try {
      const parsed = parseDelimited(await file.text());
      if (!parsed) { setError(t.csvError); return; }
      const nextDataset: StatisticalDataset = {
        id: newStatisticalId(),
        title: file.name.replace(/\.(csv|tsv)$/i, ''),
        sourceStudy: '',
        importedAt: new Date().toISOString(),
        columns: parsed.columns,
        rows: parsed.rows,
      };
      setWorkspace({ schemaVersion: 1, dataset: nextDataset, analysisTitle: '' });
      setError('');
    } catch {
      setError(t.csvError);
    }
  }

  async function importJson(file?: File): Promise<void> {
    if (!file) return;
    try {
      const parsed = parseStatisticalWorkspace(await file.text());
      if (!parsed) { setError(t.jsonError); return; }
      setWorkspace(parsed);
      setError('');
    } catch {
      setError(t.jsonError);
    }
  }

  return <main className="discipline-workspace">
    <header className="discipline-workspace__header">
      <div><p className="discipline-workspace__eyebrow">OMI Studio</p><h1>{t.title}</h1><p>{t.intro}</p></div>
      <div><button type="button" onClick={() => jsonRef.current?.click()}>{t.importJson}</button> <button type="button" disabled={!dataset} onClick={() => downloadWorkspaceJson(safeWorkspaceFileName(workspace.analysisTitle || dataset?.title || '', 'statistical-analysis') + '.json', report)}>{t.export}</button></div>
      <input ref={jsonRef} className="discipline-file" type="file" accept=".json,application/json" onChange={event => { void importJson(event.target.files?.[0]); event.currentTarget.value = ''; }} />
    </header>
    <section className="discipline-workspace__section">
      <div className="discipline-workspace__section-title"><h2>{t.dataset}</h2><div><button type="button" onClick={() => csvRef.current?.click()}>{t.importCsv}</button> {dataset && <button type="button" className="discipline-workspace__danger" onClick={() => { setWorkspace({ schemaVersion: 1, dataset: null, analysisTitle: '' }); setError(''); }}>{t.removeData}</button>}</div></div>
      <input ref={csvRef} className="discipline-file" type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" onChange={event => { void importCsv(event.target.files?.[0]); event.currentTarget.value = ''; }} />
      {dataset ? <>
        <div className="discipline-workspace__grid">
          <label>{t.titleField}<input value={workspace.analysisTitle} onChange={event => setWorkspace(current => ({ ...current, analysisTitle: event.target.value }))} /></label>
          <label>{t.dataset}<input value={dataset.title} onChange={event => setWorkspace(current => ({ ...current, dataset: current.dataset ? { ...current.dataset, title: event.target.value } : null }))} /></label>
          <label>{t.sourceStudy}<input value={dataset.sourceStudy} onChange={event => setWorkspace(current => ({ ...current, dataset: current.dataset ? { ...current.dataset, sourceStudy: event.target.value } : null }))} /></label>
        </div>
        <p className="discipline-workspace__hint">{dataset.rows.length} {t.rows} · {dataset.columns.length} {t.columns}</p>
      </> : <p className="discipline-workspace__hint">{t.noDataset}</p>}
      <p className="discipline-workspace__hint">{t.local}</p>
      {error && <p role="alert">{error}</p>}
    </section>
    {dataset && <>
      <section className="discipline-workspace__section">
        <div className="discipline-workspace__section-title"><h2>{t.descriptive}</h2><label>{t.valueColumn}<select value={valueColumn?.index ?? ''} disabled>{numericColumns.map(column => <option key={column.index} value={column.index}>{column.name}</option>)}</select></label></div>
        {summary ? <>
          <div className="discipline-table-wrap"><table className="discipline-table"><thead><tr>{[t.n,t.mean,t.median,t.sd,t.minimum,t.q1,t.q3,t.maximum].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody><tr>{[summary.n,formatStat(summary.mean),formatStat(summary.median),formatStat(summary.standardDeviation),formatStat(summary.minimum),formatStat(summary.q1),formatStat(summary.q3),formatStat(summary.maximum)].map((value,index) => <td key={index}>{value}</td>)}</tr></tbody></table></div>
          <p>{t.ci}: [{formatStat(summary.confidenceLow)}, {formatStat(summary.confidenceHigh)}]</p>
          <h3>{t.histogram}</h3><div role="img" aria-label={t.histogram} style={{ display: 'flex', alignItems: 'end', gap: '.25rem', height: '9rem', maxWidth: '38rem', borderBottom: '1px solid var(--studio-border,#d8dce3)' }}>{histogram.map((count,index) => <div key={index} title={`${t.count}: ${count}`} style={{ flex: 1, height: `${Math.max(2, count / maxBin * 100)}%`, background: 'var(--studio-accent,#3949ab)', opacity: .75 }} />)}</div>
        </> : <p>{t.noNumeric}</p>}
      </section>
      <section className="discipline-workspace__section">
        <h2>{t.comparison}</h2>
        {groupColumn && <p>{t.groupColumn}: {groupColumn.name} · {t.groups}: {groups.length}</p>}
        {tTest && <div><h3>{t.groups}: {groups[0]!.label} / {groups[1]!.label}</h3><p>{t.meanDifference}: {formatStat(tTest.meanDifference)} · {t.t}: {formatStat(tTest.statistic)} · {t.df}: {formatStat(tTest.degreesOfFreedom)} · {t.p}: {formatStat(tTest.pValue, 6)}</p><p>{t.ci}: [{formatStat(tTest.confidenceLow)}, {formatStat(tTest.confidenceHigh)}]</p></div>}
        {anova && groups.length >= 2 && <div><h3>{t.anova}</h3><p>{t.f}: {formatStat(anova.fStatistic)} · {t.dfBetween}: {anova.degreesOfFreedomBetween} · {t.dfWithin}: {anova.degreesOfFreedomWithin} · {t.p}: {formatStat(anova.pValue, 6)}</p></div>}
        {groupColumn && groups.length < 2 && <p>{t.noComparison}</p>}
      </section>
      <section className="discipline-workspace__section">
        <h2>{t.regression}</h2>
        {regression ? <div className="discipline-table-wrap"><table className="discipline-table"><tbody>
          <tr><th>{t.x} / {t.y}</th><td>{xColumn?.name} → {yColumn?.name}</td></tr>
          <tr><th>{t.count}</th><td>{regression.n}</td></tr><tr><th>{t.intercept}</th><td>{formatStat(regression.intercept)}</td></tr>
          <tr><th>{t.slope}</th><td>{formatStat(regression.slope)}</td></tr><tr><th>{t.r}</th><td>{formatStat(regression.correlation)}</td></tr>
          <tr><th>{t.r2}</th><td>{formatStat(regression.rSquared)}</td></tr>
        </tbody></table></div> : <p>{t.noNumeric}</p>}
      </section>
      <section className="discipline-workspace__section"><h2>{t.methods}</h2><p className="discipline-workspace__hint">{t.methodNote}</p></section>
      <section className="discipline-workspace__section"><h2>{t.preview}</h2><div className="discipline-table-wrap"><table className="discipline-table"><thead><tr>{dataset.columns.map((column,index) => <th key={index}>{column}</th>)}</tr></thead><tbody>{dataset.rows.slice(0,15).map((row,index) => <tr key={index}>{row.map((value,column) => <td key={column}>{value}</td>)}</tr>)}</tbody></table></div></section>
    </>}
  </main>;
}
