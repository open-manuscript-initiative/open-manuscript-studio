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
import { getCloudStorageCopy, type CloudCopy } from '../i18n/cloudStorageTranslations';
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
  const copy = getCloudStorageCopy(locale);
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
