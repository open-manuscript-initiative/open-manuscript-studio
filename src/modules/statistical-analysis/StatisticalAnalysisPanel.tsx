import { getResearchModuleCopyByLocale } from '../moduleTranslationCatalog';
import { normalizeModuleLocale } from '../moduleLocale';
import { useEffect, useRef, useState } from 'react';
import { downloadWorkspaceJson, safeWorkspaceFileName } from '../disciplineWorkspace';
import { ResearchCatalogSearchPanel } from '../ResearchCatalogSearchPanel';
import { EU_NSI_CATALOGS } from '../researchCatalogPreferences';
import { useIndexedStatisticalWorkspace } from './workspaceStorage';
import {
  addDesignDeviation,
  analyzeStatisticalDataset,
  createExperimentalDesign,
  describe,
  estimateTwoGroupSampleSize,
  formatStat,
  newStatisticalId,
  parseDelimited,
  parseLaboratoryMeasurements,
  parseStatisticalWorkspace,
  preregisterDesign,
  randomizeParticipants,
  type StatisticalDataset,
} from './model';
import '../disciplineWorkspaces.css';

const copy = getResearchModuleCopyByLocale('statistical-analysis-statistical-analysis-panel/copy');

export function StatisticalAnalysisPanel({ locale = 'en', storageKey = 'statistical-analysis' }: { locale?: string; storageKey?: string }) {
  const t = copy[normalizeModuleLocale(locale)];
  const language = normalizeModuleLocale(locale);
  const [workspace, setWorkspace, storageReady, storageError] = useIndexedStatisticalWorkspace(storageKey);
  const [error, setError] = useState('');
  useEffect(() => { if (!workspace.design) setWorkspace(current => ({ ...current, design: createExperimentalDesign() })); }, [workspace.design, setWorkspace]);
  const [participantCount, setParticipantCount] = useState(20);
  const [assignments, setAssignments] = useState<{ id: string; group: string }[]>([]);
  const [deviationText, setDeviationText] = useState('');
  const csvRef = useRef<HTMLInputElement>(null);
  const labRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);
  const dataset = workspace.dataset;
  const design = workspace.design ?? createExperimentalDesign();
  const sampleSize = estimateTwoGroupSampleSize(design.alpha, design.power, design.standardizedEffect);
  const locked = Boolean(design.preregisteredSnapshot);

  const [analysis, setAnalysis] = useState<ReturnType<typeof analyzeStatisticalDataset> | null>(null);
  useEffect(() => {
    if (!dataset) { setAnalysis(null); return; }
    if (typeof Worker === 'undefined') {
      setAnalysis(analyzeStatisticalDataset(dataset, workspace.configuration));
      return;
    }
    const worker = new Worker(new URL('./analyze.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = event => setAnalysis(event.data as ReturnType<typeof analyzeStatisticalDataset>);
    worker.onerror = () => setAnalysis(analyzeStatisticalDataset(dataset, workspace.configuration));
    worker.postMessage([dataset, workspace.configuration]);
    return () => worker.terminate();
  }, [dataset, workspace.configuration]);

  const numericColumns = analysis?.numericColumns ?? [];
  const groupingColumns = analysis?.groupingColumns ?? [];
  const valueColumn = numericColumns.find(column => String(column.index) === workspace.configuration.valueColumn) ?? numericColumns[0];
  const xColumn = numericColumns.find(column => String(column.index) === workspace.configuration.regressionX) ?? numericColumns[0];
  const yColumn = numericColumns.find(column => String(column.index) === workspace.configuration.regressionY) ?? numericColumns[1];
  const groupColumn = groupingColumns.find(column => String(column.index) === workspace.configuration.groupColumn) ?? groupingColumns[0];
  const summary = analysis?.summary ?? null;
  const groups = analysis?.groups ?? [];
  const tTest = analysis?.tTest ?? null;
  const anova = analysis?.anova ?? null;
  const regression = analysis?.regression ?? null;
  const histogram = analysis?.histogram ?? [];
  const maxBin = analysis?.maxBin ?? 1;
  const report = {
    ...workspace,
    schemaVersion: 1,
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
      const text = await file.text();
      const parsed = typeof Worker === 'undefined' ? parseDelimited(text) : await new Promise<ReturnType<typeof parseDelimited>>(resolve => {
        const worker = new Worker(new URL('./parse.worker.ts', import.meta.url), { type: 'module' });
        worker.onmessage = event => { worker.terminate(); resolve(event.data as ReturnType<typeof parseDelimited>); };
        worker.onerror = () => { worker.terminate(); resolve(parseDelimited(text)); };
        worker.postMessage({ text });
      });
      if (!parsed) { setError(t.csvError); return; }
      const nextDataset: StatisticalDataset = {
        id: newStatisticalId(),
        title: file.name.replace(/\.(csv|tsv)$/i, ''),
        sourceStudy: '',
        importedAt: new Date().toISOString(),
        columns: parsed.columns,
        rows: parsed.rows,
      };
      setWorkspace({ schemaVersion: 1, dataset: nextDataset, analysisTitle: '', configuration: { valueColumn: '', groupColumn: '', regressionX: '', regressionY: '' }, design: createExperimentalDesign() });
      setError('');
    } catch {
      setError(t.csvError);
    }
  }

  async function importLaboratory(file?: File): Promise<void> {
    if (!file) return;
    try {
      const imported = parseLaboratoryMeasurements(await file.text());
      if (!imported) { setError(t.labError); return; }
      setWorkspace({
        schemaVersion: 1,
        dataset: {
          id: newStatisticalId(),
          title: imported.projectTitle + ' — measurements',
          sourceStudy: imported.projectTitle,
          importedAt: new Date().toISOString(),
          columns: imported.columns,
          rows: imported.rows,
        },
        analysisTitle: '',
        configuration: { valueColumn: '', groupColumn: '', regressionX: '', regressionY: '' },
        design: createExperimentalDesign(),
      });
      setError('');
    } catch {
      setError(t.labError);
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
      <div><button type="button" onClick={() => jsonRef.current?.click()} disabled={!storageReady}>{t.importJson}</button> <button type="button" disabled={!dataset} onClick={() => downloadWorkspaceJson(safeWorkspaceFileName(workspace.analysisTitle || dataset?.title || '', 'statistical-analysis') + '.json', report)}>{t.export}</button></div>
      <input ref={jsonRef} className="discipline-file" type="file" accept=".json,application/json" onChange={event => { void importJson(event.target.files?.[0]); event.currentTarget.value = ''; }} />
    </header>
    <section className="discipline-workspace__section">
      <div className="discipline-workspace__section-title"><h2>{t.dataset}</h2><div><button type="button" onClick={() => csvRef.current?.click()} disabled={!storageReady}>{t.importCsv}</button> <button type="button" onClick={() => labRef.current?.click()} disabled={!storageReady}>{t.importLab}</button> {dataset && <button type="button" className="discipline-workspace__danger" disabled={!storageReady} onClick={() => { setWorkspace({ schemaVersion: 1, dataset: null, analysisTitle: '', configuration: { valueColumn: '', groupColumn: '', regressionX: '', regressionY: '' }, design: createExperimentalDesign() }); setError(''); }}>{t.removeData}</button>}</div></div>
      <input ref={csvRef} className="discipline-file" type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" onChange={event => { void importCsv(event.target.files?.[0]); event.currentTarget.value = ''; }} />
      <input ref={labRef} className="discipline-file" type="file" accept=".json,application/json" onChange={event => { void importLaboratory(event.target.files?.[0]); event.currentTarget.value = ''; }} />
      {dataset ? <>
        <div className="discipline-workspace__grid">
          <label>{t.titleField}<input value={workspace.analysisTitle} onChange={event => setWorkspace(current => ({ ...current, analysisTitle: event.target.value }))} /></label>
          <label>{t.dataset}<input value={dataset.title} onChange={event => setWorkspace(current => ({ ...current, dataset: current.dataset ? { ...current.dataset, title: event.target.value } : null }))} /></label>
          <label>{t.sourceStudy}<input value={dataset.sourceStudy} onChange={event => setWorkspace(current => ({ ...current, dataset: current.dataset ? { ...current.dataset, sourceStudy: event.target.value } : null }))} /></label>
        </div>
        <p className="discipline-workspace__hint">{dataset.rows.length} {t.rows} · {dataset.columns.length} {t.columns}</p>
      </> : <p className="discipline-workspace__hint">{t.noDataset}</p>}
      <p className="discipline-workspace__hint">{t.local}</p>
      {!storageReady && <p role="status">{language === 'de' ? 'Datensatz wird geladen …' : language === 'hu' ? 'Adatkészlet betöltése…' : 'Loading dataset…'}</p>}
      {storageError && <p role="alert">{storageError}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
    {dataset && <>
      <section className="discipline-workspace__section">
        <h2>{t.design}</h2>
        {design.preregisteredAt && <p role="status">{t.frozen}: {new Date(design.preregisteredAt).toLocaleString()}</p>}
        <div className="discipline-workspace__grid">
          <label>{t.hypothesis}<textarea value={design.hypothesis} disabled={locked} onChange={event => setWorkspace(current => ({ ...current, design: { ...current.design, hypothesis: event.target.value } }))} /></label>
          <label>{t.outcome}<input value={design.primaryOutcome} disabled={locked} onChange={event => setWorkspace(current => ({ ...current, design: { ...current.design, primaryOutcome: event.target.value } }))} /></label>
          <label>{t.groupsPlan}<input value={design.groups.join(', ')} disabled={locked} onChange={event => setWorkspace(current => ({ ...current, design: { ...current.design, groups: event.target.value.split(',').map(value => value.trim()).filter(Boolean) } }))} /></label>
          <label>{t.alpha}<input type="number" min="0.001" max="0.2" step="0.001" value={design.alpha} disabled={locked} onChange={event => setWorkspace(current => ({ ...current, design: { ...current.design, alpha: Number(event.target.value) } }))} /></label>
          <label>{t.power}<input type="number" min="0.51" max="0.99" step="0.01" value={design.power} disabled={locked} onChange={event => setWorkspace(current => ({ ...current, design: { ...current.design, power: Number(event.target.value) } }))} /></label>
          <label>{t.effect}<input type="number" min="0.01" step="0.05" value={design.standardizedEffect} disabled={locked} onChange={event => setWorkspace(current => ({ ...current, design: { ...current.design, standardizedEffect: Number(event.target.value) } }))} /></label>
        </div>
        <p>{t.sampleEstimate}: <strong>{sampleSize ?? '—'}</strong></p><p className="discipline-workspace__hint">{t.estimateNote}</p>
        <div className="discipline-workspace__grid">
          <label>{t.inclusion}<textarea value={design.inclusionCriteria.join('\n')} disabled={locked} onChange={event => setWorkspace(current => ({ ...current, design: { ...current.design, inclusionCriteria: event.target.value.split('\n') } }))} /></label>
          <label>{t.exclusion}<textarea value={design.exclusionCriteria.join('\n')} disabled={locked} onChange={event => setWorkspace(current => ({ ...current, design: { ...current.design, exclusionCriteria: event.target.value.split('\n') } }))} /></label>
          <label>{t.analysisPlan}<textarea value={design.analysisPlan} disabled={locked} onChange={event => setWorkspace(current => ({ ...current, design: { ...current.design, analysisPlan: event.target.value } }))} /></label>
          <label>{t.seed}<input value={design.randomizationSeed} disabled={locked} onChange={event => setWorkspace(current => ({ ...current, design: { ...current.design, randomizationSeed: event.target.value } }))} /></label>
        </div>
        {!locked && <button type="button" disabled={!design.hypothesis.trim() || !design.primaryOutcome.trim() || !design.analysisPlan.trim()} onClick={() => setWorkspace(current => ({ ...current, design: preregisterDesign(current.design) }))}>{t.freeze}</button>}
        <hr />
        <label>{t.participantCount}<input type="number" min="1" max="100000" value={participantCount} onChange={event => setParticipantCount(Math.max(1, Math.min(100000, Number(event.target.value) || 1)))} /></label>
        <button type="button" disabled={design.groups.length < 2} onClick={() => setAssignments(randomizeParticipants(Array.from({ length: participantCount }, (_, index) => 'P' + String(index + 1).padStart(4, '0')), design.groups, design.randomizationSeed))}>{t.randomize}</button>
        <p className="discipline-workspace__hint">{t.randomizationNote}</p>
        {assignments.length > 0 && <><button type="button" onClick={() => { const csv = ['id,group', ...assignments.map(item => JSON.stringify(item.id) + ',' + JSON.stringify(item.group))].join('\n'); const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = 'randomization-assignments.csv'; link.click(); URL.revokeObjectURL(url); }}>{t.downloadAssignments}</button><div className="discipline-table-wrap"><table className="discipline-table"><thead><tr><th>ID</th><th>{t.groups}</th></tr></thead><tbody>{assignments.slice(0, 50).map(item => <tr key={item.id}><td>{item.id}</td><td>{item.group}</td></tr>)}</tbody></table></div></>}
        {locked && <><label>{t.deviation}<textarea value={deviationText} onChange={event => setDeviationText(event.target.value)} /></label><button type="button" disabled={!deviationText.trim()} onClick={() => { setWorkspace(current => ({ ...current, design: addDesignDeviation(current.design, deviationText) })); setDeviationText(''); }}>{t.addDeviation}</button><h3>{t.deviations}</h3><ul>{design.deviations.map((item,index) => <li key={index}>{item.date}: {item.description}</li>)}</ul></>}
      </section>
      <section className="discipline-workspace__section">
        <div className="discipline-workspace__section-title"><h2>{t.descriptive}</h2><label>{t.valueColumn}<select value={valueColumn?.index ?? ''} onChange={event => setWorkspace(current => ({ ...current, configuration: { ...current.configuration, valueColumn: event.target.value } }))}>{numericColumns.map(column => <option key={column.index} value={column.index}>{column.name}</option>)}</select></label></div>
        {summary ? <>
          <div className="discipline-table-wrap"><table className="discipline-table"><thead><tr>{[t.n,t.mean,t.median,t.sd,t.minimum,t.q1,t.q3,t.maximum].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody><tr>{[summary.n,formatStat(summary.mean),formatStat(summary.median),formatStat(summary.standardDeviation),formatStat(summary.minimum),formatStat(summary.q1),formatStat(summary.q3),formatStat(summary.maximum)].map((value,index) => <td key={index}>{value}</td>)}</tr></tbody></table></div>
          <p>{t.ci}: [{formatStat(summary.confidenceLow)}, {formatStat(summary.confidenceHigh)}]</p>
          <h3>{t.histogram}</h3><div role="img" aria-label={t.histogram} style={{ display: 'flex', alignItems: 'end', gap: '.25rem', height: '9rem', maxWidth: '38rem', borderBottom: '1px solid var(--studio-border,#d8dce3)' }}>{histogram.map((count,index) => <div key={index} title={`${t.count}: ${count}`} style={{ flex: 1, height: `${Math.max(2, count / maxBin * 100)}%`, background: 'var(--studio-accent,#3949ab)', opacity: .75 }} />)}</div>
        </> : <p>{t.noNumeric}</p>}
      </section>
      <section className="discipline-workspace__section">
        <h2>{t.comparison}</h2>
        {groupColumn && <label>{t.groupColumn}<select value={groupColumn.index} onChange={event => setWorkspace(current => ({ ...current, configuration: { ...current.configuration, groupColumn: event.target.value } }))}>{groupingColumns.map(column => <option key={column.index} value={column.index}>{column.name}</option>)}</select></label>}
        {tTest && <div><h3>{t.groups}: {groups[0]!.label} / {groups[1]!.label}</h3><p>{t.meanDifference}: {formatStat(tTest.meanDifference)} · {t.t}: {formatStat(tTest.statistic)} · {t.df}: {formatStat(tTest.degreesOfFreedom)} · {t.p}: {formatStat(tTest.pValue, 6)}</p><p>{t.ci}: [{formatStat(tTest.confidenceLow)}, {formatStat(tTest.confidenceHigh)}]</p></div>}
        {anova && groups.length >= 2 && <div><h3>{t.anova}</h3><p>{t.f}: {formatStat(anova.fStatistic)} · {t.dfBetween}: {anova.degreesOfFreedomBetween} · {t.dfWithin}: {anova.degreesOfFreedomWithin} · {t.p}: {formatStat(anova.pValue, 6)}</p></div>}
        {groupColumn && groups.length < 2 && <p>{t.noComparison}</p>}
      </section>
      <section className="discipline-workspace__section">
        <h2>{t.regression}</h2>
        <div className="discipline-workspace__grid"><label>{t.x}<select value={xColumn?.index ?? ''} onChange={event => setWorkspace(current => ({ ...current, configuration: { ...current.configuration, regressionX: event.target.value } }))}>{numericColumns.map(column => <option key={column.index} value={column.index}>{column.name}</option>)}</select></label><label>{t.y}<select value={yColumn?.index ?? ''} onChange={event => setWorkspace(current => ({ ...current, configuration: { ...current.configuration, regressionY: event.target.value } }))}>{numericColumns.map(column => <option key={column.index} value={column.index}>{column.name}</option>)}</select></label></div>
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
    <ResearchCatalogSearchPanel catalogs={['eurostat', ...EU_NSI_CATALOGS]} defaultVisibleCatalogs={['eurostat']} locale={locale} storageKey={`${storageKey}:statistics`} />
  </main>;
}
