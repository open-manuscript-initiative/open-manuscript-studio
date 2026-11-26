import type { OjsIssueReview } from '../integrations/ojs/reimportOjsIssue';

const copy = {
  hu: { title: 'Már importált OJS-lapszám', help: 'A meglévő szerkesztés és tördelés megmarad. Csak az új tanulmányok kerülnek a lapszám végére; a módosított vagy eltávolított kéziratokat külön kell ellenőrizni.', metadata: 'A lapszám vagy folyóirat adatai megváltoztak az OJS-ben.', add: 'Új tanulmányok hozzáadása', keep: 'Meglévő lapszám megnyitása', new: 'Új', changed: 'Módosult', unchanged: 'Változatlan', unknown: 'Nem ellenőrizhető', removed: 'OJS-ből eltávolítva', 'locally-removed': 'Helyben eltávolítva' },
  en: { title: 'Previously imported OJS issue', help: 'Existing editing and layout are preserved. Only new studies are appended; changed or removed manuscripts require separate review.', metadata: 'Issue or journal metadata changed in OJS.', add: 'Add new studies', keep: 'Open existing issue', new: 'New', changed: 'Changed', unchanged: 'Unchanged', unknown: 'Not verifiable', removed: 'Removed from OJS', 'locally-removed': 'Removed locally' },
  de: { title: 'Bereits importierte OJS-Ausgabe', help: 'Bearbeitung und Layout bleiben erhalten. Nur neue Beiträge werden angehängt; geänderte oder entfernte Manuskripte müssen separat geprüft werden.', metadata: 'Metadaten der Ausgabe oder Zeitschrift wurden in OJS geändert.', add: 'Neue Beiträge hinzufügen', keep: 'Vorhandene Ausgabe öffnen', new: 'Neu', changed: 'Geändert', unchanged: 'Unverändert', unknown: 'Nicht überprüfbar', removed: 'Aus OJS entfernt', 'locally-removed': 'Lokal entfernt' },
} as const;

export function OjsIssueReimportReview({ review, locale, onAdd, onKeep }: {
  review: OjsIssueReview; locale: string; onAdd: () => void; onKeep: () => void;
}) {
  const labels = copy[locale as keyof typeof copy] ?? copy.en;
  const additions = review.items.filter(item => item.status === 'new').length;
  return <main className="auth-page">
    <section className="auth-card" style={{ maxWidth: '42rem', width: '100%', maxHeight: '90dvh', overflowY: 'auto' }}>
      <h1>{labels.title}</h1>
      <p>{labels.help}</p>
      {review.issueMetadataChanged ? <p role="status">{labels.metadata}</p> : null}
      <ul>{review.items.map(item => <li key={item.id}><strong>{labels[item.status]}</strong>: {item.title}</li>)}</ul>
      <button type="button" disabled={!additions} onClick={onAdd}>{labels.add} ({additions})</button>
      <button type="button" onClick={onKeep}>{labels.keep}</button>
    </section>
  </main>;
}
