import { useRef, useState } from 'react';
import { useStudioStore } from '../app/useStudioStore';
import { createPrintedPageReviewRow, reviewedPrintedPageRanges, preparePrintedPageBatch, type PrintedPageReviewRow, type PrintedPageBatchResult } from '../app/ojsIssuePrintedPageActions';
import { listOjsIssueTransferTargets } from '../model/ojsIssueTransferTargets';
import { inspectOjsIssuePrintedPages, applyReviewedOjsIssuePrintedPages } from '../services/ojsIssuePageWriteback';
import { getStudioApiBaseUrl } from '../services/studioServer';
import { useTranslation } from '../i18n';
import type { OmiManuscript } from '../types/omi';

const labels = {
  hu: { title: 'Nyomtatott oldalszámok visszaírása', help: 'Az exportok előkészítése előtt ellenőrizheti a nyomtatott oldalszámokat. Az OJS-be történő visszaírást a fájlátvitel után, friss ellenőrzéssel végezze. Ezek nem a PDF fizikai oldalindexei. Külön metaadat-művelet; nem publikálja a lapszámot.', inspect: 'Jelenlegi OJS-oldalszámok lekérése', old: 'Jelenlegi oldalszám', first: 'Első nyomtatott oldal', last: 'Utolsó nyomtatott oldal', review: 'Ellenőriztem a nyomtatott tartományt', confirm: 'Jóváhagyom az összes ellenőrzött oldalszám visszaírását.', apply: 'Oldalszámok visszaírása', busy: 'Feldolgozás…', stale: 'A lapszám, a tördelés vagy a kapcsolat megváltozott. Ellenőrizze újra.', invalid: 'Minden OJS-hez kapcsolt tanulmányhoz érvényes, sorrendben lévő, átfedésmentes tartomány szükséges.', success: 'Az oldalszámok visszaírása igazolt.', partial: 'A visszaírás megállt. A korábbi igazolt módosítások megmaradtak.', uncertain: 'Ellenőrizze az eredményt az OJS-ben, mielőtt új műveletet indít.', checked: 'Ellenőriztem az OJS-ben a korábbi művelet eredményét.', noTargets: 'Nincs kapcsolt OJS-tanulmány.', unchanged: 'változatlan' },
  en: { title: 'Write printed page ranges', help: 'Review printed pages before preparing exports if desired. Write the metadata to OJS after file transfer using a fresh inspection. These are not physical PDF page indices. This separate metadata operation does not publish the issue.', inspect: 'Inspect current OJS pages', old: 'Current pages', first: 'First printed page', last: 'Last printed page', review: 'I reviewed the printed range', confirm: 'I approve writing every reviewed page range.', apply: 'Write printed pages to OJS', busy: 'Processing…', stale: 'Issue, layout or connection changed. Inspect again.', invalid: 'Every OJS-linked study needs a valid, ordered and non-overlapping range.', success: 'Printed page writes confirmed.', partial: 'Writeback stopped. Previously confirmed changes remain.', uncertain: 'Inspect the result in OJS before starting another operation.', checked: 'I checked the previous operation in OJS.', noTargets: 'No linked OJS studies.', unchanged: 'unchanged' },
  de: { title: 'Gedruckte Seitenzahlen übertragen', help: 'Gedruckte Seitenzahlen vor der Exportvorbereitung prüfen. Nach der Dateiübertragung die Metadaten mit erneuter Prüfung an OJS übertragen. Dies sind keine physischen PDF-Seitenindizes. Dieser separate Metadatenvorgang veröffentlicht die Ausgabe nicht.', inspect: 'Aktuelle OJS-Seitenzahlen prüfen', old: 'Aktuelle Seitenzahlen', first: 'Erste gedruckte Seite', last: 'Letzte gedruckte Seite', review: 'Gedruckten Seitenbereich geprüft', confirm: 'Übertragung aller geprüften Seitenbereiche bestätigen.', apply: 'Seitenzahlen an OJS übertragen', busy: 'Verarbeitung…', stale: 'Ausgabe, Layout oder Verbindung geändert. Erneut prüfen.', invalid: 'Jeder verknüpfte Beitrag benötigt einen gültigen, geordneten und überschneidungsfreien Bereich.', success: 'Seitenzahlen bestätigt.', partial: 'Übertragung gestoppt. Bestätigte Änderungen bleiben erhalten.', uncertain: 'Ergebnis in OJS prüfen, bevor ein neuer Vorgang gestartet wird.', checked: 'Vorherigen Vorgang in OJS geprüft.', noTargets: 'Keine verknüpften OJS-Beiträge.', unchanged: 'unverändert' },
} as const;

