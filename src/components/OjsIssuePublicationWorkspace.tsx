import { useRef, useState } from 'react';
import { useStudioStore } from '../app/useStudioStore';
import { externalizeActiveManuscriptAssets } from '../app/assetActions';
import { prepareOjsIssueBatch, type IssueBatchFormat, type IssueBatchSelection, type PreparedIssueBatch, type IssueBatchResult } from '../app/ojsIssueBatchActions';
import { assertOjsProductionTarget } from '../app/ojsPublicationActions';
import { listOjsIssueTransferTargets, assertIssueArtifactTarget, issueArtifactInspectRequest, type OjsIssueTransferTarget } from '../model/ojsIssueTransferTargets';
import { useTranslation } from '../i18n';
import { requestPublicationArtifact, type IntegrationConnection } from '../services/integrationApi';
import type { PreparedPublicationArtifact, PublicationArtifactTarget } from '../services/publicationArtifact';
import { prepareIssueStudyPublication } from '../services/issueStudyPublication';
import { getStudioApiBaseUrl } from '../services/studioServer';
import { loadPublicationPublisherIdentity, type PublicationStyle } from '../services/publicationStyleExport';
import { publicationLayoutKey } from '../services/styledPublicationArtifact';
import { saveExportBlob } from '../services/exportFileDelivery';
import type { OmiManuscript } from '../types/omi';
import { IssuePdfRangeReviewPanel, type ApprovedIssuePdfSet } from './IssuePdfRangeReviewPanel';
import './OjsIssuePublicationWorkspace.css';

