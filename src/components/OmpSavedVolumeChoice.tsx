import { useRef, useState } from 'react';
import { downloadCloudBackup, listProfileSavedDocuments, type ProfileSavedDocument } from '../services/cloudStorageApi';
import { MAX_OMI_IMPORT_BYTES } from '../services/omiContainerImport';

const copies = {
  en: ['Open an OMP volume', 'Choose a previously saved OMI package to preserve local work, or explicitly import a new copy.', 'Choose a local OMI package', 'Find my cloud-saved documents', 'Select a saved document', 'Open selected document', 'Import new copy', 'Cancel', 'Checking saved package…', 'No saved documents found.', 'The saved package could not be opened. Check that it belongs to this OMP volume.', 'Unable to list saved documents.'],
  hu: ['OMP-kötet megnyitása', 'A helyi munka megőrzéséhez válaszd ki a korábban mentett OMI-csomagot, vagy indíts új importot.', 'Helyi OMI-csomag kiválasztása', 'Felhőben mentett dokumentumaim', 'Mentett dokumentum kiválasztása', 'Kiválasztott dokumentum megnyitása', 'Új példány importálása', 'Mégse', 'Mentett csomag ellenőrzése…', 'Nincs mentett dokumentum.', 'A mentett csomag nem nyitható meg. Ellenőrizd, hogy ehhez az OMP-kötethez tartozik-e.', 'A mentett dokumentumok listája nem érhető el.'],
  de: ['OMP-Band öffnen', 'Wählen Sie ein gespeichertes OMI-Paket, um lokale Arbeit zu erhalten, oder importieren Sie ausdrücklich eine neue Kopie.', 'Lokales OMI-Paket auswählen', 'Meine gespeicherten Cloud-Dokumente', 'Gespeichertes Dokument auswählen', 'Ausgewähltes Dokument öffnen', 'Neue Kopie importieren', 'Abbrechen', 'Gespeichertes Paket wird geprüft…', 'Keine gespeicherten Dokumente gefunden.', 'Das Paket konnte nicht geöffnet werden. Prüfen Sie, ob es zu diesem OMP-Band gehört.', 'Die Liste gespeicherter Dokumente ist nicht verfügbar.'],
  fr: ['Ouvrir un volume OMP', 'Choisissez un paquet OMI enregistré pour conserver le travail local, ou importez une nouvelle copie.', 'Choisir un paquet OMI local', 'Mes documents enregistrés dans le cloud', 'Sélectionner un document enregistré', 'Ouvrir le document sélectionné', 'Importer une nouvelle copie', 'Annuler', 'Vérification du paquet…', 'Aucun document enregistré.', 'Impossible d’ouvrir le paquet. Vérifiez qu’il correspond à ce volume OMP.', 'Impossible de lister les documents enregistrés.'],
  it: ['Apri un volume OMP', 'Scegli un pacchetto OMI salvato per conservare il lavoro locale, oppure importa una nuova copia.', 'Scegli un pacchetto OMI locale', 'I miei documenti salvati nel cloud', 'Seleziona un documento salvato', 'Apri il documento selezionato', 'Importa una nuova copia', 'Annulla', 'Verifica del pacchetto…', 'Nessun documento salvato.', 'Impossibile aprire il pacchetto. Verifica che appartenga a questo volume OMP.', 'Impossibile elencare i documenti salvati.'],
  es: ['Abrir un volumen OMP', 'Elija un paquete OMI guardado para conservar el trabajo local o importe una copia nueva.', 'Elegir un paquete OMI local', 'Mis documentos guardados en la nube', 'Seleccionar documento guardado', 'Abrir documento seleccionado', 'Importar copia nueva', 'Cancelar', 'Comprobando el paquete…', 'No hay documentos guardados.', 'No se pudo abrir el paquete. Compruebe que pertenece a este volumen OMP.', 'No se pudieron listar los documentos guardados.'],
  nl: ['OMP-volume openen', 'Kies een opgeslagen OMI-pakket om lokaal werk te behouden, of importeer een nieuwe kopie.', 'Lokaal OMI-pakket kiezen', 'Mijn opgeslagen clouddocumenten', 'Opgeslagen document selecteren', 'Geselecteerd document openen', 'Nieuwe kopie importeren', 'Annuleren', 'Pakket controleren…', 'Geen opgeslagen documenten gevonden.', 'Het pakket kan niet worden geopend. Controleer of het bij dit OMP-volume hoort.', 'De opgeslagen documenten zijn niet beschikbaar.'],
  pl: ['Otwórz tom OMP', 'Wybierz zapisany pakiet OMI, aby zachować lokalną pracę, lub zaimportuj nową kopię.', 'Wybierz lokalny pakiet OMI', 'Moje dokumenty zapisane w chmurze', 'Wybierz zapisany dokument', 'Otwórz wybrany dokument', 'Importuj nową kopię', 'Anuluj', 'Sprawdzanie pakietu…', 'Nie znaleziono zapisanych dokumentów.', 'Nie można otworzyć pakietu. Sprawdź, czy należy do tego tomu OMP.', 'Nie można wyświetlić zapisanych dokumentów.'],
} as const;

