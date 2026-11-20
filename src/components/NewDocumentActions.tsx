import { BookOpen, FilePlus2, FileText, LibraryBig } from 'lucide-react';
import { useEffect, useState } from 'react';

import { createAndOpenBlankOmiDocument, createAndOpenPublicationFromTemplate } from '../app/newDocumentActions';
import { useTranslation } from '../i18n';
import type { OmiVolumeKind } from '../model/documentProfile';
import { euroOfficeEnabled, requestPlainDocumentWorkspace } from '../services/euroOfficeApi';
import { PublicationIdentifierFields } from './PublicationIdentifierFields';
import type { OmiTitleMatter } from '../model/frontMatter';
import type { PublicationKind } from '../model/publicationIdentifiers';
import { getPublicationMatterCopy } from '../i18n/publicationMatter';
import { publicationTemplatesCopy } from '../i18n/publicationTemplates';
import type { PublicationTemplate } from '../model/publicationTemplates';
import { PublicationTemplateSelector, usePublicationTemplates } from './PublicationTemplateSelector';
import './NewDocumentActions.css';

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
  const [volumeKind, setVolumeKind] = useState<OmiVolumeKind | null>(null);
  const [publicationKind, setPublicationKind] = useState<PublicationKind>('volume');
  const [title, setTitle] = useState('');
  const [titleMatter, setTitleMatter] = useState<OmiTitleMatter>({});
  const publicationCopy = getPublicationMatterCopy(locale);
  const templateCopy = publicationTemplatesCopy(locale);
  const { templates, loadError } = usePublicationTemplates();
  const [template, setTemplate] = useState<PublicationTemplate>();
  const [busy, setBusy] = useState(false);
  const [templateError, setTemplateError] = useState(false);

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

  const createVolume = async (volumeKind: OmiVolumeKind) => {
    if (busy) return;
    setBusy(true); setTemplateError(false);
    try {
      const input = { kind: 'volume' as const, volumeKind: publicationKind === 'journal-issue' ? 'edited-volume' as const : volumeKind,
        publicationKind, title, titleMatter, locale };
      if (template?.kind === publicationKind) await createAndOpenPublicationFromTemplate(input, template);
      else createAndOpenBlankOmiDocument(input);
      onCreated?.();
      setVolumeKind(null);
      setTitle('');
      setTitleMatter({});
      setTemplate(undefined);
    } catch { setTemplateError(true); }
    finally { setBusy(false); }
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
        <button type="button" disabled={busy} onClick={createStudy}>
          <FilePlus2 size={20} aria-hidden="true" />
          <span><strong>{copy.study}</strong><small>{copy.studyDescription}</small></span>
        </button>
        <button type="button" disabled={busy} onClick={() => { setPublicationKind('volume'); setTemplate(undefined); setVolumeKind('monograph'); }}>
          <BookOpen size={20} aria-hidden="true" />
          <span><strong>{copy.monograph}</strong><small>{copy.monographDescription}</small></span>
        </button>
        <button type="button" disabled={busy} onClick={() => { setPublicationKind('volume'); setTemplate(undefined); setVolumeKind('edited-volume'); }}>
          <LibraryBig size={20} aria-hidden="true" />
          <span><strong>{copy.editedVolume}</strong><small>{copy.editedVolumeDescription}</small></span>
        </button>
        {euroOfficeAvailable ? (
          <button type="button" disabled={busy} onClick={() => { requestPlainDocumentWorkspace(null); onCreated?.(); }}>
            <FileText size={20} aria-hidden="true" />
            <span><strong>{copy.plainDocuments}</strong><small>{copy.plainDocumentsDescription}</small></span>
          </button>
        ) : null}
      </div>
      {volumeKind ? <form className="omi-new-publication-form" onSubmit={(event) => { event.preventDefault(); void createVolume(volumeKind); }}>
        <fieldset disabled={busy} className="omi-new-publication-template-fields">
        <label>{publicationCopy.kind}<select value={publicationKind} onChange={(event) => { setPublicationKind(event.target.value as PublicationKind); setTemplate(undefined); }}>
          <option value="volume">{publicationCopy.volume}</option>
          <option value="journal-issue">{publicationCopy.journal}</option>
        </select></label>
        <PublicationTemplateSelector templates={templates} locale={locale} kind={publicationKind} value={template?.id ?? ''} onChange={setTemplate} />
        {loadError ? <p role="alert">{templateCopy.loadError}</p> : null}
        <label>{copy.publicationTitle}<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        {publicationKind === 'volume' ? <label>{templateCopy.seriesTitle}<input value={titleMatter.seriesTitle ?? template?.defaults.seriesTitle ?? ''}
          onChange={(event) => setTitleMatter((previous) => ({ ...previous, seriesTitle: event.target.value }))} /></label> : null}
        <PublicationIdentifierFields locale={locale} kind={publicationKind} values={{ ...template?.defaults, ...titleMatter }}
          onChange={(field, value) => setTitleMatter((previous) => ({ ...previous, [field]: value }))} />
        <div className="omi-new-publication-form-actions">
          <button type="submit">{copy.create}</button>
          <button type="button" onClick={() => setVolumeKind(null)}>{copy.cancel}</button>
        </div>
        </fieldset>
        {templateError ? <p role="alert">{templateCopy.error}</p> : null}
        {busy ? <p role="status">{templateCopy.busy}</p> : null}
      </form> : null}
    </section>
  );
}