const formats: readonly IssueBatchFormat[] = ['pdf-print', 'html', 'jats'];
const names: Record<IssueBatchFormat, string> = { 'pdf-print': 'PDF', html: 'HTML', jats: 'JATS XML' };
const translations = {
  hu: { title: 'Teljes lapszám átadása az OJS-be', help: 'Válassza ki a kapcsolatot, ellenőrizze a tanulmányokat, majd jelölje ki az átadandó formátumokat. A művelet nem publikálja a lapszámot.', connection: 'OJS-kapcsolat', choose: 'Válasszon', inspect: 'OJS-célpontok ellenőrzése', language: 'Nyelv', genre: 'Fájltípus', select: 'Kiválasztott formátumok', pdfHelp: 'PDF-átadáshoz előbb ellenőrizze és készítse el a tanulmányok PDF-jeit.', prepare: 'Kijelölt fájlok előkészítése', ready: 'Előkészített fájlok', save: 'Mentés ellenőrzéshez', confirm: 'Ellenőriztem a fájlokat és az OJS-célpontokat. Jóváhagyom a visszatöltést.', transfer: 'Visszatöltés az OJS-be', busy: 'Feldolgozás folyamatban…', stale: 'A lapszám, az oldaltartomány vagy a kapcsolat megváltozott. Ellenőrizze újra.', noTargets: 'Nincs eredeti OJS-bejegyzéshez kapcsolt tanulmány.', success: 'Minden kijelölt fájl átvitele igazolt.', partial: 'Az átvitel megállt. A már igazolt fájlok megmaradnak az OJS-ben.', uncertain: 'Az utolsó fájl állapota bizonytalan. Ellenőrizze az OJS-ben, mielőtt újra megpróbálná.', reviewed: 'Ellenőriztem az OJS-ben az előző átvitel eredményét.', receipts: 'Igazolt átvitelek', missing: 'Válasszon legalább egy formátumot, nyelvet és fájltípust.', noConnection: 'Nincs engedélyezett OJS-kapcsolat.', excluded: 'A nem OJS-hez kapcsolt tanulmányok nem tölthetők vissza.' },
  en: { title: 'Transfer complete issue to OJS', help: 'Choose the connection, inspect articles and select the formats to transfer. This does not publish the issue.', connection: 'OJS connection', choose: 'Choose', inspect: 'Inspect OJS targets', language: 'Language', genre: 'File component', select: 'Selected formats', pdfHelp: 'For PDF transfer, first review the physical ranges and build the study PDFs.', prepare: 'Prepare selected files', ready: 'Prepared files', save: 'Save for review', confirm: 'I reviewed the files and OJS destinations. I approve transfer.', transfer: 'Transfer to OJS', busy: 'Processing…', stale: 'The issue, page range or connection changed. Inspect again.', noTargets: 'No studies linked to original OJS records.', success: 'All selected files have confirmed receipts.', partial: 'Transfer stopped. Confirmed files remain in OJS.', uncertain: 'The last file outcome is uncertain. Inspect OJS before retrying.', reviewed: 'I checked the previous transfer result in OJS.', receipts: 'Confirmed transfers', missing: 'Select at least one format, language and file component.', noConnection: 'No enabled OJS connection.', excluded: 'Studies without OJS links cannot be transferred.' },
  de: { title: 'Gesamte Ausgabe an OJS übertragen', help: 'Wählen Sie die Verbindung, prüfen Sie die Beiträge und wählen Sie die Formate. Die Ausgabe wird nicht veröffentlicht.', connection: 'OJS-Verbindung', choose: 'Auswählen', inspect: 'OJS-Ziele prüfen', language: 'Sprache', genre: 'Dateikomponente', select: 'Ausgewählte Formate', pdfHelp: 'Für PDF-Übertragung zuerst Seitenbereiche prüfen und Beitrags-PDFs erstellen.', prepare: 'Ausgewählte Dateien vorbereiten', ready: 'Vorbereitete Dateien', save: 'Zur Prüfung speichern', confirm: 'Dateien und OJS-Ziele geprüft. Übertragung bestätigen.', transfer: 'An OJS übertragen', busy: 'Verarbeitung läuft…', stale: 'Ausgabe, Seitenbereich oder Verbindung geändert. Erneut prüfen.', noTargets: 'Keine Beiträge mit ursprünglichen OJS-Einträgen verknüpft.', success: 'Alle ausgewählten Dateien wurden bestätigt.', partial: 'Übertragung gestoppt. Bestätigte Dateien bleiben in OJS.', uncertain: 'Status der letzten Datei unklar. Vor erneutem Versuch OJS prüfen.', reviewed: 'Vorheriges Übertragungsergebnis in OJS geprüft.', receipts: 'Bestätigte Übertragungen', missing: 'Mindestens ein Format, Sprache und Dateikomponente wählen.', noConnection: 'Keine aktivierte OJS-Verbindung.', excluded: 'Beiträge ohne OJS-Verknüpfung können nicht übertragen werden.' },
} as const;

interface Row { target: OjsIssueTransferTarget; remote: PublicationArtifactTarget; formats: IssueBatchFormat[]; locale: string; genre: string }
interface Inspected { source: OmiManuscript; origin: string; connection: string; rows: Row[] }
interface Prepared { source: OmiManuscript; key: string; origin: string; connection: string; pdf: ApprovedIssuePdfSet | null; batch: PreparedIssueBatch; artifacts: Map<string, PreparedPublicationArtifact> }

