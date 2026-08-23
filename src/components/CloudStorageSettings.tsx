import {
  Cloud,
  CloudUpload,
  HardDrive,
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
import {
  getStudioPlatform,
  hasNativeSystemStorage,
} from '../mobile/platform/platform';
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
import { saveExportBlob } from '../services/exportFileDelivery';
import {
  buildOmiContainer,
  OMI_CONTAINER_VERSION,
} from '../services/omiContainer';
import { inspectOmiContainer } from '../services/omiContainerImport';

interface CloudCopy {
  title: string;
  description: string;
  systemTitle: string;
  systemEnabled: string;
  systemDescription: string;
  systemWebDescription: string;
  saveSystemBackup: string;
  savingSystemBackup: string;
  systemBackupSaved: string;
  providerSetup: string;
  providerSetupDescription: string;
  provider: string;
  chooseProvider: string;
  accountType: string;
  personal: string;
  business: string;
  method: string;
  webdavMethod: string;
  oauthMethod: string;
  recommended: string;
  comingSoon: string;
  authentication: string;
  authWebDav: string;
  authOAuth: string;
  personalNote: string;
  businessNote: string;
  oauthPlanned: string;
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
    title: 'Storage and cloud connections',
    description: 'Installed Studio apps use the operating system storage picker by default. Configure a direct provider connection only when Studio itself must connect to a cloud service.',
    systemTitle: 'System storage',
    systemEnabled: 'enabled',
    systemDescription: 'Uses the operating system save interface. This includes local folders, network drives and cloud locations already exposed by OneDrive, Google Drive, Dropbox, Nextcloud, iCloud Drive or another installed provider.',
    systemWebDescription: 'The hosted web Studio uses normal browser downloads. Install the native Studio app to use operating-system storage locations directly.',
    saveSystemBackup: 'Save portable OMI backup',
    savingSystemBackup: 'Preparing system-storage backup…',
    systemBackupSaved: 'The portable OMI backup was saved through the system storage interface.',
    providerSetup: 'Optional direct cloud connection',
    providerSetupDescription: 'Direct connections are separate from system storage. Use one only when Studio should authenticate to and communicate with a provider itself.',
    provider: 'Cloud provider',
    chooseProvider: 'Choose a provider',
    accountType: 'Account type',
    personal: 'Personal',
    business: 'Organization / business',
    method: 'Connection method',
    webdavMethod: 'Direct WebDAV connection',
    oauthMethod: 'Direct provider sign-in (OAuth 2.0)',
    recommended: 'recommended',
    comingSoon: 'coming soon',
    authentication: 'Authentication',
    authWebDav: 'WebDAV username plus password or app password. The credential is encrypted and stored on the Studio API server.',
    authOAuth: 'OAuth 2.0 provider sign-in. Studio receives an authorization token and never receives the provider password.',
    personalNote: 'This connection belongs to the signed-in author.',
    businessNote: 'Organization policies, tenant restrictions or administrator consent may apply to business accounts.',
    oauthPlanned: 'Direct OAuth integration for this provider is planned. Until then, use the provider location through the operating system storage picker when it is available there.',
    directConnection: 'Direct cloud connection',
    directConnectionDescription: 'Studio connects to this storage service itself instead of relying on the operating system or a local synchronization client.',
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
    title: 'Tárhely és felhőkapcsolatok',
    description: 'A telepített Studio alapértelmezetten az operációs rendszer tárhelyválasztóját használja. Közvetlen szolgáltatói kapcsolatot csak akkor kell beállítani, ha maga a Studio kapcsolódjon a felhőszolgáltatóhoz.',
    systemTitle: 'Rendszertárhely',
    systemEnabled: 'bekapcsolva',
    systemDescription: 'Az operációs rendszer mentési felületét használja. Ide tartoznak a helyi mappák, hálózati meghajtók és a rendszerben már elérhető OneDrive-, Google Drive-, Dropbox-, Nextcloud-, iCloud Drive- vagy más szolgáltatói helyek.',
    systemWebDescription: 'A webes Studio hagyományos böngészős letöltést használ. Az operációs rendszer tárhelyeinek közvetlen használatához a telepített Studio alkalmazás szükséges.',
    saveSystemBackup: 'Hordozható OMI-mentés',
    savingSystemBackup: 'A rendszertárhelyes mentés előkészítése…',
    systemBackupSaved: 'A hordozható OMI-mentés elkészült a rendszer mentési felületén keresztül.',
    providerSetup: 'Opcionális közvetlen felhőkapcsolat',
    providerSetupDescription: 'A közvetlen kapcsolat külön funkció a rendszertárhelytől. Csak akkor használd, ha a Studio maga hitelesítsen és kommunikáljon a felhőszolgáltatóval.',
    provider: 'Felhőszolgáltató',
    chooseProvider: 'Válassz szolgáltatót',
    accountType: 'Fiók típusa',
    personal: 'Személyes',
    business: 'Szervezeti / üzleti',
    method: 'Kapcsolódási mód',
    webdavMethod: 'Közvetlen WebDAV-kapcsolat',
    oauthMethod: 'Közvetlen szolgáltatói bejelentkezés (OAuth 2.0)',
    recommended: 'ajánlott',
    comingSoon: 'hamarosan',
    authentication: 'Hitelesítés',
    authWebDav: 'WebDAV felhasználónév és jelszó vagy alkalmazásjelszó. A hitelesítő adat titkosítva, a Studio API szerverén kerül tárolásra.',
    authOAuth: 'OAuth 2.0 szolgáltatói bejelentkezés. A Studio engedélyezési tokent kap, a szolgáltatói jelszót nem.',
    personalNote: 'A kapcsolat a bejelentkezett szerző saját fiókjához tartozik.',
    businessNote: 'Szervezeti fióknál vállalati házirend, tenant-korlátozás vagy rendszergazdai jóváhagyás is szükséges lehet.',
    oauthPlanned: 'Ehhez a szolgáltatóhoz a közvetlen OAuth-kapcsolat tervezett. Addig használd a szolgáltató tárhelyét az operációs rendszer mentési felületén keresztül, ha ott elérhető.',
    directConnection: 'Közvetlen felhőkapcsolat',
    directConnectionDescription: 'A Studio közvetlenül kapcsolódik a tárhelyszolgáltatáshoz, nem az operációs rendszerre vagy egy helyi szinkronizáló kliensre támaszkodik.',
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
    title: 'Speicher und Cloud-Verbindungen',
    description: 'Installierte Studio-Apps verwenden standardmäßig die Speicheroberfläche des Betriebssystems. Eine direkte Anbieter-Verbindung ist nur nötig, wenn Studio selbst mit dem Cloud-Dienst kommunizieren soll.',
    systemTitle: 'Systemspeicher',
    systemEnabled: 'aktiviert',
    systemDescription: 'Verwendet den Speicherdialog des Betriebssystems. Dazu gehören lokale Ordner, Netzlaufwerke und bereits im System verfügbare OneDrive-, Google-Drive-, Dropbox-, Nextcloud-, iCloud-Drive- oder andere Anbieterorte.',
    systemWebDescription: 'Das gehostete Web-Studio verwendet normale Browser-Downloads. Für direkten Zugriff auf Systemspeicherorte ist die installierte Studio-App erforderlich.',
    saveSystemBackup: 'Portable OMI-Sicherung speichern',
    savingSystemBackup: 'Systemspeicher-Sicherung wird vorbereitet…',
    systemBackupSaved: 'Die portable OMI-Sicherung wurde über die Systemspeicheroberfläche gespeichert.',
    providerSetup: 'Optionale direkte Cloud-Verbindung',
    providerSetupDescription: 'Direkte Verbindungen sind vom Systemspeicher getrennt. Verwenden Sie sie nur, wenn Studio selbst beim Anbieter authentifizieren und kommunizieren soll.',
    provider: 'Cloud-Anbieter',
    chooseProvider: 'Anbieter auswählen',
    accountType: 'Kontotyp',
    personal: 'Persönlich',
    business: 'Organisation / Unternehmen',
    method: 'Verbindungsmethode',
    webdavMethod: 'Direkte WebDAV-Verbindung',
    oauthMethod: 'Direkte Anbieteranmeldung (OAuth 2.0)',
    recommended: 'empfohlen',
    comingSoon: 'demnächst',
    authentication: 'Authentifizierung',
    authWebDav: 'WebDAV-Benutzername plus Passwort oder App-Passwort. Die Zugangsdaten werden verschlüsselt auf dem Studio-API-Server gespeichert.',
    authOAuth: 'OAuth-2.0-Anmeldung beim Anbieter. Studio erhält ein Autorisierungstoken, nicht das Anbieterpasswort.',
    personalNote: 'Diese Verbindung gehört zum persönlichen Konto des angemeldeten Autors.',
    businessNote: 'Bei Organisationskonten können Mandantenrichtlinien oder Administratorfreigaben erforderlich sein.',
    oauthPlanned: 'Die direkte OAuth-Integration für diesen Anbieter ist geplant. Verwenden Sie bis dahin den Anbieter über den Speicherdialog des Betriebssystems, sofern er dort verfügbar ist.',
    directConnection: 'Direkte Cloud-Verbindung',
    directConnectionDescription: 'Studio verbindet sich selbst mit dem Speicherdienst, statt das Betriebssystem oder einen lokalen Synchronisationsclient zu verwenden.',
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
  if (methodId === 'webdav') return copy.webdavMethod;
  if (methodId === 'oauth2') return copy.oauthMethod;
  return copy.systemTitle;
}

export function CloudStorageSettings() {
  const { locale } = useTranslation();
  const copy = copyFor(locale);
  const manuscript = useStudioStore((state) => state.manuscript);
  const checkpoint = useStudioStore((state) => state.checkpoint);
  const platform = getStudioPlatform();
  const systemStorageAvailable = hasNativeSystemStorage(platform);
  const [connections, setConnections] = useState<CloudConnection[]>([]);
  const [backups, setBackups] = useState<CloudBackup[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState('');
  const [providerId, setProviderId] = useState<CloudStorageProviderId | ''>('');
  const [accountType, setAccountType] = useState<CloudAccountType>('personal');
  const [connectionMethodId, setConnectionMethodId] = useState<CloudConnectionMethodId | ''>('');
  const [displayName, setDisplayName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rootPath, setRootPath] = useState('OMI');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const directProviders = useMemo(
    () => cloudStorageProviders.filter((provider) => provider.supportsWebDav || provider.supportsOAuth),
    [],
  );
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

  function selectProvider(value: string): void {
    if (!value) {
      setProviderId('');
      setConnectionMethodId('');
      setMessage('');
      return;
    }
    const nextProvider = getCloudStorageProvider(value as CloudStorageProviderId);
    const nextAccount = nextProvider.accountTypes[0] ?? 'personal';
    setProviderId(nextProvider.id);
    setAccountType(nextAccount);
    setConnectionMethodId(getDefaultCloudConnectionMethod(nextProvider.id, nextAccount, platform) ?? '');
    setDisplayName(nextProvider.displayName);
    setMessage('');
  }

  function selectAccountType(value: CloudAccountType): void {
    if (!selectedProvider) return;
    setAccountType(value);
    setConnectionMethodId(getDefaultCloudConnectionMethod(selectedProvider.id, value, platform) ?? '');
    setMessage('');
  }

  async function saveSystemBackup(): Promise<void> {
    if (!systemStorageAvailable) return;
    setBusy('system-backup');
    setMessage(copy.savingSystemBackup);
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
      const delivery = await saveExportBlob(packaged.blob, packaged.fileName);
      setMessage(delivery.saved ? copy.systemBackupSaved : '');
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

  const authenticationText = selectedMethod?.authentication === 'webdav-credentials'
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
        <div className="studio-tool-card">
          <div>
            <strong><HardDrive size={16} aria-hidden="true" /> {copy.systemTitle}{systemStorageAvailable ? ` · ${copy.systemEnabled}` : ''}</strong>
            <p>{systemStorageAvailable ? copy.systemDescription : copy.systemWebDescription}</p>
          </div>
          {systemStorageAvailable ? (
            <div className="studio-tool-actions">
              <button
                type="button"
                className="studio-menu-primary-action"
                disabled={busy !== null}
                onClick={() => void saveSystemBackup()}
              >
                <Save size={16} aria-hidden="true" />
                {busy === 'system-backup' ? copy.savingSystemBackup : copy.saveSystemBackup}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="studio-cloud-section">
        <strong>{copy.providerSetup}</strong>
        <p>{copy.providerSetupDescription}</p>
        <div className="studio-manuscript-fields">
          <label>
            <span>{copy.provider}</span>
            <select value={providerId} onChange={(event) => selectProvider(event.target.value)}>
              <option value="">{copy.chooseProvider}</option>
              {directProviders.map((provider) => (
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

          {selectedProvider && methods.length > 0 ? (
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
