import { AlertTriangle, FileUp, LoaderCircle } from 'lucide-react';
import { useRef, useState } from 'react';
import { applyDocxImportPlan } from '../app/docxImportActions';
import { clearDocumentClosedState } from '../app/documentCloseState';
import { useTranslation } from '../i18n';
import type { DocxManuscriptImportPlan } from '../services/docxManuscriptImport';
import { parseOdtForStudio } from '../services/odtImport';
import { ExternalDocumentSourceReview } from './ExternalDocumentSourceReview';

export function OdtImportPanel({ onImported }: { onImported?: () => void }) {
  const { locale } = useTranslation();
  const hu = locale.toLowerCase().startsWith('hu');
  const de = locale.toLowerCase().startsWith('de');
  const copy = {
    title: hu ? 'ODT-kézirat importálása' : de ? 'ODT-Manuskript importieren' : 'Import ODT manuscript',
    description: hu ? 'OpenDocument Text-fájl megnyitása új, szerkeszthető OMI-kéziratként. A címsorok, bekezdések, alapvető szövegformázás, táblázatok és jegyzetek kerülnek át.' : de ? 'Eine OpenDocument-Textdatei als neues, bearbeitbares OMI-Manuskript öffnen. Überschriften, Absätze, grundlegende Formatierung, Tabellen und Notizen werden übernommen.' : 'Open an OpenDocument Text file as a new editable OMI manuscript. Headings, paragraphs, basic text formatting, tables and notes are imported.',
    choose: hu ? 'ODT-fájl kiválasztása' : de ? 'ODT-Datei auswählen' : 'Choose ODT file',
    parsing: hu ? 'ODT beolvasása…' : de ? 'ODT wird gelesen…' : 'Reading ODT…',
    failure: hu ? 'Az ODT import nem sikerült.' : de ? 'Der ODT-Import ist fehlgeschlagen.' : 'ODT import failed.',
    warnings: hu ? 'Import közben észlelt figyelmeztetések' : de ? 'Hinweise zum Import' : 'Import warnings',
  };
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [plan, setPlan] = useState<DocxManuscriptImportPlan | null>(null);
  const [source, setSource] = useState('');
  const [selfAuthored, setSelfAuthored] = useState(false);
  const outline = plan ? hu
    ? `${plan.stats.sections} szakasz · ${plan.stats.paragraphs} bekezdés · ${plan.stats.lists} lista · ${plan.stats.tables} táblázat · ${plan.stats.images} kép · ${plan.stats.notes} jegyzet`
    : de
      ? `${plan.stats.sections} Abschnitte · ${plan.stats.paragraphs} Absätze · ${plan.stats.lists} Listen · ${plan.stats.tables} Tabellen · ${plan.stats.images} Bilder · ${plan.stats.notes} Anmerkungen`
      : `${plan.stats.sections} sections · ${plan.stats.paragraphs} paragraphs · ${plan.stats.lists} lists · ${plan.stats.tables} tables · ${plan.stats.images} images · ${plan.stats.notes} notes`
    : '';

  async function selectFile(file?: File): Promise<void> {
    if (!file || busy) return;
    setBusy(true); setError(''); setPlan(null);
    try { const parsed = await parseOdtForStudio(file); setPlan(parsed); setSource(parsed.fileName); }
    catch (cause) { setError(cause instanceof Error ? cause.message : copy.failure); }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = ''; }
  }
  function confirm(): void {
    if (!plan || (!selfAuthored && !source.trim())) return;
    try {
      applyDocxImportPlan(plan, { importDetectedAuthors: plan.authors.length > 0, source, selfAuthoredExternal: selfAuthored });
      setPlan(null); clearDocumentClosedState(); onImported?.();
    } catch (cause) { setError(cause instanceof Error ? cause.message : copy.failure); }
  }

  return <>
    <section className="docx-import-card" aria-labelledby="odt-import-title">
      <div className="docx-import-card-header"><div><h4 id="odt-import-title">{copy.title}</h4><p>{copy.description}</p></div><FileUp size={22} aria-hidden="true" /></div>
      <input ref={inputRef} className="docx-import-file-input" type="file" accept=".odt,application/vnd.oasis.opendocument.text" onChange={(event) => void selectFile(event.target.files?.[0])} />
      <button type="button" className="studio-menu-secondary-action" disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? <LoaderCircle className="docx-import-spinner" size={16} aria-hidden="true" /> : <FileUp size={16} aria-hidden="true" />}
        {busy ? copy.parsing : copy.choose}
      </button>
      {busy ? <p className="docx-import-hint" role="status" aria-live="polite">{copy.parsing}</p> : null}
      {error ? <div className="docx-import-error" role="alert"><AlertTriangle size={16} aria-hidden="true" /><span>{error}</span></div> : null}
    </section>
    {plan ? <>
      <section className="studio-settings-hint" aria-label={copy.title}>
        <strong>{plan.title}</strong><p>{outline}</p>
        {plan.warnings.length ? <><strong>{copy.warnings}</strong><ul>{plan.warnings.map((item) => <li key={`${item.code}:${item.message}`}>{item.message}</li>)}</ul></> : null}
      </section>
      <ExternalDocumentSourceReview key={plan.fileName} locale={locale} summary={plan.title} source={source} selfAuthoredExternal={selfAuthored} onSelfAuthoredExternalChange={setSelfAuthored} onSourceChange={setSource} onConfirm={confirm} onCancel={() => { setPlan(null); setSource(''); }} />
    </> : null}
  </>;
}
