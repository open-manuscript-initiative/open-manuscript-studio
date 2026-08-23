import {
  Cloud,
  CloudUpload,
  HardDrive,
  RefreshCw,
  RotateCcw,
  Save,
  Trash2,
  Usb,
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
import {
  getDeviceStorageMode,
  setDeviceStorageMode,
  subscribeDeviceStorageMode,
} from '../services/deviceStorageMode';
import { saveExportBlob } from '../services/exportFileDelivery';
import {
  buildOmiContainer,
  OMI_CONTAINER_VERSION,
} from '../services/omiContainer';
import { inspectOmiContainer } from '../services/omiContainerImport';
import { getCurrentUser, useAuthStore } from '../store/authStore';

interface CloudCopy {
  title: string;
  description: string;
  ownDevice: string;
  ownDeviceHint: string;
  sharedDeviceHint: string;
  systemTitle: string;
  systemEnabled: string;
  systemDisabled: string;
  systemDescription: string;
  systemWebDescription: string;
  portableTitle: string;
  portableDescription: string;
  saveSystemBackup: string;
  savePortableBackup: string;
  savingSystemBackup: string;
  systemBackupSaved: string;
  portableBackupSaved: string;
  providerSetup: string;
  providerSetupDescription: string;
  profileCloudDescription: string;
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
    description: 'Choose whether this is your own device. Local system storage is enabled only on your own device; cloud connections belong to your signed-in profile.',
    ownDevice: 'This is my own device',
    ownDeviceHint: 'System storage is enabled. Studio may keep a current local document path during this app session.',
    sharedDeviceHint: 'Shared or foreign device mode. Cloud storage is preferred and local working paths are not retained.',
    systemTitle: 'System storage',
    systemEnabled: 'enabled',
    systemDisabled: 'disabled on this device',
    systemDescription: 'Uses the operating system save interface for local folders, network drives and synchronized cloud folders exposed by the operating system.',
    systemWebDescription: 'The hosted web Studio does not have native system-storage access.',
    portableTitle: 'Portable storage',
    portableDescription: 'On a shared computer you can still save a one-off copy to a USB drive or other removable storage. Studio does not remember the selected path.',
    saveSystemBackup: 'Save portable OMI backup',
    savePortableBackup: 'Save to portable storage',
    savingSystemBackup: 'Preparing backup…',
    systemBackupSaved: 'The portable OMI backup was saved through system storage.',
    portableBackupSaved: 'The one-off copy was saved. The selected path was not retained by Studio.',
    providerSetup: 'Cloud storage for this profile',
    providerSetupDescription: 'These connections are stored for the signed-in profile and are available after signing in on another device.',
    profileCloudDescription: 'On a shared device, use a profile cloud connection as the normal save destination. Portable storage remains available for one-off copies.',
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
    authWebDav: 'WebDAV username plus password or app password. The credential is encrypted and stored on the Studio API server for this profile.',
    authOAuth: 'OAuth 2.0 provider sign-in. Studio receives an authorization token and never receives the provider password.',
    personalNote: 'This connection belongs to the signed-in author profile.',
    businessNote: 'Organization policies, tenant restrictions or administrator consent may apply to business accounts.',
    oauthPlanned: 'Direct OAuth integration for this provider is planned.',
    directConnection: 'Direct cloud connection',
    directConnectionDescription: 'Studio connects to the storage service itself. This configuration follows the signed-in profile rather than this computer.',
    connectionTitle: 'Profile cloud connections',
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
    noConnections: 'No cloud connection has been configured for this profile yet.',
    backupTitle: 'Cloud manuscript backup',
    backupDescription: 'Create a portable OMI package and upload it through a cloud connection belonging to your profile.',
    chooseConnection: 'Choose a cloud connection',
    saveBackup: 'Save to cloud',
    savingBackup: 'Creating and uploading backup…',
    backupSaved: 'Cloud backup saved.',
    backups: 'Cloud backup history',
    noBackups: 'No cloud backups exist for this manuscript yet.',
    restore: 'Restore',
    restoring: 'Downloading and verifying backup…',
    restored: 'Backup restored successfully.',
    deleteBackup: 'Delete',
    confirmDeleteConnection: 'Remove this cloud connection from your profile? Its registered backup history will also be removed from Studio.',
    confirmDeleteBackup: 'Delete this backup from cloud storage?',
    confirmRestore: 'Restore this backup? The currently open manuscript will be replaced by the verified package.',
    invalidPackage: 'The downloaded OMI package failed integrity verification.',
    refresh: 'Refresh',
  },
  hu: {
    title: 'Tárhely és felhőkapcsolatok',
    description: 'Állítsd be, hogy ez a saját eszközöd-e. A helyi rendszertárhely csak saját eszközön aktív; a felhőkapcsolatok a bejelentkezett profilhoz tartoznak.',
    ownDevice: 'A saját gépemen / eszközömön dolgozom',
    ownDeviceHint: 'A rendszertárhely bekapcsolva. A Studio a munkamenetben megjegyezheti az aktuális helyi dokumentum útvonalát.',
    sharedDeviceHint: 'Idegen vagy közös eszköz mód. A felhőtárhely az elsődleges, helyi munkafájl-útvonalat nem őrzünk meg.',
    systemTitle: 'Rendszertárhely',
    systemEnabled: 'bekapcsolva',
    systemDisabled: 'ezen az eszközön kikapcsolva',
    systemDescription: 'Az operációs rendszer mentési felületét használja helyi mappákhoz, hálózati meghajtókhoz és a rendszerben elérhető szinkronizált felhőmappákhoz.',
    systemWebDescription: 'A webes Studio nem rendelkezik natív rendszertárhely-hozzáféréssel.',
    portableTitle: 'Hordozható adattároló',
    portableDescription: 'Idegen gépen is menthetsz egyszeri másolatot pendrive-ra vagy más hordozható adathordozóra. A Studio nem jegyzi meg a kiválasztott útvonalat.',
    saveSystemBackup: 'Hordozható OMI-mentés',
    savePortableBackup: 'Mentés hordozható adattárolóra',
    savingSystemBackup: 'A mentés előkészítése…',
    systemBackupSaved: 'A hordozható OMI-mentés elkészült a rendszertárhelyen keresztül.',
    portableBackupSaved: 'Az egyszeri másolat elkészült. A Studio nem őrizte meg a kiválasztott útvonalat.',
    providerSetup: 'A profil felhőtárhelyei',
    providerSetupDescription: 'Ezek a kapcsolatok a bejelentkezett profilhoz tartoznak, ezért másik eszközön történő bejelentkezés után is elérhetők.',
    profileCloudDescription: 'Idegen gépen a profilhoz kapcsolt felhőtárhely legyen a normál mentési cél. Pendrive-ra továbbra is készíthető egyszeri másolat.',
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
    authWebDav: 'WebDAV felhasználónév és jelszó vagy alkalmazásjelszó. A hitelesítő adat titkosítva, ehhez a profilhoz kötve kerül a Studio API szerverére.',
    authOAuth: 'OAuth 2.0 szolgáltatói bejelentkezés. A Studio engedélyezési tokent kap, a szolgáltatói jelszót nem.',
    personalNote: 'A kapcsolat a bejelentkezett szerző profiljához tartozik.',
    businessNote: 'Szervezeti fióknál vállalati házirend, tenant-korlátozás vagy rendszergazdai jóváhagyás is szükséges lehet.',
    oauthPlanned: 'Ehhez a szolgáltatóhoz a közvetlen OAuth-kapcsolat tervezett.',
    directConnection: 'Közvetlen felhőkapcsolat',
    directConnectionDescription: 'A Studio közvetlenül kapcsolódik a tárhelyszolgáltatáshoz. A beállítás a profilhoz tartozik, nem ehhez a géphez.',
    connectionTitle: 'Profilhoz kapcsolt felhőkapcsolatok',
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
    noConnections: 'Ehhez a profilhoz még nincs beállított felhőkapcsolat.',
    backupTitle: 'Kézirat mentése felhőbe',
    backupDescription: 'Hordozható OMI-csomag készítése és feltöltése a profilhoz tartozó felhőkapcsolaton keresztül.',
    chooseConnection: 'Válassz felhőkapcsolatot',
    saveBackup: 'Mentés felhőbe',
    savingBackup: 'A mentés készítése és feltöltése folyamatban…',
    backupSaved: 'A felhőmentés elkészült.',
    backups: 'Felhőmentési előzmények',
    noBackups: 'Ehhez a kézirathoz még nincs felhőmentés.',
    restore: 'Visszaállítás',
    restoring: 'A mentés letöltése és ellenőrzése…',
    restored: 'A mentés sikeresen visszaállítva.',
    deleteBackup: 'Törlés',
    confirmDeleteConnection: 'Eltávolítod ezt a felhőkapcsolatot a profilodból? A hozzá tartozó mentési előzmények is törlődnek a Stúdióból.',
    confirmDeleteBackup: 'Törlöd ezt a biztonsági mentést a felhőtárhelyről?',
    confirmRestore: 'Visszaállítod ezt a mentést? A jelenleg megnyitott kéziratot az ellenőrzött csomag váltja fel.',
    invalidPackage: 'A letöltött OMI-csomag nem ment át az integritásellenőrzésen.',
    refresh: 'Frissítés',
  },
  de: {
    title: 'Speicher und Cloud-Verbindungen',
    description: 'Legen Sie fest, ob dies Ihr eigenes Gerät ist. Systemspeicher ist nur auf dem eigenen Gerät aktiv; Cloud-Verbindungen gehören zum angemeldeten Profil.',
    ownDevice: 'Ich arbeite auf meinem eigenen Gerät',
    ownDeviceHint: 'Systemspeicher ist aktiviert. Studio darf den aktuellen lokalen Dokumentpfad während dieser Sitzung beibehalten.',
    sharedDeviceHint: 'Gemeinsames oder fremdes Gerät. Cloud-Speicher wird bevorzugt; lokale Arbeitspfade werden nicht beibehalten.',
    systemTitle: 'Systemspeicher',
    systemEnabled: 'aktiviert',
    systemDisabled: 'auf diesem Gerät deaktiviert',
    systemDescription: 'Verwendet den Speicherdialog des Betriebssystems für lokale Ordner, Netzlaufwerke und synchronisierte Cloud-Ordner.',
    systemWebDescription: 'Das gehostete Web-Studio hat keinen nativen Systemspeicherzugriff.',
    portableTitle: 'Wechseldatenträger',
    portableDescription: 'Auf einem fremden Rechner kann eine einmalige Kopie auf USB-Stick oder einen anderen Wechseldatenträger gespeichert werden. Studio merkt sich den Pfad nicht.',
    saveSystemBackup: 'Portable OMI-Sicherung speichern',
    savePortableBackup: 'Auf Wechseldatenträger speichern',
    savingSystemBackup: 'Sicherung wird vorbereitet…',
    systemBackupSaved: 'Die portable OMI-Sicherung wurde über den Systemspeicher gespeichert.',
    portableBackupSaved: 'Die einmalige Kopie wurde gespeichert. Studio hat den gewählten Pfad nicht beibehalten.',
    providerSetup: 'Cloud-Speicher dieses Profils',
    providerSetupDescription: 'Diese Verbindungen gehören zum angemeldeten Profil und sind nach der Anmeldung auch auf anderen Geräten verfügbar.',
    profileCloudDescription: 'Auf einem fremden Gerät sollte eine profilgebundene Cloud-Verbindung das normale Speicherziel sein. Wechseldatenträger bleiben für einmalige Kopien verfügbar.',
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
    authWebDav: 'WebDAV-Benutzername plus Passwort oder App-Passwort. Die Zugangsdaten werden verschlüsselt und diesem Profil zugeordnet auf dem Studio-API-Server gespeichert.',
    authOAuth: 'OAuth-2.0-Anmeldung beim Anbieter. Studio erhält ein Autorisierungstoken, nicht das Anbieterpasswort.',
    personalNote: 'Diese Verbindung gehört zum Profil des angemeldeten Autors.',
    businessNote: 'Bei Organisationskonten können Mandantenrichtlinien oder Administratorfreigaben erforderlich sein.',
    oauthPlanned: 'Die direkte OAuth-Integration für diesen Anbieter ist geplant.',
    directConnection: 'Direkte Cloud-Verbindung',
    directConnectionDescription: 'Studio verbindet sich selbst mit dem Speicherdienst. Die Einstellung gehört zum Profil und nicht zu diesem Computer.',
    connectionTitle: 'Cloud-Verbindungen des Profils',
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
    noConnections: 'Für dieses Profil ist noch keine Cloud-Verbindung konfiguriert.',
    backupTitle: 'Manuskript in der Cloud sichern',
    backupDescription: 'Erstellt ein portables OMI-Paket und lädt es über eine Cloud-Verbindung des Profils hoch.',
    chooseConnection: 'Cloud-Verbindung auswählen',
    saveBackup: 'In Cloud speichern',
    savingBackup: 'Sicherung wird erstellt und hochgeladen…',
    backupSaved: 'Cloud-Sicherung gespeichert.',
    backups: 'Cloud-Sicherungsverlauf',
    noBackups: 'Für dieses Manuskript gibt es noch keine Cloud-Sicherungen.',
    restore: 'Wiederherstellen',
    restoring: 'Sicherung wird heruntergeladen und geprüft…',
    restored: 'Sicherung erfolgreich wiederhergestellt.',
    deleteBackup: 'Löschen',
    confirmDeleteConnection: 'Diese Cloud-Verbindung aus Ihrem Profil entfernen? Der zugehörige Sicherungsverlauf wird ebenfalls aus Studio entfernt.',
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
  const currentUser = useAuthStore(getCurrentUser);
  const platform = getStudioPlatform();
  const nativeStorageCapable = hasNativeSystemStorage(platform);
  const userId = String(currentUser?.id ?? 'anonymous');
  const [deviceMode, setDeviceMode] = useState(() => getDeviceStorageMode(userId));
  const ownDevice = nativeStorageCapable && deviceMode === 'own-device';
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

  useEffect(() => {
    setDeviceMode(getDeviceStorageMode(userId));
    return subscribeDeviceStorageMode(() => {
      setDeviceMode(getDeviceStorageMode(userId));
    });
  }, [userId]);

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

  function changeOwnDevice(checked: boolean): void {
    const nextMode = checked ? 'own-device' : 'shared-device';
    setDeviceStorageMode(userId, nextMode);
    setDeviceMode(nextMode);
    setMessage('');
  }

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

  async function saveNativeBackup(portableOnly: boolean): Promise<void> {
    if (!nativeStorageCapable) return;
    setBusy(portableOnly ? 'portable-backup' : 'system-backup');
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
      setMessage(
        delivery.saved
          ? portableOnly ? copy.portableBackupSaved : copy.systemBackupSaved
          : '',
      );
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

      {nativeStorageCapable ? (
        <div className="studio-cloud-section">
          <label className="studio-settings-hint">
            <span>
              <input
                type="checkbox"
                checked={ownDevice}
                onChange={(event) => changeOwnDevice(event.target.checked)}
              />{' '}
              <strong>{copy.ownDevice}</strong>
            </span>
            <p>{ownDevice ? copy.ownDeviceHint : copy.sharedDeviceHint}</p>
          </label>
        </div>
      ) : null}

      <div className="studio-cloud-section">
        <div className="studio-tool-card">
          <div>
            <strong><HardDrive size={16} aria-hidden="true" /> {copy.systemTitle} · {ownDevice ? copy.systemEnabled : copy.systemDisabled}</strong>
            <p>{nativeStorageCapable ? copy.systemDescription : copy.systemWebDescription}</p>
          </div>
          {ownDevice ? (
            <div className="studio-tool-actions">
              <button
                type="button"
                className="studio-menu-primary-action"
                disabled={busy !== null}
                onClick={() => void saveNativeBackup(false)}
              >
                <Save size={16} aria-hidden="true" />
                {busy === 'system-backup' ? copy.savingSystemBackup : copy.saveSystemBackup}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {nativeStorageCapable && !ownDevice ? (
        <div className="studio-cloud-section">
          <div className="studio-tool-card">
            <div>
              <strong><Usb size={16} aria-hidden="true" /> {copy.portableTitle}</strong>
              <p>{copy.portableDescription}</p>
            </div>
            <div className="studio-tool-actions">
              <button
                type="button"
                className="studio-menu-secondary-action"
                disabled={busy !== null}
                onClick={() => void saveNativeBackup(true)}
              >
                <Usb size={16} aria-hidden="true" />
                {busy === 'portable-backup' ? copy.savingSystemBackup : copy.savePortableBackup}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="studio-cloud-section">
        <strong>{copy.providerSetup}</strong>
        <p>{copy.providerSetupDescription}</p>
        {!ownDevice && nativeStorageCapable ? <p className="studio-settings-hint">{copy.profileCloudDescription}</p> : null}
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