export interface ApprovedPrintedPageExport {
  source: OmiManuscript;
  connection: string;
  origin: string;
  layoutKey: string;
  ranges: ReturnType<typeof reviewedPrintedPageRanges>;
}

export function OjsIssuePrintedPagePanel({ connection, active, disabled, layoutKey, onBusyChange, onReviewRequired, onReviewedPages, onWriteStart }: {
  connection: string; active: boolean; disabled: boolean; layoutKey: string;
  onBusyChange: (busy: boolean) => void; onReviewRequired: () => void;
  onReviewedPages: (review: ApprovedPrintedPageExport | undefined) => void;
  onWriteStart: () => void;
}) {
  const { locale } = useTranslation();
  const copy = labels[locale as keyof typeof labels] ?? labels.en;
  const source = useStudioStore(state => state.manuscript);
  const origin = getStudioApiBaseUrl();
  const latest = useRef({ connection, active, disabled, layoutKey });
  latest.current = { connection, active, disabled, layoutKey };
  const [inspection, setInspection] = useState<{ source: OmiManuscript; connection: string; origin: string; layoutKey: string; rows: PrintedPageReviewRow[] }>();
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [confirmed, setConfirmed] = useState(false);
  const [exportReview, setExportReview] = useState<typeof inspection>();
  const [result, setResult] = useState<PrintedPageBatchResult>();
  const [error, setError] = useState('');
  const current = inspection?.source === source && inspection.connection === connection &&
    inspection.origin === origin && inspection.layoutKey === layoutKey;
  const rows = current ? inspection.rows : [];
  let valid = false;
  try { if (current) { reviewedPrintedPageRanges(rows); valid = true; } } catch { /* incomplete review */ }
  const assertCurrent = (snapshot: OmiManuscript, destination: string, server: string, key: string) => {
    if (!latest.current.active || latest.current.connection !== destination || latest.current.layoutKey !== key ||
        getStudioApiBaseUrl() !== server || useStudioStore.getState().manuscript !== snapshot) throw new Error(copy.stale);
  };
  const fail = (cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause));
  const start = () => { lock.current = true; setBusy(true); onBusyChange(true); setError(''); setConfirmed(false); };
  const stop = () => { lock.current = false; setBusy(false); onBusyChange(false); };
  async function inspect() {
    if (lock.current || disabled || !connection) return;
    start(); setInspection(undefined); setExportReview(undefined); onReviewedPages(undefined);
    try {
      const targets = listOjsIssueTransferTargets(source);
      if (!targets.length || targets.length > 100) throw new Error(copy.noTargets);
      const next: PrintedPageReviewRow[] = [];
      for (const target of targets) {
        assertCurrent(source, connection, origin, layoutKey);
        const snapshot = await inspectOjsIssuePrintedPages(connection, target);
        assertCurrent(source, connection, origin, layoutKey);
        next.push(createPrintedPageReviewRow(target, snapshot));
      }
      setInspection({ source, connection, origin, layoutKey, rows: next });
    } catch (cause) { fail(cause); } finally { stop(); }
  }
  function edit(root: string, field: 'first' | 'last' | 'reviewed', value: string | boolean) {
    setConfirmed(false); setExportReview(undefined); onReviewedPages(undefined);
    setInspection(previous => previous ? { ...previous, rows: previous.rows.map(row => row.target.rootSectionId === root
      ? field === 'reviewed' ? { ...row, reviewed: value === true } : { ...row, [field]: String(value), reviewed: false } : row) } : previous);
  }
  async function apply() {
    if (lock.current || disabled || !current || !valid || !confirmed) return;
    start(); onWriteStart(); setExportReview(undefined); onReviewedPages(undefined);
    try {
      const batch = preparePrintedPageBatch({ rows,
        assertCurrent: () => assertCurrent(source, connection, origin, layoutKey),
        inspect: target => inspectOjsIssuePrintedPages(connection, target),
        apply: (target, snapshot, range, approved) => applyReviewedOjsIssuePrintedPages(connection, target, snapshot, range, approved),
      });
      const outcome = await batch.execute(true);
      setResult(outcome);
      if (outcome.failed) onReviewRequired();
    } catch (cause) { fail(cause); } finally { setInspection(undefined); stop(); }
  }
  const exportLabel = locale === 'hu' ? 'Jóváhagyott oldalszámok használata az exportokban' : locale === 'de' ? 'Geprüfte Seitenzahlen in Exporten verwenden' : 'Use reviewed printed pages in exports';
  const exportReady = locale === 'hu' ? 'Az exportáláshoz jóváhagyva.' : locale === 'de' ? 'Für Exporte bestätigt.' : 'Approved for exports.';
  function approveForExport() {
    if (!current || !valid || !inspection || disabled || lock.current) return;
    try {
      assertCurrent(source, connection, origin, layoutKey);
      onReviewedPages({ source, connection, origin, layoutKey, ranges: reviewedPrintedPageRanges(rows) });
      setExportReview(inspection);
    } catch (cause) { fail(cause); }
  }
  return <section className="ojs-issue-workspace" hidden={!active} aria-label={copy.title}>
    <h4>{copy.title}</h4><p>{copy.help}</p>
    <fieldset disabled={disabled || busy}>
      <button type="button" disabled={!connection} onClick={() => void inspect()}>{copy.inspect}</button>
      {inspection && !current ? <p role="alert">{copy.stale}</p> : null}
      {rows.map(row => <article className="ojs-issue-workspace-row" key={row.target.rootSectionId}>
        <strong>{row.target.title}</strong><small>{copy.old}: {row.snapshot.pages ?? '—'}</small>
        <div className="ojs-live-publication-fields">
          <label>{copy.first}<input type="number" min={1} max={999999} step={1} inputMode="numeric" value={row.first}
            onChange={event => edit(row.target.rootSectionId, 'first', event.target.value)} /></label>
          <label>{copy.last}<input type="number" min={1} max={999999} step={1} inputMode="numeric" value={row.last}
            onChange={event => edit(row.target.rootSectionId, 'last', event.target.value)} /></label>
        </div>
        <label><input type="checkbox" checked={row.reviewed} onChange={event => edit(row.target.rootSectionId, 'reviewed', event.target.checked)} /> {copy.review}</label>
      </article>)}
      {rows.length ? <>
        {!valid ? <p>{copy.invalid}</p> : null}
        <button type="button" disabled={!valid} onClick={approveForExport}>{exportLabel}</button>
        {current && exportReview === inspection && exportReview ? <p role="status">{exportReady}</p> : null}
        <label><input type="checkbox" disabled={!valid} checked={confirmed && valid} onChange={event => setConfirmed(event.target.checked)} /> {copy.confirm}</label>
        <button type="button" disabled={!valid || !confirmed} onClick={() => void apply()}>{copy.apply}</button>
      </> : null}
    </fieldset>
    {busy ? <p role="status">{copy.busy}</p> : null}
    {error ? <p role="alert">{error}</p> : null}
    {result ? <div role="status"><p>{result.failed ? copy.partial : copy.success}</p>
      {result.failed ? <p>{result.failed.title}: {result.failed.message}</p> : null}
      <ul>{result.receipts.map(({ rootSectionId, receipt }) => <li key={rootSectionId}>
        OJS #{receipt.submissionId}: {receipt.previousPages ?? '—'} → {receipt.pages} {receipt.unchanged ? '(' + copy.unchanged + ')' : '✓'}
      </li>)}</ul>
    </div> : null}
  </section>;
}