export function OjsIssuePublicationWorkspace({ style, active, connections }: { style: PublicationStyle; active: boolean; connections: readonly IntegrationConnection[] }) {
  const { locale } = useTranslation();
  const copy = translations[locale as keyof typeof translations] ?? translations.en;
  const manuscript = useStudioStore(state => state.manuscript);
  const [connection, setConnection] = useState('');
  const [inspected, setInspected] = useState<Inspected>();
  const [pdf, setPdf] = useState<ApprovedIssuePdfSet | null>(null);
  const [prepared, setPrepared] = useState<Prepared>();
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<IssueBatchResult>();
  const [needsReview, setNeedsReview] = useState(false);
  const lock = useRef(false);
  const pdfLock = useRef(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const latest = useRef({ style, active, connection, connections, pdf });
  latest.current = { style, active, connection, connections, pdf };
  const layoutKey = () => publicationLayoutKey({ style: latest.current.style, identity: loadPublicationPublisherIdentity() });
  const origin = getStudioApiBaseUrl();
  const inspectionCurrent = inspected?.source === manuscript && inspected.connection === connection && inspected.origin === origin &&
    connections.some(item => item.id === connection && item.enabled);
  const pdfCurrent = pdf?.plan.source === manuscript && pdf.plan.layoutKey === layoutKey() && pdf.origin === origin;
  const preparedCurrent = !!prepared && prepared.source === manuscript && prepared.connection === connection &&
    prepared.origin === origin && prepared.key === layoutKey() && (!prepared.pdf || prepared.pdf === pdf) && inspectionCurrent;
  const rows = inspectionCurrent ? inspected.rows : [];
  const selected = rows.filter(row => row.formats.length);
  const canPrepare = selected.length > 0 && selected.every(row => row.locale && row.genre &&
    (!row.formats.includes('pdf-print') || (pdfCurrent && pdf?.outputs.some(item => item.rootSectionId === row.target.rootSectionId))));
  const invalidate = () => { setPrepared(undefined); setConfirmed(false); };
  const fail = (cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause));
  const assertDestination = (expectedConnection: string, expectedOrigin: string, source: OmiManuscript) => {
    const current = latest.current;
    if (!current.active || current.connection !== expectedConnection ||
      !current.connections.some(item => item.id === expectedConnection && item.enabled) ||
      getStudioApiBaseUrl() !== expectedOrigin || useStudioStore.getState().manuscript !== source) throw new Error(copy.stale);
  };
  function changeRow(id: string, update: (row: Row) => Row) {
    invalidate();
    setInspected(previous => previous ? { ...previous, rows: previous.rows.map(row => row.target.rootSectionId === id ? update(row) : row) } : previous);
  }
  async function inspect() {
    if (lock.current || pdfLock.current || !connection || needsReview) return;
    lock.current = true; setBusy(true); setError(''); invalidate(); setInspected(undefined);
    try {
      // Existing approved PDFs are tied to a committed snapshot. Avoid creating
      // another revision just to inspect destinations.
      if (!pdfCurrent) {
        await externalizeActiveManuscriptAssets();
        if (!latest.current.active || latest.current.connection !== connection || getStudioApiBaseUrl() !== origin || useStudioStore.getState().manuscript.id !== manuscript.id) throw new Error(copy.stale);
        useStudioStore.getState().checkpoint('export');
      }
      const source = useStudioStore.getState().manuscript;
      const targetList = listOjsIssueTransferTargets(source);
      if (!targetList.length) throw new Error(copy.noTargets);
      const inspectedRows: Row[] = [];
      for (const target of targetList) {
        assertDestination(connection, origin, source);
        const response = await requestPublicationArtifact(connection, issueArtifactInspectRequest(target, source.id));
        assertDestination(connection, origin, source);
        if (!response.target || response.receipt) throw new Error(copy.stale);
        assertIssueArtifactTarget(target, response.target); assertOjsProductionTarget(response.target);
        inspectedRows.push({ target, remote: response.target, formats: [],
          locale: response.target.locales.includes(source.locale) ? source.locale : '',
          genre: response.target.genres.length === 1 ? String(response.target.genres[0]!.id) : '' });
      }
      setInspected({ source, connection, origin, rows: inspectedRows });
    } catch (cause) { fail(cause); }
    finally { lock.current = false; setBusy(false); }
  }
  async function prepare() {
    if (lock.current || pdfLock.current || !inspectionCurrent || !canPrepare || needsReview) return;
    lock.current = true; setBusy(true); setError(''); invalidate();
    try {
      const source = manuscript, key = layoutKey();
      const selectedPdf = selected.some(row => row.formats.includes('pdf-print')) ? pdf : null;
      const assertCurrent = () => {
        assertDestination(connection, origin, source);
        if (layoutKey() !== key || (selectedPdf && latest.current.pdf !== selectedPdf)) throw new Error(copy.stale);
      };
      assertCurrent();
      const selections: IssueBatchSelection[] = selected.map(row => ({
        rootSectionId: row.target.rootSectionId, formats: row.formats, locale: row.locale, genreId: Number(row.genre),
      }));
      const artifacts = new Map<string, PreparedPublicationArtifact>();
      const batch = await prepareOjsIssueBatch({
        source, layoutKey: key, connectionId: connection,
        currentSource: () => { assertCurrent(); return useStudioStore.getState().manuscript; },
        currentLayoutKey: layoutKey, currentConnectionId: () => latest.current.connection,
        send: async (connectionId, request) => {
          const response = await requestPublicationArtifact(connectionId, request);
          if (request.action === 'inspect' && response.target?.workflowToken !== selected.find(row => row.target.submissionId === request.submissionId)?.remote.workflowToken) throw new Error(copy.stale);
          return response;
        },
        prepare: async (target, wanted) => {
          const outputs: PreparedPublicationArtifact[] = [];
          const textual = wanted.filter((format): format is 'html' | 'jats' => format !== 'pdf-print');
          if (textual.length) outputs.push(...(await prepareIssueStudyPublication(source, target.rootSectionId, textual)).artifacts);
          if (wanted.includes('pdf-print')) {
            const item = selectedPdf?.outputs.find(output => output.rootSectionId === target.rootSectionId);
            if (!item || selectedPdf?.plan.source !== source || selectedPdf.plan.layoutKey !== key ||
                item.derivation.rootSectionId !== target.rootSectionId) throw new Error(copy.pdfHelp);
            outputs.push({ format: 'pdf-print', mediaType: 'application/pdf', fileName: item.fileName,
              bytes: new Uint8Array(await item.pdf.arrayBuffer()), artifactBase64: '', build: item.build });
          }
          outputs.forEach(output => artifacts.set(target.rootSectionId + ':' + output.format, output));
          return outputs;
        },
      }, selections);
      assertCurrent();
      setPrepared({ source, key, origin, connection, pdf: selectedPdf, batch, artifacts });
    } catch (cause) { fail(cause); }
    finally { lock.current = false; setBusy(false); }
  }
  async function transfer() {
    if (lock.current || pdfLock.current || !prepared || !preparedCurrent || !confirmed || needsReview) return;
    lock.current = true; setBusy(true); setError(''); setConfirmed(false);
    try {
      const outcome = await prepared.batch.execute(true);
      setResult(previous => ({ ...outcome, receipts: [...(previous?.receipts ?? []), ...outcome.receipts] }));
      if (outcome.failed) setNeedsReview(true);
    } catch (cause) { fail(cause); }
    finally { invalidate(); setInspected(undefined); lock.current = false; setBusy(false); }
  }
  const approvePdf = (value: ApprovedIssuePdfSet | null) => {
    latest.current.pdf = value; setPdf(value); invalidate();
  };
  return <section className="ojs-issue-workspace" aria-label={copy.title}>
    <h4>{copy.title}</h4><p>{copy.help}</p><p>{copy.excluded}</p>
    <fieldset disabled={busy || needsReview}>
      <IssuePdfRangeReviewPanel style={style} active={active && !busy && !needsReview} onApproved={approvePdf} onBusyChange={value => { pdfLock.current = value; setPdfBusy(value); }} />
    </fieldset>
    <fieldset disabled={busy || pdfBusy || needsReview}>
      <label>{copy.connection}<select value={connection} onChange={event => {
        latest.current.connection = event.target.value; setConnection(event.target.value); setInspected(undefined); invalidate();
      }}><option value="">{copy.choose}</option>{connections.map(item => <option key={item.id} value={item.id}>{item.displayName ?? item.connectionKey}</option>)}</select></label>
      {!connections.length ? <p>{copy.noConnection}</p> : null}
      <button type="button" disabled={!connection} onClick={() => void inspect()}>{copy.inspect}</button>
      {inspected && !inspectionCurrent ? <p role="alert">{copy.stale}</p> : null}
      {rows.map(row => <article key={row.target.rootSectionId} className="ojs-issue-workspace-row">
        <strong>{row.target.title}</strong><small>OJS #{row.target.submissionId} / {row.target.publicationId}</small>
        <div className="ojs-live-publication-fields">
          <label>{copy.language}<select value={row.locale} onChange={event => changeRow(row.target.rootSectionId, old => ({ ...old, locale: event.target.value }))}>
            <option value="">{copy.choose}</option>{row.remote.locales.map(item => <option key={item}>{item}</option>)}
          </select></label>
          <label>{copy.genre}<select value={row.genre} onChange={event => changeRow(row.target.rootSectionId, old => ({ ...old, genre: event.target.value }))}>
            <option value="">{copy.choose}</option>{row.remote.genres.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select></label>
        </div>
        <div className="ojs-live-publication-choices" aria-label={copy.select}>{formats.map(format => <label key={format}>
          <input type="checkbox" checked={row.formats.includes(format)} disabled={!row.remote.formats.some(item => item.id === format && item.available)}
            onChange={event => changeRow(row.target.rootSectionId, old => ({ ...old, formats: event.target.checked ? [...old.formats, format] : old.formats.filter(item => item !== format) }))} /> {names[format]}
        </label>)}</div>
      </article>)}
      {selected.some(row => row.formats.includes('pdf-print')) && !pdfCurrent ? <p>{copy.pdfHelp}</p> : null}
      <button type="button" disabled={!canPrepare} onClick={() => void prepare()}>{copy.prepare}</button>
      {prepared ? <>
        <h5>{copy.ready}</h5>
        <ul>{prepared.batch.files.map(file => <li key={file.rootSectionId + ':' + file.format}>
          {file.title} · {names[file.format]} · {file.fileName} · {Math.ceil(file.byteLength / 1024)} KB
          <button type="button" disabled={!preparedCurrent} onClick={() => {
            const artifact = prepared.artifacts.get(file.rootSectionId + ':' + file.format);
            if (artifact) void saveExportBlob(new Blob([new Uint8Array(artifact.bytes).buffer], { type: artifact.mediaType }), artifact.fileName).catch(fail);
          }}>{copy.save}</button>
        </li>)}</ul>
        {!preparedCurrent ? <p role="alert">{copy.stale}</p> : null}
        <label><input type="checkbox" checked={confirmed && preparedCurrent} disabled={!preparedCurrent} onChange={event => setConfirmed(event.target.checked)} /> {copy.confirm}</label>
        <button type="button" disabled={!confirmed || !preparedCurrent} onClick={() => void transfer()}>{copy.transfer}</button>
      </> : null}
    </fieldset>
    {busy ? <p role="status">{copy.busy}</p> : null}
    {error ? <p role="alert">{error}</p> : null}
    {result ? <div role="status"><p>{result.failed ? copy.partial : copy.success}</p>
      {result.failed ? <p>{result.failed.file.title} · {names[result.failed.file.format]}: {result.failed.message}</p> : null}
      <h5>{copy.receipts}</h5><ul>{result.receipts.map((item, index) => <li key={item.receipt.buildId + ':' + index}>
        OJS #{item.receipt.submissionId} · {item.receipt.format} · #{item.receipt.galleyId} ✓
      </li>)}</ul>
    </div> : null}
    {needsReview ? <><p role="alert">{copy.uncertain}</p><label><input type="checkbox" checked={false} onChange={event => { if (event.target.checked) setNeedsReview(false); }} /> {copy.reviewed}</label></> : null}
  </section>;
}
