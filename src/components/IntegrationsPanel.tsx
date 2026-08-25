import { Bot, Cloud, Languages, Link2, ShieldCheck, Sparkles } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

import { useTranslation } from '../i18n';
import type { IntegrationAuthenticationMode, IntegrationProviderStatus } from '../integrations/contracts';
import { integrationCatalog, type IntegrationCatalogEntry } from '../integrations/registry';
import { getAuthProviders, getOrcidLinkUrl, type AuthProviders, unlinkOrcid } from '../services/authApi';
import {
  createPublishingConnection,
  deleteIntegrationConnection,
  getIntegrationCatalog,
  getIntegrationStatus,
  saveIntegrationConnection,
  testIntegrationConnection,
  testIntegrationConnectionById,
  updatePublishingConnection,
  type IntegrationConnection,
  type PublishingConnectionCredentials,
} from '../services/integrationApi';
import { CloudStorageSettings } from './CloudStorageSettings';
import { OmiAgentsSettings } from './OmiAgentsSettings';
import './IntegrationsPanel.css';

export function IntegrationsPanel() {
  const { locale } = useTranslation();
  const copy = getCopy(locale);
  return (
    <section className="studio-menu-view omi-integrations-panel">
      <div className="studio-menu-view-header"><div><h3>{copy.title}</h3><p>{copy.description}</p></div></div>
      <div className="omi-integrations-security-note">
        <ShieldCheck size={18} aria-hidden="true" />
        <div><strong>{copy.securityTitle}</strong><p>{copy.securityDescription}</p></div>
      </div>
      <div className="omi-integrations-grid">
        {integrationCatalog.map((entry) => <IntegrationCard key={entry.id} entry={entry} locale={locale} />)}
      </div>
    </section>
  );
}

