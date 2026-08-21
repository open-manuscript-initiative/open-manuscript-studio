import {
  Cloud,
  CloudUpload,
  FolderOpen,
  RefreshCw,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { applyOmiContainerImportPlan } from '../app/omiContainerImportActions';
import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import {
  cloudStorageProviders,
  getCloudConnectionMethods,
  getCloudStorageProvider,
  getDefaultCloudConnectionMethod,
  type CloudAccountType,
  type CloudConnectionMethodId,
  type CloudStorageProviderId,
} from '../integrations/cloudStorageProviders';
import { getStudioPlatform } from '../mobile/platform/platform';
import {
  createCloudConnection,
  deleteCloudBackup,
  deleteCloudConnection,
  downloadCloudBackup,
  listCloudBackups,
  listCloudConnections,
  testCloudConnection,
  uploadCloudBackup,
  type CloudBackup,
  type CloudConnection,
  type CloudProviderType,
} from '../services/cloudStorageApi';
import {
  chooseSynchronizedFolder,
  clearSynchronizedFolderPreference,
  getSynchronizedFolderPreference,
  setSynchronizedFolderPreference,
  writeOmiBackupToSynchronizedFolder,
  type SynchronizedFolderPreferenceContext,
} from '../services/localCloudFolder';
import {
  buildOmiContainer,
  OMI_CONTAINER_VERSION,
} from '../services/omiContainer';
import { inspectOmiContainer } from '../services/omiContainerImport';
import { getCurrentUser, useAuthStore } from '../store/authStore';

interface CloudCopy {
  title: string;
  description: string;
  providerSetup: string;
  provider: string;
  chooseProvider: string;
  accountType: string;
  personal: string;
  business: string;
  method: string;
  localFolderMethod: string;
  webdavMethod: string;
  oauthMethod: string;
  recommended: string;
  comingSoon: string;
  authentication: string;
  authNone: string;
  authWebDav: string;
  authOAuth: string;
  personalNote: string;
  businessNote: string;
  desktopOnly: string;
  oauthPlanned: string;
  localFolderDescription: string;
  chooseFolder: string;
  folderNotSelected: string;
  folderRemembered: string;
  forgetFolder: string;
  saveLocalBackup: string;
  savingLocalBackup: string;
  localBackupSaved: string;
  directConnection: string;
  directConnectionDescription: string;
  connectionTitle: string;
  providerLabel: string;
  nextcloud: string;
  webdav: string;
  displayName: string;
  serverUrl: string;
  username: string;
  password: string;
  rootPath: string;
  connect: string;
  connecting: string;
  connected: string;
  connectionError: string;
  test: string;
  remove: string;
  noConnections: string;
  backupTitle: string;
  backupDescription: string;
  chooseConnection: string;
  saveBackup: string;
  savingBackup: string;
  backupSaved: string;
  backups: string;
  noBackups: string;
  restore: string;
  restoring: string;
  restored: string;
  deleteBackup: string;
  confirmDeleteConnection: string;
  confirmDeleteBackup: string;
  confirmRestore: string;
  invalidPackage: string;
  refresh: string;
}

const COPY: Record<'en' | 'hu' | 'de', CloudCopy> = {
  en: {
    title: 'Cloud storage',
    description: 'Choose the storage provider first. Studio then shows the account type and connection methods that apply to that provider and this device.',
    providerSetup: 'Add storage',
    provider: 'Storage provider',
    chooseProvider: 'Choose a provider',
    accountType: 'Account type',
    personal: 'Personal',
    business: 'Organization / business',
    method: 'Connection method',
    localFolderMethod: 'Locally synchronized folder',
    webdavMethod: 'Direct WebDAV connection',
    oauthMethod: 'Direct provider sign-in (OAuth 2.0)',
    recommended: 'recommended',
    comingSoon: 'coming soon',
    authentication: 'Authentication',
    authNone: 'No OMI cloud credential is required. The provider desktop client authenticates and synchronizes the selected local folder.',
    authWebDav: 'WebDAV username plus password or app password. The credential is encrypted and stored on the Studio API server.',
    authOAuth: 'OAuth 2.0 provider sign-in. Studio receives an authorization token and never receives the provider password.',
    personalNote: 'This connection belongs to the signed-in author.',
    businessNote: 'Organization policies, tenant restrictions or administrator consent may apply to business accounts.',
    desktopOnly: 'Local synchronized folders are available in the desktop application. On the web, use a direct provider connection.',
    oauthPlanned: 'Direct OAuth integration for this provider is planned. If its desktop sync client is installed, use the locally synchronized folder method now.',
    localFolderDescription: 'Select a folder already synchronized by OneDrive, Google Drive, Dropbox, Nextcloud, iCloud Drive or another desktop sync client. Studio writes the portable OMI package locally; the provider client performs the cloud synchronization.',
    chooseFolder: 'Choose folder',
    folderNotSelected: 'No folder selected.',
    folderRemembered: 'Remembered only on this device. The folder path is never sent to the Studio server.',
    forgetFolder: 'Forget folder',
    saveLocalBackup: 'Save OMI backup to folder',
    savingLocalBackup: 'Creating local synchronized backup…',
    localBackupSaved: 'Backup saved to the synchronized folder.',
    directConnection: 'Direct cloud connection',
    directConnectionDescription: 'Use this when Studio should connect to the storage service itself instead of relying on a local synchronization client.',
    connectionTitle: 'Registered direct connections',
    providerLabel: 'Provider',
    nextcloud: 'Nextcloud',
    webdav: 'WebDAV',
    displayName: 'Connection name',
    serverUrl: 'WebDAV server URL',
    username: 'Username',
    password: 'Password or app password',
    rootPath: 'Root folder',
    connect: 'Connect',
    connecting: 'Connecting…',
    connected: 'Connected',
    connectionError: 'Connection error',
    test: 'Test',
    remove: 'Remove',
    noConnections: 'No direct cloud connection has been configured yet.',
    backupTitle: 'Server-side manuscript backup',
    backupDescription: 'Create a complete portable OMI package and upload it through a registered direct cloud connection.',
    chooseConnection: 'Choose a cloud connection',
    saveBackup: 'Save to cloud',
    savingBackup: 'Creating and uploading backup…',
    backupSaved: 'Cloud backup saved.',
    backups: 'Server-side backup history',
    noBackups: 'No server-side cloud backups exist for this manuscript yet.',
    restore: 'Restore',
    restoring: 'Downloading and verifying backup…',
    restored: 'Backup restored successfully.',
    deleteBackup: 'Delete',
    confirmDeleteConnection: 'Remove this cloud connection? Its registered backup history will also be removed from Studio.',
    confirmDeleteBackup: 'Delete this backup from cloud storage?',
    confirmRestore: 'Restore this backup? The currently open manuscript will be replaced by the verified package.',
    invalidPackage: 'The downloaded OMI package failed integrity verification.',
    refresh: 'Refresh',
  },
  hu: {
    title: 'Felhőtárhely',
    description: 'Először válaszd ki a felhőszolgáltatót. A Stúdió ezután csak az adott szolgáltatóhoz, fióktípushoz és eszközhöz tartozó kapcsolódási módokat mutatja.',
    providerSetup: 'Tárhely hozzáadása',
    provider: 'Felhőszolgáltató',
    chooseProvider: 'Válassz szolgáltatót',
    accountType: 'Fiók típusa',
    personal: 'Személyes',
    business: 'Szervezeti / üzleti',
    method: 'Kapcsolódási mód',
    localFolderMethod: 'Helyben szinkronizált mappa',
    webdavMethod: 'Közvetlen WebDAV-kapcsolat',
    oauthMethod: 'Közvetlen szolgáltatói bejelentkezés (OAuth 2.0)',
    recommended: 'ajánlott',
    comingSoon: 'hamarosan',
    authentication: 'Hitelesítés',
    authNone: 'Nincs szükség OMI-felhőhitelesítésre. A felhőszolgáltató asztali kliensprogramja végzi a bejelentkezést és a kiválasztott helyi mappa szinkronizálását.',
    authWebDav: 'WebDAV felhasználónév és jelszó vagy alkalmazásjelszó. A hitelesítő adat titkosítva, a Studio API szerverén kerül tárolásra.',
    authOAuth: 'OAuth 2.0 szolgáltatói bejelentkezés. A Studio engedélyezési tokent kap, a szolgáltatói jelszót nem.',
    personalNote: 'A kapcsolat a bejelentkezett szerző saját fiókjához tartozik.',
    businessNote: 'Szervezeti fióknál vállalati házirend, tenant-korlátozás vagy rendszergazdai jóváhagyás is szükséges lehet.',
    desktopOnly: 'A helyben szinkronizált mappa az asztali alkalmazásban használható. Weben közvetlen szolgáltatói kapcsolat szükséges.',
    oauthPlanned: 'Ehhez a szolgáltatóhoz a közvetlen OAuth-kapcsolat tervezett. Ha telepítve van a szolgáltató saját asztali szinkronizáló kliense, addig a helyben szinkronizált mappa használható.',
    localFolderDescription: 'Válassz egy olyan mappát, amelyet a OneDrive, Google Drive, Dropbox, Nextcloud, iCloud Drive vagy más asztali kliens már szinkronizál. A Studio helyben írja ki a hordozható OMI-csomagot; a felhőbe feltöltést a szolgáltató saját kliense végzi.',
    chooseFolder: 'Mappa kiválasztása',
    folderNotSelected: 'Nincs kiválasztott mappa.',
    folderRemembered: 'Csak ezen az eszközön jegyezzük meg. A mappa elérési útja nem kerül a Studio szerverére.',
    forgetFolder: 'Mappa elfelejtése',
    saveLocalBackup: 'OMI-mentés ebbe a mappába',
    savingLocalBackup: 'A helyi szinkronizált mentés készítése…',
    localBackupSaved: 'A mentés elkészült a szinkronizált mappában.',
    directConnection: 'Közvetlen felhőkapcsolat',
    directConnectionDescription: 'Akkor használd, ha a Studio közvetlenül kapcsolódjon a tárhelyszolgáltatáshoz, és ne a gépen futó szinkronizáló kliensre támaszkodjon.',
    connectionTitle: 'Regisztrált közvetlen kapcsolatok',
    providerLabel: 'Szolgáltató',
    nextcloud: 'Nextcloud',
    webdav: 'WebDAV',
    displayName: 'Kapcsolat neve',
    serverUrl: 'WebDAV szerver URL-je',
    username: 'Felhasználónév',
    password: 'Jelszó vagy alkalmazásjelszó',
    rootPath: 'Gyökérmappa',
    connect: 'Kapcsolódás',
    connecting: 'Kapcsolódás…',
    connected: 'Kapcsolódva',
    connectionError: 'Kapcsolati hiba',
    test: 'Tesztelés',
    remove: 'Eltávolítás',
    noConnections: 'Még nincs beállított közvetlen felhőkapcsolat.',
    backupTitle: 'Szerveroldali kéziratmentés',
    backupDescription: 'Teljes, hordozható OMI-csomag készítése és feltöltése egy regisztrált közvetlen felhőkapcsolaton keresztül.',
    chooseConnection: 'Válassz felhőkapcsolatot',
    saveBackup: 'Mentés felhőbe',
    savingBackup: 'A mentés készítése és feltöltése folyamatban…',
    backupSaved: 'A felhőmentés elkészült.',
    backups: 'Szerveroldali mentési előzmények',
    noBackups: 'Ehhez a kézirathoz még nincs szerveroldali felhőmentés.',
    restore: 'Visszaállítás',
    restoring: 'A mentés letöltése és ellenőrzése…',
    restored: 'A mentés sikeresen visszaállítva.',
    deleteBackup: 'Törlés',
    confirmDeleteConnection: 'Eltávolítod ezt a felhőkapcsolatot? A hozzá tartozó mentési előzmények is törlődnek a Stúdióból.',
    confirmDeleteBackup: 'Törlöd ezt a biztonsági mentést a felhőtárhelyről?',
    confirmRestore: 'Visszaállítod ezt a mentést? A jelenleg megnyitott kéziratot az ellenőrzött csomag váltja fel.',
    invalidPackage: 'A letöltött OMI-csomag nem ment át az integritásellenőrzésen.',
    refresh: 'Frissítés',
  },
  de: {
    title: 'Cloud-Speicher',
    description: 'Wählen Sie zuerst den Speicheranbieter. Studio zeigt danach nur die für Anbieter, Kontotyp und Gerät passenden Verbindungsmethoden.',
    providerSetup: 'Speicher hinzufügen',
    provider: 'Speicheranbieter',
    chooseProvider: 'Anbieter auswählen',
    accountType: 'Kontotyp',
    personal: 'Persönlich',
    business: 'Organisation / Unternehmen',
    method: 'Verbindungsmethode',
    localFolderMethod: 'Lokal synchronisierter Ordner',
    webdavMethod: 'Direkte WebDAV-Verbindung',
    oauthMethod: 'Direkte Anbieteranmeldung (OAuth 2.0)',
    recommended: 'empfohlen',
    comingSoon: 'demnächst',
    authentication: 'Authentifizierung',
    authNone: 'Keine OMI-Cloud-Anmeldedaten erforderlich. Der Desktop-Client des Anbieters authentifiziert und synchronisiert den ausgewählten lokalen Ordner.',
    authWebDav: 'WebDAV-Benutzername plus Passwort oder App-Passwort. Die Zugangsdaten werden verschlüsselt auf dem Studio-API-Server gespeichert.',
    authOAuth: 'OAuth-2.0-Anmeldung beim Anbieter. Studio erhält ein Autorisierungstoken, nicht das Anbieterpasswort.',
    personalNote: 'Diese Verbindung gehört zum persönlichen Konto des angemeldeten Autors.',
    businessNote: 'Bei Organisationskonten können Mandantenrichtlinien oder Administratorfreigaben erforderlich sein.',
    desktopOnly: 'Lokal synchronisierte Ordner sind in der Desktop-Anwendung verfügbar. Im Web ist eine direkte Anbieterverbindung erforderlich.',
    oauthPlanned: 'Die direkte OAuth-Integration für diesen Anbieter ist geplant. Ist dessen Desktop-Synchronisationsclient installiert, kann derzeit der lokal synchronisierte Ordner verwendet werden.',
    localFolderDescription: 'Wählen Sie einen Ordner, der bereits von OneDrive, Google Drive, Dropbox, Nextcloud, iCloud Drive oder einem anderen Desktop-Client synchronisiert wird. Studio schreibt das portable OMI-Paket lokal; der Anbieterclient übernimmt die Cloud-Synchronisation.',
    chooseFolder: 'Ordner auswählen',
    folderNotSelected: 'Kein Ordner ausgewählt.',
    folderRemembered: 'Nur auf diesem Gerät gespeichert. Der Ordnerpfad wird niemals an den Studio-Server übertragen.',
    forgetFolder: 'Ordner vergessen',
    saveLocalBackup: 'OMI-Sicherung in Ordner speichern',
    savingLocalBackup: 'Lokale synchronisierte Sicherung wird erstellt…',
    localBackupSaved: 'Sicherung im synchronisierten Ordner gespeichert.',
    directConnection: 'Direkte Cloud-Verbindung',
    directConnectionDescription: 'Verwenden Sie diese Option, wenn Studio selbst mit dem Speicherdienst verbinden soll, statt einen lokalen Synchronisationsclient zu verwenden.',
    connectionTitle: 'Registrierte direkte Verbindungen',
    providerLabel: 'Anbieter',
    nextcloud: 'Nextcloud',
    webdav: 'WebDAV',
    displayName: 'Verbindungsname',
    serverUrl: 'WebDAV-Server-URL',
    username: 'Benutzername',
    password: 'Passwort oder App-Passwort',
    rootPath: 'Stammordner',
    connect: 'Verbinden',
    connecting: 'Verbindung wird hergestellt…',
    connected: 'Verbunden',
    connectionError: 'Verbindungsfehler',
    test: 'Testen',
    remove: 'Entfernen',
    noConnections: 'Noch keine direkte Cloud-Verbindung konfiguriert.',
    backupTitle: 'Serverseitige Manuskriptsicherung',
    backupDescription: 'Erstellt ein vollständiges portables OMI-Paket und lädt es über eine registrierte direkte Cloud-Verbindung hoch.',
    chooseConnection: 'Cloud-Verbindung auswählen',
    saveBackup: 'In Cloud speichern',
    savingBackup: 'Sicherung wird erstellt und hochgeladen…',
    backupSaved: 'Cloud-Sicherung gespeichert.',
    backups: 'Serverseitiger Sicherungsverlauf',
    noBackups: 'Für dieses Manuskript gibt es noch keine serverseitigen Cloud-Sicherungen.',
    restore: 'Wiederherstellen',
    restoring: 'Sicherung wird heruntergeladen und geprüft…',
    restored: 'Sicherung erfolgreich wiederhergestellt.',
    deleteBackup: 'Löschen',
    confirmDeleteConnection: 'Diese Cloud-Verbindung entfernen? Der zugehörige Sicherungsverlauf wird ebenfalls aus Studio entfernt.',
    confirmDeleteBackup: 'Diese Sicherung aus dem Cloud-Speicher löschen?',
    confirmRestore: 'Diese Sicherung wiederherstellen? Das aktuell geöffnete Manuskript wird durch das geprüfte Paket ersetzt.',
    invalidPackage: 'Das heruntergeladene OMI-Paket hat die Integritätsprüfung nicht bestanden.',
    refresh: 'Aktualisieren',
  },
};

function copyFor(locale: string): CloudCopy {
  if (locale === 'hu' || locale === 'de') return COPY[locale];
  return COPY.en;
}

function formatBytes(value: string): string {
  const bytes = Number(value);
  if (!Number.isFinite(bytes)) return value;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function methodLabel(methodId: CloudConnectionMethodId, copy: CloudCopy): string {
  if (methodId === 'local-folder') return copy.localFolderMethod;
  if (methodId === 'webdav') return copy.webdavMethod;
  return copy.oauthMethod;
}

export function CloudStorageSettings() {
  const { locale } = useTranslation();
  const copy = copyFor(locale);
  const manuscript = useStudioStore((state) => state.manuscript);
  const checkpoint = useStudioStore((state) => state.checkpoint);
  const currentUser = useAuthStore(getCurrentUser);
  const platform = getStudioPlatform();
  const desktopLocalFolder = platform === 'desktop';
  const [connections, setConnections] = useState<CloudConnection[]>([]);
  const [backups, setBackups] = useState<CloudBackup[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState('');
  const [providerId, setProviderId] = useState<CloudStorageProviderId | ''>(
    desktopLocalFolder ? 'local-folder' : '',
  );
  const [accountType, setAccountType] = useState<CloudAccountType>('personal');
  const [connectionMethodId, setConnectionMethodId] = useState<CloudConnectionMethodId | ''>(
    desktopLocalFolder ? 'local-folder' : '',
  );
  const [localFolderPath, setLocalFolderPath] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rootPath, setRootPath] = useState('OMI');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const selectedProvider = useMemo(
    () => providerId ? getCloudStorageProvider(providerId) : null,
    [providerId],
  );
  const methods = useMemo(
    () => providerId ? getCloudConnectionMethods(providerId, accountType, platform) : [],
    [providerId, accountType, platform],
  );
  const selectedMethod = methods.find((method) => method.id === connectionMethodId) ?? null;
  const connectedConnections = useMemo(
    () => connections.filter((connection) => connection.status === 'connected'),
    [connections],
  );
  const localFolderContext = useMemo<SynchronizedFolderPreferenceContext | null>(
    () => providerId
      ? {
          userId: String(currentUser?.id ?? 'anonymous'),
          providerId,
          accountType,
        }
      : null,
    [currentUser?.id, providerId, accountType],
  );

  async function refresh(): Promise<void> {
    try {
      const [nextConnections, nextBackups] = await Promise.all([
        listCloudConnections(),
        listCloudBackups(manuscript.id),
      ]);
      setConnections(nextConnections);
      setBackups(nextBackups);
      setSelectedConnectionId((current) =>
        nextConnections.some((connection) => connection.id === current && connection.status === 'connected')
          ? current
          : nextConnections.find((connection) => connection.status === 'connected')?.id ?? '',
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  useEffect(() => {
    void refresh();
  }, [manuscript.id]);

  useEffect(() => {
    if (
      platform !== 'desktop'
      || selectedMethod?.implementation !== 'local-folder'
      || !localFolderContext
    ) {
      setLocalFolderPath('');
      return;
    }
    setLocalFolderPath(getSynchronizedFolderPreference(localFolderContext));
  }, [
    platform,
    selectedMethod?.implementation,
    localFolderContext,
  ]);

  function selectProvider(value: string): void {
    if (!value) {
      setProviderId('');
      setConnectionMethodId('');
      setLocalFolderPath('');
      return;
    }
    const nextProvider = getCloudStorageProvider(value as CloudStorageProviderId);
    const nextAccount = nextProvider.accountTypes[0] ?? 'personal';
    setProviderId(nextProvider.id);
    setAccountType(nextAccount);
    setConnectionMethodId(getDefaultCloudConnectionMethod(nextProvider.id, nextAccount, platform) ?? '');
    setDisplayName(nextProvider.displayName);
    setLocalFolderPath('');
    setMessage('');
  }

  function selectAccountType(value: CloudAccountType): void {
    if (!selectedProvider) return;
    setAccountType(value);
    setConnectionMethodId(getDefaultCloudConnectionMethod(selectedProvider.id, value, platform) ?? '');
    setLocalFolderPath('');
    setMessage('');
  }

  async function chooseLocalFolder(): Promise<void> {
    if (!localFolderContext) return;
    setMessage('');
    try {
      const selected = await chooseSynchronizedFolder(localFolderPath);
      if (!selected) return;
      setSynchronizedFolderPreference(localFolderContext, selected);
      setLocalFolderPath(selected);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  function forgetLocalFolder(): void {
    if (!localFolderContext) return;
    clearSynchronizedFolderPreference(localFolderContext);
    setLocalFolderPath('');
    setMessage('');
  }

  async function saveLocalBackup(): Promise<void> {
    if (!localFolderPath) return;
    setBusy('local-backup');
    setMessage(copy.savingLocalBackup);
    try {
      checkpoint('manual');
      const current = useStudioStore.getState().manuscript;
      const packaged = await buildOmiContainer(current);
      if (!packaged.validForExport) {
        const detail = packaged.diagnostics
          .filter((diagnostic) => diagnostic.severity === 'error')
          .map((diagnostic) => diagnostic.message)
          .join(' ');
        throw new Error(detail || copy.invalidPackage);
      }
      const path = await writeOmiBackupToSynchronizedFolder({
        folderPath: localFolderPath,
        manuscriptTitle: current.title,
        bytes: packaged.bytes,
      });
      setMessage(`${copy.localBackupSaved} ${path}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  }

  async function connect(): Promise<void> {
    if (!selectedProvider?.directProviderType || selectedMethod?.implementation !== 'webdav') return;
    setBusy('connect');
    setMessage('');
    try {
      const connection = await createCloudConnection({
        providerType: selectedProvider.directProviderType as CloudProviderType,
        displayName,
        baseUrl,
        username,
        password,
        rootPath,
      });
      setConnections((current) => [...current, connection]);
      setSelectedConnectionId(connection.id);
      setPassword('');
      setMessage(copy.connected);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  }

  async function testConnection(connectionId: string): Promise<void> {
    setBusy(`test:${connectionId}`);
    setMessage('');
    try {
      const updated = await testCloudConnection(connectionId);
      setConnections((current) =>
        current.map((connection) => connection.id === updated.id ? updated : connection),
      );
      setMessage(updated.status === 'connected' ? copy.connected : copy.connectionError);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  }

  async function removeConnection(connectionId: string): Promise<void> {
    if (!window.confirm(copy.confirmDeleteConnection)) return;
    setBusy(`connection-delete:${connectionId}`);
    setMessage('');
    try {
      await deleteCloudConnection(connectionId);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  }

  async function saveBackup(): Promise<void> {
    if (!selectedConnectionId) return;
    setBusy('backup');
    setMessage(copy.savingBackup);
    try {
      checkpoint('manual');
      const current = useStudioStore.getState().manuscript;
      const packaged = await buildOmiContainer(current);
      if (!packaged.validForExport) {
        const detail = packaged.diagnostics
          .filter((diagnostic) => diagnostic.severity === 'error')
          .map((diagnostic) => diagnostic.message)
          .join(' ');
        throw new Error(detail || copy.invalidPackage);
      }
      await uploadCloudBackup({
        manuscriptId: current.id,
        connectionId: selectedConnectionId,
        packageVersion: OMI_CONTAINER_VERSION,
        bytes: packaged.bytes,
      });
      await refresh();
      setMessage(copy.backupSaved);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  }

  async function restoreBackup(backup: CloudBackup): Promise<void> {
    if (!window.confirm(copy.confirmRestore)) return;
    setBusy(`restore:${backup.id}`);
    setMessage(copy.restoring);
    try {
      const bytes = await downloadCloudBackup(backup.id);
      const plan = await inspectOmiContainer(bytes);
      if (!plan.validForImport || !plan.manuscript) throw new Error(copy.invalidPackage);
      await applyOmiContainerImportPlan(plan);
      setMessage(copy.restored);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  }

  async function removeBackup(backupId: string): Promise<void> {
    if (!window.confirm(copy.confirmDeleteBackup)) return;
    setBusy(`backup-delete:${backupId}`);
    setMessage('');
    try {
      await deleteCloudBackup(backupId);
      setBackups((current) => current.filter((backup) => backup.id !== backupId));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  }

  const authenticationText = selectedMethod?.authentication === 'none'
    ? copy.authNone
    : selectedMethod?.authentication === 'webdav-credentials'
      ? copy.authWebDav
      : selectedMethod?.authentication === 'oauth2'
        ? copy.authOAuth
        : '';

  return (
    <section className="studio-settings-card" aria-labelledby="studio-cloud-storage-title">
      <div className="studio-settings-card-header">
        <div>
          <h4 id="studio-cloud-storage-title"><Cloud size={18} aria-hidden="true" /> {copy.title}</h4>
          <p>{copy.description}</p>
        </div>
        <button type="button" className="studio-menu-secondary-action" disabled={busy !== null} onClick={() => void refresh()}>
          <RefreshCw size={14} aria-hidden="true" /> {copy.refresh}
        </button>
      </div>

      <div className="studio-cloud-section">
        <strong>{copy.providerSetup}</strong>
        <div className="studio-manuscript-fields">
          <label>
            <span>{copy.provider}</span>
            <select value={providerId} onChange={(event) => selectProvider(event.target.value)}>
              <option value="">{copy.chooseProvider}</option>
              {cloudStorageProviders.map((provider) => (
                <option value={provider.id} key={provider.id}>{provider.displayName}</option>
              ))}
            </select>
          </label>

          {selectedProvider && selectedProvider.accountTypes.length > 1 ? (
            <label>
              <span>{copy.accountType}</span>
              <select value={accountType} onChange={(event) => selectAccountType(event.target.value as CloudAccountType)}>
                {selectedProvider.accountTypes.map((type) => (
                  <option value={type} key={type}>{type === 'business' ? copy.business : copy.personal}</option>
                ))}
              </select>
            </label>
          ) : null}

          {selectedProvider ? (
            <label>
              <span>{copy.method}</span>
              <select value={connectionMethodId} onChange={(event) => setConnectionMethodId(event.target.value as CloudConnectionMethodId)}>
                {methods.map((method) => (
                  <option value={method.id} key={method.id}>
                    {methodLabel(method.id, copy)}{method.recommended ? ` · ${copy.recommended}` : ''}{!method.available ? ` · ${copy.comingSoon}` : ''}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        {selectedProvider && selectedMethod ? (
          <div className="studio-settings-hint">
            <strong>{copy.authentication}</strong>
            <p>{authenticationText}</p>
            <p>{accountType === 'business' ? copy.businessNote : copy.personalNote}</p>
          </div>
        ) : null}

        {selectedMethod?.implementation === 'local-folder' ? (
          <div className="studio-tool-card">
            <div>
              <strong>{copy.localFolderMethod}</strong>
              <p>{copy.localFolderDescription}</p>
              <small>{platform === 'desktop' ? localFolderPath || copy.folderNotSelected : copy.desktopOnly}</small>
              {platform === 'desktop' && localFolderPath ? <small>{copy.folderRemembered}</small> : null}
            </div>
            <div className="studio-tool-actions">
              <button type="button" className="studio-menu-secondary-action" disabled={busy !== null || platform !== 'desktop'} onClick={() => void chooseLocalFolder()}>
                <FolderOpen size={16} aria-hidden="true" /> {copy.chooseFolder}
              </button>
              {localFolderPath ? (
                <button type="button" className="studio-menu-secondary-action" disabled={busy !== null || platform !== 'desktop'} onClick={forgetLocalFolder}>
                  <Trash2 size={14} aria-hidden="true" /> {copy.forgetFolder}
                </button>
              ) : null}
              <button type="button" className="studio-menu-primary-action" disabled={busy !== null || platform !== 'desktop' || !localFolderPath} onClick={() => void saveLocalBackup()}>
                <Save size={16} aria-hidden="true" /> {busy === 'local-backup' ? copy.savingLocalBackup : copy.saveLocalBackup}
              </button>
            </div>
          </div>
        ) : null}

        {selectedMethod?.implementation === 'planned-oauth' ? (
          <p className="studio-settings-future-note">{copy.oauthPlanned}</p>
        ) : null}

        {selectedMethod?.implementation === 'webdav' && selectedProvider?.directProviderType ? (
          <div className="studio-cloud-section">
            <strong>{copy.directConnection}</strong>
            <p>{copy.directConnectionDescription}</p>
            <div className="studio-manuscript-fields">
              <label><span>{copy.providerLabel}</span><input value={selectedProvider.displayName} disabled /></label>
              <label><span>{copy.displayName}</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>
              <label><span>{copy.serverUrl}</span><input type="url" placeholder="https://cloud.example.org/remote.php/dav/files/user/" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} /></label>
              <label><span>{copy.username}</span><input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} /></label>
              <label><span>{copy.password}</span><input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
              <label><span>{copy.rootPath}</span><input value={rootPath} onChange={(event) => setRootPath(event.target.value)} /></label>
            </div>
            <button type="button" className="studio-menu-primary-action" disabled={busy !== null || !displayName.trim() || !baseUrl.trim() || !username.trim() || !password} onClick={() => void connect()}>
              <Cloud size={16} aria-hidden="true" /> {busy === 'connect' ? copy.connecting : copy.connect}
            </button>
          </div>
        ) : null}
      </div>

      <div className="studio-cloud-section">
        <strong>{copy.connectionTitle}</strong>
        {connections.length === 0 ? <p>{copy.noConnections}</p> : (
          <div className="studio-language-preference-list">
            {connections.map((connection) => (
              <div className="studio-language-preference" key={connection.id}>
                <span className="studio-language-preference-copy">
                  <strong>{connection.displayName}</strong>
                  <small>{connection.providerType === 'nextcloud' ? copy.nextcloud : copy.webdav} · {connection.status === 'connected' ? copy.connected : copy.connectionError}</small>
                </span>
                <button type="button" className="studio-menu-secondary-action" disabled={busy !== null} onClick={() => void testConnection(connection.id)}>
                  <RefreshCw size={14} aria-hidden="true" /> {copy.test}
                </button>
                <button type="button" className="studio-menu-secondary-action studio-menu-danger-action" disabled={busy !== null} onClick={() => void removeConnection(connection.id)}>
                  <Trash2 size={14} aria-hidden="true" /> {copy.remove}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="studio-cloud-section">
        <strong>{copy.backupTitle}</strong>
        <p>{copy.backupDescription}</p>
        <div className="omi-keyword-input-row">
          <select value={selectedConnectionId} onChange={(event) => setSelectedConnectionId(event.target.value)}>
            <option value="">{copy.chooseConnection}</option>
            {connectedConnections.map((connection) => <option value={connection.id} key={connection.id}>{connection.displayName}</option>)}
          </select>
          <button type="button" className="studio-menu-primary-action" disabled={busy !== null || !selectedConnectionId} onClick={() => void saveBackup()}>
            <CloudUpload size={16} aria-hidden="true" /> {busy === 'backup' ? copy.savingBackup : copy.saveBackup}
          </button>
        </div>
      </div>

      <div className="studio-cloud-section">
        <strong>{copy.backups}</strong>
        {backups.length === 0 ? <p>{copy.noBackups}</p> : (
          <div className="studio-language-preference-list">
            {backups.map((backup) => (
              <div className="studio-language-preference" key={backup.id}>
                <span className="studio-language-preference-copy">
                  <strong>{new Date(backup.createdAt).toLocaleString(locale)}</strong>
                  <small>{formatBytes(backup.sizeBytes)} · OMI {backup.packageVersion}</small>
                </span>
                <button type="button" className="studio-menu-secondary-action" disabled={busy !== null} onClick={() => void restoreBackup(backup)}>
                  <RotateCcw size={14} aria-hidden="true" /> {busy === `restore:${backup.id}` ? copy.restoring : copy.restore}
                </button>
                <button type="button" className="studio-menu-secondary-action studio-menu-danger-action" disabled={busy !== null} onClick={() => void removeBackup(backup.id)}>
                  <Trash2 size={14} aria-hidden="true" /> {copy.deleteBackup}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {message ? <p className="studio-settings-hint" role="status">{message}</p> : null}
    </section>
  );
}
