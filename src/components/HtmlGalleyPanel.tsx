import { useEffect, useState } from 'react';
import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import { getDocumentStructureProfile } from '../model/documentProfile';
import { buildHtmlGalley, type HtmlGalleyTarget, type HtmlGalleyReceipt } from '../services/htmlGalley';
import { getIntegrationCatalog, requestHtmlGalley, type IntegrationConnection } from '../services/integrationApi';
import type { OmiManuscript } from '../types/omi';
import './DirectSubmissionPanel.css';

const text = {
  hu: {
    title: 'HTML-változat átadása az OJS-nek', intro: 'Egy meglévő, még nem publikált, előállítási szakaszban lévő cikkhez. Az OJS szerkesztője ellenőrzi és teszi közzé a HTML-t.',
    connection: 'OJS-kapcsolat', choose: 'Válassz…', key: 'A személyes profilban mentett OJS-kulcsot használjuk',
    id: 'Az OJS-beküldés azonosítója', inspect: 'Célcikk ellenőrzése és HTML-előnézet',
    locale: 'HTML-változat nyelve', genre: 'Cikkfájl típusa', confirm: 'Ellenőriztem a célcikket és az előnézetet. Átadom a HTML-t; a korábban innen átadott, azonos nyelvű változat frissül.',
    transfer: 'HTML átadása', preview: 'HTML-előnézet', busy: 'Feldolgozás…',
    success: 'A HTML az OJS-ben van, szerkesztői ellenőrzésre vár. Közzététel nem történt.',
    unchanged: 'Ez a HTML-változat már az OJS-ben van; nem készült új példány.',
    study: 'Nyiss meg egy önálló tanulmányt.', noConnections: 'Először állíts be OJS-kapcsolatot az Integrációk menüben.',
    changed: 'A kézirat változott. Készíts új előnézetet.', publication: 'Publikációváltozat', galley: 'HTML-változat azonosítója',
    help: 'OJS 3.5 és HTML-átadást támogató Studio Integration bővítmény szükséges. A képek beágyazva kerülnek át (PNG/JPEG/GIF/WebP, összesen legfeljebb 8 MiB HTML).',
  },
  en: {
    title: 'Transfer HTML to OJS', intro: 'For an existing unpublished article in production. The OJS editor reviews and publishes the HTML.',
    connection: 'OJS connection', choose: 'Choose…', key: 'Editorial OJS API key (not saved)',
    id: 'OJS submission ID', inspect: 'Check destination and preview HTML',
    locale: 'HTML language', genre: 'Article file genre', confirm: 'I checked the destination and preview. Transfer the HTML, updating the version previously transferred from this study in this language.',
    transfer: 'Transfer HTML', preview: 'HTML preview', busy: 'Processing…',
    success: 'The HTML is in OJS, awaiting editorial review. Nothing has been published.',
    unchanged: 'This HTML version is already in OJS; no duplicate was created.',
    study: 'Open a standalone study.', noConnections: 'First configure an OJS connection in Integrations.',
    changed: 'The manuscript changed. Prepare a new preview.', publication: 'Publication version', galley: 'HTML galley ID',
    help: 'Requires OJS 3.5 and a Studio Integration plugin supporting HTML transfer. Images are embedded (PNG/JPEG/GIF/WebP; at most 8 MiB of HTML).',
  },
};

