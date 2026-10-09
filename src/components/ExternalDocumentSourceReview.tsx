import { useState } from 'react';

interface Props {
  locale: string;
  summary: string;
  source: string;
  selfAuthoredExternal: boolean;
  onSelfAuthoredExternalChange: (value: boolean) => void;
  busy?: boolean;
  onSourceChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ExternalDocumentSourceReview({
  locale, summary, source, selfAuthoredExternal, onSelfAuthoredExternalChange, busy = false, onSourceChange, onConfirm, onCancel,
}: Props) {
  const [approved, setApproved] = useState(false);
  const copy = locale.toLowerCase().startsWith('hu')
    ? { title: 'Import forrásának ellenőrzése', source: 'Forrás (kötelező)', note: 'A forrás a kézirat elején láthatóan megjelenik. A fájlnév csak javaslat; ellenőrizze, és szükség esetén írja át.', own: 'Saját művem, amelyet korábban más programban készítettem; ne jelenjen meg külön forrásfelirat.', ownNote: 'A szerzői nyilatkozat a kéziratban rejtett eredetjelölésként megmarad. Ez nem igazolt szerzőség.', ownApprove: 'Kijelentem, hogy az importált mű a sajátom, és jogosult vagyok az átvételére.', approve: 'Ellenőriztem a forrást és jogosult vagyok a tartalom átvételére.', confirm: 'Kézirat létrehozása', cancel: 'Mégsem' }
    : locale.toLowerCase().startsWith('de')
      ? { title: 'Importquelle prüfen', source: 'Quelle (erforderlich)', note: 'Die Quelle erscheint sichtbar am Anfang des Manuskripts. Der Dateiname ist nur ein Vorschlag; bitte prüfen und bei Bedarf korrigieren.', own: 'Mein eigenes Werk, zuvor in einem anderen Programm erstellt; keine sichtbare Quellenzeile anzeigen.', ownNote: 'Die Selbsterklärung bleibt als verborgene Herkunftsangabe im Manuskript. Sie ist kein verifizierter Urheberschaftsnachweis.', ownApprove: 'Ich erkläre, dass dies mein eigenes Werk ist und ich es übernehmen darf.', approve: 'Ich habe die Quelle und die Berechtigung zur Übernahme geprüft.', confirm: 'Manuskript erstellen', cancel: 'Abbrechen' }
      : { title: 'Review import source', source: 'Source (required)', note: 'The source will be visible near the start of the manuscript. The file name is only a suggestion; review and correct it if needed.', own: 'This is my own work created earlier in another editor; omit the visible source line.', ownNote: 'The author declaration remains as hidden origin metadata in the manuscript. It does not verify authorship.', ownApprove: 'I declare this imported work is mine and I have permission to use it.', approve: 'I checked the source and have permission to use this content.', confirm: 'Create manuscript', cancel: 'Cancel' };
  return <section className="docx-import-card" aria-label={copy.title}>
    <h5>{copy.title}</h5>
    <p>{summary}</p>
    {!selfAuthoredExternal && <p>{copy.note}</p>}
    <label>
      <input type="checkbox" checked={selfAuthoredExternal} onChange={(event) => { onSelfAuthoredExternalChange(event.target.checked); setApproved(false); }} />
      {copy.own}
    </label>
    {selfAuthoredExternal ? <p>{copy.ownNote}</p> : <label>{copy.source}
      <input required value={source} onChange={(event) => { onSourceChange(event.target.value); setApproved(false); }} />
    </label>}
    <label>
      <input type="checkbox" checked={approved} onChange={(event) => setApproved(event.target.checked)} />
      {selfAuthoredExternal ? copy.ownApprove : copy.approve}
    </label>
    <div className="omi-visual-insert-actions">
      <button type="button" disabled={busy || !approved || (!selfAuthoredExternal && !source.trim())} onClick={onConfirm}>{copy.confirm}</button>
      <button type="button" disabled={busy} onClick={onCancel}>{copy.cancel}</button>
    </div>
  </section>;
}
