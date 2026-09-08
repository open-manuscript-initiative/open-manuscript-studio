import { useEffect, useState } from 'react';
import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import { getDocumentStructureProfile } from '../model/documentProfile';
import { createDirectSubmissionSnapshot } from '../model/directSubmissionSnapshot';
import { buildDocxExport } from '../services/exportDocx';
import { getIntegrationCatalog, requestDirectSubmission, type IntegrationConnection } from '../services/integrationApi';
import type { SubmissionAuthor, SubmissionOptions, SubmissionReceipt, SubmissionSnapshot } from '../services/directSubmissionTypes';
import type { OmiManuscript } from '../types/omi';
import './DirectSubmissionPanel.css';

const text = {
  hu: {
    title: 'Tanulmány beküldése OJS / OMP rendszerbe', intro: 'Válaszd ki a folyóiratot vagy kiadót. Először piszkozatot és fájlokat küldünk át, majd a célrendszer ellenőrzése után véglegesítheted a beküldést.',
    destination: 'Folyóirat / kiadó', choose: 'Válassz…', noConnections: 'Először adj hozzá OJS- vagy OMP-kapcsolatot az Integrációk menüben.',
    key: 'Szerzői API-kulcs a célrendszerből', keyHelp: 'Az OJS/OMP szerzői profilod API-kulcsa szükséges. A kulcsot nem mentjük el; a plugin megosztott titka nem helyettesíti.',
    language: 'A tanulmány nyelve', section: 'Rovat / sorozat', genre: 'Kéziratfájl típusa', heading: 'Cím', abstract: 'Összefoglaló', keywords: 'Kulcsszavak (pontosvesszővel elválasztva)',
    authors: 'Szerzők, megjelenési sorrendben', given: 'Utónév', family: 'Családnév', email: 'E-mail', add: 'Szerző hozzáadása', remove: 'Eltávolítás',
    authorHelp: 'Az első szerző lesz a kapcsolattartó. Az API-kulcshoz tartozó szerző is szerepeljen a listában. Ellenőrizd minden szerző nevét és e-mail-címét.',
    requirements: 'A célrendszer beküldési feltételei', consent: 'Elolvastam és elfogadom a célrendszer beküldési, szerzői jogi és adatkezelési feltételeit; jogosult vagyok a kézirat beküldésére.',
    prepare: 'Piszkozat átadása és ellenőrzése', submit: 'Beküldés véglegesítése', busy: 'Feldolgozás…', ready: 'A piszkozat és a DOCX + OMI fájlok átadva. A célrendszer ellenőrzése sikeres. A beküldés még nincs véglegesítve.',
    submitted: 'A tanulmány beküldése sikeres.', open: 'Beküldés megnyitása a célrendszerben', refresh: 'Állapot lekérdezése',
    changed: 'A dokumentum vagy az adatok változtak. A véglegesítés előtt add át újra a piszkozatot.',
    studyOnly: 'Nyiss meg egy önálló tanulmányt a beküldéshez.', closed: 'Ez a célrendszer jelenleg nem fogad beküldéseket.',
    snapshot: 'Az aktuális tanulmány DOCX és teljes OMI formátumban kerül átadásra, a megadott szerzőkkel és adatokkal.',
    omp: 'OMP-ben új önálló kézirat jön létre. Ez nem csatol fejezetet egy már meglévő kötethez.',
    uncertain: 'A létrehozás eredménye nem ismert. Ellenőrizd a szerzői fiókodat a célrendszerben; ne indíts új beküldést ugyanebből a kéziratból.',
    draft: 'A piszkozat azonosítója:', status: 'Állapot:', warning: 'DOCX-export megjegyzései:',
  },
  en: {
    title: 'Submit an article to OJS / OMP', intro: 'Choose a journal or press. Transfer a draft and its files, then finalize the submission after the publishing system validates it.',
    destination: 'Journal / press', choose: 'Choose…', noConnections: 'Add an OJS or OMP connection in Integrations first.',
    key: 'Author API key from the destination', keyHelp: 'Use the API key from your OJS/OMP author profile. The key is not saved. The plugin shared secret is not an author credential.',
    language: 'Submission language', section: 'Section / series', genre: 'Manuscript file component', heading: 'Title', abstract: 'Abstract', keywords: 'Keywords (separated by semicolons)',
    authors: 'Authors in publication order', given: 'Given name', family: 'Family name', email: 'Email', add: 'Add author', remove: 'Remove',
    authorHelp: 'The first author will be the primary contact. Include the author who owns the API key. Check every author’s name and email.',
    requirements: 'Destination submission requirements', consent: 'I have read and accept the destination’s submission, copyright and privacy terms and am authorized to submit this manuscript.',
    prepare: 'Transfer and validate draft', submit: 'Finalize submission', busy: 'Processing…', ready: 'The draft and DOCX + OMI files were transferred and validated. The submission has not been finalized yet.',
    submitted: 'The manuscript was submitted successfully.', open: 'Open submission in publishing system', refresh: 'Check status',
    changed: 'The document or metadata changed. Transfer the draft again before finalizing.', studyOnly: 'Open a standalone study to submit.', closed: 'This destination is not accepting submissions.',
    snapshot: 'The current study will be transferred as DOCX and complete OMI files with the authors and metadata shown here.',
    omp: 'OMP creates a new standalone manuscript. This does not attach a chapter to an existing book.',
    uncertain: 'The creation result is unknown. Check your author account in the publishing system before attempting any new submission of this manuscript.',
    draft: 'Draft identifier:', status: 'Status:', warning: 'DOCX export notes:',
  },
  de: {
    title: 'Beitrag bei OJS / OMP einreichen', intro: 'Wählen Sie eine Zeitschrift oder einen Verlag. Übertragen Sie einen Entwurf mit Dateien und bestätigen Sie die Einreichung nach der Prüfung durch das Zielsystem.',
    destination: 'Zeitschrift / Verlag', choose: 'Auswählen…', noConnections: 'Fügen Sie zuerst eine OJS- oder OMP-Verbindung unter Integrationen hinzu.',
    key: 'API-Schlüssel des Autorenkontos im Zielsystem', keyHelp: 'Verwenden Sie den Schlüssel Ihres OJS/OMP-Autorenprofils. Er wird nicht gespeichert. Das gemeinsame Plugin-Geheimnis ist kein Autorenschlüssel.',
    language: 'Sprache des Beitrags', section: 'Rubrik / Reihe', genre: 'Dateikomponente', heading: 'Titel', abstract: 'Zusammenfassung', keywords: 'Schlagwörter (durch Semikolon getrennt)',
    authors: 'Autoren in Veröffentlichungsreihenfolge', given: 'Vorname', family: 'Nachname', email: 'E-Mail', add: 'Autor hinzufügen', remove: 'Entfernen',
    authorHelp: 'Der erste Autor wird Kontaktperson. Nehmen Sie den Inhaber des API-Schlüssels auf. Prüfen Sie alle Namen und E-Mail-Adressen.',
    requirements: 'Einreichungsbedingungen des Zielsystems', consent: 'Ich habe die Einreichungs-, Urheberrechts- und Datenschutzbedingungen gelesen und akzeptiert und bin zur Einreichung berechtigt.',
    prepare: 'Entwurf übertragen und prüfen', submit: 'Einreichung abschließen', busy: 'Verarbeitung…', ready: 'Entwurf und DOCX- sowie OMI-Dateien wurden übertragen und geprüft. Die Einreichung ist noch nicht abgeschlossen.',
    submitted: 'Der Beitrag wurde erfolgreich eingereicht.', open: 'Einreichung im Zielsystem öffnen', refresh: 'Status prüfen', changed: 'Dokument oder Angaben wurden geändert. Übertragen Sie den Entwurf erneut.',
    studyOnly: 'Öffnen Sie einen eigenständigen Beitrag zur Einreichung.', closed: 'Dieses Zielsystem nimmt keine Einreichungen an.',
    snapshot: 'Der aktuelle Beitrag wird als DOCX und vollständige OMI-Datei mit den angezeigten Autoren und Metadaten übertragen.',
    omp: 'OMP erstellt ein neues eigenständiges Manuskript. Es wird kein Kapitel an ein vorhandenes Buch angehängt.',
    uncertain: 'Das Ergebnis der Erstellung ist unbekannt. Prüfen Sie Ihr Autorenkonto im Zielsystem, bevor Sie eine neue Einreichung versuchen.',
    draft: 'Entwurfskennung:', status: 'Status:', warning: 'Hinweise zum DOCX-Export:',
  },
};
function authorsFrom(manuscript: OmiManuscript): SubmissionAuthor[] {
  const authors = manuscript.contributions.filter((c) => c.roles.includes('author')).sort((a,b) => (a.order ?? 0) - (b.order ?? 0)).map((c) => {
    const agent = manuscript.agents.find((a) => a.id === c.agentId);
    const name = agent?.names.find((n) => n.preferred) ?? agent?.names[0];
    return { agentId: c.agentId, givenName: name?.givenName ?? name?.value ?? '', familyName: name?.familyName ?? '', email: '' };
  });
  return authors.length ? authors : [{ givenName: '', familyName: '', email: '' }];
}
function readable(value: unknown): string {
  if (typeof value === 'string') return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  if (Array.isArray(value)) return value.map(readable).join('\n');
  if (value && typeof value === 'object') return Object.values(value).map(readable).join('\n');
  return '';
}
function base64(bytes: Uint8Array): string {
  let result = '';
  for (let i = 0; i < bytes.length; i += 8192) result += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(result);
}
export function DirectSubmissionPanel() {
  const manuscript = useStudioStore((s) => s.manuscript);
  return <SubmissionForm key={manuscript.id} manuscript={manuscript} />;
}
function SubmissionForm({ manuscript }: { manuscript: OmiManuscript }) {
  const { locale } = useTranslation();
  const copy = locale === 'hu' ? text.hu : locale === 'de' ? text.de : text.en;
  const [connections, setConnections] = useState<IntegrationConnection[]>([]);
  const [connectionId, setConnectionId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [options, setOptions] = useState<SubmissionOptions | null>(null);
  const [receipt, setReceipt] = useState<SubmissionReceipt | null>(null);
  const [title, setTitle] = useState(manuscript.title);
  const [abstract, setAbstract] = useState(manuscript.abstract ?? '');
  const [keywords, setKeywords] = useState(manuscript.keywords.join('; '));
  const [language, setLanguage] = useState(manuscript.locale);
  const [authors, setAuthors] = useState<SubmissionAuthor[]>(() => authorsFrom(manuscript));
  const [sectionId, setSectionId] = useState('');
  const [genreId, setGenreId] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [preparedSource, setPreparedSource] = useState('');
  const [preparedFields, setPreparedFields] = useState('');
  const currentSource = JSON.stringify(manuscript);
  const fields = JSON.stringify({ title, abstract, keywords, language, authors, sectionId, genreId });
  const unchanged = preparedSource === currentSource && preparedFields === fields;
  const connection = connections.find((c) => c.id === connectionId);
  const study = getDocumentStructureProfile(manuscript).kind === 'study';
  useEffect(() => {
    let active = true;
    void getIntegrationCatalog().then((catalog) => {
      if (active) setConnections(catalog.filter((p) => p.id === 'ojs' || p.id === 'omp').flatMap((p) => p.connections).filter((c) => c.enabled));
    }).catch((e: unknown) => { if (active) setError(String(e)); });
    return () => { active = false; };
  }, []);
  async function selectConnection(id: string) {
    setConnectionId(id); setOptions(null); setReceipt(null); setApiKey(''); setConfirmed(false); setError(''); setPreparedSource('');
    if (!id) return;
    setBusy(true);
    try {
      const [configuration, state] = await Promise.all([
        requestDirectSubmission(id, { action: 'options', manuscriptId: manuscript.id }),
        requestDirectSubmission(id, { action: 'status', manuscriptId: manuscript.id }),
      ]);
      if (configuration.error) throw new Error(configuration.error.message);
      if (state.error) throw new Error(state.error.message);
      const next = configuration.options;
      setOptions(next ?? null); setReceipt(state.receipt ?? null);
      setSectionId(''); setGenreId('');
      setLanguage(next?.locales.includes(manuscript.locale) ? manuscript.locale : next?.locales[0] ?? '');
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  async function run(action: 'prepare' | 'submit' | 'status') {
    if (busy) return;
    setBusy(true); setError('');
    try {
      let input: SubmissionSnapshot | undefined;
      if (action === 'prepare') {
        const snapshot = createDirectSubmissionSnapshot(manuscript, { title, abstract, keywords: keywords.split(';').map((k) => k.trim()).filter(Boolean), locale: language, authors });
        const exported = buildDocxExport(snapshot);
        setWarnings(exported.warnings);
        input = { manuscriptId: manuscript.id, title, abstract, keywords: snapshot.keywords, locale: language, authors,
          sectionId: sectionId ? Number(sectionId) : null, genreId: Number(genreId), docx: base64(exported.bytes), omi: JSON.stringify(snapshot) };
      }
      const result = await requestDirectSubmission(connectionId, {
        action, manuscriptId: manuscript.id, ...(apiKey ? { apiKey } : {}),
        ...(input ? { input } : {}), ...(action === 'submit' && receipt ? { digest: receipt.digest, confirmed: true as const } : {}),
      });
      setReceipt(result.receipt ?? null);
      if (result.error) throw new Error(result.error.message);
      if (action === 'prepare') { setPreparedSource(currentSource); setPreparedFields(fields); setConfirmed(false); }
      if (result.receipt?.status === 'SUBMITTED') setApiKey('');
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  const blocked = busy || receipt?.status === 'SUBMITTED' || ['CREATING', 'UNKNOWN', 'SUBMITTING'].includes(receipt?.status ?? '');
  return <section className="omi-direct-submission" aria-labelledby="direct-submission-title">
    <h4 id="direct-submission-title">{copy.title}</h4><p>{copy.intro}</p>
    {!study ? <p>{copy.studyOnly}</p> : <>
      {!connections.length ? <p>{copy.noConnections}</p> : null}
      <label>{copy.destination}<select value={connectionId} disabled={busy} onChange={(e) => void selectConnection(e.target.value)}><option value="">{copy.choose}</option>{connections.map((c) => <option key={c.id} value={c.id}>{c.displayName ?? c.connectionKey} ({c.providerId.toUpperCase()})</option>)}</select></label>
      {options ? <form onSubmit={(e) => { e.preventDefault(); void run('prepare'); }}>
        <p><strong>{options.name}</strong></p>{connection?.providerId === 'omp' ? <p>{copy.omp}</p> : null}
        {!options.acceptingSubmissions ? <p role="alert">{copy.closed}</p> : null}
        <label>{copy.key}<input type="password" autoComplete="off" required value={apiKey} onChange={(e) => setApiKey(e.target.value)} /></label><p>{copy.keyHelp}</p>
        <fieldset disabled={blocked}>
          <label>{copy.heading}<input required maxLength={1000} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
          <label>{copy.abstract}<textarea value={abstract} onChange={(e) => setAbstract(e.target.value)} /></label>
          <label>{copy.keywords}<input value={keywords} onChange={(e) => setKeywords(e.target.value)} /></label>
          <label>{copy.language}<select required value={language} onChange={(e) => setLanguage(e.target.value)}>{options.locales.map((l) => <option key={l}>{l}</option>)}</select></label>
          <label>{copy.section}<select required={connection?.providerId === 'ojs'} value={sectionId} onChange={(e) => setSectionId(e.target.value)}><option value="">{copy.choose}</option>{options.sections.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
          <label>{copy.genre}<select required value={genreId} onChange={(e) => setGenreId(e.target.value)}><option value="">{copy.choose}</option>{options.genres.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}</select></label>
          <h5>{copy.authors}</h5><p>{copy.authorHelp}</p>
          {authors.map((author, index) => <div className="omi-direct-submission-author" key={index}>
            {(['givenName', 'familyName', 'email'] as const).map((field) => <label key={field}>{field === 'givenName' ? copy.given : field === 'familyName' ? copy.family : copy.email}<input type={field === 'email' ? 'email' : 'text'} required={field !== 'familyName'} value={author[field]} onChange={(e) => setAuthors(authors.map((a,i) => i === index ? { ...a, [field]: e.target.value } : a))} /></label>)}
            {authors.length > 1 ? <button type="button" onClick={() => setAuthors(authors.filter((_,i) => i !== index))}>{copy.remove}</button> : null}
          </div>)}<button type="button" onClick={() => setAuthors([...authors, { givenName: '', familyName: '', email: '' }])}>{copy.add}</button>
          <details><summary>{copy.requirements}</summary><div className="omi-direct-submission-terms">{[options.requirements, options.copyrightNotice, options.privacyStatement].map(readable).join('\n\n')}</div></details>
          <p>{copy.snapshot}</p>
          <button type="submit" disabled={!options.acceptingSubmissions}>{busy ? copy.busy : copy.prepare}</button>
        </fieldset>
      </form> : null}
      {receipt ? <div role="status">
        {receipt.externalId ? <p>{copy.draft} {receipt.externalId}</p> : null}
        <p>{copy.status} {receipt.status}</p>
        {receipt.status === 'READY' ? <><p>{unchanged ? copy.ready : copy.changed}</p><label className="omi-direct-submission-confirm"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />{copy.consent}</label><button type="button" disabled={busy || !confirmed || !unchanged || !apiKey} onClick={() => void run('submit')}>{copy.submit}</button></> : null}
        {receipt.status === 'SUBMITTED' ? <p>{copy.submitted}</p> : null}
        {['UNKNOWN','CREATING'].includes(receipt.status) ? <p>{copy.uncertain}</p> : null}
        {receipt.url ? <a href={receipt.url} target="_blank" rel="noopener noreferrer">{copy.open}</a> : null}
        <button type="button" disabled={busy} onClick={() => void run('status')}>{copy.refresh}</button>
      </div> : null}
      {warnings.length ? <p>{copy.warning} {warnings.join(' ')}</p> : null}
    </>}
    {busy ? <p role="status">{copy.busy}</p> : null}{error ? <p role="alert">{error}</p> : null}
  </section>;
}
