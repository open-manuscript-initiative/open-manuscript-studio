import { BookOpen, FilePlus2, LibraryBig } from 'lucide-react';

import { createAndOpenBlankOmiDocument } from '../app/newDocumentActions';
import { isDocumentClosedState } from '../app/documentCloseState';
import { useTranslation } from '../i18n';
import { isMobileStudio } from '../mobile/platform/platform';
import type { OmiVolumeKind } from '../model/documentProfile';

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

  const confirmSingleDocumentReplacement = () => {
    if (isDocumentClosedState() || !isMobileStudio()) return true;
    return window.confirm(copy.replaceConfirm);
  };

  const createStudy = () => {
    if (!confirmSingleDocumentReplacement()) return;
    createAndOpenBlankOmiDocument({ kind: 'study', locale });
    onCreated?.();
  };

  const createVolume = (volumeKind: OmiVolumeKind) => {
    if (!confirmSingleDocumentReplacement()) return;
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
      </div>
    </section>
  );
}

function getCopy(locale: string) {
  if (locale === 'hu') return {
    title: 'Új OMI dokumentum',
    description: 'Indítson önálló tanulmányt, egyszerzős monográfiát vagy többszerzős tanulmánykötetet.',
    study: 'Új OMI tanulmány',
    studyDescription: 'Egy tanulmány, egy önálló Tiptap-szerkesztő.',
    monograph: 'Új OMI monográfia',
    monographDescription: 'Egyszerzős kötet fejezetekkel és közös apparátussal.',
    editedVolume: 'Új OMI tanulmánykötet',
    editedVolumeDescription: 'Több szerző külön szerkeszthető tanulmányaiból.',
    replaceConfirm: 'Az új dokumentum felváltja a mobil munkatérben megnyitott dokumentumot. Folytatja?',
  };
  if (locale === 'de') return {
    title: 'Neues OMI-Dokument',
    description: 'Beginnen Sie einen eigenständigen Beitrag, eine Monografie oder einen Sammelband.',
    study: 'Neue OMI-Studie',
    studyDescription: 'Eine Studie in einem eigenen Tiptap-Editor.',
    monograph: 'Neue OMI-Monografie',
    monographDescription: 'Ein einbändiges Werk mit Kapiteln und gemeinsamem Apparat.',
    editedVolume: 'Neuer OMI-Sammelband',
    editedVolumeDescription: 'Getrennt bearbeitbare Beiträge mehrerer Autorinnen und Autoren.',
    replaceConfirm: 'Das neue Dokument ersetzt das aktuell geöffnete Dokument im mobilen Arbeitsbereich. Fortfahren?',
  };
  return {
    title: 'New OMI document',
    description: 'Start a standalone study, a single-author monograph, or a multi-author edited volume.',
    study: 'New OMI study',
    studyDescription: 'One study in one independent Tiptap editor.',
    monograph: 'New OMI monograph',
    monographDescription: 'A single-author volume with chapters and shared scholarly apparatus.',
    editedVolume: 'New OMI edited volume',
    editedVolumeDescription: 'Separately editable studies by multiple authors.',
    replaceConfirm: 'The new document will replace the document open in the mobile workspace. Continue?',
  };
}