function getCopy(locale: string) {
  if (locale === 'hu') return {
    title: 'Új dokumentum',
    description: 'Új OMI-tanulmány, kötet, folyóiratszám vagy DOCX-dokumentum létrehozása.',
    publicationTitle: 'A kötet vagy folyóiratszám címe', create: 'Létrehozás', cancel: 'Mégse',
    study: 'Új OMI tanulmány',
    studyDescription: 'Önálló tanulmány saját címmel, metaadatokkal és tartalommal.',
    monograph: 'Új OMI monográfia',
    monographDescription: 'Egyszerzős kötet fejezetekkel és közös apparátussal.',
    editedVolume: 'Új kötet / folyóiratszám',
    editedVolumeDescription: 'Több szerző külön szerkeszthető tanulmányai egy kiadványban.',
    plainDocuments: 'Hétköznapi DOCX-dokumentumok',
    plainDocumentsDescription: 'Natív Word-fájlok írása EuroOffice-szal, a Stúdión belül.',
  };
  if (locale === 'de') return {
    title: 'Neues Dokument',
    description: 'Neuen OMI-Beitrag, Band, neues Zeitschriftenheft oder DOCX-Dokument erstellen.',
    publicationTitle: 'Titel des Bandes oder Zeitschriftenhefts', create: 'Erstellen', cancel: 'Abbrechen',
    study: 'Neue OMI-Studie',
    studyDescription: 'Eigenständiger Beitrag mit eigenem Titel, Metadaten und Inhalt.',
    monograph: 'Neue OMI-Monografie',
    monographDescription: 'Ein einbändiges Werk mit Kapiteln und gemeinsamem Apparat.',
    editedVolume: 'Neuer Band oder Heft',
    editedVolumeDescription: 'Getrennt bearbeitbare Beiträge mehrerer Autorinnen und Autoren.',
    plainDocuments: 'Allgemeine DOCX-Dokumente',
    plainDocumentsDescription: 'Word-Dateien nativ mit EuroOffice in Studio bearbeiten.',
  };
  return {
    title: 'New document',
    description: 'Create an OMI study, volume, journal issue or DOCX document.',
    publicationTitle: 'Volume or journal issue title', create: 'Create', cancel: 'Cancel',
    study: 'New OMI study',
    studyDescription: 'A standalone study with its own title, metadata, and content.',
    monograph: 'New OMI monograph',
    monographDescription: 'A single-author volume with chapters and shared scholarly apparatus.',
    editedVolume: 'New volume or issue',
    editedVolumeDescription: 'A volume or journal issue with independently editable studies.',
    plainDocuments: 'Everyday DOCX documents',
    plainDocumentsDescription: 'Write native Word files with EuroOffice inside Studio.',
  };
}