function IntegrationCard({ entry, locale }: { entry: IntegrationCatalogEntry; locale: string }) {
  const copy = getCopy(locale);
  const [expanded, setExpanded] = useState(false);
  const [remoteStatus, setRemoteStatus] = useState<IntegrationProviderStatus | null>(null);
  const [orcid, setOrcid] = useState<AuthProviders['orcid'] | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [connections, setConnections] = useState<IntegrationConnection[]>([]);
  const [publishingName, setPublishingName] = useState('');
  const [publishingBaseUrl, setPublishingBaseUrl] = useState('');
  const [credentials, setCredentials] = useState<PublishingConnectionCredentials | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const isPublishing = entry.id === 'ojs' || entry.id === 'omp';
  const isCloudStorage = entry.id === 'cloud-storage';
  const isOmiAgents = entry.id === 'omi-agents';

  useEffect(() => {
    if (entry.id !== 'orcid') return;
    let cancelled = false;
    setBusy(true);
    void getAuthProviders()
      .then((providers) => { if (!cancelled) setOrcid(providers.orcid); })
      .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason)); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [entry.id]);

  useEffect(() => {
    if ((entry.id !== 'deepl' && !isOmiAgents) || !expanded) return;
    let cancelled = false;
    setBusy(true);
    setError('');
    void getIntegrationStatus(entry.id)
      .then((status) => { if (!cancelled) setRemoteStatus(status); })
      .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason)); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [entry.id, expanded, isOmiAgents]);

  useEffect(() => {
    if (!isPublishing || !expanded) return;
    let cancelled = false;
    setBusy(true);
    setError('');
    void getIntegrationCatalog()
      .then((catalog) => {
        if (cancelled) return;
        setConnections(catalog.find((provider) => provider.id === entry.id)?.connections ?? []);
      })
      .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason)); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [entry.id, expanded, isPublishing]);

  const connectedCount = connections.filter((connection) => connection.status === 'connected').length;
  const statusLabel = isPublishing && connections.length > 0
    ? copy.connectedCount(connections.length, connectedCount)
    : entry.id === 'orcid' && orcid
      ? orcid.linked ? copy.status.connected : orcid.enabled ? copy.status.available : copy.status.notConfigured
      : remoteStatus
        ? remoteStatus.configured ? remoteStatus.healthy === false ? copy.status.error : copy.status.connected : copy.status.notConfigured
        : copy.status[entry.status];
  const statusClass = isPublishing && connectedCount > 0
    ? 'connected'
    : entry.id === 'orcid' && orcid?.linked
      ? 'connected'
      : remoteStatus?.healthy === true
        ? 'connected'
        : remoteStatus?.healthy === false
          ? 'available'
          : entry.status;
  const configurableNow = entry.id === 'deepl' || entry.id === 'orcid' || isOmiAgents || isPublishing || isCloudStorage;

  async function refreshPublishingConnections() {
    const catalog = await getIntegrationCatalog();
    setConnections(catalog.find((provider) => provider.id === entry.id)?.connections ?? []);
  }

  async function testConnection() {
    setBusy(true); setError(''); setNotice('');
    try { setRemoteStatus(await testIntegrationConnection(entry.id)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  }

  async function saveDeepLApiKey() {
    const key = apiKey.trim();
    if (!key) {
      setError(copy.apiKeyRequired);
      return;
    }
    setBusy(true); setError(''); setNotice('');
    try {
      await saveIntegrationConnection('deepl', {
        connectionKey: 'personal',
        displayName: 'DeepL personal API key',
        authenticationMode: 'user_api_key',
        secret: key,
        enabled: true,
      });
      setApiKey('');
      const status = await testIntegrationConnection('deepl');
      setRemoteStatus(status);
      setNotice(status.healthy ? copy.savedAndVerified : status.message ?? copy.saved);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  async function savePublishing() {
    if (!isPublishing) return;
    const displayName = publishingName.trim();
    const baseUrl = publishingBaseUrl.trim();
    if (!displayName || !baseUrl) {
      setError(copy.publishingRequired);
      return;
    }
    setBusy(true); setError(''); setNotice('');
    try {
      if (editingId) {
        await updatePublishingConnection(editingId, { displayName, baseUrl });
        setNotice(copy.connectionUpdated);
      } else {
        const result = await createPublishingConnection(entry.id, { displayName, baseUrl });
        setCredentials(result.credentials);
        setNotice(copy.connectionCreated);
      }
      setPublishingName('');
      setPublishingBaseUrl('');
      setEditingId(null);
      await refreshPublishingConnections();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  async function testPublishingConnection(connection: IntegrationConnection) {
    setBusy(true); setError(''); setNotice('');
    try {
      await testIntegrationConnectionById(connection.id);
      await refreshPublishingConnections();
      setNotice(copy.connectionVerified);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  async function removePublishingConnection(connection: IntegrationConnection) {
    if (!window.confirm(copy.deleteConfirmation(connection.displayName ?? connection.connectionKey))) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await deleteIntegrationConnection(connection.id);
      if (editingId === connection.id) {
        setEditingId(null);
        setPublishingName('');
        setPublishingBaseUrl('');
      }
      await refreshPublishingConnections();
      setNotice(copy.connectionDeleted);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  function editPublishingConnection(connection: IntegrationConnection) {
    const baseUrl = typeof connection.config?.baseUrl === 'string' ? connection.config.baseUrl : '';
    setEditingId(connection.id);
    setPublishingName(connection.displayName ?? '');
    setPublishingBaseUrl(baseUrl);
    setCredentials(null);
    setNotice('');
    setError('');
  }

  async function disconnectOrcid() {
    setBusy(true); setError('');
    try {
      await unlinkOrcid();
      setOrcid((await getAuthProviders()).orcid);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  }

  return (
    <article className="omi-integration-card">
      <div className="omi-integration-card__header">
        <span className="omi-integration-card__icon" aria-hidden="true">{iconFor(entry.kind)}</span>
        <div><span className="omi-integration-card__category">{entry.categoryLabel}</span><h4>{entry.displayName}</h4></div>
        <span className={`omi-integration-status omi-integration-status--${statusClass}`}>{statusLabel}</span>
      </div>
      <p>{entry.description}</p>
      <Meta label={copy.authentication}>
        {isCloudStorage
          ? <code>{copy.cloudCredentials}</code>
          : entry.authenticationModes.map((mode) => <code key={mode} title={copy.authenticationHelp[mode]}>{copy.authenticationMode[mode]}{mode === entry.preferredAuthenticationMode ? ` · ${copy.preferred}` : ''}</code>)}
      </Meta>
      <Meta label={copy.permissions}>{entry.permissions.map((permission) => <code key={permission}>{permission}</code>)}</Meta>
      {entry.supportsMultipleConnections ? <p className="omi-integration-secret-note">{copy.multipleConnections}</p> : null}
      {entry.requiresServerSecret ? <p className="omi-integration-secret-note">{copy.serverSecret}</p> : null}
      <div className="omi-integration-card__actions">
        {entry.configurable ? <button type="button" className="studio-menu-primary-action" disabled={!configurableNow} onClick={() => configurableNow && setExpanded((value) => !value)}>{configurableNow ? copy.configure : copy.comingSoon}</button> : null}
      </div>

      {isPublishing && expanded ? (
        <div className="omi-integration-config">
          <strong>{entry.id === 'ojs' ? copy.ojsConnections : copy.ompConnections}</strong>
          <p>{entry.id === 'ojs' ? copy.ojsConnectionsDescription : copy.ompConnectionsDescription}</p>

          {connections.length ? (
            <div className="omi-publishing-connections">
              {connections.map((connection) => {
                const baseUrl = typeof connection.config?.baseUrl === 'string' ? connection.config.baseUrl : '';
                const installationId = typeof connection.config?.installationId === 'string' ? connection.config.installationId : connection.connectionKey;
                return (
                  <div className="omi-publishing-connection" key={connection.id}>
                    <div className="omi-publishing-connection__main">
                      <strong>{connection.displayName ?? installationId}</strong>
                      <span>{baseUrl}</span>
                      <code>{installationId}</code>
                    </div>
                    <span className={`omi-integration-status omi-integration-status--${connection.status === 'connected' ? 'connected' : 'available'}`}>
                      {connection.status === 'connected' ? copy.status.connected : connection.status === 'disconnected' ? copy.status.notConnected : copy.status.configured}
                    </span>
                    <div className="omi-publishing-connection__actions">
                      <button type="button" className="studio-menu-secondary-action" disabled={busy} onClick={() => void testPublishingConnection(connection)}>{copy.test}</button>
                      <button type="button" className="studio-menu-secondary-action" disabled={busy} onClick={() => editPublishingConnection(connection)}>{copy.edit}</button>
                      <button type="button" className="studio-menu-secondary-action" disabled={busy} onClick={() => void removePublishingConnection(connection)}>{copy.delete}</button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <p className="omi-integration-secret-note">{copy.noPublishingConnections}</p>}

          <div className="omi-publishing-form">
            <strong>{editingId ? copy.editConnection : copy.addConnection}</strong>
            <label><span>{copy.connectionName}</span><input value={publishingName} onChange={(event) => setPublishingName(event.target.value)} placeholder={entry.id === 'ojs' ? copy.ojsNamePlaceholder : copy.ompNamePlaceholder} /></label>
            <label><span>{copy.baseUrl}</span><input type="url" value={publishingBaseUrl} onChange={(event) => setPublishingBaseUrl(event.target.value)} placeholder="https://example.org" /></label>
            <div className="omi-integration-card__actions">
              <button type="button" className="studio-menu-primary-action" disabled={busy} onClick={() => void savePublishing()}>{busy ? copy.checking : editingId ? copy.saveChanges : copy.registerConnection}</button>
              {editingId ? <button type="button" className="studio-menu-secondary-action" disabled={busy} onClick={() => { setEditingId(null); setPublishingName(''); setPublishingBaseUrl(''); }}>{copy.cancel}</button> : null}
            </div>
          </div>

          {credentials ? (
            <div className="omi-publishing-credentials">
              <strong>{copy.credentialsTitle}</strong>
              <p>{copy.credentialsDescription}</p>
              <dl>
                <div><dt>{copy.studioUrl}</dt><dd><code>{window.location.origin}</code></dd></div>
                <div><dt>{copy.installationId}</dt><dd><code>{credentials.installationId}</code></dd></div>
                <div><dt>{copy.sharedSecret}</dt><dd><code>{credentials.sharedSecret}</code></dd></div>
                <div><dt>{copy.tokenTtl}</dt><dd><code>300</code></dd></div>
              </dl>
            </div>
          ) : null}
          {notice ? <p>{notice}</p> : null}
          {error ? <p className="omi-integration-error" role="alert">{error}</p> : null}
        </div>
      ) : null}

      {isCloudStorage && expanded ? (
        <div className="omi-integration-config omi-cloud-storage-config">
          <CloudStorageSettings />
        </div>
      ) : null}

      {isOmiAgents && expanded ? (
        <div className="omi-integration-config">
          <OmiAgentsSettings />
        </div>
      ) : null}

      {entry.id === 'deepl' && expanded ? (
        <div className="omi-integration-config">
          <strong>{copy.deeplConfiguration}</strong><p>{copy.deeplConfigurationDescription}</p>
          <label><span>{copy.personalApiKey}</span><input type="password" autoComplete="off" value={apiKey} placeholder={copy.apiKeyPlaceholder} onChange={(event) => setApiKey(event.target.value)} /></label>
          <p className="omi-integration-secret-note">{copy.apiKeySecurity}</p>
          <div className="omi-integration-card__actions">
            <button type="button" className="studio-menu-primary-action" disabled={busy || !apiKey.trim()} onClick={() => void saveDeepLApiKey()}>{busy ? copy.checking : copy.saveAndTest}</button>
            <button type="button" className="studio-menu-secondary-action" disabled={busy || !remoteStatus?.configured} onClick={() => void testConnection()}>{busy ? copy.checking : copy.testConnection}</button>
          </div>
          <dl>
            <div><dt>{copy.configured}</dt><dd>{remoteStatus?.configured ? copy.yes : copy.no}</dd></div>
            <div><dt>{copy.enabled}</dt><dd>{remoteStatus?.enabled !== false ? copy.yes : copy.no}</dd></div>
            <div><dt>{copy.health}</dt><dd>{remoteStatus?.healthy === true ? copy.healthy : remoteStatus?.healthy === false ? copy.unhealthy : copy.unknown}</dd></div>
          </dl>
          {notice ? <p>{notice}</p> : null}
          {error ? <p className="omi-integration-error" role="alert">{error}</p> : null}
        </div>
      ) : null}

      {entry.id === 'orcid' && expanded ? (
        <div className="omi-integration-config">
          <strong>{copy.orcidConfiguration}</strong><p>{copy.orcidConfigurationDescription}</p>
          <dl>
            <div><dt>{copy.configured}</dt><dd>{orcid?.enabled ? copy.yes : copy.no}</dd></div>
            <div><dt>{copy.connectionState}</dt><dd>{orcid?.linked ? copy.status.connected : copy.status.notConnected}</dd></div>
            {orcid?.identity?.providerUserId ? <div><dt>ORCID iD</dt><dd>{orcid.identity.providerUserId}</dd></div> : null}
            {orcid?.identity?.displayName ? <div><dt>{copy.connectedAccount}</dt><dd>{orcid.identity.displayName}</dd></div> : null}
          </dl>
          {error ? <p className="omi-integration-error" role="alert">{error}</p> : null}
          {orcid?.linked
            ? <button type="button" className="studio-menu-secondary-action" disabled={busy} onClick={() => void disconnectOrcid()}>{busy ? copy.checking : copy.disconnectOrcid}</button>
            : <button type="button" className="studio-menu-primary-action" disabled={busy || !orcid?.enabled} onClick={() => window.location.assign(getOrcidLinkUrl())}>{copy.connectOrcid}</button>}
        </div>
      ) : null}
    </article>
  );
}

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return <div className="omi-integration-permissions"><strong>{label}</strong><div>{children}</div></div>;
}

function iconFor(kind: IntegrationCatalogEntry['kind']) {
  switch (kind) {
    case 'translation': return <Languages size={20} />;
    case 'ai': return <Sparkles size={20} />;
    case 'agent': return <Bot size={20} />;
    case 'storage': return <Cloud size={20} />;
    default: return <Link2 size={20} />;
  }
}

const authenticationModeLabels: Record<IntegrationAuthenticationMode, string> = {
  none: 'No external authentication', server_secret: 'Server credential', user_api_key: 'Personal API key', oauth2: 'OAuth 2.0', oidc: 'OpenID Connect', integration_token: 'Integration token',
};
const authenticationModeHelp: Record<IntegrationAuthenticationMode, string> = {
  none: 'No separate external credential is required.', server_secret: 'A credential is stored only on the Studio API server.', user_api_key: 'The user supplies a personal provider API key; the password is never requested.', oauth2: 'The user signs in on the provider site and OMI receives an authorization token, not the password.', oidc: 'Identity is delegated to the provider through OpenID Connect.', integration_token: 'A purpose-built token authenticates the publishing-system integration.',
};

function getCopy(locale: string) {
  const common = { authenticationMode: authenticationModeLabels, authenticationHelp: authenticationModeHelp };
  if (locale === 'hu') return {
    ...common,
    title: 'Integrációk', description: 'Külső szolgáltatások, fordítók, AI-szolgáltatók és kiadói rendszerek kapcsolatai.', securityTitle: 'Elkülönített hitelesítés', securityDescription: 'Az OMI-fiók bejelentkezése és a külső szolgáltatások hitelesítése külön történik. OAuth-szolgáltatások jelszavát a Studio nem kéri; a hitelesítő adatot igénylő kapcsolatok titkai titkosítva, szerveroldalon tárolódnak.', permissions: 'Engedélyek', authentication: 'Hitelesítés', preferred: 'ajánlott', cloudCredentials: 'WebDAV hitelesítő adatok · titkosítva a szerveren', multipleConnections: 'Több különálló kapcsolat regisztrálható.', serverSecret: 'Egyes hitelesítési módokhoz szerveroldali titkos konfiguráció szükséges.', configure: 'Beállítás', testConnection: 'Kapcsolat tesztelése', comingSoon: 'Hamarosan', deeplConfiguration: 'DeepL konfiguráció', deeplConfigurationDescription: 'A DeepL központi szerveroldali API-kulccsal vagy a saját személyes API-kulcsoddal használható.', personalApiKey: 'Személyes DeepL API-kulcs', apiKeyPlaceholder: 'DeepL API-kulcs', apiKeySecurity: 'A kulcs titkosítva, szerveroldalon kerül tárolásra; a Studio nem kér DeepL-jelszót.', apiKeyRequired: 'Add meg a DeepL API-kulcsot.', saveAndTest: 'Mentés és tesztelés', savedAndVerified: 'A DeepL API-kulcs mentve, a kapcsolat ellenőrizve.', saved: 'A beállítás mentve.', orcidConfiguration: 'ORCID kapcsolat', orcidConfigurationDescription: 'Kapcsold a Studio-fiókhoz a saját ORCID iD-det. A hitelesítés az ORCID oldalán történik; az OMI nem kapja meg az ORCID-jelszót.', connectOrcid: 'ORCID összekapcsolása', disconnectOrcid: 'ORCID leválasztása', connectionState: 'Állapot', configured: 'Konfigurálva', enabled: 'Engedélyezve', health: 'Kapcsolat', connectedAccount: 'Kapcsolt fiók', yes: 'Igen', no: 'Nem', healthy: 'Rendben', unhealthy: 'Hiba', unknown: 'Ismeretlen', checking: 'Ellenőrzés…', ojsConnections: 'OJS folyóiratok', ompConnections: 'OMP kiadók', ojsConnectionsDescription: 'Regisztrálj egy vagy több OJS telepítést vagy folyóiratot külön kapcsolattal.', ompConnectionsDescription: 'Regisztrálj egy vagy több OMP telepítést vagy kiadói kontextust külön kapcsolattal.', noPublishingConnections: 'Még nincs regisztrált kapcsolat.', addConnection: 'Kapcsolat hozzáadása', editConnection: 'Kapcsolat szerkesztése', connectionName: 'Megjelenítési név', ojsNamePlaceholder: 'Például: Egyháztörténeti Szemle', ompNamePlaceholder: 'Például: Varga Webkiadó', baseUrl: 'Külső rendszer URL-je', registerConnection: 'Kapcsolat regisztrálása', saveChanges: 'Módosítások mentése', cancel: 'Mégse', test: 'Teszt', edit: 'Szerkesztés', delete: 'Törlés', publishingRequired: 'Add meg a kapcsolat nevét és URL-jét.', connectionCreated: 'A kapcsolat létrejött. Másold át az alábbi adatokat az OJS/OMP plugin beállításaiba.', connectionUpdated: 'A kapcsolat frissítve.', connectionVerified: 'A Studio-regisztráció ellenőrzése sikerült.', connectionDeleted: 'A kapcsolat törölve és a külső telepítés letiltva.', credentialsTitle: 'Egyszer megjelenített kapcsolati adatok', credentialsDescription: 'A megosztott titok biztonsági okból később nem jeleníthető meg újra. Másold át most a pluginba.', studioUrl: 'Studio URL', installationId: 'Telepítési azonosító', sharedSecret: 'Megosztott titok', tokenTtl: 'Token élettartama (másodperc)', deleteConfirmation: (name: string) => `Biztosan törlöd ezt a kapcsolatot: ${name}?`, connectedCount: (total: number, connected: number) => `${connected}/${total} kapcsolódva`,
    status: { available: 'Elérhető', planned: 'Tervezett', connected: 'Kapcsolódva', configured: 'Konfigurálva', notConnected: 'Nincs összekapcsolva', notConfigured: 'Nincs beállítva', error: 'Hiba' },
  };
  if (locale === 'de') return {
    ...common,
    title: 'Integrationen', description: 'Verbindungen zu externen Diensten, Übersetzern, KI-Anbietern und Publikationssystemen.', securityTitle: 'Getrennte Authentifizierung', securityDescription: 'OMI-Anmeldung und externe Dienstauthentifizierung bleiben getrennt. Studio fragt Passwörter von OAuth-Anbietern nicht ab; Zugangsdaten für credential-basierte Verbindungen werden verschlüsselt serverseitig gespeichert.', permissions: 'Berechtigungen', authentication: 'Authentifizierung', preferred: 'empfohlen', cloudCredentials: 'WebDAV-Zugangsdaten · verschlüsselt auf dem Server', multipleConnections: 'Mehrere unabhängige Verbindungen können registriert werden.', serverSecret: 'Einige Authentifizierungsarten benötigen eine geheime serverseitige Konfiguration.', configure: 'Konfigurieren', testConnection: 'Verbindung testen', comingSoon: 'Demnächst', deeplConfiguration: 'DeepL-Konfiguration', deeplConfigurationDescription: 'DeepL kann mit einem zentralen serverseitigen API-Schlüssel oder einem persönlichen API-Schlüssel verwendet werden.', personalApiKey: 'Persönlicher DeepL-API-Schlüssel', apiKeyPlaceholder: 'DeepL-API-Schlüssel', apiKeySecurity: 'Der Schlüssel wird verschlüsselt auf dem Server gespeichert; Studio fragt nicht nach Ihrem DeepL-Passwort.', apiKeyRequired: 'Geben Sie den DeepL-API-Schlüssel ein.', saveAndTest: 'Speichern und testen', savedAndVerified: 'Der DeepL-API-Schlüssel wurde gespeichert und die Verbindung geprüft.', saved: 'Die Einstellung wurde gespeichert.', orcidConfiguration: 'ORCID-Verbindung', orcidConfigurationDescription: 'Verbinden Sie Ihre ORCID iD mit Ihrem Studio-Konto. Die Anmeldung erfolgt bei ORCID; OMI erhält Ihr ORCID-Passwort nicht.', connectOrcid: 'ORCID verbinden', disconnectOrcid: 'ORCID trennen', connectionState: 'Status', configured: 'Konfiguriert', enabled: 'Aktiviert', health: 'Verbindung', connectedAccount: 'Verbundenes Konto', yes: 'Ja', no: 'Nein', healthy: 'In Ordnung', unhealthy: 'Fehler', unknown: 'Unbekannt', checking: 'Prüfung…', ojsConnections: 'OJS-Zeitschriften', ompConnections: 'OMP-Verlage', ojsConnectionsDescription: 'Registrieren Sie eine oder mehrere OJS-Installationen oder Zeitschriften als getrennte Verbindungen.', ompConnectionsDescription: 'Registrieren Sie eine oder mehrere OMP-Installationen oder Press-Kontexte als getrennte Verbindungen.', noPublishingConnections: 'Noch keine Verbindung registriert.', addConnection: 'Verbindung hinzufügen', editConnection: 'Verbindung bearbeiten', connectionName: 'Anzeigename', ojsNamePlaceholder: 'Zum Beispiel: Fachzeitschrift', ompNamePlaceholder: 'Zum Beispiel: Universitätsverlag', baseUrl: 'URL des externen Systems', registerConnection: 'Verbindung registrieren', saveChanges: 'Änderungen speichern', cancel: 'Abbrechen', test: 'Testen', edit: 'Bearbeiten', delete: 'Löschen', publishingRequired: 'Geben Sie einen Namen und eine URL ein.', connectionCreated: 'Die Verbindung wurde erstellt. Übertragen Sie die folgenden Daten in die OJS/OMP-Plugin-Einstellungen.', connectionUpdated: 'Die Verbindung wurde aktualisiert.', connectionVerified: 'Die Studio-Registrierung wurde erfolgreich geprüft.', connectionDeleted: 'Die Verbindung wurde gelöscht und die externe Installation deaktiviert.', credentialsTitle: 'Einmalig angezeigte Verbindungsdaten', credentialsDescription: 'Das gemeinsame Geheimnis wird aus Sicherheitsgründen später nicht erneut angezeigt. Kopieren Sie es jetzt in das Plugin.', studioUrl: 'Studio-URL', installationId: 'Installations-ID', sharedSecret: 'Gemeinsames Geheimnis', tokenTtl: 'Token-Lebensdauer (Sekunden)', deleteConfirmation: (name: string) => `Diese Verbindung wirklich löschen: ${name}?`, connectedCount: (total: number, connected: number) => `${connected}/${total} verbunden`,
    status: { available: 'Verfügbar', planned: 'Geplant', connected: 'Verbunden', configured: 'Konfiguriert', notConnected: 'Nicht verbunden', notConfigured: 'Nicht konfiguriert', error: 'Fehler' },
  };
  return {
    ...common,
    title: 'Integrations', description: 'Connections to external services, translators, AI providers, and publishing systems.', securityTitle: 'Separated authentication', securityDescription: 'OMI account sign-in and external-provider authentication remain separate. Studio never asks for OAuth-provider passwords; credentials required by credential-based connections are encrypted and stored server-side.', permissions: 'Permissions', authentication: 'Authentication', preferred: 'preferred', cloudCredentials: 'WebDAV credentials · encrypted server-side', multipleConnections: 'Multiple independent connections can be registered.', serverSecret: 'Some authentication modes require secret server-side configuration.', configure: 'Configure', testConnection: 'Test connection', comingSoon: 'Coming soon', deeplConfiguration: 'DeepL configuration', deeplConfigurationDescription: 'DeepL can use a central server-side API key or your own personal API key.', personalApiKey: 'Personal DeepL API key', apiKeyPlaceholder: 'DeepL API key', apiKeySecurity: 'The key is encrypted and stored server-side; Studio never asks for your DeepL password.', apiKeyRequired: 'Enter the DeepL API key.', saveAndTest: 'Save and test', savedAndVerified: 'The DeepL API key was saved and the connection verified.', saved: 'The setting was saved.', orcidConfiguration: 'ORCID connection', orcidConfigurationDescription: 'Connect your ORCID iD to your Studio account. Authentication happens on ORCID; OMI never receives your ORCID password.', connectOrcid: 'Connect ORCID', disconnectOrcid: 'Disconnect ORCID', connectionState: 'Status', configured: 'Configured', enabled: 'Enabled', health: 'Connection', connectedAccount: 'Connected account', yes: 'Yes', no: 'No', healthy: 'Healthy', unhealthy: 'Error', unknown: 'Unknown', checking: 'Checking…', ojsConnections: 'OJS journals', ompConnections: 'OMP presses', ojsConnectionsDescription: 'Register one or more OJS installations or journals as independent connections.', ompConnectionsDescription: 'Register one or more OMP installations or press contexts as independent connections.', noPublishingConnections: 'No connection has been registered yet.', addConnection: 'Add connection', editConnection: 'Edit connection', connectionName: 'Display name', ojsNamePlaceholder: 'For example: Journal of Example Studies', ompNamePlaceholder: 'For example: University Press', baseUrl: 'External system URL', registerConnection: 'Register connection', saveChanges: 'Save changes', cancel: 'Cancel', test: 'Test', edit: 'Edit', delete: 'Delete', publishingRequired: 'Enter a connection name and URL.', connectionCreated: 'The connection was created. Copy the following values into the OJS/OMP plugin settings.', connectionUpdated: 'The connection was updated.', connectionVerified: 'The Studio registration was verified successfully.', connectionDeleted: 'The connection was deleted and the external installation disabled.', credentialsTitle: 'Connection credentials shown once', credentialsDescription: 'For security, the shared secret cannot be displayed again later. Copy it to the plugin now.', studioUrl: 'Studio URL', installationId: 'Installation ID', sharedSecret: 'Shared secret', tokenTtl: 'Token lifetime (seconds)', deleteConfirmation: (name: string) => `Delete this connection: ${name}?`, connectedCount: (total: number, connected: number) => `${connected}/${total} connected`,
    status: { available: 'Available', planned: 'Planned', connected: 'Connected', configured: 'Configured', notConnected: 'Not connected', notConfigured: 'Not configured', error: 'Error' },
  };
}
