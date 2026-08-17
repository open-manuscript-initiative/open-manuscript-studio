import {
  Bot,
  Cloud,
  Languages,
  Link2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { useTranslation } from '../i18n';
import type {
  IntegrationAuthenticationMode,
  IntegrationProviderStatus,
} from '../integrations/contracts';
import {
  integrationCatalog,
  type IntegrationCatalogEntry,
} from '../integrations/registry';
import {
  getIntegrationStatus,
  testIntegrationConnection,
} from '../services/integrationApi';
import './IntegrationsPanel.css';

export function IntegrationsPanel() {
  const { locale } = useTranslation();
  const copy = getCopy(locale);

  return (
    <section className="studio-menu-view omi-integrations-panel">
      <div className="studio-menu-view-header">
        <div>
          <h3>{copy.title}</h3>
          <p>{copy.description}</p>
        </div>
      </div>

      <div className="omi-integrations-security-note">
        <ShieldCheck size={18} aria-hidden="true" />
        <div>
          <strong>{copy.securityTitle}</strong>
          <p>{copy.securityDescription}</p>
        </div>
      </div>

      <div className="omi-integrations-grid">
        {integrationCatalog.map((entry) => (
          <IntegrationCard key={entry.id} entry={entry} locale={locale} />
        ))}
      </div>
    </section>
  );
}

function IntegrationCard({
  entry,
  locale,
}: {
  entry: IntegrationCatalogEntry;
  locale: string;
}) {
  const copy = getCopy(locale);
  const [expanded, setExpanded] = useState(false);
  const [remoteStatus, setRemoteStatus] = useState<IntegrationProviderStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (entry.id !== 'deepl' || !expanded) return;
    let cancelled = false;
    setBusy(true);
    setError('');
    void getIntegrationStatus(entry.id)
      .then((status) => {
        if (!cancelled) setRemoteStatus(status);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason));
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entry.id, expanded]);

  const catalogStatus = copy.status[entry.status];
  const statusLabel = remoteStatus
    ? remoteStatus.configured
      ? remoteStatus.healthy === false
        ? copy.status.error
        : copy.status.connected
      : copy.status.notConfigured
    : catalogStatus;
  const activeAuthenticationMode =
    remoteStatus?.authenticationMode ?? entry.preferredAuthenticationMode;

  async function testConnection(): Promise<void> {
    setBusy(true);
    setError('');
    try {
      const status = await testIntegrationConnection(entry.id);
      setRemoteStatus(status);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="omi-integration-card">
      <div className="omi-integration-card__header">
        <span className="omi-integration-card__icon" aria-hidden="true">
          {iconFor(entry.kind)}
        </span>
        <div>
          <span className="omi-integration-card__category">{entry.categoryLabel}</span>
          <h4>{entry.displayName}</h4>
        </div>
        <span className={`omi-integration-status omi-integration-status--${entry.status}`}>
          {statusLabel}
        </span>
      </div>

      <p>{entry.description}</p>

      <div className="omi-integration-permissions">
        <strong>{copy.authentication}</strong>
        <div>
          {entry.authenticationModes.map((mode) => (
            <code key={mode} title={copy.authenticationHelp[mode]}>
              {copy.authenticationMode[mode]}
              {mode === entry.preferredAuthenticationMode ? ` · ${copy.preferred}` : ''}
            </code>
          ))}
        </div>
      </div>

      <div className="omi-integration-permissions">
        <strong>{copy.permissions}</strong>
        <div>
          {entry.permissions.map((permission) => (
            <code key={permission}>{permission}</code>
          ))}
        </div>
      </div>

      {entry.supportsPerUserAuthentication ? (
        <p className="omi-integration-secret-note">{copy.perUserAuthentication}</p>
      ) : null}
      {entry.requiresServerSecret ? (
        <p className="omi-integration-secret-note">{copy.serverSecret}</p>
      ) : null}

      <div className="omi-integration-card__actions">
        {entry.configurable ? (
          <button
            type="button"
            className="studio-menu-primary-action"
            disabled={entry.id !== 'deepl'}
            onClick={() => entry.id === 'deepl' && setExpanded((value) => !value)}
          >
            {entry.id === 'deepl' ? copy.configure : copy.comingSoon}
          </button>
        ) : null}
      </div>

      {entry.id === 'deepl' && expanded ? (
        <div className="omi-integration-config">
          <strong>{copy.deeplConfiguration}</strong>
          <p>{copy.deeplConfigurationDescription}</p>
          <dl>
            <div><dt>{copy.configured}</dt><dd>{remoteStatus?.configured ? copy.yes : copy.no}</dd></div>
            <div><dt>{copy.enabled}</dt><dd>{remoteStatus?.enabled ? copy.yes : copy.no}</dd></div>
            <div><dt>{copy.authentication}</dt><dd>{copy.authenticationMode[activeAuthenticationMode]}</dd></div>
            <div><dt>{copy.health}</dt><dd>{remoteStatus?.healthy === true ? copy.healthy : remoteStatus?.healthy === false ? copy.unhealthy : copy.unknown}</dd></div>
          </dl>
          {remoteStatus?.connectedAccountLabel ? (
            <p role="status">{copy.connectedAccount}: {remoteStatus.connectedAccountLabel}</p>
          ) : null}
          {remoteStatus?.message ? <p role="status">{remoteStatus.message}</p> : null}
          {error ? <p className="omi-integration-error" role="alert">{error}</p> : null}
          <button
            type="button"
            className="studio-menu-secondary-action"
            disabled={busy || !remoteStatus?.configured}
            onClick={() => void testConnection()}
          >
            {busy ? copy.checking : copy.testConnection}
          </button>
        </div>
      ) : null}
    </article>
  );
}

