import { useRef, useState } from 'react';
import { externalizeActiveManuscriptAssets } from '../app/assetActions';
import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import { createIssuePdfReviewRows, editIssuePdfReviewRow, reviewedIssuePdfRanges, type IssuePdfReviewRow } from '../model/issuePdfReview';
import { prepareIssuePdfRangePlan, extractReviewedIssuePdfRanges, type IssuePdfRangePlan, type ReviewedIssuePdfArtifact } from '../services/issuePdfRangePlanning';
import { loadPublicationPublisherIdentity, type PublicationStyle } from '../services/publicationStyleExport';
import { publicationLayoutKey } from '../services/styledPublicationArtifact';
import { saveExportBlob } from '../services/exportFileDelivery';
import { serializePublicationBuildManifest, publicationBuildManifestFileName } from '../services/publicationBuildManifest';
import { getStudioApiBaseUrl } from '../services/studioServer';
import './IssuePdfRangeReviewPanel.css';

const labels = {
  hu: { title: 'Tanulmányonkénti PDF-export', help: 'Készítse el a végleges lapszám PDF-jét. Töltse le és ellenőrizze minden tanulmány első és utolsó fizikai oldalát, beleértve a jegyzeteket, képeket és hivatkozásokat. Ezek nem a nyomtatott oldalszámok.', prepare: 'Lapszám renderelése és vizsgálata', preparing: 'PDF előkészítése…', download: 'Teljes PDF letöltése ellenőrzéshez', pages: 'Fizikai oldalak száma', first: 'Első PDF-oldal', last: 'Utolsó PDF-oldal', review: 'Ellenőriztem a teljes tanulmányt', uncertain: 'Kézi ellenőrzés szükséges', proposed: 'Automatikus javaslat', extract: 'Jóváhagyott PDF-ek elkészítése', extracting: 'PDF-ek kivágása…', stale: 'A dokumentum, stílus vagy szerver megváltozott. Készítse el újra a PDF-et.', invalid: 'Minden tartomány legyen jóváhagyott, érvényes, sorrendben és átfedésmentesen.', ready: 'Az önálló PDF-ek elkészültek.', save: 'PDF letöltése' },
  en: { title: 'Individual study PDFs', help: 'Render the final issue PDF. Download and check the first and last physical page of every study, including notes, images and references. These are not printed page labels.', prepare: 'Render and inspect issue', preparing: 'Preparing PDF…', download: 'Download full PDF for review', pages: 'Physical page count', first: 'First PDF page', last: 'Last PDF page', review: 'I checked the entire study', uncertain: 'Manual review needed', proposed: 'Suggested range', extract: 'Build approved study PDFs', extracting: 'Extracting PDFs…', stale: 'The document, style or server changed. Render the PDF again.', invalid: 'Approve every valid, ordered and non-overlapping range.', ready: 'Individual PDFs are ready.', save: 'Download PDF' },
  de: { title: 'Einzelne Beitrags-PDFs', help: 'Erstellen Sie das endgültige PDF der Ausgabe. Laden Sie es herunter und prüfen Sie die erste und letzte physische Seite jedes Beitrags einschließlich Anmerkungen, Bildern und Literatur. Dies sind keine gedruckten Seitenzahlen.', prepare: 'Ausgabe rendern und prüfen', preparing: 'PDF wird vorbereitet…', download: 'Gesamtes PDF zur Prüfung herunterladen', pages: 'Physische Seitenzahl', first: 'Erste PDF-Seite', last: 'Letzte PDF-Seite', review: 'Gesamten Beitrag geprüft', uncertain: 'Manuelle Prüfung erforderlich', proposed: 'Vorgeschlagener Bereich', extract: 'Bestätigte Beitrags-PDFs erstellen', extracting: 'PDFs werden extrahiert…', stale: 'Dokument, Stil oder Server wurde geändert. PDF erneut erstellen.', invalid: 'Alle gültigen, geordneten und überschneidungsfreien Bereiche bestätigen.', ready: 'Einzelne PDFs sind bereit.', save: 'PDF herunterladen' },
} as const;

