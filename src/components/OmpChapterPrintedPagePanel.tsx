import { useEffect, useRef, useState } from 'react';
import { useStudioStore } from '../app/useStudioStore';
import { externalizeActiveManuscriptAssets } from '../app/assetActions';
import { useTranslation } from '../i18n';
import { listOmpChapterTransferTargets } from '../model/ompChapterTransferTargets';
import { reviewedOmpChapterRanges, type OmpChapterPrintedReviewRow, type OmpChapterPageReceipt } from '../model/ompChapterPrintedPages';
import { inspectOmpChapterPrintedPages, applyReviewedOmpChapterPrintedPages } from '../services/ompChapterPageWriteback';
import { prepareIssuePdfRangePlan, type IssuePdfRangePlan } from '../services/issuePdfRangePlanning';
import { loadPublicationStyle, loadPublicationPublisherIdentity } from '../services/publicationStyleExport';
import { publicationLayoutKey } from '../services/styledPublicationArtifact';
import { saveExportBlob } from '../services/exportFileDelivery';
import { getStudioApiBaseUrl } from '../services/studioServer';
import type { IntegrationConnection } from '../services/integrationApi';
import type { OmiManuscript } from '../types/omi';

const labels = {
  hu: ['OMP-fejezetek nyomtatott oldalszámai', 'A végleges PDF alapján ellenőrizze a fejezetek nyomtatott oldalszámait. A fizikai PDF-oldal csak tájékoztató javaslat. A visszaírás nem publikálja a kötetet.', 'OMP-kapcsolat', 'Válasszon', 'PDF renderelése és célpontok ellenőrzése', 'PDF letöltése ellenőrzéshez', 'Fizikai PDF-oldaljavaslat', 'Kézi ellenőrzés szükséges', 'Jelenlegi OMP-oldalszám', 'Első nyomtatott oldal', 'Utolsó nyomtatott oldal', 'A PDF-ben ellenőriztem a nyomtatott oldalszámokat', 'Jóváhagyom az ellenőrzött oldalszámok visszaírását', 'Visszaírás az OMP-be', 'A dokumentum, stílus, szerver vagy kapcsolat változott. Ellenőrizze újra.', 'Ellenőrizze az előző művelet eredményét az OMP-ben; automatikus újrapróbálkozás nincs.', 'Ellenőriztem az OMP-ben', 'Nincsenek egyértelműen kapcsolt fejezetek.', 'Feldolgozás…', 'Igazolt visszaírások', 'A tartományok hiányosak vagy hibásak.', 'A nem kapcsolt fejezetek kimaradnak.'],
  en: ['OMP chapter printed pages', 'Verify printed chapter labels against the final PDF. Physical PDF pages are suggestions only. Writeback does not publish the volume.', 'OMP connection', 'Choose', 'Render PDF and inspect destinations', 'Download PDF for review', 'Suggested physical PDF pages', 'Manual inspection required', 'Current OMP pages', 'First printed page', 'Last printed page', 'I verified printed labels in the PDF', 'I approve writing the reviewed printed pages', 'Write to OMP', 'Document, style, server or connection changed. Inspect again.', 'Inspect the previous result in OMP; no automatic retry.', 'I checked in OMP', 'No unambiguously linked chapters.', 'Processing…', 'Confirmed writes', 'Ranges are incomplete or invalid.', 'Unlinked chapters are excluded.'],
  de: ['Gedruckte OMP-Kapitelseiten', 'Gedruckte Seiten anhand des endgültigen PDF prüfen. Physische PDF-Seiten sind nur Vorschläge. Der Band wird nicht veröffentlicht.', 'OMP-Verbindung', 'Auswählen', 'PDF erstellen und Ziele prüfen', 'PDF zur Prüfung herunterladen', 'Vorgeschlagene physische PDF-Seiten', 'Manuelle Prüfung erforderlich', 'Aktuelle OMP-Seiten', 'Erste gedruckte Seite', 'Letzte gedruckte Seite', 'Gedruckte Seiten im PDF geprüft', 'Übertragung der geprüften Seiten bestätigen', 'An OMP übertragen', 'Dokument, Stil, Server oder Verbindung geändert. Erneut prüfen.', 'Vorheriges Ergebnis in OMP prüfen; keine automatische Wiederholung.', 'In OMP geprüft', 'Keine eindeutig verknüpften Kapitel.', 'Verarbeitung…', 'Bestätigte Übertragungen', 'Seitenbereiche unvollständig oder ungültig.', 'Nicht verknüpfte Kapitel werden ausgeschlossen.'],
} as const;
function layout(source: OmiManuscript) {
  return { style: loadPublicationStyle(source), identity: loadPublicationPublisherIdentity() };
}
type Inspection = { plan: IssuePdfRangePlan; connection: string; server: string; rows: OmpChapterPrintedReviewRow[] };
export function OmpChapterPrintedPagePanel({ connections, disabled }: { connections: readonly IntegrationConnection[]; disabled: boolean }) {
  const { locale } = useTranslation();
  const copy = labels[locale.split(/[-_]/)[0] as keyof typeof labels] ?? labels.en;
  const source = useStudioStore(state => state.manuscript);
  const [connection, setConnection] = useState('');
  const [inspection, setInspection] = useState<Inspection>();
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState('');
  const [receipts, setReceipts] = useState<OmpChapterPageReceipt[]>([]);
  const lock = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const latest = useRef({ connection, connections, disabled });
  latest.current = { connection, connections, disabled };
  const assertCurrent = (candidate: Inspection) => {
    const current = useStudioStore.getState().manuscript;
    if (!mounted.current || latest.current.disabled || current !== candidate.plan.source ||
        latest.current.connection !== candidate.connection || !latest.current.connections.some(item => item.id === candidate.connection && item.enabled && item.providerId === 'omp') ||
        getStudioApiBaseUrl() !== candidate.server || publicationLayoutKey(layout(current)) !== candidate.plan.layoutKey)
      throw new Error(copy[14]);
  };
  const current = !!inspection && inspection.plan.source === source && inspection.connection === connection &&
    inspection.server === getStudioApiBaseUrl() && inspection.plan.layoutKey === publicationLayoutKey(layout(source));
  const rows = current ? inspection.rows : [];
  let valid = false;
  try { if (current) { reviewedOmpChapterRanges(rows); valid = true; } } catch { /* incomplete review */ }
  const fail = (cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause));
  async function inspect() {
    if (lock.current || disabled || uncertain || !connection) return;
    lock.current = true; setBusy(true); setError(''); setInspection(undefined); setConfirmed(false); setReceipts([]);
    try {
      if (!listOmpChapterTransferTargets(source).length) throw new Error(copy[17]);
      await externalizeActiveManuscriptAssets();
      const store = useStudioStore.getState();
      if (store.manuscript.id !== source.id) throw new Error(copy[14]);
      store.checkpoint('export');
      const committed = useStudioStore.getState().manuscript;
      const targets = listOmpChapterTransferTargets(committed);
      if (!targets.length || targets.length > 100) throw new Error(copy[17]);
      const server = getStudioApiBaseUrl();
      const plan = await prepareIssuePdfRangePlan(committed, layout(committed));
      const next: Inspection = { plan, server, connection, rows: [] };
      for (const target of targets) {
        assertCurrent(next);
        const snapshot = await inspectOmpChapterPrintedPages(connection, target);
        assertCurrent(next);
        // Never prefill from physical page indices or stale remote metadata.
        next.rows.push({ target, snapshot, first: '', last: '', reviewed: false });
      }
      setInspection(next);
    } catch (cause) { fail(cause); }
    finally { lock.current = false; setBusy(false); }
  }
  function edit(root: string, field: 'first' | 'last' | 'reviewed', value: string | boolean) {
    setConfirmed(false);
    setInspection(previous => previous ? { ...previous, rows: previous.rows.map(row => row.target.rootSectionId === root
      ? field === 'reviewed' ? { ...row, reviewed: value === true } : { ...row, [field]: String(value), reviewed: false } : row) } : previous);
  }
  async function apply() {
    if (lock.current || disabled || uncertain || !inspection || !current || !valid || !confirmed) return;
    lock.current = true; setBusy(true); setError(''); setConfirmed(false); setReceipts([]);
    let attempted = false;
    try {
      const ranges = reviewedOmpChapterRanges(inspection.rows);
      // Check every target before the first write. Never refresh an old token silently.
      for (const row of inspection.rows) {
        assertCurrent(inspection);
        const fresh = await inspectOmpChapterPrintedPages(connection, row.target);
        assertCurrent(inspection);
        if (fresh.workflowToken !== row.snapshot.workflowToken || fresh.pages !== row.snapshot.pages) throw new Error(copy[14]);
      }
      for (let i = 0; i < inspection.rows.length; i++) {
        assertCurrent(inspection);
        const row = inspection.rows[i]!;
        attempted = true;
        const receipt = await applyReviewedOmpChapterPrintedPages(connection, row.target, row.snapshot, ranges[i]!, true);
        setReceipts(previous => [...previous, receipt]);
        assertCurrent(inspection);
      }
    } catch (cause) { fail(cause); if (attempted) setUncertain(true); }
    finally { setInspection(undefined); lock.current = false; setBusy(false); }
  }
  async function download() {
    if (!inspection || lock.current) return;
    try { assertCurrent(inspection); await saveExportBlob(inspection.plan.pdf, inspection.plan.parentBuild.output.fileName); }
    catch (cause) { fail(cause); }
  }
  return <section className="ojs-issue-workspace" aria-label={copy[0]}>
    <h4>{copy[0]}</h4><p>{copy[1]}</p><p>{copy[21]}</p>
    <fieldset disabled={busy || disabled || uncertain}>
      <label>{copy[2]}<select value={connection} onChange={event => {
        latest.current.connection = event.target.value; setConnection(event.target.value); setInspection(undefined); setConfirmed(false);
      }}><option value="">{copy[3]}</option>{connections.map(item => <option key={item.id} value={item.id}>{item.displayName ?? item.connectionKey}</option>)}</select></label>
      <button type="button" disabled={!connection} onClick={() => void inspect()}>{copy[4]}</button>
      {inspection && !current ? <p role="alert">{copy[14]}</p> : null}
      {current ? <button type="button" onClick={() => void download()}>{copy[5]}</button> : null}
      {rows.map(row => {
        const proposed = inspection?.plan.proposals.find(item => item.rootSectionId === row.target.rootSectionId);
        return <article className="ojs-issue-workspace-row" key={row.target.rootSectionId}>
          <strong>{row.target.title}</strong>
          <small>{copy[6]}: {proposed?.firstPage !== undefined && proposed.lastPage !== undefined ? proposed.firstPage + '–' + proposed.lastPage : copy[7]}</small>
          <small>{copy[8]}: {row.snapshot.pages ?? '—'}</small>
          <div className="ojs-live-publication-fields">
            <label>{copy[9]}<input type="number" min={1} max={999999} step={1} value={row.first} onChange={event => edit(row.target.rootSectionId, 'first', event.target.value)} /></label>
            <label>{copy[10]}<input type="number" min={1} max={999999} step={1} value={row.last} onChange={event => edit(row.target.rootSectionId, 'last', event.target.value)} /></label>
          </div>
          <label><input type="checkbox" checked={row.reviewed} onChange={event => edit(row.target.rootSectionId, 'reviewed', event.target.checked)} /> {copy[11]}</label>
        </article>;
      })}
      {rows.length ? <>{!valid ? <p>{copy[20]}</p> : null}
        <label><input type="checkbox" disabled={!valid} checked={confirmed && valid} onChange={event => setConfirmed(event.target.checked)} /> {copy[12]}</label>
        <button type="button" disabled={!valid || !confirmed} onClick={() => void apply()}>{copy[13]}</button></> : null}
    </fieldset>
    {busy ? <p role="status">{copy[18]}</p> : null}
    {error ? <p role="alert">{error}</p> : null}
    {uncertain ? <p role="alert">{copy[15]} <button type="button" disabled={busy || disabled} onClick={() => setUncertain(false)}>{copy[16]}</button></p> : null}
    {receipts.length ? <div role="status"><p>{copy[19]}</p><ul>{receipts.map(receipt => <li key={receipt.chapterId}>OMP #{receipt.chapterId}: {receipt.previousPages ?? '—'} → {receipt.pages}</li>)}</ul></div> : null}
  </section>;
}
