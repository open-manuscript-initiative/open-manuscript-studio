import {
  Cloud,
  CloudUpload,
  HardDrive,
  KeyRound,
  RefreshCw,
  RotateCcw,
  Save,
  Trash2,
  Usb,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { applyOmiContainerImportPlan } from '../app/omiContainerImportActions';
import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import { getCloudOAuthCopy, type CloudOAuthCopy } from '../i18n/cloudOAuthTranslations';
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
  consumeCloudOAuthResultFromLocation,
  createCloudConnection,
  deleteCloudBackup,
  deleteCloudConnection,
  downloadCloudBackup,
  listCloudBackups,
  listCloudConnections,
  listCloudOAuthProviders,
  listenForCloudOAuthReturn,
  startCloudOAuthConnection,
  testCloudConnection,
  uploadCloudBackup,
  type CloudBackup,
  type CloudConnection,
  type CloudOAuthProviderConfig,
  type CloudOAuthProviderId,
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

function template(value: string, provider: string): string {
  return value.replace('{provider}', provider);
}

function methodLabel(
  methodId: CloudConnectionMethodId,
  copy: CloudCopy,
  oauthCopy: CloudOAuthCopy,
): string {
  if (methodId === 'webdav') return copy.webdavMethod;
  if (methodId === 'oauth2') return oauthCopy.oauthMethod;
  if (methodId === 'proton-sdk') return oauthCopy.protonMethod;
  return copy.systemTitle;
}

function isOAuthProviderId(value: string): value is CloudOAuthProviderId {
  return value === 'google-drive' || value === 'onedrive' || value === 'dropbox';
}

function connectionProviderLabel(connection: CloudConnection, copy: CloudCopy): string {
  if (connection.providerType === 'nextcloud') return copy.nextcloud;
  if (connection.providerType === 'webdav') return copy.webdav;
  if (connection.providerType === 'google-drive') return 'Google Drive';
  if (connection.providerType === 'onedrive') return 'Microsoft OneDrive';
  return 'Dropbox';
}

export function CloudStorageSettings() {
  const { locale } = useTranslation();
  const copy = getCloudStorageCopy(locale);
  const oauthCopy = getCloudOAuthCopy(locale);
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
  const [oauthProviders, setOauthProviders] = useState<CloudOAuthProviderConfig[]>([]);
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
    () => cloudStorageProviders.filter((provider) =>
      provider.accountTypes.some((type) => getCloudConnectionMethods(provider.id, type, platform).length > 0),
    ),
    [platform],
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
  const selectedOAuthConfig = useMemo(
    () => selectedProvider && isOAuthProviderId(selectedProvider.id)
      ? oauthProviders.find((provider) => provider.id === selectedProvider.id) ?? null
      : null,
    [selectedProvider, oauthProviders],
  );

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const [nextConnections, nextBackups, nextOauthProviders] = await Promise.all([
        listCloudConnections(),
        listCloudBackups(manuscript.id),
        listCloudOAuthProviders().catch(() => [] as CloudOAuthProviderConfig[]),
      ]);
      setConnections(nextConnections);
      setBackups(nextBackups);
      setOauthProviders(nextOauthProviders);
      setSelectedConnectionId((current) =>
        nextConnections.some((connection) => connection.id === current && connection.status === 'connected')
          ? current
          : nextConnections.find((connection) => connection.status === 'connected')?.id ?? '',
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }, [manuscript.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const exposeResult = (result: { status: 'connected' | 'error'; provider?: string; error?: string }) => {
      const provider = oauthProviders.find((entry) => entry.id === result.provider)?.label
        ?? selectedProvider?.displayName
        ?? result.provider
        ?? '';
      if (result.status === 'connected') {
        setMessage(template(oauthCopy.connected, provider));
        void refresh();
        return;
      }
      setMessage(
        result.error === 'access_denied'
          ? oauthCopy.accessDenied
          : result.error === 'exchange_failed'
            ? oauthCopy.exchangeFailed
            : oauthCopy.authorizationFailed,
      );
    };

    const locationResult = consumeCloudOAuthResultFromLocation();
    if (locationResult) exposeResult(locationResult);

    let dispose: (() => void) | undefined;
    let active = true;
    void listenForCloudOAuthReturn((result) => {
      if (active) exposeResult(result);
    }).then((nextDispose) => {
      if (active) dispose = nextDispose;
      else nextDispose();
    });
    return () => {
      active = false;
      dispose?.();
    };
  }, [
    oauthCopy.accessDenied,
    oauthCopy.authorizationFailed,
    oauthCopy.connected,
    oauthCopy.exchangeFailed,
    oauthProviders,
    refresh,
    selectedProvider,
  ]);

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

  async function connectWebDav(): Promise<void> {
    if (!selectedProvider?.directProviderType || selectedMethod?.implementation !== 'webdav') return;
    setBusy('connect');
    setMessage('');
    try {
      const connection = await createCloudConnection({
        providerType: selectedProvider.directProviderType,
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

  async function connectOAuth(): Promise<void> {
    if (!selectedProvider || !isOAuthProviderId(selectedProvider.id) || !selectedOAuthConfig?.configured) return;
    setBusy('oauth-connect');
    setMessage(oauthCopy.connecting);
    try {
      await startCloudOAuthConnection({
        provider: selectedProvider.id,
        accountType,
        displayName: displayName.trim() || selectedProvider.displayName,
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : oauthCopy.authorizationFailed);
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
      : selectedMethod?.authentication === 'proton-session'
        ? oauthCopy.protonAuth
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
                    {methodLabel(method.id, copy, oauthCopy)}{method.recommended ? ` · ${copy.recommended}` : ''}{!method.available ? ` · ${copy.comingSoon}` : ''}
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

        {selectedMethod?.implementation === 'planned-proton-sdk' ? (
          <div className="studio-tool-card">
            <div>
              <strong>{oauthCopy.protonPreviewTitle}</strong>
              <p>{oauthCopy.protonPreviewText}</p>
              <p>{oauthCopy.protonSystemStorageText}</p>
              <small>{oauthCopy.protonSdkStatus}</small>
            </div>
          </div>
        ) : null}

        {selectedMethod?.implementation === 'oauth2' && selectedProvider && isOAuthProviderId(selectedProvider.id) ? (
          <div className="studio-cloud-section">
            <strong><KeyRound size={16} aria-hidden="true" /> {oauthCopy.oauthTitle}</strong>
            <p>{oauthCopy.oauthDescription}</p>
            <div className="studio-settings-hint">
              <strong>{selectedOAuthConfig?.configured ? oauthCopy.serverConfigured : oauthCopy.serverNotConfigured}</strong>
              {selectedOAuthConfig?.redirectUri ? (
                <p><span>{oauthCopy.redirectUri}: </span><code>{selectedOAuthConfig.redirectUri}</code></p>
              ) : null}
              {selectedOAuthConfig?.scopes.length ? (
                <p><span>{oauthCopy.scopes}: </span><code>{selectedOAuthConfig.scopes.join(' ')}</code></p>
              ) : null}
              {selectedOAuthConfig?.setupEnvironment.length ? (
                <p><span>{oauthCopy.serverVariables}: </span><code>{selectedOAuthConfig.setupEnvironment.join(', ')}</code></p>
              ) : null}
            </div>
            <details className="studio-technical-details">
              <summary>{oauthCopy.adminSetupTitle}</summary>
              <p>{oauthCopy.adminSetupText}</p>
            </details>
            <div className="studio-manuscript-fields">
              <label><span>{copy.displayName}</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>
            </div>
            <button
              type="button"
              className="studio-menu-primary-action"
              disabled={busy !== null || !selectedOAuthConfig?.configured}
              onClick={() => void connectOAuth()}
            >
              <KeyRound size={16} aria-hidden="true" />
              {busy === 'oauth-connect'
                ? oauthCopy.connecting
                : template(oauthCopy.connectWith, selectedProvider.displayName)}
            </button>
          </div>
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
            <button type="button" className="studio-menu-primary-action" disabled={busy !== null || !displayName.trim() || !baseUrl.trim() || !username.trim() || !password} onClick={() => void connectWebDav()}>
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
                  <small>{connectionProviderLabel(connection, copy)} · {connection.status === 'connected' ? copy.connected : copy.connectionError}</small>
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
