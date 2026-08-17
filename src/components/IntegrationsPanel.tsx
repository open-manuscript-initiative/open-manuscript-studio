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
import {
  integrationCatalog,
  type IntegrationCatalogEntry,
} from '../integrations/registry';
import type { IntegrationProviderStatus } from '../integrations/contracts';
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
        <strong>{copy.permissions}</strong>
        <div>
          {entry.permissions.map((permission) => (
            <code key={permission}>{permission}</code>
          ))}
        </div>
      </div>

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
            <div><dt>{copy.health}</dt><dd>{remoteStatus?.healthy === true ? copy.healthy : remoteStatus?.healthy === false ? copy.unhealthy : copy.unknown}</dd></div>
          </dl>
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

function getCopy(locale: string) {
  if (locale === 'hu') {
    return {
      title: 'Integrációk',
      description: 'Külső szolgáltatások, fordítók, AI-szolgáltatók és kiadói rendszerek kapcsolatai.',
      securityTitle: 'Szerveroldali hitelesítő adatok',
      securityDescription: 'Az API-kulcsok és titkok nem kerülnek a böngészőbe vagy a localStorage-ba; a Studio csak az integráció állapotát és engedélyeit kapja meg.',
      permissions: 'Engedélyek',
      serverSecret: 'Szerveroldali titkos konfiguráció szükséges.',
      configure: 'Beállítás',
      testConnection: 'Kapcsolat tesztelése',
      comingSoon: 'Hamarosan',
      deeplConfiguration: 'DeepL konfiguráció',
      deeplConfigurationDescription: 'A hitelesítő kulcsot a Studio API szerverén kell beállítani. A böngésző csak a konfiguráció állapotát kérdezi le.',
      configured: 'Konfigurálva', enabled: 'Engedélyezve', health: 'Kapcsolat', yes: 'Igen', no: 'Nem', healthy: 'Rendben', unhealthy: 'Hiba', unknown: 'Ismeretlen', checking: 'Ellenőrzés…',
      status: { available: 'Elérhető', planned: 'Tervezett', connected: 'Kapcsolódva', notConfigured: 'Nincs beállítva', error: 'Hiba' },
    };
  }

  if (locale === 'de') {
    return {
      title: 'Integrationen',
      description: 'Verbindungen zu externen Diensten, Übersetzern, KI-Anbietern und Publikationssystemen.',
      securityTitle: 'Serverseitige Zugangsdaten',
      securityDescription: 'API-Schlüssel und Geheimnisse werden weder an den Browser noch an localStorage weitergegeben; Studio erhält nur Status und Berechtigungen.',
      permissions: 'Berechtigungen',
      serverSecret: 'Eine geheime serverseitige Konfiguration ist erforderlich.',
      configure: 'Konfigurieren',
      testConnection: 'Verbindung testen',
      comingSoon: 'Demnächst',
      deeplConfiguration: 'DeepL-Konfiguration',
      deeplConfigurationDescription: 'Der API-Schlüssel wird auf dem Studio-API-Server konfiguriert. Der Browser liest nur den Konfigurationsstatus.',
      configured: 'Konfiguriert', enabled: 'Aktiviert', health: 'Verbindung', yes: 'Ja', no: 'Nein', healthy: 'In Ordnung', unhealthy: 'Fehler', unknown: 'Unbekannt', checking: 'Prüfung…',
      status: { available: 'Verfügbar', planned: 'Geplant', connected: 'Verbunden', notConfigured: 'Nicht konfiguriert', error: 'Fehler' },
    };
  }

  return {
    title: 'Integrations',
    description: 'Connections to external services, translators, AI providers, and publishing systems.',
    securityTitle: 'Server-side credentials',
    securityDescription: 'API keys and secrets are never exposed to the browser or localStorage; Studio receives only integration status and permissions.',
    permissions: 'Permissions',
    serverSecret: 'Requires secret server-side configuration.',
    configure: 'Configure',
    testConnection: 'Test connection',
    comingSoon: 'Coming soon',
    deeplConfiguration: 'DeepL configuration',
    deeplConfigurationDescription: 'The credential is configured on the Studio API server. The browser only reads configuration status.',
    configured: 'Configured', enabled: 'Enabled', health: 'Connection', yes: 'Yes', no: 'No', healthy: 'Healthy', unhealthy: 'Error', unknown: 'Unknown', checking: 'Checking…',
    status: { available: 'Available', planned: 'Planned', connected: 'Connected', notConfigured: 'Not configured', error: 'Error' },
  };
}