export function HtmlGalleyPanel() {
  const manuscript = useStudioStore((s) => s.manuscript);
  return <HtmlGalleyForm key={manuscript.id} manuscript={manuscript} />;
}
function HtmlGalleyForm({ manuscript }: { manuscript: OmiManuscript }) {
  const { locale: uiLocale } = useTranslation();
  const copy = uiLocale === 'hu' ? text.hu : text.en;
  const [connections, setConnections] = useState<IntegrationConnection[]>([]);
  const [connectionId, setConnectionId] = useState('');
  const [submissionId, setSubmissionId] = useState('');
  const [prepared, setPrepared] = useState<{ html: string; target: HtmlGalleyTarget; source: OmiManuscript }>();
  const [locale, setLocale] = useState('');
  const [genreId, setGenreId] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<HtmlGalleyReceipt>();
  useEffect(() => {
    let active = true;
    void getIntegrationCatalog().then((catalog) => {
      if (active) setConnections(catalog.filter((p) => p.id === 'ojs').flatMap((p) => p.connections).filter((c) => c.enabled));
    }).catch((e: unknown) => { if (active) setError(String(e)); });
    return () => { active = false; };
  }, []);
  function invalidate() { setPrepared(undefined); setConfirmed(false); setReceipt(undefined); setError(''); }
  async function inspect() {
    invalidate(); setBusy(true);
    try {
      const [html, result] = await Promise.all([
        buildHtmlGalley(manuscript),
        requestHtmlGalley(connectionId, { action: 'inspect', manuscriptId: manuscript.id, submissionId: Number(submissionId) }),
      ]);
      if (!result.target) throw new Error('OJS returned no destination.');
      setPrepared({ html, target: result.target, source: manuscript });
      setLocale(result.target.locales.includes(manuscript.locale) ? manuscript.locale : result.target.locales[0] ?? '');
      setGenreId(String(result.target.genres[0]?.id ?? ''));
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  async function transfer() {
    if (!prepared || prepared.source !== manuscript || !confirmed) return;
    setBusy(true); setError(''); setReceipt(undefined);
    try {
      const result = await requestHtmlGalley(connectionId, {
        action: 'transfer', manuscriptId: manuscript.id, submissionId: prepared.target.submissionId,
        publicationId: prepared.target.publicationId, locale, genreId: Number(genreId), html: prepared.html, confirmed: true,
      });
      if (!result.receipt) throw new Error('OJS returned no receipt.');
      setReceipt(result.receipt); setConfirmed(false);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  const valid = Number.isSafeInteger(Number(submissionId)) && Number(submissionId) > 0;
  return <section className="omi-direct-submission" aria-label={copy.title}>
    <h3>{copy.title}</h3><p>{copy.intro}</p><p>{copy.help}</p>
    {getDocumentStructureProfile(manuscript).kind !== 'study' ? <p>{copy.study}</p> : <>
      {!connections.length && <p>{copy.noConnections}</p>}
      <fieldset disabled={busy}>
        <label>{copy.connection}<select value={connectionId} onChange={(e) => { invalidate(); setConnectionId(e.target.value); }}>
          <option value="">{copy.choose}</option>{connections.map((c) => <option key={c.id} value={c.id}>{c.displayName}</option>)}
        </select></label>
        <label>{copy.id}<input type="number" min="1" step="1" value={submissionId} onChange={(e) => { invalidate(); setSubmissionId(e.target.value); }} /></label>
        <p>{copy.key}</p><button type="button" disabled={!connectionId || !valid} onClick={() => void inspect()}>{copy.inspect}</button>
        {prepared && <>
          <p><strong>{prepared.target.title}</strong> · OJS #{prepared.target.submissionId} · {copy.publication}: {prepared.target.publicationId}</p>
          <iframe title={copy.preview} sandbox="" srcDoc={prepared.html} style={{ width: '100%', height: '24rem', background: 'white', border: '1px solid #ccc' }} />
          <label>{copy.locale}<select value={locale} onChange={(e) => { setLocale(e.target.value); setConfirmed(false); setReceipt(undefined); }}>{prepared.target.locales.map((l) => <option key={l}>{l}</option>)}</select></label>
          <label>{copy.genre}<select value={genreId} onChange={(e) => { setGenreId(e.target.value); setConfirmed(false); setReceipt(undefined); }}>{prepared.target.genres.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}</select></label>
          {prepared.source !== manuscript && <p role="status">{copy.changed}</p>}
          <label className="omi-direct-submission-confirm"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />{copy.confirm}</label>
          <button type="button" disabled={!confirmed || !locale || !genreId || prepared.source !== manuscript} onClick={() => void transfer()}>{copy.transfer}</button>
        </>}
      </fieldset>
      {busy && <p role="status">{copy.busy}</p>}
      {receipt && <p role="status">{receipt.unchanged ? copy.unchanged : copy.success} {copy.galley}: {receipt.galleyId}</p>}
    </>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