export function IssuePdfRangeReviewPanel({ style, active }: { style: PublicationStyle; active: boolean }) {
  const { locale } = useTranslation();
  const copy = labels[locale as keyof typeof labels] ?? labels.en;
  const manuscript = useStudioStore(state => state.manuscript);
  const latest = useRef({ style, active });
  latest.current = { style, active };
  const context = () => ({ style: latest.current.style, identity: loadPublicationPublisherIdentity() });
  const [plan, setPlan] = useState<IssuePdfRangePlan>();
  const [origin, setOrigin] = useState('');
  const [rows, setRows] = useState<IssuePdfReviewRow[]>([]);
  const [outputs, setOutputs] = useState<ReviewedIssuePdfArtifact[]>([]);
  const [busy, setBusy] = useState<'prepare' | 'extract' | null>(null);
  const lock = useRef(false);
  const [error, setError] = useState('');
  const current = !!plan && plan.source === manuscript && plan.layoutKey === publicationLayoutKey(context()) &&
    origin === getStudioApiBaseUrl();
  const assertCurrent = (candidate: IssuePdfRangePlan, server: string) => {
    if (!latest.current.active || candidate.source !== useStudioStore.getState().manuscript ||
        candidate.layoutKey !== publicationLayoutKey(context()) || server !== getStudioApiBaseUrl()) throw new Error(copy.stale);
  };
  let valid = false;
  if (plan && current) {
    try { reviewedIssuePdfRanges(plan.pageCount, plan.proposals.map(item => item.rootSectionId), rows); valid = true; }
    catch { /* Unreviewed or invalid input. */ }
  }
  async function prepare() {
    if (lock.current || !latest.current.active) return;
    lock.current = true;
    setBusy('prepare'); setError(''); setPlan(undefined); setRows([]); setOutputs([]);
    try {
      await externalizeActiveManuscriptAssets();
      useStudioStore.getState().checkpoint('export');
      const source = useStudioStore.getState().manuscript;
      if (source.id !== manuscript.id) throw new Error(copy.stale);
      const server = getStudioApiBaseUrl();
      const result = await prepareIssuePdfRangePlan(source, context());
      assertCurrent(result, server);
      setOrigin(server);
      setPlan(result); setRows(createIssuePdfReviewRows(result.proposals));
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { lock.current = false; setBusy(null); }
  }
  async function extract() {
    if (lock.current || !plan || !valid) return;
    lock.current = true;
    setBusy('extract'); setError(''); setOutputs([]);
    try {
      assertCurrent(plan, origin);
      const ranges = reviewedIssuePdfRanges(plan.pageCount, plan.proposals.map(item => item.rootSectionId), rows);
      const result = await extractReviewedIssuePdfRanges(plan, ranges, {
        confirmed: true,
        currentSource: () => { assertCurrent(plan, origin); return useStudioStore.getState().manuscript; },
        currentLayoutKey: () => publicationLayoutKey(context()),
      });
      assertCurrent(plan, origin);
      setOutputs(result);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { lock.current = false; setBusy(null); }
  }
  function save(blob: Blob, fileName: string) {
    if (!plan || lock.current) return;
    try {
      assertCurrent(plan, origin);
      void saveExportBlob(blob, fileName).catch(cause => setError(cause instanceof Error ? cause.message : String(cause)));
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  }
  function saveJson(value: string, name: string) {
    save(new Blob([value], { type: 'application/json' }), name);
  }
  const auditLabel = locale === 'hu' ? 'Eredetigazolás' : locale === 'de' ? 'Herkunftsnachweis' : 'Build provenance';
  const derivationLabel = locale === 'hu' ? 'Oldalkivágási adatok' : locale === 'de' ? 'Seitenauszug-Nachweis' : 'Page extraction evidence';
  const edit = (id: string, field: 'first' | 'last', value: string) => {
    setRows(previous => editIssuePdfReviewRow(previous, id, field, value)); setOutputs([]);
  };
  const confirm = (id: string, value: boolean) => {
    setRows(previous => previous.map(row => row.rootSectionId === id ? { ...row, reviewed: value } : row)); setOutputs([]);
  };
  return <section hidden={!active} className="issue-pdf-review" aria-label={copy.title}>
    <h4>{copy.title}</h4>
    <p>{copy.help}</p>
    <button type="button" disabled={busy !== null} onClick={() => void prepare()}>{busy === 'prepare' ? copy.preparing : copy.prepare}</button>
    {plan && !current ? <p role="alert">{copy.stale}</p> : null}
    {plan && current ? <>
      <p>{copy.pages}: {plan.pageCount}</p>
      <button type="button" disabled={busy !== null} onClick={() => save(plan.pdf, plan.parentBuild.output.fileName)}>{copy.download}</button>
      <button type="button" disabled={busy !== null} onClick={() => saveJson(serializePublicationBuildManifest(plan.parentBuild), publicationBuildManifestFileName(plan.parentBuild.output.fileName))}>{auditLabel}: {plan.parentBuild.output.fileName}</button>
      <fieldset disabled={busy !== null}>
        {plan.proposals.map((proposal, index) => {
          const row = rows[index];
          if (!row) return null;
          return <article key={proposal.rootSectionId} className="issue-pdf-review-row">
            <strong>{index + 1}. {proposal.title}</strong>
            <small>{proposal.problem ? copy.uncertain : copy.proposed}</small>
            <div className="issue-pdf-review-fields">
              <label>{copy.first}<input type="number" inputMode="numeric" min={1} max={plan.pageCount} step={1}
                value={row.first} onChange={event => edit(row.rootSectionId, 'first', event.target.value)} /></label>
              <label>{copy.last}<input type="number" inputMode="numeric" min={1} max={plan.pageCount} step={1}
                value={row.last} onChange={event => edit(row.rootSectionId, 'last', event.target.value)} /></label>
            </div>
            <label><input type="checkbox" checked={row.reviewed} onChange={event => confirm(row.rootSectionId, event.target.checked)} /> {copy.review}</label>
          </article>;
        })}
      </fieldset>
      {!valid ? <p>{copy.invalid}</p> : null}
      <button type="button" disabled={!valid || busy !== null} onClick={() => void extract()}>{busy === 'extract' ? copy.extracting : copy.extract}</button>
      {outputs.length ? <div role="status"><p>{copy.ready}</p>{outputs.map((output, index) =>
        <div key={output.rootSectionId}>
          <button type="button" disabled={busy !== null} onClick={() => save(output.pdf, output.fileName)}>{copy.save}: {plan.proposals[index]?.title}</button>
          <button type="button" disabled={busy !== null} onClick={() => saveJson(serializePublicationBuildManifest(output.build), publicationBuildManifestFileName(output.fileName))}>{auditLabel}: {output.fileName}</button>
          <button type="button" disabled={busy !== null} onClick={() => saveJson(output.derivationText, output.fileName + '.omi-derivation.json')}>{derivationLabel}: {output.fileName}</button>
        </div>
      )}</div> : null}
    </> : null}
    {error ? <p role="alert">{error}</p> : null}
  </section>;
}
