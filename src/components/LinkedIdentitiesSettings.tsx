import { BadgeCheck, KeyRound, Link2, RefreshCw, Unlink } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  getAuthProviders,
  getOrcidLinkUrl,
  requestPasswordReset,
  startOidcLink,
  type AuthProviders,
  type OidcProviderKey,
} from '../services/authApi';
import {
  getLinkedIdentitySettings,
  unlinkLinkedIdentity,
  type LinkedIdentityRecord,
  type LinkedIdentitySettings,
} from '../services/linkedIdentityApi';
import { getStudioPlatform } from '../mobile/platform/platform';

interface LinkedIdentitiesSettingsProps {
  locale: string;
  email: string;
}

const copy = {
  en: {
    title: 'Connected identities',
    description: 'Manage the credentials and external identities that can sign in to this Studio account.',
    local: 'E-mail and password',
    available: 'Available',
    notSet: 'Not set',
    passwordAction: 'Set / change password',
    passwordSent: 'A password setup link was sent if this e-mail address can receive Studio mail.',
    linked: 'Connected',
    connect: 'Connect',
    disconnect: 'Disconnect',
    connectedAt: 'Connected',
    lastUsed: 'Last used',
    issuer: 'Issuer',
    cannotDisconnect: 'Add another sign-in method or set a password before disconnecting this identity.',
    confirmDisconnect: 'Disconnect this identity from your Studio account?',
    providers: 'Available sign-in providers',
    none: 'No additional provider is currently available.',
    refresh: 'Refresh',
    loading: 'Loading connected identities…',
    error: 'The linked identity settings could not be loaded.',
    providerError: 'The external sign-in provider could not be opened.',
  },
  hu: {
    title: 'Kapcsolt azonosítók',
    description: 'Itt kezelhetők azok a hitelesítési módok és külső azonosítók, amelyekkel ebbe a Studio-fiókba be lehet jelentkezni.',
    local: 'E-mail-cím és jelszó',
    available: 'Elérhető',
    notSet: 'Nincs beállítva',
    passwordAction: 'Jelszó beállítása / módosítása',
    passwordSent: 'A rendszer elküldte a jelszóbeállító hivatkozást, ha erre az e-mail-címre a Studio levelet tud kézbesíteni.',
    linked: 'Kapcsolva',
    connect: 'Kapcsolás',
    disconnect: 'Leválasztás',
    connectedAt: 'Kapcsolva',
    lastUsed: 'Utoljára használva',
    issuer: 'Kibocsátó',
    cannotDisconnect: 'Előbb kapcsolj egy másik bejelentkezési módot vagy állíts be jelszót.',
    confirmDisconnect: 'Leválasztod ezt az azonosítót a Studio-fiókról?',
    providers: 'Elérhető bejelentkezési szolgáltatók',
    none: 'Jelenleg nincs további elérhető szolgáltató.',
    refresh: 'Frissítés',
    loading: 'A kapcsolt azonosítók betöltése…',
    error: 'A kapcsolt azonosítók beállításai nem tölthetők be.',
    providerError: 'A külső bejelentkezési szolgáltató nem nyitható meg.',
  },
  de: {
    title: 'Verknüpfte Identitäten',
    description: 'Verwalten Sie die Anmeldemethoden und externen Identitäten, mit denen dieses Studio-Konto verwendet werden kann.',
    local: 'E-Mail-Adresse und Passwort',
    available: 'Verfügbar',
    notSet: 'Nicht eingerichtet',
    passwordAction: 'Passwort einrichten / ändern',
    passwordSent: 'Ein Link zum Einrichten des Passworts wurde gesendet, sofern Studio E-Mails an diese Adresse zustellen kann.',
    linked: 'Verbunden',
    connect: 'Verbinden',
    disconnect: 'Trennen',
    connectedAt: 'Verbunden',
    lastUsed: 'Zuletzt verwendet',
    issuer: 'Aussteller',
    cannotDisconnect: 'Richten Sie zuerst eine weitere Anmeldemethode oder ein Passwort ein.',
    confirmDisconnect: 'Diese Identität vom Studio-Konto trennen?',
    providers: 'Verfügbare Anmeldeanbieter',
    none: 'Derzeit ist kein weiterer Anbieter verfügbar.',
    refresh: 'Aktualisieren',
    loading: 'Verknüpfte Identitäten werden geladen…',
    error: 'Die Einstellungen für verknüpfte Identitäten konnten nicht geladen werden.',
    providerError: 'Der externe Anmeldeanbieter konnte nicht geöffnet werden.',
  },
} as const;

