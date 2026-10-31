import { BookOpen, FilePlus2, FileText, LibraryBig } from 'lucide-react';
import { useEffect, useState } from 'react';

import { createAndOpenBlankOmiDocument } from '../app/newDocumentActions';
import { useTranslation } from '../i18n';
import type { OmiVolumeKind } from '../model/documentProfile';
import { euroOfficeEnabled, requestPlainDocumentWorkspace } from '../services/euroOfficeApi';

interface NewDocumentActionsProps {
  onCreated?: () => void;
  variant?: 'menu' | 'empty-workspace';
}

export function NewDocumentActions({
  onCreated,
  variant = 'menu',
}: NewDocumentActionsProps) {
  const { locale } = useTranslation();
  const copy = getCopy(locale);
  const [euroOfficeAvailable, setEuroOfficeAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    euroOfficeEnabled().then((enabled) => {
      if (!cancelled) setEuroOfficeAvailable(enabled);
    }).catch(() => {
      if (!cancelled) setEuroOfficeAvailable(false);
    });
    return () => { cancelled = true; };
  }, []);

  const createStudy = () => {
    createAndOpenBlankOmiDocument({ kind: 'study', locale });
    onCreated?.();
  };

  const createVolume = (volumeKind: OmiVolumeKind) => {
    createAndOpenBlankOmiDocument({ kind: 'volume', volumeKind, locale });
    onCreated?.();
  };

  return (
    <section
      className={`omi-new-document-actions omi-new-document-actions--${variant}`}
      aria-labelledby={`omi-new-document-title-${variant}`}
    >
      <div className="omi-new-document-heading">
        <strong id={`omi-new-document-title-${variant}`}>{copy.title}</strong>
        <p>{copy.description}</p>
      </div>

      <div className="omi-new-document-grid">
        <button type="button" onClick={createStudy}>
          <FilePlus2 size={20} aria-hidden="true" />
          <span><strong>{copy.study}</strong><small>{copy.studyDescription}</small></span>
        </button>
        <button type="button" onClick={() => createVolume('monograph')}>
          <BookOpen size={20} aria-hidden="true" />
          <span><strong>{copy.monograph}</strong><small>{copy.monographDescription}</small></span>
        </button>
        <button type="button" onClick={() => createVolume('edited-volume')}>
          <LibraryBig size={20} aria-hidden="true" />
          <span><strong>{copy.editedVolume}</strong><small>{copy.editedVolumeDescription}</small></span>
        </button>
        {euroOfficeAvailable ? (
          <button type="button" onClick={() => { requestPlainDocumentWorkspace(null); onCreated?.(); }}>
            <FileText size={20} aria-hidden="true" />
            <span><strong>{copy.plainDocuments}</strong><small>{copy.plainDocumentsDescription}</small></span>
          </button>
        ) : null}
      </div>
    </section>
  );
}

function getCopy(locale: string) {
  if (locale === 'hu') return {
    title: 'Új dokumentum',
    description: 'Hozzon létre OMI-tanulmányt vagy -kötetet, illetve hétköznapi DOCX-dokumentumot EuroOffice-szal.',
    study: 'Új OMI tanulmány',
    studyDescription: 'Önálló tanulmány saját címmel, metaadatokkal és tartalommal.',
    monograph: 'Új OMI monográfia',
    monographDescription: 'Egyszerzős kötet fejezetekkel és közös apparátussal.',
    editedVolume: 'Új OMI tanulmánykötet',
    editedVolumeDescription: 'Több szerző külön szerkeszthető tanulmányaiból.',
    plainDocuments: 'Hétköznapi DOCX-dokumentumok',
    plainDocumentsDescription: 'Natív Word-fájlok írása EuroOffice-szal, a Stúdión belül.',
  };
  if (locale === 'de') return {
    title: 'Neues Dokument',
    description: 'Erstellen Sie einen OMI-Beitrag oder -Band oder ein gewöhnliches DOCX-Dokument mit EuroOffice.',
    study: 'Neue OMI-Studie',
    studyDescription: 'Eigenständiger Beitrag mit eigenem Titel, Metadaten und Inhalt.',
    monograph: 'Neue OMI-Monografie',
    monographDescription: 'Ein einbändiges Werk mit Kapiteln und gemeinsamem Apparat.',
    editedVolume: 'Neuer OMI-Sammelband',
    editedVolumeDescription: 'Getrennt bearbeitbare Beiträge mehrerer Autorinnen und Autoren.',
    plainDocuments: 'Allgemeine DOCX-Dokumente',
    plainDocumentsDescription: 'Word-Dateien nativ mit EuroOffice in Studio bearbeiten.',
  };
  return {
    title: 'New document',
    description: 'Create an OMI study or volume, or write an everyday DOCX document with EuroOffice.',
    study: 'New OMI study',
    studyDescription: 'A standalone study with its own title, metadata, and content.',
    monograph: 'New OMI monograph',
    monographDescription: 'A single-author volume with chapters and shared scholarly apparatus.',
    editedVolume: 'New OMI edited volume',
    editedVolumeDescription: 'Separately editable studies by multiple authors.',
    plainDocuments: 'Everyday DOCX documents',
    plainDocumentsDescription: 'Write native Word files with EuroOffice inside Studio.',
  };
}
