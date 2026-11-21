import { useEffect, useRef, useState } from 'react';
import { documentImportSourcePolicy, type DocumentImportMode } from '../model/documentImportMode';

interface Props {
  locale: string;
  summary: string;
  source: string;
  importMode: DocumentImportMode;
  onImportModeChange: (value: DocumentImportMode) => void;
  includeSource: boolean;
  onIncludeSourceChange: (value: boolean) => void;
  busy?: boolean;
  onSourceChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ExternalDocumentSourceReview({
  locale, summary, source, importMode, onImportModeChange, includeSource, onIncludeSourceChange,
  busy = false, onSourceChange, onConfirm, onCancel,
}: Props) {
  const [approved, setApproved] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    headingRef.current?.scrollIntoView({ block: 'start' });
  }, []);
  const copy = locale.toLowerCase().startsWith('hu') ? {
    title: 'Import forrásának ellenőrzése',
    status: 'A fájl beolvasása kész. Az importálás befejezéséhez még megerősítés szükséges.',
    instruction: 'Válassza ki az importálás célját. Ezután kattintson a „Kézirat létrehozása” gombra. A kézirat ekkor megjelenik a szerkesztőben.',
    mode: 'Importálás célja', editorial: 'Szerkesztőként importálok egy kéziratot', own: 'Saját művemet importálom', citation: 'Más művét veszem át forrásmegjelöléssel',
    editorialNote: 'A kézirat forrásfelirat nélkül nyílik meg szerkesztésre.',
    include: 'Forrás megjelölése a dokumentum elején', source: 'Forrás',
    note: 'A megadott forrásfelirat a kézirat elején jelenik meg. A fájlnév csak javaslat; szükség esetén írja át.',
    approve: 'Ellenőriztem a forrást és jogosult vagyok a tartalom átvételére.', confirm: 'Kézirat létrehozása', cancel: 'Mégsem',
  } : locale.toLowerCase().startsWith('de') ? {
    title: 'Importquelle prüfen',
    status: 'Die Datei wurde eingelesen. Zum Abschließen des Imports ist noch Ihre Bestätigung erforderlich.',
    instruction: 'Wählen Sie den Importzweck. Klicken Sie danach auf „Manuskript erstellen“. Das Manuskript wird anschließend im Editor angezeigt.',
    mode: 'Importzweck', editorial: 'Manuskript zur redaktionellen Bearbeitung importieren', own: 'Mein eigenes Werk importieren', citation: 'Fremdes Werk mit Quellenangabe übernehmen',
    editorialNote: 'Das Manuskript wird ohne zusätzliche Quellenzeile zur Bearbeitung geöffnet.',
    include: 'Quellenangabe am Dokumentanfang einfügen', source: 'Quelle',
    note: 'Die Quellenangabe erscheint am Anfang des Manuskripts. Der Dateiname ist nur ein Vorschlag; bei Bedarf korrigieren.',
    approve: 'Ich habe die Quelle und die Berechtigung zur Übernahme geprüft.', confirm: 'Manuskript erstellen', cancel: 'Abbrechen',
  } : {
    title: 'Review import source',
    status: 'The file has been read. Your confirmation is still required to finish importing.',
    instruction: 'Select the import purpose. Then click “Create manuscript”. The manuscript will appear in the editor.',
    mode: 'Import purpose', editorial: 'Import a manuscript for editorial work', own: 'Import my own work', citation: 'Reuse third-party work with attribution',
    editorialNote: 'The manuscript opens for editing without an added source line.',
    include: 'Include source at the beginning of the document', source: 'Source',
    note: 'The source line will appear near the start of the manuscript. The file name is only a suggestion; correct it if needed.',
    approve: 'I checked the source and have permission to use this content.', confirm: 'Create manuscript', cancel: 'Cancel',
  };
  const policy = documentImportSourcePolicy({ importMode, includeSource });
  return <section className="docx-import-card docx-import-review" aria-label={copy.title}>
    <h5 ref={headingRef} tabIndex={-1}>{copy.title}</h5>
    <div className="docx-import-next-step">
      <p role="status"><strong>{copy.status}</strong></p>
      <p>{copy.instruction}</p>
    </div>
    <p>{summary}</p>
    <label>{copy.mode}
      <select value={importMode} onChange={(event) => { onImportModeChange(event.target.value as DocumentImportMode); setApproved(false); }}>
        <option value="editorial">{copy.editorial}</option>
        <option value="own-work">{copy.own}</option>
        <option value="citation">{copy.citation}</option>
      </select>
    </label>
    {importMode === 'editorial' && <p>{copy.editorialNote}</p>}
    {importMode === 'own-work' && <label>
      <input type="checkbox" checked={includeSource} onChange={(event) => onIncludeSourceChange(event.target.checked)} />
      {copy.include}
    </label>}
    {policy.includeSource && <>
      <p>{copy.note}</p>
      <label>{copy.source}
        <input required value={source} onChange={(event) => { onSourceChange(event.target.value); setApproved(false); }} />
      </label>
    </>}
    {importMode === 'citation' && <label>
      <input type="checkbox" checked={approved} onChange={(event) => setApproved(event.target.checked)} />
      {copy.approve}
    </label>}
    <div className="omi-visual-insert-actions">
      <button type="button" disabled={busy || (policy.includeSource && !source.trim()) || (importMode === 'citation' && !approved)} onClick={onConfirm}>{copy.confirm}</button>
      <button type="button" disabled={busy} onClick={onCancel}>{copy.cancel}</button>
    </div>
  </section>;
}