export function LinkedIdentitiesSettings({
  locale,
  email,
}: LinkedIdentitiesSettingsProps) {
  const labels = copy[locale as keyof typeof copy] ?? copy.en;
  const [settings, setSettings] = useState<LinkedIdentitySettings | null>(null);
  const [providers, setProviders] = useState<AuthProviders | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setError('');
    try {
      const [nextSettings, nextProviders] = await Promise.all([
        getLinkedIdentitySettings(),
        getAuthProviders(),
      ]);
      setSettings(nextSettings);
      setProviders(nextProviders);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : labels.error);
    }
  }, [labels.error]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const linkedKeys = useMemo(
    () => new Set(settings?.identities.map((identity) => identity.providerKey) ?? []),
    [settings?.identities],
  );

  const availableProviders = useMemo(() => {
    if (!providers) return [];
    const candidates: Array<{
      key: 'orcid' | OidcProviderKey;
      label: string;
      issuer?: string;
    }> = [];
    if (providers.orcid.enabled && !linkedKeys.has('orcid')) {
      candidates.push({ key: 'orcid', label: providers.orcid.label, issuer: providers.orcid.issuer });
    }
    for (const key of ['google', 'microsoft', 'oidc'] as const) {
      const provider = providers[key];
      if (provider.enabled && !linkedKeys.has(key)) {
        candidates.push({ key, label: provider.label, issuer: provider.issuer });
      }
    }
    return candidates;
  }, [linkedKeys, providers]);

  async function connectProvider(key: 'orcid' | OidcProviderKey): Promise<void> {
    setBusy(`connect:${key}`);
    setError('');
    try {
      if (key === 'orcid') {
        await openAuthUrl(getOrcidLinkUrl());
      } else {
        await startOidcLink(key, locale);
      }
    } catch {
      setError(labels.providerError);
      setBusy(null);
    }
  }

  async function disconnect(identity: LinkedIdentityRecord): Promise<void> {
    if (!identity.canUnlink || !window.confirm(labels.confirmDisconnect)) return;
    setBusy(`unlink:${identity.id}`);
    setError('');
    setMessage('');
    try {
      await unlinkLinkedIdentity(identity.id);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : labels.error);
    } finally {
      setBusy(null);
    }
  }

  async function setupPassword(): Promise<void> {
    setBusy('password');
    setError('');
    setMessage('');
    try {
      await requestPasswordReset(email);
      setMessage(labels.passwordSent);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : labels.error);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="account-linked-identities">
      <div className="account-linked-heading">
        <div>
          <h3>{labels.title}</h3>
          <p>{labels.description}</p>
        </div>
        <button
          type="button"
          className="account-identity-action"
          disabled={busy !== null}
          onClick={() => void refresh()}
        >
          <RefreshCw size={14} aria-hidden="true" /> {labels.refresh}
        </button>
      </div>

      {!settings && !error ? <p className="account-identity-muted">{labels.loading}</p> : null}

      {settings ? (
        <>
          <div className="account-signin-method">
            <div className="account-signin-icon"><KeyRound size={18} aria-hidden="true" /></div>
            <div className="account-signin-copy">
              <strong>{labels.local}</strong>
              <span>{settings.localCredential.email}</span>
              <small>{settings.localCredential.enabled ? labels.available : labels.notSet}</small>
            </div>
            <button
              type="button"
              className="account-identity-action"
              disabled={busy !== null}
              onClick={() => void setupPassword()}
            >
              {labels.passwordAction}
            </button>
          </div>

          {settings.identities.map((identity) => (
            <div className="account-signin-method" key={identity.id}>
              <div className="account-signin-icon"><BadgeCheck size={18} aria-hidden="true" /></div>
              <div className="account-signin-copy">
                <strong>{identity.label}</strong>
                <span>{identity.displayName || identity.email || identity.subject}</span>
                <small>{labels.connectedAt}: {formatDate(identity.connectedAt, locale)}</small>
                {identity.lastUsedAt ? <small>{labels.lastUsed}: {formatDate(identity.lastUsedAt, locale)}</small> : null}
                {identity.providerKey === 'oidc' || identity.providerKey === 'saml'
                  ? <small>{labels.issuer}: {identity.issuer}</small>
                  : null}
                {!identity.canUnlink ? <small className="account-identity-warning">{labels.cannotDisconnect}</small> : null}
              </div>
              <button
                type="button"
                className="account-identity-action account-identity-action--danger"
                disabled={busy !== null || !identity.canUnlink}
                onClick={() => void disconnect(identity)}
              >
                <Unlink size={14} aria-hidden="true" />
                {busy === `unlink:${identity.id}` ? '…' : labels.disconnect}
              </button>
            </div>
          ))}

          <div className="account-provider-section">
            <h4>{labels.providers}</h4>
            {availableProviders.length ? (
              <div className="account-provider-list">
                {availableProviders.map((provider) => (
                  <div className="account-provider-row" key={provider.key}>
                    <div>
                      <strong>{provider.label}</strong>
                      {provider.issuer ? <small>{provider.issuer}</small> : null}
                    </div>
                    <button
                      type="button"
                      className="account-provider-connect"
                      disabled={busy !== null}
                      onClick={() => void connectProvider(provider.key)}
                    >
                      <Link2 size={15} aria-hidden="true" />
                      {busy === `connect:${provider.key}` ? '…' : labels.connect}
                    </button>
                  </div>
                ))}
              </div>
            ) : <p className="account-identity-muted">{labels.none}</p>}
          </div>
        </>
      ) : null}

      {message ? <div className="account-success" role="status">{message}</div> : null}
      {error ? <div className="account-error" role="alert">{error || labels.error}</div> : null}
    </div>
  );
}

async function openAuthUrl(url: string): Promise<void> {
  const platform = getStudioPlatform();
  if (platform === 'android' || platform === 'ios') {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    try {
      await openUrl(url, 'inAppBrowser');
    } catch {
      await openUrl(url);
    }
    return;
  }
  globalThis.location?.assign(url);
}

function formatDate(value: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
}
