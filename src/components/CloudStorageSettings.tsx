import {
  Cloud,
  CloudUpload,
  RefreshCw,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { applyOmiContainerImportPlan } from '../app/omiContainerImportActions';
import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
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
  buildOmiContainer,
  OMI_CONTAINER_VERSION,
} from '../services/omiContainer';
import { inspectOmiContainer } from '../services/omiContainerImport';

interface CloudCopy {
  title: string;
  description: string;
  connectionTitle: string;
  provider: string;
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
    description: 'Connect Nextcloud or another WebDAV service and store portable OMI manuscript backups in your own cloud account.',
    connectionTitle: 'Cloud connections',
    provider: 'Provider',
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
    noConnections: 'No cloud connection has been configured yet.',
    backupTitle: 'Manuscript backup',
    backupDescription: 'Create a complete portable OMI package and upload it to the selected cloud connection.',
    chooseConnection: 'Choose a cloud connection',
    saveBackup: 'Save to cloud',
    savingBackup: 'Creating and uploading backup…',
    backupSaved: 'Cloud backup saved.',
    backups: 'Backup history',
    noBackups: 'No cloud backups exist for this manuscript yet.',
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
    description: 'Kapcsoljon Nextcloudot vagy más WebDAV-szolgáltatást, és a hordozható OMI kéziratmentéseket a saját felhőfiókjában tárolja.',
    connectionTitle: 'Felhőkapcsolatok',
    provider: 'Szolgáltató',
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
    noConnections: 'Még nincs beállított felhőkapcsolat.',
    backupTitle: 'Kézirat biztonsági mentése',
    backupDescription: 'Teljes, hordozható OMI-csomag készítése és feltöltése a kiválasztott felhőtárhelyre.',
    chooseConnection: 'Válasszon felhőkapcsolatot',
    saveBackup: 'Mentés felhőbe',
    savingBackup: 'A mentés készítése és feltöltése folyamatban…',
    backupSaved: 'A felhőmentés elkészült.',
    backups: 'Mentési előzmények',
    noBackups: 'Ehhez a kézirathoz még nincs felhőmentés.',
    restore: 'Visszaállítás',
    restoring: 'A mentés letöltése és ellenőrzése…',
    restored: 'A mentés sikeresen visszaállítva.',
    deleteBackup: 'Törlés',
    confirmDeleteConnection: 'Eltávolítja ezt a felhőkapcsolatot? A hozzá tartozó mentési előzmények is törlődnek a Stúdióból.',
    confirmDeleteBackup: 'Törli ezt a biztonsági mentést a felhőtárhelyről?',
    confirmRestore: 'Visszaállítja ezt a mentést? A jelenleg megnyitott kéziratot az ellenőrzött csomag váltja fel.',
    invalidPackage: 'A letöltött OMI-csomag nem ment át az integritásellenőrzésen.',
    refresh: 'Frissítés',
  },
  de: {
    title: 'Cloud-Speicher',
    description: 'Verbinden Sie Nextcloud oder einen anderen WebDAV-Dienst und speichern Sie portable OMI-Manuskriptsicherungen in Ihrem eigenen Cloud-Konto.',
    connectionTitle: 'Cloud-Verbindungen',
    provider: 'Anbieter',
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
    noConnections: 'Noch keine Cloud-Verbindung konfiguriert.',
    backupTitle: 'Manuskriptsicherung',
    backupDescription: 'Erstellt ein vollständiges portables OMI-Paket und lädt es in die ausgewählte Cloud-Verbindung hoch.',
    chooseConnection: 'Cloud-Verbindung auswählen',
    saveBackup: 'In Cloud speichern',
    savingBackup: 'Sicherung wird erstellt und hochgeladen…',
    backupSaved: 'Cloud-Sicherung gespeichert.',
    backups: 'Sicherungsverlauf',
    noBackups: 'Für dieses Manuskript gibt es noch keine Cloud-Sicherungen.',
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

export function CloudStorageSettings() {
  const { locale } = useTranslation();
  const copy = copyFor(locale);
  const manuscript = useStudioStore((state) => state.manuscript);
  const checkpoint = useStudioStore((state) => state.checkpoint);
  const [connections, setConnections] = useState<CloudConnection[]>([]);
  const [backups, setBackups] = useState<CloudBackup[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState('');
  const [providerType, setProviderType] = useState<CloudProviderType>('nextcloud');
  const [displayName, setDisplayName] = useState('Nextcloud');
  const [baseUrl, setBaseUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rootPath, setRootPath] = useState('OMI');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');

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

  async function connect(): Promise<void> {
    setBusy('connect');
    setMessage('');
    try {
      const connection = await createCloudConnection({
        providerType,
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
      if (!plan.validForImport || !plan.manuscript) {
        throw new Error(copy.invalidPackage);
      }
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

        <div className="studio-manuscript-fields">
          <label><span>{copy.provider}</span><select value={providerType} onChange={(event) => setProviderType(event.target.value as CloudProviderType)}><option value="nextcloud">{copy.nextcloud}</option><option value="webdav">{copy.webdav}</option></select></label>
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
