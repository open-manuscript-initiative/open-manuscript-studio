import { Bot, Cloud, Languages, Link2, ShieldCheck, Sparkles } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

import { useTranslation } from '../i18n';
import type { IntegrationAuthenticationMode, IntegrationProviderStatus } from '../integrations/contracts';
import { integrationCatalog, type IntegrationCatalogEntry } from '../integrations/registry';
import { getAuthProviders, getOrcidLinkUrl, type AuthProviders, unlinkOrcid } from '../services/authApi';
import { getIntegrationStatus, testIntegrationConnection } from '../services/integrationApi';
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

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
    if (entry.id !== 'deepl' || !expanded) return;
    let cancelled = false;
    setBusy(true);
    setError('');
    void getIntegrationStatus(entry.id)
      .then((status) => { if (!cancelled) setRemoteStatus(status); })
      .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason)); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [entry.id, expanded]);

  const statusLabel = entry.id === 'orcid' && orcid
    ? orcid.linked ? copy.status.connected : orcid.enabled ? copy.status.available : copy.status.notConfigured
    : remoteStatus
      ? remoteStatus.configured ? remoteStatus.healthy === false ? copy.status.error : copy.status.connected : copy.status.notConfigured
      : copy.status[entry.status];
  const statusClass = entry.id === 'orcid' && orcid?.linked ? 'connected' : entry.status;
  const configurableNow = entry.id === 'deepl' || entry.id === 'orcid';

  async function testConnection() {
    setBusy(true); setError('');
    try { setRemoteStatus(await testIntegrationConnection(entry.id)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
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
      <Meta label={copy.authentication}>{entry.authenticationModes.map((mode) => <code key={mode} title={copy.authenticationHelp[mode]}>{copy.authenticationMode[mode]}{mode === entry.preferredAuthenticationMode ? ` · ${copy.preferred}` : ''}</code>)}</Meta>
      <Meta label={copy.permissions}>{entry.permissions.map((permission) => <code key={permission}>{permission}</code>)}</Meta>
      {entry.supportsPerUserAuthentication ? <p className="omi-integration-secret-note">{copy.perUserAuthentication}</p> : null}
      {entry.requiresServerSecret ? <p className="omi-integration-secret-note">{copy.serverSecret}</p> : null}
      <div className="omi-integration-card__actions">
        {entry.configurable ? <button type="button" className="studio-menu-primary-action" disabled={!configurableNow} onClick={() => configurableNow && setExpanded((value) => !value)}>{configurableNow ? copy.configure : copy.comingSoon}</button> : null}
      </div>

      {entry.id === 'deepl' && expanded ? (
        <div className="omi-integration-config">
          <strong>{copy.deeplConfiguration}</strong><p>{copy.deeplConfigurationDescription}</p>
          <dl>
            <div><dt>{copy.configured}</dt><dd>{remoteStatus?.configured ? copy.yes : copy.no}</dd></div>
            <div><dt>{copy.enabled}</dt><dd>{remoteStatus?.enabled ? copy.yes : copy.no}</dd></div>
            <div><dt>{copy.health}</dt><dd>{remoteStatus?.healthy === true ? copy.healthy : remoteStatus?.healthy === false ? copy.unhealthy : copy.unknown}</dd></div>
          </dl>
          {error ? <p className="omi-integration-error" role="alert">{error}</p> : null}
          <button type="button" className="studio-menu-secondary-action" disabled={busy || !remoteStatus?.configured} onClick={() => void testConnection()}>{busy ? copy.checking : copy.testConnection}</button>
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
  const common = {
    authenticationMode: authenticationModeLabels,
    authenticationHelp: authenticationModeHelp,
  };
  if (locale === 'hu') return {
    ...common,
    title: 'Integrációk', description: 'Külső szolgáltatások, fordítók, AI-szolgáltatók és kiadói rendszerek kapcsolatai.', securityTitle: 'Elkülönített hitelesítés', securityDescription: 'Az OMI-fiók bejelentkezése és a külső szolgáltatások hitelesítése külön történik. Külső szolgáltatás jelszavát a Studio nem kéri és nem tárolja.', permissions: 'Engedélyek', authentication: 'Hitelesítés', preferred: 'ajánlott', perUserAuthentication: 'Ez a szolgáltatás felhasználónként külön is kapcsolható.', serverSecret: 'Egyes hitelesítési módokhoz szerveroldali titkos konfiguráció szükséges.', configure: 'Beállítás', testConnection: 'Kapcsolat tesztelése', comingSoon: 'Hamarosan', deeplConfiguration: 'DeepL konfiguráció', deeplConfigurationDescription: 'A DeepL használható központi szerveroldali API-kulccsal vagy később a felhasználó saját API-kulcsával.', orcidConfiguration: 'ORCID kapcsolat', orcidConfigurationDescription: 'Kapcsold a Studio-fiókhoz a saját ORCID iD-det. A hitelesítés az ORCID oldalán történik; az OMI nem kapja meg az ORCID-jelszót.', connectOrcid: 'ORCID összekapcsolása', disconnectOrcid: 'ORCID leválasztása', connectionState: 'Állapot', configured: 'Konfigurálva', enabled: 'Engedélyezve', health: 'Kapcsolat', connectedAccount: 'Kapcsolt fiók', yes: 'Igen', no: 'Nem', healthy: 'Rendben', unhealthy: 'Hiba', unknown: 'Ismeretlen', checking: 'Ellenőrzés…',
    status: { available: 'Elérhető', planned: 'Tervezett', connected: 'Kapcsolódva', notConnected: 'Nincs összekapcsolva', notConfigured: 'Nincs beállítva', error: 'Hiba' },
  };
  if (locale === 'de') return {
    ...common,
    title: 'Integrationen', description: 'Verbindungen zu externen Diensten, Übersetzern, KI-Anbietern und Publikationssystemen.', securityTitle: 'Getrennte Authentifizierung', securityDescription: 'OMI-Anmeldung und Authentifizierung externer Dienste bleiben getrennt. Passwörter externer Anbieter werden von Studio weder abgefragt noch gespeichert.', permissions: 'Berechtigungen', authentication: 'Authentifizierung', preferred: 'empfohlen', perUserAuthentication: 'Dieser Dienst kann auch pro Benutzer separat verbunden werden.', serverSecret: 'Einige Authentifizierungsarten benötigen eine geheime serverseitige Konfiguration.', configure: 'Konfigurieren', testConnection: 'Verbindung testen', comingSoon: 'Demnächst', deeplConfiguration: 'DeepL-Konfiguration', deeplConfigurationDescription: 'DeepL kann mit einem zentralen serverseitigen API-Schlüssel oder später mit einem persönlichen API-Schlüssel verwendet werden.', orcidConfiguration: 'ORCID-Verbindung', orcidConfigurationDescription: 'Verbinden Sie Ihre ORCID iD mit Ihrem Studio-Konto. Die Anmeldung erfolgt bei ORCID; OMI erhält Ihr ORCID-Passwort nicht.', connectOrcid: 'ORCID verbinden', disconnectOrcid: 'ORCID trennen', connectionState: 'Status', configured: 'Konfiguriert', enabled: 'Aktiviert', health: 'Verbindung', connectedAccount: 'Verbundenes Konto', yes: 'Ja', no: 'Nein', healthy: 'In Ordnung', unhealthy: 'Fehler', unknown: 'Unbekannt', checking: 'Prüfung…',
    status: { available: 'Verfügbar', planned: 'Geplant', connected: 'Verbunden', notConnected: 'Nicht verbunden', notConfigured: 'Nicht konfiguriert', error: 'Fehler' },
  };
  return {
    ...common,
    title: 'Integrations', description: 'Connections to external services, translators, AI providers, and publishing systems.', securityTitle: 'Separated authentication', securityDescription: 'OMI account sign-in and external provider authentication remain separate. Studio never asks for or stores an external provider password.', permissions: 'Permissions', authentication: 'Authentication', preferred: 'preferred', perUserAuthentication: 'This service can also be connected separately for each user.', serverSecret: 'Some authentication modes require secret server-side configuration.', configure: 'Configure', testConnection: 'Test connection', comingSoon: 'Coming soon', deeplConfiguration: 'DeepL configuration', deeplConfigurationDescription: 'DeepL can use a central server-side API key or, later, a user-owned API key.', orcidConfiguration: 'ORCID connection', orcidConfigurationDescription: 'Connect your ORCID iD to your Studio account. Authentication happens on ORCID; OMI never receives your ORCID password.', connectOrcid: 'Connect ORCID', disconnectOrcid: 'Disconnect ORCID', connectionState: 'Status', configured: 'Configured', enabled: 'Enabled', health: 'Connection', connectedAccount: 'Connected account', yes: 'Yes', no: 'No', healthy: 'Healthy', unhealthy: 'Error', unknown: 'Unknown', checking: 'Checking…',
    status: { available: 'Available', planned: 'Planned', connected: 'Connected', notConnected: 'Not connected', notConfigured: 'Not configured', error: 'Error' },
  };
}
