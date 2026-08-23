import {
  BookOpen,
  FileText,
  Fingerprint,
  FolderOpen,
  History as HistoryIcon,
  Library,
  Printer,
  RotateCcw,
  Save,
  SaveAll,
  Settings2,
  StickyNote,
  UserPlus,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import {
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import { getPublicationProfileCopy } from '../i18n/publicationProfile';
import { getStudioPlatform, type StudioPlatform } from '../mobile/platform/platform';
import { saveExportBlob } from '../services/exportFileDelivery';
import {
  getCurrentManuscriptFilePath,
  isAndroidDocumentUri,
  isNativeStudio,
  openLocalManuscript,
  saveLocalManuscript,
  saveLocalManuscriptAs,
} from '../services/nativeManuscriptFile';
import type { OjsAssignmentLaunchContext } from '../services/ojsAssignmentApi';
import { buildOmiContainer } from '../services/omiContainer';
import { AssetContainerPanel } from './AssetContainerPanel';
import { AuthorSignaturePanel } from './AuthorSignaturePanel';
import { ContentLanguageSettings } from './ContentLanguageSettings';
import { CrossReferencePanel } from './CrossReferencePanel';
import { DocxImportPanel } from './DocxImportPanel';
import { ExportFormatsPanel } from './ExportFormatsPanel';
import { Footer } from './Footer';
import { HistoryPanel } from './HistoryPanel';
import { KeywordEditor } from './KeywordEditor';
import { ManuscriptLanguageField } from './ManuscriptLanguageField';
import { NotesPanel } from './NotesPanel';
import { OjsAssignmentPanel } from './OjsAssignmentPanel';
import { PropertiesPanel } from './PropertiesPanel';
import { PublicationProfilePanel } from './PublicationProfilePanel';
import { ReferencesPanel } from './ReferencesPanel';
import { SectionNumberingControl } from './SectionNumberingControl';
import { SectionStructurePanel } from './SectionStructurePanel';

type StudioMenuView =
  | 'document'
  | 'manuscript'
  | 'notes'
  | 'references'
  | 'contributors'
  | 'assignments'
  | 'publication'
  | 'signatures'
  | 'history'
  | 'tools'
  | 'settings';

interface StudioMenuProps {
  open: boolean;
  onClose: () => void;
  ojsAssignment?: {
    actorMode: 'editor' | 'author';
    context: OjsAssignmentLaunchContext;
  } | null;
}

export function StudioMenu({
  open,
  onClose,
  ojsAssignment = null,
}: StudioMenuProps) {
  const { t, locale } = useTranslation();
  const publicationCopy = getPublicationProfileCopy(locale);
  const [activeView, setActiveView] =
    useState<StudioMenuView>('document');
  const assignmentsLabel = locale === 'hu'
    ? 'Megbízások'
    : locale === 'de'
      ? 'Aufträge'
      : 'Assignments';
  const signaturesLabel = locale === 'hu'
    ? 'Aláírások'
    : locale === 'de'
      ? 'Signaturen'
      : 'Signatures';

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="studio-menu-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <aside className="studio-menu-drawer" role="dialog" aria-modal="true" aria-labelledby="studio-menu-title">
        <header className="studio-menu-header">
          <div><span className="studio-menu-eyebrow">Open Manuscript Studio</span><h2 id="studio-menu-title">{t('studio.menu')}</h2></div>
          <button type="button" className="studio-menu-close" aria-label={t('studio.closeMenu')} title={t('studio.closeMenu')} onClick={onClose}><X size={20} aria-hidden="true" /></button>
        </header>
        <div className="studio-menu-body">
          <nav className="studio-menu-navigation" aria-label={t('studio.menu')}>
            <MenuButton active={activeView === 'document'} icon={<BookOpen size={18} aria-hidden="true" />} label={t('studio.navigation.document')} onClick={() => setActiveView('document')} />
            <MenuButton active={activeView === 'manuscript'} icon={<FileText size={18} aria-hidden="true" />} label={t('studio.navigation.manuscript')} onClick={() => setActiveView('manuscript')} />
            <MenuButton active={activeView === 'notes'} icon={<StickyNote size={18} aria-hidden="true" />} label={t('studio.navigation.notes')} onClick={() => setActiveView('notes')} />
            <MenuButton active={activeView === 'references'} icon={<Library size={18} aria-hidden="true" />} label={t('studio.navigation.references')} onClick={() => setActiveView('references')} />
            <MenuButton active={activeView === 'contributors'} icon={<Users size={18} aria-hidden="true" />} label={t('studio.navigation.contributors')} onClick={() => setActiveView('contributors')} />
            {ojsAssignment ? <MenuButton active={activeView === 'assignments'} icon={<UserPlus size={18} aria-hidden="true" />} label={assignmentsLabel} onClick={() => setActiveView('assignments')} /> : null}
            <MenuButton active={activeView === 'publication'} icon={<Printer size={18} aria-hidden="true" />} label={publicationCopy.navigation} onClick={() => setActiveView('publication')} />
            <MenuButton active={activeView === 'signatures'} icon={<Fingerprint size={18} aria-hidden="true" />} label={signaturesLabel} onClick={() => setActiveView('signatures')} />
            <MenuButton active={activeView === 'history'} icon={<HistoryIcon size={18} aria-hidden="true" />} label={t('studio.navigation.history')} onClick={() => setActiveView('history')} />
            <MenuButton active={activeView === 'tools'} icon={<Wrench size={18} aria-hidden="true" />} label={t('studio.navigation.tools')} onClick={() => setActiveView('tools')} />
            <MenuButton active={activeView === 'settings'} icon={<Settings2 size={18} aria-hidden="true" />} label={t('studio.navigation.settings')} onClick={() => setActiveView('settings')} />
          </nav>
          <div className="studio-menu-content">
            {activeView === 'document' ? <DocumentMenuView onNavigate={onClose} /> : null}
            {activeView === 'manuscript' ? <ManuscriptDataView /> : null}
            {activeView === 'notes' ? <NotesPanel onNavigate={onClose} /> : null}
            {activeView === 'references' ? <ReferencesPanel /> : null}
            {activeView === 'contributors' ? <PropertiesPanel /> : null}
            {activeView === 'assignments' && ojsAssignment ? <OjsAssignmentPanel actorMode={ojsAssignment.actorMode} context={ojsAssignment.context} /> : null}
            {activeView === 'publication' ? <PublicationProfilePanel /> : null}
            {activeView === 'signatures' ? <AuthorSignaturePanel /> : null}
            {activeView === 'history' ? <HistoryPanel /> : null}
            {activeView === 'tools' ? <ToolsView /> : null}
            {activeView === 'settings' ? <SettingsView /> : null}
          </div>
        </div>
      </aside>
    </div>
  );
}

interface MenuButtonProps { active: boolean; icon: ReactNode; label: string; onClick: () => void; }
function MenuButton({ active, icon, label, onClick }: MenuButtonProps) {
  return <button type="button" className={`studio-menu-nav-button${active ? ' studio-menu-nav-button--active' : ''}`} aria-current={active ? 'page' : undefined} onClick={onClick}>{icon}<span>{label}</span></button>;
}

function DocumentMenuView({ onNavigate }: { onNavigate: () => void }) {
  const { t, locale } = useTranslation();
  const loadManuscript = useStudioStore((state) => state.loadManuscript);
  const [localPath, setLocalPath] = useState(getCurrentManuscriptFilePath());
  const [fileMessage, setFileMessage] = useState('');
  const native = isNativeStudio();
  const platform = getStudioPlatform();
  const labels = getLocalFileLabels(locale, platform);

  async function openNative(): Promise<void> {
    try {
      const result = await openLocalManuscript();
      if (!result) return;
      loadManuscript(result.manuscript);
      setLocalPath(result.path);
      setFileMessage(labels.opened);
    } catch (error) {
      setFileMessage(error instanceof Error ? error.message : String(error));
    }
  }

  return <section className="studio-menu-view">
    <div className="studio-menu-view-header"><div><h3>{t('studio.document.title')}</h3><p>{t('studio.document.description')}</p></div></div>
    {native ? <div className="studio-tool-card"><div><strong>{labels.openTitle}</strong><p>{labels.openDescription}</p><small>{formatNativeLocation(localPath, platform, labels)}</small>{fileMessage ? <p role="status">{fileMessage}</p> : null}</div><div className="studio-tool-actions"><button type="button" className="studio-menu-primary-action" onClick={() => void openNative()}><FolderOpen size={16} aria-hidden="true" />{labels.open}</button></div></div> : null}
    <DocxImportPanel />
    <SectionNumberingControl />
    <CrossReferencePanel />
    <div className="studio-menu-mobile-structure">
      <SectionStructurePanel onNavigate={onNavigate} />
    </div>
  </section>;
}

function ManuscriptDataView() {
  const { t } = useTranslation();
  const manuscript = useStudioStore((state) => state.manuscript);
  const setAbstract = useStudioStore((state) => state.setAbstract);
  return <section className="studio-menu-view"><div className="studio-menu-view-header"><div><h3>{t('studio.manuscript.title')}</h3><p>{t('studio.manuscript.description')}</p></div></div><div className="studio-manuscript-fields"><label><span>{t('manuscript.abstract')}</span><textarea value={manuscript.abstract ?? ''} onChange={(event) => setAbstract(event.target.value)} /></label><KeywordEditor /><ManuscriptLanguageField /></div></section>;
}

function ToolsView() {
  const { t, locale } = useTranslation();
  const manuscript = useStudioStore((state) => state.manuscript);
  const selectedSectionId = useStudioStore((state) => state.selectedSectionId);
  const checkpoint = useStudioStore((state) => state.checkpoint);
  const resetSample = useStudioStore((state) => state.resetSample);
  const selectedSection = manuscript.sections.find((section) => section.id === selectedSectionId);
  const [localPath, setLocalPath] = useState(getCurrentManuscriptFilePath());
  const [fileMessage, setFileMessage] = useState('');
  const [fileBusy, setFileBusy] = useState<'save' | 'backup' | null>(null);
  const native = isNativeStudio();
  const platform = getStudioPlatform();
  const labels = getLocalFileLabels(locale, platform);

  const semanticSection = selectedSection ? { id: selectedSection.id, title: selectedSection.title, blocks: selectedSection.blocks.map((block) => ({ id: block.id, type: block.type, content: parseBlockContent(block.content) })) } : null;

  async function saveNative(asNewFile = false): Promise<void> {
    setFileBusy('save');
    setFileMessage('');
    try {
      checkpoint('manual');
      const current = useStudioStore.getState().manuscript;
      const path = asNewFile ? await saveLocalManuscriptAs(current) : await saveLocalManuscript(current);
      if (!path) {
        setFileMessage(labels.cancelled);
        return;
      }
      setLocalPath(path);
      setFileMessage(labels.saved);
    } catch (error) {
      setFileMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setFileBusy(null);
    }
  }

  async function savePortableBackup(): Promise<void> {
    setFileBusy('backup');
    setFileMessage(labels.backupSaving);
    try {
      checkpoint('export');
      const current = useStudioStore.getState().manuscript;
      const packaged = await buildOmiContainer(current);
      if (!packaged.validForExport) {
        const detail = packaged.diagnostics
          .filter((diagnostic) => diagnostic.severity === 'error')
          .map((diagnostic) => diagnostic.message)
          .join(' ');
        throw new Error(detail || labels.backupFailed);
      }
      const delivery = await saveExportBlob(packaged.blob, packaged.fileName);
      setFileMessage(delivery.saved ? labels.backupSaved : labels.cancelled);
    } catch (error) {
      setFileMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setFileBusy(null);
    }
  }

  const nativeSaveCard = native ? (
    <div className="studio-tool-card">
      <div>
        <strong>{labels.localTitle}</strong>
        <p>{labels.localDescription}</p>
        <small>{formatNativeLocation(localPath, platform, labels)}</small>
        {platform === 'android' ? <small>{labels.androidProviderHint}</small> : null}
        {fileMessage ? <p role="status">{fileMessage}</p> : null}
      </div>
      <div className="studio-tool-actions">
        <button type="button" className="studio-menu-primary-action" disabled={fileBusy !== null} onClick={() => void saveNative(false)}>
          <Save size={16} aria-hidden="true" />{fileBusy === 'save' ? labels.saving : labels.save}
        </button>
        <button type="button" className="studio-menu-secondary-action" disabled={fileBusy !== null} onClick={() => void saveNative(true)}>
          <SaveAll size={16} aria-hidden="true" />{labels.saveAs}
        </button>
        {platform === 'android' ? (
          <button type="button" className="studio-menu-secondary-action" disabled={fileBusy !== null} onClick={() => void savePortableBackup()}>
            <SaveAll size={16} aria-hidden="true" />{fileBusy === 'backup' ? labels.backupSaving : labels.portableBackup}
          </button>
        ) : null}
      </div>
    </div>
  ) : null;

  return <section className="studio-menu-view"><div className="studio-menu-view-header"><div><h3>{t('studio.tools.title')}</h3><p>{t('studio.tools.description')}</p></div></div>
    {platform === 'android' ? nativeSaveCard : null}
    <ExportFormatsPanel />
    {platform !== 'android' ? nativeSaveCard : null}
    <AssetContainerPanel />
    <div className="studio-tool-card"><div><strong>{t('studio.tools.reset')}</strong><p>{t('studio.tools.resetDescription')}</p></div><button type="button" className="studio-menu-secondary-action studio-menu-danger-action" onClick={() => { if (window.confirm(t('studio.tools.confirmReset'))) resetSample(); }}><RotateCcw size={16} aria-hidden="true" />{t('studio.tools.reset')}</button></div>
    <details className="studio-technical-details"><summary>{t('studio.tools.technicalData')}</summary><p>{t('studio.tools.technicalDescription')}</p><div className="studio-json-header"><strong>{t('studio.tools.liveJson')}</strong><span>{t('studio.tools.synced')}</span></div><pre className="studio-json-view"><code>{JSON.stringify(semanticSection, null, 2)}</code></pre></details><div className="studio-menu-footer-wrap"><Footer /></div></section>;
}

function SettingsView() {
  const { t } = useTranslation();
  return <section className="studio-menu-view"><div className="studio-menu-view-header"><div><h3>{t('studio.settings.title')}</h3><p>{t('studio.settings.description')}</p></div></div><ContentLanguageSettings /></section>;
}

interface LocalFileLabels {
  localTitle: string;
  localDescription: string;
  openTitle: string;
  openDescription: string;
  open: string;
  save: string;
  saving: string;
  saveAs: string;
  noFile: string;
  targetSelected: string;
  saved: string;
  opened: string;
  cancelled: string;
  portableBackup: string;
  backupSaving: string;
  backupSaved: string;
  backupFailed: string;
  androidProviderHint: string;
}

function getLocalFileLabels(locale: string, platform: StudioPlatform): LocalFileLabels {
  const base: LocalFileLabels = locale === 'hu'
    ? {
        localTitle: 'Helyi kéziratfájl',
        localDescription: 'A telepített Studio közvetlenül a saját gépére, szinkronizált felhőmappába, NAS-ra vagy külső meghajtóra menthet.',
        openTitle: 'Meglévő dokumentum megnyitása',
        openDescription: 'Nyisson meg egy korábban mentett OMI kéziratot a telepített Studio alkalmazásban.',
        open: 'Megnyitás',
        save: 'Mentés',
        saving: 'Mentés…',
        saveAs: 'Mentés másként',
        noFile: 'Még nincs fájlhely kiválasztva.',
        targetSelected: 'A dokumentum mentési helye ki van választva.',
        saved: 'A kézirat mentve.',
        opened: 'A kézirat megnyitva.',
        cancelled: 'A művelet megszakítva.',
        portableBackup: 'OMI biztonsági másolat',
        backupSaving: 'Biztonsági másolat készítése…',
        backupSaved: 'A hordozható OMI biztonsági másolat mentve.',
        backupFailed: 'Az OMI biztonsági másolat nem készíthető el.',
        androidProviderHint: '',
      }
    : locale === 'de'
      ? {
          localTitle: 'Lokale Manuskriptdatei',
          localDescription: 'Das installierte Studio kann direkt auf dem Computer, in synchronisierten Cloud-Ordnern, auf NAS oder externen Laufwerken speichern.',
          openTitle: 'Vorhandenes Dokument öffnen',
          openDescription: 'Öffnen Sie ein zuvor gespeichertes OMI-Manuskript in der installierten Studio-App.',
          open: 'Öffnen',
          save: 'Speichern',
          saving: 'Wird gespeichert…',
          saveAs: 'Speichern unter',
          noFile: 'Noch kein Dateispeicherort ausgewählt.',
          targetSelected: 'Der Speicherort des Dokuments ist ausgewählt.',
          saved: 'Manuskript gespeichert.',
          opened: 'Manuskript geöffnet.',
          cancelled: 'Vorgang abgebrochen.',
          portableBackup: 'OMI-Sicherung',
          backupSaving: 'Sicherung wird erstellt…',
          backupSaved: 'Portable OMI-Sicherung gespeichert.',
          backupFailed: 'Die OMI-Sicherung konnte nicht erstellt werden.',
          androidProviderHint: '',
        }
      : {
          localTitle: 'Local manuscript file',
          localDescription: 'The installed Studio can save directly to your computer, synchronized cloud folders, NAS, or external drives.',
          openTitle: 'Open an existing document',
          openDescription: 'Open a previously saved OMI manuscript in the installed Studio app.',
          open: 'Open',
          save: 'Save',
          saving: 'Saving…',
          saveAs: 'Save as',
          noFile: 'No file location selected yet.',
          targetSelected: 'The document save location is selected.',
          saved: 'Manuscript saved.',
          opened: 'Manuscript opened.',
          cancelled: 'Operation cancelled.',
          portableBackup: 'OMI backup',
          backupSaving: 'Creating backup…',
          backupSaved: 'Portable OMI backup saved.',
          backupFailed: 'The OMI backup could not be created.',
          androidProviderHint: '',
        };

  if (platform !== 'android') return base;

  if (locale === 'hu') {
    return {
      ...base,
      localTitle: 'Mentés Androidon',
      localDescription: 'A Studio az Android rendszerfájlválasztóját használja. Menthetsz a készülékre, a Letöltések közé, SD-kártyára vagy az Androidban elérhető dokumentumszolgáltatóba.',
      openTitle: 'Kézirat megnyitása Androidon',
      openDescription: 'Válassz OMI kéziratot a készülékről vagy egy, az Android fájlválasztójában megjelenő tárhelyszolgáltatóból.',
      saveAs: 'Mentés másik helyre',
      noFile: 'Még nincs kiválasztott dokumentumhely ebben a munkamenetben.',
      targetSelected: 'A dokumentumhely ki van választva erre a munkamenetre.',
      androidProviderHint: 'A Google Drive, OneDrive, Dropbox, Nextcloud és más tárhelyek akkor jelenhetnek meg itt, ha a telepített alkalmazásuk Android dokumentumszolgáltatót biztosít.',
    };
  }

  if (locale === 'de') {
    return {
      ...base,
      localTitle: 'Speichern unter Android',
      localDescription: 'Studio verwendet die Android-Systemdateiauswahl. Sie können auf dem Gerät, in Downloads, auf einer SD-Karte oder bei einem in Android verfügbaren Dokumentanbieter speichern.',
      openTitle: 'Manuskript unter Android öffnen',
      openDescription: 'Wählen Sie ein OMI-Manuskript auf dem Gerät oder bei einem in der Android-Dateiauswahl verfügbaren Speicheranbieter aus.',
      saveAs: 'An anderem Ort speichern',
      noFile: 'In dieser Sitzung wurde noch kein Dokumentspeicherort ausgewählt.',
      targetSelected: 'Der Dokumentspeicherort ist für diese Sitzung ausgewählt.',
      androidProviderHint: 'Google Drive, OneDrive, Dropbox, Nextcloud und andere Speicher können hier erscheinen, wenn ihre installierte App einen Android-Dokumentanbieter bereitstellt.',
    };
  }

  return {
    ...base,
    localTitle: 'Save on Android',
    localDescription: 'Studio uses the Android system file picker. You can save on the device, in Downloads, on an SD card, or to a document provider available to Android.',
    openTitle: 'Open manuscript on Android',
    openDescription: 'Choose an OMI manuscript from the device or from a storage provider exposed in the Android file picker.',
    saveAs: 'Save to another location',
    noFile: 'No document location has been selected in this session yet.',
    targetSelected: 'The document location is selected for this session.',
    androidProviderHint: 'Google Drive, OneDrive, Dropbox, Nextcloud and other storage apps can appear here when their installed app exposes an Android document provider.',
  };
}

function formatNativeLocation(
  path: string | null,
  platform: StudioPlatform,
  labels: LocalFileLabels,
): string {
  if (!path) return labels.noFile;
  if (platform === 'android' || isAndroidDocumentUri(path)) return labels.targetSelected;
  return path;
}

function parseBlockContent(content: string): unknown {
  if (content.trim().length === 0) return { type: 'doc', content: [{ type: 'paragraph' }] };
  try { return JSON.parse(content) as unknown; } catch { return { legacyText: content }; }
}
