import { useEffect, useRef, useState } from 'react';

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
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
    headingRef.current?.scrollIntoView({ block: 'start' });
  }, []);
  const nextStep = locale.toLowerCase().startsWith('hu')
    ? {
      status: 'A fájl beolvasása kész. Az importálás befejezéséhez még megerősítés szükséges.',
      instruction: 'Jelölje be, hogy saját művét importálja, vagy ellenőrizze a külső mű forrását és jelölje be az átvételi jogosultságot. Ezután kattintson a „Kézirat létrehozása” gombra. A kézirat ekkor megjelenik a szerkesztőben.',
    }
    : locale.toLowerCase().startsWith('de')
      ? {
        status: 'Die Datei wurde eingelesen. Zum Abschließen des Imports ist noch Ihre Bestätigung erforderlich.',
        instruction: 'Markieren Sie die Option für Ihr eigenes Werk oder prüfen Sie bei einem fremden Werk die Quelle und bestätigen Sie die Berechtigung zur Übernahme. Klicken Sie danach auf „Manuskript erstellen“. Das Manuskript wird anschließend im Editor angezeigt.',
      }
      : {
        status: 'The file has been read. Your confirmation is still required to finish importing.',
        instruction: 'Select the own-work option, or review the source of third-party work and confirm permission to use it. Then click “Create manuscript”. The manuscript will appear in the editor.',
      };
  const originNote = locale.toLowerCase().startsWith('hu')
    ? 'A saját műként jelölését és az import idejét a dokumentum rejtett eredetadata őrzi. Ez nem igazolt szerzőség. A dokumentum minden része szabadon szerkeszthető és törölhető.'
    : locale.toLowerCase().startsWith('de')
      ? 'Ihre Erklärung als eigenes Werk und der Importzeitpunkt bleiben als verborgene Dokumentmetadaten erhalten. Dies ist kein geprüfter Urheberschaftsnachweis. Alle Dokumentteile bleiben frei bearbeitbar und löschbar.'
      : 'Your own-work declaration and import time remain in hidden document metadata. This does not verify authorship. Every part of the document remains editable and deletable.';
  const copy = locale.toLowerCase().startsWith('hu')
    ? { title: 'Import forrásának ellenőrzése', source: 'Forrás (kötelező külső műnél)', note: 'A megadott forrásfelirat a kézirat elején jelenik meg. A fájlnév csak javaslat; ellenőrizze, és szükség esetén írja át.', own: 'Saját művem, amelyet korábban más programban készítettem; ne kerüljön be forrásfelirat.', ownNote: 'Saját mű importálásakor kihagyhatja a forrásmegjelölést. Nem kerül rejtett jelzés az első címsorhoz, így a címsor szabadon módosítható és törölhető.', approve: 'Ellenőriztem a forrást és jogosult vagyok a tartalom átvételére.', confirm: 'Kézirat létrehozása', cancel: 'Mégsem' }
    : locale.toLowerCase().startsWith('de')
      ? { title: 'Importquelle prüfen', source: 'Quelle (bei fremdem Werk erforderlich)', note: 'Die Quellenangabe erscheint am Anfang des Manuskripts. Der Dateiname ist nur ein Vorschlag; bitte prüfen und bei Bedarf korrigieren.', own: 'Mein eigenes Werk, zuvor in einem anderen Programm erstellt; keine Quellenzeile hinzufügen.', ownNote: 'Bei eigenen Werken können Sie die Quellenangabe auslassen. An der ersten Überschrift wird kein verborgenes Herkunftsmerkmal gespeichert; sie bleibt frei bearbeitbar und löschbar.', approve: 'Ich habe die Quelle und die Berechtigung zur Übernahme geprüft.', confirm: 'Manuskript erstellen', cancel: 'Abbrechen' }
      : { title: 'Review import source', source: 'Source (required for third-party work)', note: 'The source line will appear near the start of the manuscript. The file name is only a suggestion; review and correct it if needed.', own: 'This is my own work created earlier in another editor; do not add a source line.', ownNote: 'For your own work, you can skip source attribution. No hidden origin marker is attached to the first heading, so it remains editable and deletable.', approve: 'I checked the source and have permission to use this content.', confirm: 'Create manuscript', cancel: 'Cancel' };
  return <section className="docx-import-card docx-import-review" aria-label={copy.title}>
    <h5 ref={headingRef} tabIndex={-1}>{copy.title}</h5>
    <div className="docx-import-next-step">
      <p role="status"><strong>{nextStep.status}</strong></p>
      <p>{nextStep.instruction}</p>
    </div>
    <p>{summary}</p>
    {!selfAuthoredExternal && <p>{copy.note}</p>}
    <label>
      <input type="checkbox" checked={selfAuthoredExternal} onChange={(event) => { onSelfAuthoredExternalChange(event.target.checked); setApproved(false); }} />
      {copy.own}
    </label>
    {selfAuthoredExternal ? <p>{copy.ownNote}</p> : <label>{copy.source}
      <input required value={source} onChange={(event) => { onSourceChange(event.target.value); setApproved(false); }} />
    </label>}
    {selfAuthoredExternal && <p>{originNote}</p>}
    {!selfAuthoredExternal && <label>
      <input type="checkbox" checked={approved} onChange={(event) => setApproved(event.target.checked)} />
      {copy.approve}
    </label>}
    <div className="omi-visual-insert-actions">
      <button type="button" disabled={busy || (!selfAuthoredExternal && (!approved || !source.trim()))} onClick={onConfirm}>{copy.confirm}</button>
      <button type="button" disabled={busy} onClick={onCancel}>{copy.cancel}</button>
    </div>
  </section>;
}
