import {
  Bot,
  Cloud,
  Languages,
  Link2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

import { useTranslation } from '../i18n';
import {
  integrationCatalog,
  type IntegrationCatalogEntry,
} from '../integrations/registry';
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
  const status = copy.status[entry.status];

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
          {status}
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
          <button type="button" className="studio-menu-primary-action" disabled={entry.id !== 'deepl'}>
            {entry.id === 'deepl' ? copy.configure : copy.comingSoon}
          </button>
        ) : null}
        {entry.id === 'deepl' ? (
          <button type="button" className="studio-menu-secondary-action" disabled>
            {copy.testConnection}
          </button>
        ) : null}
      </div>
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
      status: { available: 'Elérhető', planned: 'Tervezett', connected: 'Kapcsolódva' },
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
      status: { available: 'Verfügbar', planned: 'Geplant', connected: 'Verbunden' },
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
    status: { available: 'Available', planned: 'Planned', connected: 'Connected' },
  };
}
