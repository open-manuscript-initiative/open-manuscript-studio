import { useEffect, useState } from 'react';
import { ArrowLeft, Download, FileText, History, LoaderCircle } from 'lucide-react';
import { useTranslation } from '../i18n';
import {
  downloadPlainDocument, downloadEuroOfficeSave, listPlainDocuments,
  listEuroOfficeSaves, type PlainDocumentSummary, type EuroOfficeSaveSummary,
} from '../services/euroOfficeApi';
import './LegacyOfficeArchive.css';

interface Props { onClose: () => void }

// Archive only: Office DocsAPI, iframe, JWT and editor sessions are never loaded here.
export function LegacyOfficeArchive({ onClose }: Props) {
  const { locale } = useTranslation();
  const copy = archiveCopy(locale);
  const [documents, setDocuments] = useState<PlainDocumentSummary[]>([]);
  const [saves, setSaves] = useState<Record<string, EuroOfficeSaveSummary[]>>({});
  const [busy, setBusy] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    listPlainDocuments()
      .then((items) => { if (active) setDocuments(items); })
      .catch(() => { if (active) setError(copy.loadError); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [copy.loadError]);

  async function download(documentId: string, title: string, saveId?: string) {
    const key = saveId ?? documentId;
    setPending(key);
    setError('');
    try {
      const blob = saveId
        ? await downloadEuroOfficeSave(documentId, saveId)
        : await downloadPlainDocument(documentId);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const safeTitle = title.replace(/[\\/<>:"|?*\\x00-\\x1f]/g, '_').trim() || 'document';
      link.href = objectUrl;
      link.download = saveId ? `${safeTitle}-recovery-${saveId.slice(0, 8)}.docx` : `${safeTitle}.docx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
    } catch {
      setError(copy.downloadError);
    } finally {
      setPending(null);
    }
  }

  async function loadSaves(documentId: string) {
    if (saves[documentId]) {
      setSaves((previous) => {
        const next = { ...previous };
        delete next[documentId];
        return next;
      });
      return;
    }
    setPending(documentId);
    setError('');
    try {
      const items = await listEuroOfficeSaves(documentId);
      setSaves((previous) => ({ ...previous, [documentId]: items }));
    } catch {
      setError(copy.loadError);
    } finally {
      setPending(null);
    }
  }

  return (
    <main className="omi-office-archive">
      <header className="omi-office-archive-header">
        <button type="button" onClick={onClose}><ArrowLeft size={18} aria-hidden="true" />{copy.back}</button>
        <h1>{copy.title}</h1>
      </header>
      <p>{copy.description}</p>
      <p className="omi-office-archive-hint">{copy.importHint}</p>
      {error ? <p role="alert" className="omi-office-archive-error">{error}</p> : null}
      {busy ? <p role="status"><LoaderCircle size={18} aria-hidden="true" /> {copy.loading}</p> : null}
      {!busy && documents.length === 0 ? <p>{copy.empty}</p> : null}
      <div className="omi-office-archive-documents">
        {documents.map((item) => (
          <section className="omi-office-archive-document" key={item.id}>
            <div className="omi-office-archive-document-main">
              <FileText size={20} aria-hidden="true" />
              <div className="omi-office-archive-document-title">
                <strong>{item.title}</strong>
                <small>{copy.revision} {item.revision}</small>
              </div>
              <button type="button" disabled={pending !== null} onClick={() => void download(item.id, item.title)}>
                <Download size={16} aria-hidden="true" />{copy.download}
              </button>
              <button type="button" disabled={pending !== null} onClick={() => void loadSaves(item.id)}
                aria-expanded={Boolean(saves[item.id])}>
                <History size={16} aria-hidden="true" />{copy.recovery}
              </button>
            </div>
            {saves[item.id] ? (
              <div className="omi-office-archive-saves">
                {saves[item.id].length === 0 ? <p>{copy.noSaves}</p> : null}
                {saves[item.id].map((save) => (
                  <div className="omi-office-archive-save" key={save.id}>
                    <span>{new Date(save.createdAt).toLocaleString(locale)} · {copy.save} {save.status}</span>
                    <button type="button" disabled={pending !== null} onClick={() => void download(item.id, item.title, save.id)}>
                      <Download size={15} aria-hidden="true" />{copy.download}
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        ))}
      </div>
    </main>
  );
}

function archiveCopy(locale: string) {
  if (locale === 'hu') return {
    title: 'Korábbi Office-dokumentumok', back: 'Vissza a Stúdióba',
    description: 'Ez a munkaterület kizárólag a régi EuroOffice-dokumentumok és mentések exportálására szolgál. Új DOCX-dokumentumokat már nem itt hozunk létre.',
    importHint: 'Az exportált DOCX-fájlt a Stúdió saját dokumentumimportálójával nyithatod meg.',
    revision: 'Verzió:', download: 'DOCX letöltése', recovery: 'Mentések', save: 'Mentéstípus:',
    noSaves: 'Nincs külön mentési pillanatkép.', empty: 'Nincsenek korábbi Office-dokumentumok.',
    loading: 'Dokumentumok betöltése…', loadError: 'A dokumentumok vagy a mentések betöltése nem sikerült.',
    downloadError: 'A DOCX-fájl letöltése nem sikerült.',
  };
  if (locale === 'de') return {
    title: 'Frühere Office-Dokumente', back: 'Zurück zu Studio',
    description: 'Dieser Bereich dient ausschließlich dem Export alter EuroOffice-Dokumente und Sicherungen. Neue DOCX-Dateien werden hier nicht erstellt.',
    importHint: 'Exportierte DOCX-Dateien können über den Dokumentimport von Studio geöffnet werden.',
    revision: 'Version:', download: 'DOCX herunterladen', recovery: 'Sicherungen', save: 'Speichertyp:',
    noSaves: 'Keine zusätzlichen Sicherungen.', empty: 'Keine früheren Office-Dokumente.',
    loading: 'Dokumente werden geladen…', loadError: 'Dokumente oder Sicherungen konnten nicht geladen werden.',
    downloadError: 'DOCX konnte nicht heruntergeladen werden.',
  };
  return {
    title: 'Previous Office documents', back: 'Back to Studio',
    description: 'This area is for exporting previous EuroOffice documents and recovery snapshots only. New DOCX documents are no longer created here.',
    importHint: 'Open an exported DOCX using Studio’s own document importer.',
    revision: 'Revision:', download: 'Download DOCX', recovery: 'Recovery saves', save: 'Save status:',
    noSaves: 'No separate recovery snapshots.', empty: 'No previous Office documents.',
    loading: 'Loading documents…', loadError: 'Could not load documents or recovery saves.',
    downloadError: 'Could not download the DOCX file.',
  };
}