function iconFor(kind: IntegrationCatalogEntry['kind']) {
  switch (kind) {
    case 'translation':
      return <Languages size={20} />;
    case 'ai':
      return <Sparkles size={20} />;
    case 'agent':
      return <Bot size={20} />;
    case 'storage':
      return <Cloud size={20} />;
    default:
      return <Link2 size={20} />;
  }
}

const authenticationModeLabels: Record<IntegrationAuthenticationMode, string> = {
  none: 'No external authentication',
  server_secret: 'Server credential',
  user_api_key: 'Personal API key',
  oauth2: 'OAuth 2.0',
  oidc: 'OpenID Connect',
  integration_token: 'Integration token',
};

const authenticationModeHelp: Record<IntegrationAuthenticationMode, string> = {
  none: 'No separate external credential is required.',
  server_secret: 'A credential is stored only on the Studio API server.',
  user_api_key: 'The user supplies a personal provider API key; the password is never requested.',
  oauth2: 'The user signs in on the provider site and OMI receives an authorization token, not the password.',
  oidc: 'Identity is delegated to the provider through OpenID Connect.',
  integration_token: 'A purpose-built token authenticates the publishing-system integration.',
};

function getCopy(locale: string) {
  if (locale === 'hu') {
    return {
      title: 'Integrációk',
      description: 'Külső szolgáltatások, fordítók, AI-szolgáltatók és kiadói rendszerek kapcsolatai.',
      securityTitle: 'Elkülönített hitelesítés',
      securityDescription: 'Az OMI-fiók bejelentkezése és a külső szolgáltatások hitelesítése külön történik. Külső szolgáltatás jelszavát a Studio nem kéri és nem tárolja.',
      permissions: 'Engedélyek',
      authentication: 'Hitelesítés',
      preferred: 'ajánlott',
      perUserAuthentication: 'Ez a szolgáltatás felhasználónként külön is kapcsolható.',
      serverSecret: 'Egyes hitelesítési módokhoz szerveroldali titkos konfiguráció szükséges.',
      configure: 'Beállítás',
      testConnection: 'Kapcsolat tesztelése',
      comingSoon: 'Hamarosan',
      deeplConfiguration: 'DeepL konfiguráció',
      deeplConfigurationDescription: 'A DeepL használható központi szerveroldali API-kulccsal vagy később a felhasználó saját API-kulcsával. DeepL e-mail címet és jelszót az OMI nem kér.',
      configured: 'Konfigurálva', enabled: 'Engedélyezve', health: 'Kapcsolat', connectedAccount: 'Kapcsolt fiók', yes: 'Igen', no: 'Nem', healthy: 'Rendben', unhealthy: 'Hiba', unknown: 'Ismeretlen', checking: 'Ellenőrzés…',
      authenticationMode: {
        none: 'Nincs külső hitelesítés',
        server_secret: 'Szerveroldali hitelesítő adat',
        user_api_key: 'Saját API-kulcs',
        oauth2: 'OAuth 2.0',
        oidc: 'OpenID Connect',
        integration_token: 'Integrációs token',
      } as Record<IntegrationAuthenticationMode, string>,
      authenticationHelp: {
        none: 'Nem szükséges külön külső hitelesítő adat.',
        server_secret: 'A hitelesítő adat kizárólag a Studio API szerveren található.',
        user_api_key: 'A felhasználó saját API-kulcsot ad meg; szolgáltatói jelszót nem kérünk.',
        oauth2: 'A felhasználó a szolgáltató oldalán jelentkezik be; az OMI tokent kap, jelszót nem.',
        oidc: 'A személyazonosság ellenőrzését OpenID Connecten keresztül a szolgáltató végzi.',
        integration_token: 'A kiadói rendszerhez célzott integrációs token tartozik.',
      } as Record<IntegrationAuthenticationMode, string>,
      status: { available: 'Elérhető', planned: 'Tervezett', connected: 'Kapcsolódva', notConfigured: 'Nincs beállítva', error: 'Hiba' },
    };
  }

  if (locale === 'de') {
    return {
      title: 'Integrationen',
      description: 'Verbindungen zu externen Diensten, Übersetzern, KI-Anbietern und Publikationssystemen.',
      securityTitle: 'Getrennte Authentifizierung',
      securityDescription: 'OMI-Anmeldung und Authentifizierung externer Dienste bleiben getrennt. Passwörter externer Anbieter werden von Studio weder abgefragt noch gespeichert.',
      permissions: 'Berechtigungen',
      authentication: 'Authentifizierung',
      preferred: 'empfohlen',
      perUserAuthentication: 'Dieser Dienst kann auch pro Benutzer separat verbunden werden.',
      serverSecret: 'Einige Authentifizierungsarten benötigen eine geheime serverseitige Konfiguration.',
      configure: 'Konfigurieren',
      testConnection: 'Verbindung testen',
      comingSoon: 'Demnächst',
      deeplConfiguration: 'DeepL-Konfiguration',
      deeplConfigurationDescription: 'DeepL kann mit einem zentralen serverseitigen API-Schlüssel oder später mit einem persönlichen API-Schlüssel verwendet werden. OMI fragt keine DeepL-E-Mail-Adresse oder kein Passwort ab.',
      configured: 'Konfiguriert', enabled: 'Aktiviert', health: 'Verbindung', connectedAccount: 'Verbundenes Konto', yes: 'Ja', no: 'Nein', healthy: 'In Ordnung', unhealthy: 'Fehler', unknown: 'Unbekannt', checking: 'Prüfung…',
      authenticationMode: {
        none: 'Keine externe Authentifizierung',
        server_secret: 'Server-Zugangsdaten',
        user_api_key: 'Eigener API-Schlüssel',
        oauth2: 'OAuth 2.0',
        oidc: 'OpenID Connect',
        integration_token: 'Integrationstoken',
      } as Record<IntegrationAuthenticationMode, string>,
      authenticationHelp: authenticationModeHelp,
      status: { available: 'Verfügbar', planned: 'Geplant', connected: 'Verbunden', notConfigured: 'Nicht konfiguriert', error: 'Fehler' },
    };
  }

  return {
    title: 'Integrations',
    description: 'Connections to external services, translators, AI providers, and publishing systems.',
    securityTitle: 'Separated authentication',
    securityDescription: 'OMI account sign-in and external provider authentication remain separate. Studio never asks for or stores an external provider password.',
    permissions: 'Permissions',
    authentication: 'Authentication',
    preferred: 'preferred',
    perUserAuthentication: 'This service can also be connected separately for each user.',
    serverSecret: 'Some authentication modes require secret server-side configuration.',
    configure: 'Configure',
    testConnection: 'Test connection',
    comingSoon: 'Coming soon',
    deeplConfiguration: 'DeepL configuration',
    deeplConfigurationDescription: 'DeepL can use a central server-side API key or, later, a user-owned API key. OMI never asks for a DeepL email address or password.',
    configured: 'Configured', enabled: 'Enabled', health: 'Connection', connectedAccount: 'Connected account', yes: 'Yes', no: 'No', healthy: 'Healthy', unhealthy: 'Error', unknown: 'Unknown', checking: 'Checking…',
    authenticationMode: authenticationModeLabels,
    authenticationHelp: authenticationModeHelp,
    status: { available: 'Available', planned: 'Planned', connected: 'Connected', notConfigured: 'Not configured', error: 'Error' },
  };
}