export function OmpSavedVolumeChoice({ locale, onRestore, onNew, onCancel }: {
  locale: string;
  onRestore: (bytes: Uint8Array, expectedId?: string) => Promise<void>;
  onNew: () => void;
  onCancel: () => void;
}) {
  const language = locale.toLowerCase().split(/[-_]/)[0] as keyof typeof copies;
  const c = copies[language] ?? copies.en;
  const [documents, setDocuments] = useState<ProfileSavedDocument[] | null>(null);
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const locked = useRef(false);
  async function run(action: () => Promise<void>, error: string) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setMessage('');
    try { await action(); } catch { setMessage(error); }
    finally { locked.current = false; setBusy(false); }
  }
  return <main className="auth-page" data-omp-saved-volume-choice="true">
    <section className="auth-card auth-card-wide auth-form" aria-busy={busy}>
      <div className="auth-header"><h1>{c[0]}</h1><p>{c[1]}</p></div>
      <label className="auth-field">{c[2]}<input type="file" accept=".omi,application/vnd.openmanuscript.package+zip"
        disabled={busy} onChange={event => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          if (file) void run(async () => {
            if (file.size > MAX_OMI_IMPORT_BYTES) throw new Error('Package too large.');
            await onRestore(new Uint8Array(await file.arrayBuffer()));
          }, c[10]);
        }} /></label>
      <button type="button" disabled={busy} onClick={() => void run(async () => {
        setDocuments(await listProfileSavedDocuments());
        setSelected('');
      }, c[11])}>{c[3]}</button>
      {documents?.length === 0 ? <p>{c[9]}</p> : null}
      {documents && documents.length > 0 ? <>
        <label className="auth-field">{c[4]}<select value={selected} disabled={busy} onChange={event => setSelected(event.target.value)}>
          <option value="">{c[4]}</option>
          {documents.map(document => <option key={document.id} value={document.id}>{document.title} — {document.connectionName} — {new Date(document.createdAt).toLocaleString(locale)}</option>)}
        </select></label>
        <button type="button" disabled={busy || !selected} onClick={() => void run(async () => {
          const document = documents.find(item => item.id === selected);
          if (!document || Number(document.sizeBytes) > MAX_OMI_IMPORT_BYTES) throw new Error('Invalid saved document.');
          await onRestore(await downloadCloudBackup(document.id), document.manuscriptId);
        }, c[10])}>{c[5]}</button>
      </> : null}
      {busy ? <p role="status">{c[8]}</p> : null}
      {message ? <p role="alert">{message}</p> : null}
      <button type="button" className="auth-primary-button" disabled={busy} onClick={onNew}>{c[6]}</button>
      <button type="button" disabled={busy} onClick={onCancel}>{c[7]}</button>
    </section>
  </main>;
}
