import { useState } from 'react';
import type { OmpChapterPreview, OmpVolumeReview } from '../integrations/omp/reimportOmpVolume';

const copy = {
  hu: ['OMP-kötet egyeztetése', 'A helyi kézirat és tördelés változatlan marad. A fejezetváltozásokat külön kell ellenőrizni.', 'A publikáció verziója vagy forrásfelépítése megváltozott.', 'A kötet vagy a szerzők metaadatai megváltoztak.', 'A kiadói vagy sorozati adatok megváltoztak.', 'Helyi metaadatütközés', 'Kiadói és sorozati adatok frissítése', 'Meglévő kötet megnyitása', 'Új', 'Módosult', 'Változatlan', 'Nem ellenőrizhető', 'OMP-ből eltávolítva', 'Helyben eltávolítva'],
  en: ['Review OMP volume changes', 'Local text and layout are preserved. Chapter changes require separate review.', 'The publication version or source representation changed.', 'Volume or contributor metadata changed.', 'Publisher or series metadata changed.', 'Local metadata conflict', 'Refresh publisher and series metadata', 'Open existing volume', 'New', 'Changed', 'Unchanged', 'Not verifiable', 'Removed from OMP', 'Removed locally'],
  de: ['OMP-Band abgleichen', 'Lokaler Text und Layout bleiben erhalten. Kapiteländerungen müssen separat geprüft werden.', 'Publikationsversion oder Quellstruktur geändert.', 'Band- oder Personenmetadaten geändert.', 'Verlags- oder Reihenmetadaten geändert.', 'Lokaler Metadatenkonflikt', 'Verlags- und Reihenmetadaten aktualisieren', 'Vorhandenen Band öffnen', 'Neu', 'Geändert', 'Unverändert', 'Nicht überprüfbar', 'Aus OMP entfernt', 'Lokal entfernt'],
  fr: ['Comparer le volume OMP', 'Le texte et la mise en page locaux sont conservés. Vérifiez séparément les changements de chapitres.', 'La version ou la structure source a changé.', 'Les métadonnées du volume ou des contributeurs ont changé.', 'Les métadonnées éditoriales ou de collection ont changé.', 'Conflit de métadonnées locales', 'Actualiser les métadonnées éditoriales et de collection', 'Ouvrir le volume existant', 'Nouveau', 'Modifié', 'Inchangé', 'Non vérifiable', 'Supprimé d’OMP', 'Supprimé localement'],
  it: ['Confronta il volume OMP', 'Testo e impaginazione locali sono preservati. Verificare separatamente le modifiche ai capitoli.', 'La versione o la struttura della fonte è cambiata.', 'I metadati del volume o dei contributori sono cambiati.', 'I metadati editoriali o della collana sono cambiati.', 'Conflitto di metadati locali', 'Aggiorna editore e collana', 'Apri il volume esistente', 'Nuovo', 'Modificato', 'Invariato', 'Non verificabile', 'Rimosso da OMP', 'Rimosso localmente'],
  es: ['Comparar el volumen OMP', 'Se conservan el texto y la maquetación locales. Revise los cambios de capítulos por separado.', 'Cambió la versión o la estructura de origen.', 'Cambiaron los metadatos del volumen o de los colaboradores.', 'Cambiaron los metadatos editoriales o de serie.', 'Conflicto de metadatos locales', 'Actualizar editorial y serie', 'Abrir volumen existente', 'Nuevo', 'Modificado', 'Sin cambios', 'No verificable', 'Eliminado de OMP', 'Eliminado localmente'],
  nl: ['OMP-volume vergelijken', 'Lokale tekst en opmaak blijven behouden. Controleer hoofdstukwijzigingen afzonderlijk.', 'De publicatieversie of bronstructuur is gewijzigd.', 'Volume- of bijdragersmetadata zijn gewijzigd.', 'Uitgevers- of reeksmetadata zijn gewijzigd.', 'Lokaal metadataconflict', 'Uitgevers- en reeksmetadata vernieuwen', 'Bestaand volume openen', 'Nieuw', 'Gewijzigd', 'Ongewijzigd', 'Niet verifieerbaar', 'Verwijderd uit OMP', 'Lokaal verwijderd'],
  pl: ['Porównaj tom OMP', 'Lokalny tekst i układ pozostają bez zmian. Zmiany rozdziałów wymagają osobnej kontroli.', 'Zmieniła się wersja publikacji lub struktura źródła.', 'Zmieniły się metadane tomu lub współtwórców.', 'Zmieniły się metadane wydawcy lub serii.', 'Konflikt lokalnych metadanych', 'Odśwież dane wydawcy i serii', 'Otwórz istniejący tom', 'Nowy', 'Zmieniony', 'Bez zmian', 'Nie można zweryfikować', 'Usunięty z OMP', 'Usunięty lokalnie'],
} as const;
const index = { new: 8, changed: 9, unchanged: 10, unknown: 11, removed: 12, 'locally-removed': 13 } as const;
const addLabels = { hu: 'Új fejezetek hozzáadása', en: 'Add new chapters', de: 'Neue Kapitel hinzufügen',
  fr: 'Ajouter les nouveaux chapitres', it: 'Aggiungi nuovi capitoli', es: 'Añadir capítulos nuevos',
  nl: 'Nieuwe hoofdstukken toevoegen', pl: 'Dodaj nowe rozdziały' } as const;
