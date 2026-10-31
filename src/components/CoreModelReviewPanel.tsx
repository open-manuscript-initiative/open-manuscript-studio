import { useRef, useState } from 'react';
import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import { coreDiagnosticMessage, coreReviewCopy } from '../i18n/coreModelReview';
import { runCoreModelReview } from '../services/coreModelReview';
import { saveExportText } from '../services/exportFileDelivery';

export function CoreModelReviewPanel() {
  const { locale } = useTranslation(), copy = coreReviewCopy(locale);
  const manuscript = useStudioStore(state => state.manuscript);
  const [mode, setMode] = useState<'authoring' | 'exchange'>('authoring');
  const [report, setReport] = useState<ReturnType<typeof runCoreModelReview> | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const source = useRef(manuscript);
  const stale = !!report && (source.current !== manuscript || report.result.mode !== mode);
  async function run() {
    setBusy(true); setError('');
    const snapshot = manuscript;
    try {
      await new Promise<void>(resolve => { window.setTimeout(resolve, 0); });
      const next = runCoreModelReview(snapshot, mode);
      source.current = snapshot; setReport(next);
    } catch { setError(copy.failed); }
    finally { setBusy(false); }
  }
  async function save() {
    if (!report || stale || busy) return;
    try { setError(''); await saveExportText(JSON.stringify(report, null, 2), 'core-model-review.json', 'application/json;charset=utf-8'); }
    catch { setError(copy.failed); }
  }
  return <section className="panel omi-core-model-review" aria-labelledby="omi-core-review-title">
    <h3 id="omi-core-review-title">{copy.title}</h3><p>{copy.description}</p>
    <div className="omi-validation-controls">
      <label>{copy.profile}<select value={mode} disabled={busy} onChange={event => setMode(event.target.value as typeof mode)}>
        <option value="authoring">{copy.authoring}</option><option value="exchange">{copy.exchange}</option>
      </select></label>
      <button type="button" className="studio-menu-secondary-action" disabled={busy} onClick={() => void run()}>{busy ? copy.running : copy.run}</button>
      <button type="button" className="studio-menu-secondary-action" disabled={!report || busy || stale} onClick={() => void save()}>{copy.save}</button>
    </div>
    <p>{copy.scope}</p>
    {error ? <p role="alert">{error}</p> : null}
    {stale ? <p role="status">{copy.stale}</p> : null}
    {report ? <>
      <p role="status">{copy[report.result.outcome]}</p>
      <details><summary>{copy.findings} ({report.result.diagnostics.length})</summary>
        {report.result.diagnostics.length ? <ul>{report.result.diagnostics.map((item, index) => <li key={index}><p>{coreDiagnosticMessage(locale, item.code)}</p><code>{item.code} · {item.path || '/'}</code></li>)}</ul> : <p>{copy.noFindings}</p>}
      </details>
    </> : <p>{copy.empty}</p>}
  </section>;
}
