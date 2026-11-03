import { useEffect, useRef, useState } from 'react';
import { useStudioStore } from '../app/useStudioStore';
import { translateCatalog, useTranslation } from '../i18n';
import { getPublicationProfileCopy } from '../i18n/publicationProfile';
import { getValidationProgressCopy } from '../i18n/validationProgress';
import type { OmiPublicationProfileIssueCode } from '../model/publicationProfile';
import { VALIDATION_PROFILES, type ValidationDiagnostic, type ValidationProfile, type ValidationProgress, type ValidationReport, type ValidationSeverity } from '../model/validation';
import { validateStudioManuscript, validationTargetSection } from '../services/manuscriptValidation';
import { serializeValidationReport } from '../services/validationReport';
import { saveExportText } from '../services/exportFileDelivery';
import { getAssetPayload } from '../services/assetRepository';
import type { OmiManuscript } from '../types/omi';
import './ValidationPanel.css';
import { CoreModelReviewPanel } from './CoreModelReviewPanel';
import { ModelSupportPanel } from './ModelSupportPanel';

export function ValidationPanel({ onNavigate }: { onNavigate: () => void }) {
  const { locale } = useTranslation();
  const copy = (key: string) => translateCatalog(locale, `/uncataloguedUi/validationModel/${key}`);
  const progressCopy = getValidationProgressCopy(locale);
  const manuscript = useStudioStore((state) => state.manuscript);
  const [profile, setProfile] = useState<ValidationProfile>('authoring');
  const [result, setResult] = useState<{ report: ValidationReport; source: OmiManuscript } | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ValidationProgress | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [lastDuration, setLastDuration] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<ValidationSeverity | 'all'>('all');
  const [page, setPage] = useState(0);
  const request = useRef(0);
  useEffect(() => {
    if (!busy || startedAt === null) return;
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [busy, startedAt]);
  // Conservative reference comparison is constant-time during typing. Reports
  // are point-in-time observations; an edit or checkpoint asks for another run.
  const stale = !!result && (result.source !== manuscript || result.report.profile !== profile);
  const report = result?.report;

  async function run() {
    const requestId = ++request.current;
    const source = useStudioStore.getState().manuscript;
    const started = Date.now();
    setBusy(true);
    setResult(null);
    setError('');
    setStartedAt(started);
    setElapsed(0);
    setLastDuration(null);
    setProgress({ completed: 0, total: VALIDATION_PROFILES[profile].length, currentCheck: null });
    try {
      // Paint the busy state before the potentially expensive snapshot and hashes.
      await new Promise<void>((resolve) => { window.setTimeout(resolve, 0); });
      const next = await validateStudioManuscript(source, {
        profile,
        loadAsset: getAssetPayload,
        onProgress: (nextProgress) => { if (requestId === request.current) setProgress(nextProgress); },
        // Only check IDs and aggregate timings are logged; no manuscript contents.
        onTiming: (event) => {
          if (import.meta.env.DEV) console.debug('[OMI validation timing]', event.phase, event.checkId ?? '', Math.round(event.durationMs), 'ms');
        },
        yieldBetweenChecks: () => new Promise<void>((resolve) => { window.setTimeout(resolve, 0); }),
      });
      if (requestId === request.current) { setResult({ report: next, source }); setPage(0); }
    } catch { if (requestId === request.current) setError(copy('failed')); }
    finally {
      if (requestId === request.current) {
        setLastDuration(Math.floor((Date.now() - started) / 1000));
        setBusy(false);
        setProgress(null);
      }
    }
  }

  async function exportReport() {
    if (!report || stale || busy) return;
    setError('');
    try { await saveExportText(serializeValidationReport(report), `validation-${report.profile}.json`, 'application/json;charset=utf-8'); }
    catch { setError(copy('failed')); }
  }

  function message(item: ValidationDiagnostic): string {
    if (item.code.startsWith('publication.')) {
      return getPublicationProfileCopy(locale).issueText[item.code.slice('publication.'.length) as OmiPublicationProfileIssueCode];
    }
    return copy(`message-${item.code}`);
  }
  const findings = report?.diagnostics.filter((item) => filter === 'all' || item.severity === filter) ?? [];
  const totalPages = Math.max(1, Math.ceil(findings.length / 20));
  const currentPage = Math.min(page, totalPages - 1);
  return <><section className="panel omi-validation-panel" aria-labelledby="omi-validation-title">
    <h3 id="omi-validation-title">{copy('title')}</h3>
    <p>{copy('description')}</p>
    <p className="omi-validation-duration-hint">{progressCopy.notice}</p>
    <div className="omi-validation-controls">
      <label>{copy('profile')}<select value={profile} disabled={busy} onChange={(event) => setProfile(event.target.value as ValidationProfile)}>
        {(['authoring', 'exchange', 'publication-preflight'] as const).map((value) => <option key={value} value={value}>{copy(value)}</option>)}
      </select></label>
      <button type="button" className="studio-menu-primary-action" disabled={busy} onClick={() => void run()}>{copy(busy ? 'running' : 'run')}</button>
      <button type="button" className="studio-menu-secondary-action" disabled={!report || stale || busy} onClick={() => void exportReport()}>{copy('export')}</button>
    </div>
    {busy && progress ? <div className="omi-validation-running" aria-busy="true">
      <div role="status" aria-live="polite" aria-atomic="true">
        <strong>{copy('running')}</strong> {progress.currentCheck ? copy(`check-${progress.currentCheck}`) : progressCopy.preparing}
      </div>
      <progress aria-label={copy('checks')} max={progress.total} value={progress.completed} />
      <span>{progressCopy.completed} {progress.completed}/{progress.total}</span>
      <span aria-live="off">{progressCopy.elapsed} {elapsed} s</span>
    </div> : null}
    {!busy && lastDuration !== null ? <p className="omi-validation-finished-duration">{progressCopy.finished} {lastDuration} s</p> : null}
    <p>{copy('scopeHint')}</p>
    {error ? <p role="alert">{error}</p> : null}
    {stale ? <p role="status" className="omi-validation-stale">{copy('stale')}</p> : null}
    {!report ? (busy ? null : <p>{copy('empty')}</p>) : <>
      <div className="omi-validation-summary" role="status">
        <strong>{copy(report.summary.outcome)}</strong>
        <span>{copy(report.summary.complete ? 'complete' : 'incomplete')}</span>
        <span>{copy('error')}: {report.summary.errors} · {copy('warning')}: {report.summary.warnings} · {copy('info')}: {report.summary.information}</span>
      </div>
      <p><time dateTime={report.createdAt}>{new Date(report.createdAt).toLocaleString(locale)}</time></p>
      <details><summary>{copy('checks')}</summary><ul>
        {report.checks.map((check) => <li key={check.id}>{copy(`check-${check.id}`)}: <strong>{copy(check.status)}</strong>{check.truncated ? ` · ${copy('truncated')}` : ''}</li>)}
      </ul></details>
      <label>{copy('findings')}<select value={filter} onChange={(event) => { setFilter(event.target.value as typeof filter); setPage(0); }}>
        {(['all', 'error', 'warning', 'info'] as const).map((value) => <option key={value} value={value}>{copy(value)}</option>)}
      </select></label>
      {!findings.length ? <p>{copy('noFindings')}</p> : <ol className="omi-validation-findings" start={currentPage * 20 + 1}>
        {findings.slice(currentPage * 20, (currentPage + 1) * 20).map((item) => {
          const sectionId = validationTargetSection(manuscript, item.targetId);
          return <li key={item.id} data-severity={item.severity}>
            <strong>{copy(item.severity)}</strong><p>{message(item)}</p>
            <details><summary>{copy('location')}</summary><code>{item.code}</code><br /><code>{item.path || '/'}</code>{item.targetId ? <p><code>{item.targetId}</code></p> : null}</details>
            {sectionId && !stale ? <button type="button" className="studio-menu-secondary-action" onClick={() => { useStudioStore.getState().selectSection(sectionId); onNavigate(); }}>{copy('openTarget')}</button> : null}
          </li>;
        })}
      </ol>}
      {totalPages > 1 ? <div className="omi-validation-controls">
        <button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>{copy('previous')}</button><span>{currentPage + 1}/{totalPages}</span>
        <button type="button" disabled={currentPage + 1 >= totalPages} onClick={() => setPage(currentPage + 1)}>{copy('next')}</button>
      </div> : null}
    </>}
  </section><ModelSupportPanel /><CoreModelReviewPanel /></>;
}
