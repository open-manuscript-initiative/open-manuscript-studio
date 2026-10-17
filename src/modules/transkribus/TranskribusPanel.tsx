import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useStudioStore } from '../../app/useStudioStore';
import { stageInsertBlocks } from '../../app/visualBlockActions';
import { saveExportText } from '../../services/exportFileDelivery';
import { TranskribusConnectionSettings } from './TranskribusConnectionSettings';
import { downloadTranskribusPage, refreshTranskribusJob, submitTranskribusJob, type TranskribusConnection } from './api';
import { getTranskribusCopy, transkribusErrorMessage } from './copy';
import { buildTranskribusImport, isSavedTranskribusJob, transkribusStorageKey, TRANSKRIBUS_RIGHTS, type SavedTranskribusJob, type TranskribusRights } from './model';
import './transkribus.css';

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const terminal = (status: string) => ['FINISHED', 'FAILED', 'CANCELLED'].includes(status);

function loadJob(key: string): SavedTranskribusJob | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    return isSavedTranskribusJob(value) ? value : null;
  } catch { return null; }
}

function fileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.onabort = () => reject(new Error('Image read cancelled.'));
    reader.readAsDataURL(file);
  });
}

export function TranskribusPanel({ locale, userId, workspaceId }: { locale: string; userId: string; workspaceId: string }) {
  const copy = getTranskribusCopy(locale);
  const key = transkribusStorageKey(userId, workspaceId);
  const [saved, setSaved] = useState<SavedTranskribusJob | null>(() => loadJob(key));
  const [connection, setConnection] = useState<TranskribusConnection | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [modelId, setModelId] = useState('');
  const [consent, setConsent] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [targetId, setTargetId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [storageFailed, setStorageFailed] = useState(false);
  const [pollPaused, setPollPaused] = useState(false);
  const pending = useRef<AbortController | null>(null);
  const sections = useStudioStore(state => state.manuscript.sections);
  const selectedSectionId = useStudioStore(state => state.selectedSectionId);
  const hasDocument = useStudioStore(state => state.hasOpenDocument);
  const sectionId = sections.some(section => section.id === targetId) ? targetId : selectedSectionId ?? sections[0]?.id ?? '';
  const processing = Boolean(saved && !terminal(saved.job.status));

  useEffect(() => () => pending.current?.abort(), []);
  useEffect(() => {
    if (!saved) return;
    try { localStorage.setItem(key, JSON.stringify(saved)); setStorageFailed(false); }
    catch { setStorageFailed(true); }
  }, [key, saved]);

  const handle = saved?.job.handle;
  const status = saved?.job.status;
  useEffect(() => {
    if (!connection?.connected || !handle || !status || terminal(status) || pollPaused) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void refreshTranskribusJob(workspaceId, handle, controller.signal).then(job => {
        if (!controller.signal.aborted) setSaved(current => current?.job.handle === handle
          ? { ...current, job, text: job.text || current.text } : current);
      }).catch(reason => {
        if (!controller.signal.aborted) { setError(transkribusErrorMessage(reason, copy)); setPollPaused(true); }
      });
    }, 10_000);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [connection?.connected, handle, status, saved, workspaceId, pollPaused, copy]);

  async function start(event: FormEvent) {
    event.preventDefault();
    if (!file || !consent || !connection?.connected || busy || processing) return;
    const numericModel = Number(modelId);
    if (!Number.isInteger(numericModel) || numericModel < 1 || numericModel > 2_147_483_647) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true); setError(''); setNotice(''); setReviewed(false); setPollPaused(false);
    try {
      const imageBase64 = await fileBase64(file);
      if (controller.signal.aborted) return;
      const job = await submitTranskribusJob(workspaceId, numericModel, imageBase64, controller.signal);
      if (!controller.signal.aborted) {
        setSaved({ version: 1, job, modelId: numericModel, fileName: file.name,
          title: file.name, source: file.name, text: job.text, rights: 'unknown' });
        setConsent(false);
      }
    } catch (reason) {
      if (!controller.signal.aborted) setError(`${transkribusErrorMessage(reason, copy)} ${copy.submitHint}`);
    } finally { if (!controller.signal.aborted) setBusy(false); }
  }

  async function refresh() {
    if (!saved || busy) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true); setError('');
    try {
      const job = await refreshTranskribusJob(workspaceId, saved.job.handle, controller.signal);
      if (!controller.signal.aborted) {
        setSaved(current => current ? { ...current, job, text: current.job.status === 'FINISHED' ? current.text : job.text } : current);
        setPollPaused(false);
      }
    } catch (reason) {
      if (!controller.signal.aborted) { setError(transkribusErrorMessage(reason, copy)); setPollPaused(true); }
    } finally { if (!controller.signal.aborted) setBusy(false); }
  }

  function update(patch: Partial<SavedTranskribusJob>) {
    setSaved(current => current ? { ...current, ...patch } : current);
    setReviewed(false); setNotice('');
  }

  function insert() {
    if (!saved || !reviewed || !hasDocument) return;
    const state = useStudioStore.getState();
    const section = state.manuscript.sections.find(candidate => candidate.id === sectionId);
    if (!section || !state.hasOpenDocument) return;
    try {
      const result = buildTranskribusImport(saved, copy.source, new Date().toISOString(), undefined, state.manuscript.bibliographicRecords);
      if (stageInsertBlocks(section.id, section.blocks.length, result.blocks, 'Import reviewed Transkribus transcription',
        result.annotations, result.sourceAttributions, result.bibliographicRecords)) {
        setReviewed(false); setNotice(copy.inserted); setError('');
      }
    } catch { setError(copy.errors.TRANSKRIBUS_INVALID_REQUEST); }
  }

  function forget() {
    if (busy || !window.confirm(copy.forgetConfirm)) return;
    pending.current?.abort();
    try { localStorage.removeItem(key); }
    catch { setStorageFailed(true); return; }
    setSaved(null); setReviewed(false); setPollPaused(false); setError(''); setNotice('');
  }

  async function download(pageXml: boolean) {
    if (!saved || busy) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true); setError('');
    try {
      const text = pageXml ? await downloadTranskribusPage(workspaceId, saved.job.handle, controller.signal) : saved.text;
      if (!controller.signal.aborted) await saveExportText(text, `transkribus-${saved.job.processId}.${pageXml ? 'page.xml' : 'txt'}`, pageXml ? 'application/xml' : 'text/plain;charset=utf-8');
    } catch (reason) {
      if (!controller.signal.aborted) setError(transkribusErrorMessage(reason, copy));
    } finally { if (!controller.signal.aborted) setBusy(false); }
  }

  return <section className="transkribus-panel" aria-label={copy.title}>
    <header><h4>{copy.title}</h4><p>{copy.description}</p></header>
    <TranskribusConnectionSettings locale={locale} onStatus={setConnection} />
    <form onSubmit={event => void start(event)} className="transkribus-recognition">
      <div className="transkribus-fields">
        <label>{copy.image}<input type="file" accept="image/jpeg,image/png,image/tiff,.jpg,.jpeg,.png,.tif,.tiff" disabled={busy || processing} onChange={event => {
          const next = event.target.files?.[0] ?? null;
          setConsent(false); setNotice('');
          if (next && (next.size < 8 || next.size > MAX_IMAGE_BYTES ||
              (!['image/jpeg', 'image/png', 'image/tiff'].includes(next.type) && !/\.(?:jpe?g|png|tiff?)$/i.test(next.name)))) {
            setFile(null); setError(copy.invalidImage); event.target.value = ''; return;
          }
          setFile(next); setError('');
        }} /></label>
        <label>{copy.modelId}<input type="number" min={1} max={2_147_483_647} step={1} value={modelId} disabled={busy || processing} onChange={event => { setModelId(event.target.value); setConsent(false); }} required /></label>
      </div>
      <p>{copy.imageHint} <a href="https://www.transkribus.org/models" target="_blank" rel="noopener noreferrer">{copy.models}</a></p>
      <label className="transkribus-check"><input type="checkbox" checked={consent} disabled={busy || processing} onChange={event => setConsent(event.target.checked)} />{copy.consent}</label>
      <div className="transkribus-actions"><button type="submit" disabled={busy || processing || !file || !consent || !connection?.connected || !Number.isInteger(Number(modelId)) || Number(modelId) < 1}>{busy ? copy.busy : copy.start}</button></div>
    </form>
    {saved && <section className="transkribus-result" aria-label={copy.result}>
      <div className="transkribus-actions"><h5>{copy.result}</h5><span role="status">{copy.statuses[saved.job.status]} · {saved.job.processId}</span><button type="button" disabled={busy || !connection?.connected} onClick={() => void refresh()}>{copy.refresh}</button><button type="button" disabled={busy} onClick={forget}>{copy.forget}</button></div>
      {processing && <p>{copy.processingNote}</p>}
      {pollPaused && <p role="status">{copy.paused}</p>}
      <p>{copy.savedJob}: {saved.fileName} · {copy.modelId}: {saved.modelId}</p>
      {saved.job.status === 'FINISHED' && <>
        <p>{copy.reviewHint}</p>
        {!saved.text.trim() && <p role="status">{copy.empty}</p>}
        <label>{copy.result}<textarea rows={9} value={saved.text} maxLength={1_000_000} onChange={event => update({ text: event.target.value })} /></label>
        <div className="transkribus-fields">
          <label>{copy.source}<input value={saved.source} maxLength={4000} onChange={event => update({ source: event.target.value })} /></label>
          <label>{copy.rights}<select value={saved.rights} onChange={event => update({ rights: event.target.value as TranskribusRights })}>{TRANSKRIBUS_RIGHTS.map(right => <option key={right} value={right}>{copy.rightsOptions[right]}</option>)}</select></label>
        </div>
        <p>{copy.sourceHint}</p>
        {hasDocument ? <label>{copy.section}<select value={sectionId} onChange={event => { setTargetId(event.target.value); setReviewed(false); }}>{sections.map((section, index) => <option key={section.id} value={section.id}>{section.title || `${copy.untitledSection} ${index + 1}`}</option>)}</select></label> : <p>{copy.noDocument}</p>}
        <label className="transkribus-check"><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} />{copy.reviewed}</label>
        <div className="transkribus-actions">
          <button type="button" disabled={!hasDocument || !sectionId || !reviewed || !saved.text.trim() || (saved.rights !== 'self-authored' && !saved.source.trim())} onClick={insert}>{copy.insert}</button>
          <button type="button" disabled={busy} onClick={() => void download(false)}>{copy.downloadText}</button>
          <button type="button" disabled={busy || !connection?.connected} onClick={() => void download(true)}>{copy.downloadPage}</button>
        </div>
      </>}
    </section>}
    {storageFailed && <p role="alert">{copy.storageFailed}</p>}
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
  </section>;
}
