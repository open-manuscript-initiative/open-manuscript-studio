import type { AuthProviders } from '../services/authApi';
import './OrcidEnvironmentBadge.css';

type OrcidProvider = AuthProviders['orcid'];

interface OrcidEnvironmentBadgeProps {
  provider: OrcidProvider;
  locale: string;
  compact?: boolean;
}

export function OrcidEnvironmentBadge({
  provider,
  locale,
  compact = false,
}: OrcidEnvironmentBadgeProps) {
  if (!provider.environment) return null;

  const isSandbox = provider.environment === 'sandbox';
  const environmentLabel = isSandbox ? 'Sandbox' : 'Production';
  const description = environmentDescription(provider.environment, locale);
  const credentialLabel = provider.credentialSource
    ? credentialSourceLabel(provider.credentialSource, provider.apiType, locale)
    : '';
  const title = [
    `ORCID ${environmentLabel}`,
    description,
    credentialLabel,
    provider.issuer,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      className={`orcid-environment-badge orcid-environment-badge--${provider.environment}${compact ? ' orcid-environment-badge--compact' : ''}`}
      role="status"
      aria-label={title}
      title={title}
    >
      <span className="orcid-environment-badge__dot" aria-hidden="true" />
      <strong>ORCID {environmentLabel}</strong>
      {!compact ? (
        <span className="orcid-environment-badge__description">{description}</span>
      ) : null}
    </div>
  );
}

function environmentDescription(
  environment: NonNullable<OrcidProvider['environment']>,
  locale: string,
): string {
  if (environment === 'sandbox') {
    if (locale === 'hu') return 'tesztkörnyezet';
    if (locale === 'de') return 'Testumgebung';
    return 'test environment';
  }

  if (locale === 'hu') return 'éles ORCID-környezet';
  if (locale === 'de') return 'produktive ORCID-Umgebung';
  return 'live ORCID environment';
}

function credentialSourceLabel(
  source: NonNullable<OrcidProvider['credentialSource']>,
  apiType: OrcidProvider['apiType'],
  locale: string,
): string {
  if (source === 'institutional') {
    const api = apiType === 'member' ? 'Member API' : 'Public API';
    if (locale === 'hu') return `intézményi hitelesítő adatok · ${api}`;
    if (locale === 'de') return `institutionelle Zugangsdaten · ${api}`;
    return `institutional credentials · ${api}`;
  }

  if (locale === 'hu') return 'személyes telepítési hitelesítő adatok';
  if (locale === 'de') return 'Zugangsdaten der persönlichen Installation';
  return 'personal deployment credentials';
}
