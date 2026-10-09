import { useState } from 'react';

interface Props {
  locale: string;
  summary: string;
  source: string;
  busy?: boolean;
  onSourceChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ExternalDocumentSourceReview({
  locale, summary, source, busy = false, onSourceChange, onConfirm, onCancel,
}: Props) {
  const [approved, setApproved] = useState(false);
  const copy = locale.toLowerCase().startsWith('hu')
    ? { title: 'Import forrásának ellenőrzése', source: 'Forrás (kötelező)', note: 'A forrás a kézirat elején láthatóan megjelenik. A fájlnév csak javaslat; ellenőrizze, és szükség esetén írja át.', approve: 'Ellenőriztem a forrást és jogosult vagyok a tartalom átvételére.', confirm: 'Kézirat létrehozása', cancel: 'Mégsem' }
    : locale.toLowerCase().startsWith('de')
      ? { title: 'Importquelle prüfen', source: 'Quelle (erforderlich)', note: 'Die Quelle erscheint sichtbar am Anfang des Manuskripts. Der Dateiname ist nur ein Vorschlag; bitte prüfen und bei Bedarf korrigieren.', approve: 'Ich habe die Quelle und die Berechtigung zur Übernahme geprüft.', confirm: 'Manuskript erstellen', cancel: 'Abbrechen' }
      : { title: 'Review import source', source: 'Source (required)', note: 'The source will be visible near the start of the manuscript. The file name is only a suggestion; review and correct it if needed.', approve: 'I checked the source and have permission to use this content.', confirm: 'Create manuscript', cancel: 'Cancel' };
  return <section className="docx-import-card" aria-label={copy.title}>
    <h5>{copy.title}</h5>
    <p>{summary}</p>
    <p>{copy.note}</p>
    <label>{copy.source}
      <input required value={source} onChange={(event) => { onSourceChange(event.target.value); setApproved(false); }} />
    </label>
    <label>
      <input type="checkbox" checked={approved} onChange={(event) => setApproved(event.target.checked)} />
      {copy.approve}
    </label>
    <div className="omi-visual-insert-actions">
      <button type="button" disabled={busy || !approved || !source.trim()} onClick={onConfirm}>{copy.confirm}</button>
      <button type="button" disabled={busy} onClick={onCancel}>{copy.cancel}</button>
    </div>
  </section>;
}