const blockedLabels = { hu: 'Az új fejezetekhez azonos publikációverzió és ellenőrzött szerzőazonosítók szükségesek.',
  en: 'New chapters require the same publication version and verified contributor identities.',
  de: 'Neue Kapitel benötigen dieselbe Publikationsversion und geprüfte Personenidentitäten.',
  fr: 'Les nouveaux chapitres nécessitent la même version et des identités vérifiées.',
  it: 'I nuovi capitoli richiedono la stessa versione e identità verificate.',
  es: 'Los capítulos nuevos requieren la misma versión e identidades verificadas.',
  nl: 'Nieuwe hoofdstukken vereisen dezelfde versie en geverifieerde identiteiten.',
  pl: 'Nowe rozdziały wymagają tej samej wersji i zweryfikowanych tożsamości.' } as const;
const previewLabels = {
  hu: ['Összehasonlítás', 'Eredeti import', 'Helyi változat', 'Új OMP-változat', 'Nem áll rendelkezésre', 'Részlet – a teljes szöveg nem látható', 'Helyi változat megtartása', 'Helyi változat jóváhagyva', 'Szöveges előnézet: nem teljes formázási összehasonlítás.', 'Bezárás', 'Az előnézet nem érhető el.'],
  en: ['Compare', 'Original import', 'Local version', 'New OMP version', 'Unavailable', 'Excerpt – full text not shown', 'Keep local version', 'Local version approved', 'Text preview, not a full formatting comparison.', 'Close', 'Preview unavailable.'],
  de: ['Vergleichen', 'Ursprünglicher Import', 'Lokale Fassung', 'Neue OMP-Fassung', 'Nicht verfügbar', 'Auszug – nicht der vollständige Text', 'Lokale Fassung behalten', 'Lokale Fassung bestätigt', 'Textvorschau, kein vollständiger Formatvergleich.', 'Schließen', 'Vorschau nicht verfügbar.'],
  fr: ['Comparer', 'Import original', 'Version locale', 'Nouvelle version OMP', 'Indisponible', 'Extrait – texte incomplet', 'Conserver la version locale', 'Version locale validée', 'Aperçu textuel, sans comparaison complète de la mise en forme.', 'Fermer', 'Aperçu indisponible.'],
  it: ['Confronta', 'Importazione originale', 'Versione locale', 'Nuova versione OMP', 'Non disponibile', 'Estratto – testo incompleto', 'Mantieni versione locale', 'Versione locale approvata', 'Anteprima testuale, non confronto completo della formattazione.', 'Chiudi', 'Anteprima non disponibile.'],
  es: ['Comparar', 'Importación original', 'Versión local', 'Nueva versión OMP', 'No disponible', 'Extracto – texto incompleto', 'Conservar versión local', 'Versión local aprobada', 'Vista textual, no comparación completa del formato.', 'Cerrar', 'Vista no disponible.'],
  nl: ['Vergelijken', 'Oorspronkelijke import', 'Lokale versie', 'Nieuwe OMP-versie', 'Niet beschikbaar', 'Fragment – niet de volledige tekst', 'Lokale versie behouden', 'Lokale versie goedgekeurd', 'Tekstvoorbeeld, geen volledige opmaakvergelijking.', 'Sluiten', 'Voorbeeld niet beschikbaar.'],
  pl: ['Porównaj', 'Pierwotny import', 'Wersja lokalna', 'Nowa wersja OMP', 'Niedostępne', 'Fragment – niepełny tekst', 'Zachowaj wersję lokalną', 'Wersja lokalna zatwierdzona', 'Podgląd tekstu, nie pełne porównanie formatowania.', 'Zamknij', 'Podgląd niedostępny.'],
} as const;
const acceptLabels = {
  hu: ['Új OMP-változat elfogadása', 'A biztonságos automatikus csere feltételei nem teljesülnek. A helyi változat megmarad.'],
  en: ['Accept new OMP version', 'Safe automatic replacement is unavailable. The local version is preserved.'],
  de: ['Neue OMP-Fassung übernehmen', 'Sicherer automatischer Ersatz nicht möglich. Die lokale Fassung bleibt erhalten.'],
  fr: ['Accepter la nouvelle version OMP', 'Remplacement automatique sûr indisponible. La version locale est conservée.'],
  it: ['Accetta la nuova versione OMP', 'Sostituzione automatica sicura non disponibile. La versione locale è conservata.'],
  es: ['Aceptar nueva versión OMP', 'Sustitución automática segura no disponible. Se conserva la versión local.'],
  nl: ['Nieuwe OMP-versie accepteren', 'Veilige automatische vervanging niet beschikbaar. De lokale versie blijft behouden.'],
  pl: ['Zaakceptuj nową wersję OMP', 'Bezpieczna automatyczna zamiana niedostępna. Wersja lokalna zostaje zachowana.'],
} as const;
export function OmpVolumeReimportReview({ review, locale, onKeep, onRefresh, onAdd, onPreview, onKeepChapter, onAcceptChapter }: {
  review: OmpVolumeReview; locale: string; onKeep: () => void; onRefresh: () => void; onAdd: () => void;
  onPreview: (id: string) => OmpChapterPreview; onKeepChapter: (id: string) => void; onAcceptChapter: (id: string) => void;
}) {
  const language = locale.split(/[-_]/)[0] as keyof typeof copy;
  const labels = copy[language] ?? copy.en;
  const additions = review.items.filter(item => item.status === 'new').length;
  const p = previewLabels[language] ?? previewLabels.en;
  const accept = acceptLabels[language] ?? acceptLabels.en;
  const [selected, setSelected] = useState<{ id: string; preview: OmpChapterPreview } | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const openPreview = (id: string) => {
    try { setSelected({ id, preview: onPreview(id) }); setPreviewError(false); }
    catch { setSelected(null); setPreviewError(true); }
  };
  return <main className="auth-page">
    <section className="auth-card" style={{ maxWidth: '42rem', width: '100%', maxHeight: '90dvh', overflowY: 'auto' }}>
      <h1>{labels[0]}</h1><p>{labels[1]}</p>
      {review.publicationChanged || review.representationChanged ? <p role="status">{labels[2]}</p> : null}
      {review.metadataChanged ? <p role="status">{labels[3]}</p> : null}
      {review.matterChanged ? <p role="status">{labels[4]}</p> : null}
      {review.matterConflicts.length ? <p role="alert">{labels[5]}</p> : null}
      <ul>{review.items.map(item => <li key={item.id}><strong>{labels[index[item.status]]}</strong>: {item.title}
        {item.reviewedLocal ? <span> — {p[7]}</span> : null}
        {item.status === 'changed' && item.id !== 'book' && !review.representationChanged
          ? <button type="button" onClick={() => openPreview(item.id)}>{p[0]}</button> : null}</li>)}</ul>
      {previewError ? <p role="alert">{p[10]}</p> : null}
      {selected ? <section aria-label={p[0]}>
        <p>{p[8]}</p>
        {([selected.preview.original, selected.preview.local, selected.preview.incoming] as const).map((value, index) =>
          <details key={index} open><summary>{p[index + 1]}</summary>
            <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: '14rem', overflowY: 'auto' }}>{value?.text ?? p[4]}</pre>
            {value?.truncated ? <p>{p[5]}</p> : null}
          </details>)}
        <button type="button" onClick={() => { onKeepChapter(selected.id); setSelected(null); }} disabled={!selected.preview.canKeepLocal}>{p[6]}</button>
        <button type="button" disabled={!selected.preview.canAcceptIncoming} onClick={() => { onAcceptChapter(selected.id); setSelected(null); }}>{accept[0]}</button>
        {!selected.preview.canAcceptIncoming ? <p role="status">{accept[1]}</p> : null}
        <button type="button" onClick={() => setSelected(null)}>{p[9]}</button>
      </section> : null}
      {additions > 0 ? <><button type="button" disabled={!review.canAppend} onClick={onAdd}>{addLabels[language] ?? addLabels.en} ({additions})</button>
        {!review.canAppend ? <p role="status">{blockedLabels[language] ?? blockedLabels.en}</p> : null}</> : null}
      {review.matterChanged ? <button type="button" disabled={review.publicationChanged || review.representationChanged || !!review.matterConflicts.length} onClick={onRefresh}>{labels[6]}</button> : null}
      <button type="button" onClick={onKeep}>{labels[7]}</button>
    </section>
  </main>;
}
