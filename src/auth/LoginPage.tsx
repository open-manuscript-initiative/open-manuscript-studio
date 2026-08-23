import {
  type FormEvent,
  useEffect,
  useState,
} from 'react';
import {
  FilePenLine,
  Globe2,
  Layers3,
} from 'lucide-react';

import {
  useTranslation,
  type TranslationKey,
} from '../i18n';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { OrcidEnvironmentBadge } from '../components/OrcidEnvironmentBadge';
import {
  getAuthErrorCodeFromLocation,
  startOidcAuthentication,
  startOrcidAuthentication,
  type OidcProviderKey,
} from '../services/authApi';
import { useAuthStore } from '../store/authStore';
import { PasswordRecoveryPage } from './PasswordRecoveryPage';
import { useAuthProviders } from './useOrcidProvider';

interface LoginPageProps {
  onShowRegister: () => void;
}

export function LoginPage({
  onShowRegister,
}: LoginPageProps) {
  const { t, locale } = useTranslation();

  const login = useAuthStore(
    (state) => state.login,
  );

  const isLoading = useAuthStore(
    (state) => state.isLoading,
  );

  const error = useAuthStore(
    (state) => state.error,
  );

  const clearError = useAuthStore(
    (state) => state.clearError,
  );

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [federatedStartError, setFederatedStartError] = useState('');
  const providers = useAuthProviders();
  const orcidProvider = providers?.orcid ?? null;
  const oidcProviders = providers
    ? (['google', 'microsoft', 'oidc'] as const)
        .map((key) => ({ key, provider: providers[key] }))
        .filter(({ provider }) => provider?.enabled)
    : [];
  const hasFederatedProvider = Boolean(orcidProvider?.enabled || oidcProviders.length);
  const authErrorCode = getAuthErrorCodeFromLocation();
  const resetToken = new URLSearchParams(window.location.search).get('resetPassword')?.trim() ?? '';
  const heroCopy = getLoginHeroCopy(locale);

  useEffect(() => {
    clearError();
  }, [clearError]);

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    try {
      await login({
        email,
        password,
      });
    } catch {
      // The auth store exposes the error state.
    }
  };

  const handleOrcidSignIn = async () => {
    setFederatedStartError('');
    try {
      await startOrcidAuthentication();
    } catch {
      setFederatedStartError(providerOpenError('ORCID', locale));
    }
  };

  const handleOidcSignIn = async (provider: OidcProviderKey, label: string) => {
    setFederatedStartError('');
    try {
      await startOidcAuthentication(provider, locale);
    } catch {
      setFederatedStartError(providerOpenError(label, locale));
    }
  };

  const closeRecovery = () => {
    if (resetToken) {
      const url = new URL(window.location.href);
      url.searchParams.delete('resetPassword');
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
      window.location.reload();
      return;
    }
    setRecoveryOpen(false);
  };

  if (resetToken || recoveryOpen) {
    return (
      <PasswordRecoveryPage
        mode={resetToken ? 'reset' : 'forgot'}
        token={resetToken || undefined}
        initialEmail={email}
        onBack={closeRecovery}
      />
    );
  }

  const errorTranslationKey = error
    ? getAuthErrorTranslationKey(error)
    : undefined;
  const federatedError = authErrorCode ? federatedErrorMessage(authErrorCode, locale) : '';

  return (
    <main className="auth-page auth-page-login">
      <div className="auth-login-shell">
        <aside className="auth-login-hero" aria-label={t('auth.brand.name')}>
          <div className="auth-login-hero-content">
            <div className="auth-login-lockup">
              <img
                className="auth-login-logo"
                src="/android-chrome-512x512.png"
                alt=""
              />
              <div className="auth-login-product-name">OMI Studio</div>
            </div>

            <p className="auth-login-tagline">
              Write naturally. Structure once. Publish everywhere.
            </p>

            <p className="auth-login-intro">
              {heroCopy.intro}
            </p>

            <div className="auth-login-features" aria-label={heroCopy.featuresLabel}>
              <div className="auth-login-feature">
                <FilePenLine aria-hidden="true" />
                <span>{heroCopy.write}</span>
              </div>
              <div className="auth-login-feature">
                <Layers3 aria-hidden="true" />
                <span>{heroCopy.structure}</span>
              </div>
              <div className="auth-login-feature">
                <Globe2 aria-hidden="true" />
                <span>{heroCopy.publish}</span>
              </div>
            </div>
          </div>
        </aside>

        <section
          className="auth-card auth-login-card"
          aria-labelledby="login-title"
        >
          <div className="auth-language-switcher auth-login-language-switcher">
            <LanguageSwitcher showAllLocales />
          </div>

          <div className="auth-brand auth-login-mobile-brand">
            <div className="auth-brand-name">
              {t('auth.brand.name')}
            </div>

            <div className="auth-brand-description">
              {t('auth.brand.description')}
            </div>
          </div>

          <header className="auth-header auth-login-header">
            <h1 id="login-title">
              {heroCopy.welcome}
            </h1>

            <p>{t('auth.login.description')}</p>
          </header>

          {hasFederatedProvider ? (
            <div className="auth-form auth-login-federated">
              <div className="auth-login-provider-grid">
                {orcidProvider?.enabled ? (
                  <button
                    className="auth-primary-button auth-provider-button auth-orcid-button"
                    type="button"
                    onClick={() => void handleOrcidSignIn()}
                  >
                    {providerButtonLabel('ORCID', locale)}
                  </button>
                ) : null}
                {oidcProviders.map(({ key, provider }) => (
                  <button
                    className={`auth-primary-button auth-provider-button auth-provider-button--${key}`}
                    type="button"
                    key={key}
                    onClick={() => void handleOidcSignIn(key, provider.label)}
                  >
                    {providerButtonLabel(provider.label, locale)}
                  </button>
                ))}
              </div>
              {orcidProvider?.enabled ? (
                <div className="auth-login-orcid-meta">
                  <OrcidEnvironmentBadge provider={orcidProvider} locale={locale} />
                  <div className="auth-field-hint auth-login-orcid-hint">
                    {locale === 'hu'
                      ? 'Az ORCID-hitelesítés a Studio-fiókhoz kapcsolt, ellenőrzött ORCID iD-t használja.'
                      : locale === 'de'
                        ? 'Die ORCID-Anmeldung verwendet die verifizierte ORCID iD, die mit Ihrem Studio-Konto verknüpft ist.'
                        : 'ORCID sign-in uses the verified ORCID iD linked to your Studio account.'}
                  </div>
                </div>
              ) : null}
              {federatedStartError ? <div className="auth-error" role="alert">{federatedStartError}</div> : null}
            </div>
          ) : null}

          {hasFederatedProvider ? (
            <div className="auth-login-divider" aria-hidden="true">
              <span>{heroCopy.orEmail}</span>
            </div>
          ) : null}

          <form
            className="auth-form auth-login-email-form"
            onSubmit={handleSubmit}
          >
            <div className="auth-field">
              <label htmlFor="login-email">{t('auth.fields.email.label')}</label>
              <input
                id="login-email"
                name="email"
                type="email"
                value={email}
                autoComplete="email"
                placeholder={t('auth.fields.email.placeholder')}
                required
                disabled={isLoading}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (error) clearError();
                }}
              />
            </div>

            <div className="auth-field">
              <label htmlFor="login-password">{t('auth.fields.password.label')}</label>
              <input
                id="login-password"
                name="password"
                type="password"
                value={password}
                autoComplete="current-password"
                placeholder={t('auth.fields.password.placeholder')}
                required
                disabled={isLoading}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (error) clearError();
                }}
              />
              <div className="auth-password-help">
                <button
                  type="button"
                  className="auth-link-button"
                  disabled={isLoading}
                  onClick={() => {
                    clearError();
                    setRecoveryOpen(true);
                  }}
                >
                  {heroCopy.forgotPassword}
                </button>
              </div>
            </div>

            {(error || federatedError) && (
              <div className="auth-error" role="alert">
                {federatedError || (errorTranslationKey ? t(errorTranslationKey) : error)}
              </div>
            )}

            <button
              className="auth-primary-button auth-login-submit"
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? t('auth.login.submitting') : t('auth.login.submit')}
            </button>
          </form>

          <footer className="auth-footer auth-login-footer">
            <span>{t('auth.login.noAccount')}</span>
            <button
              type="button"
              className="auth-link-button"
              disabled={isLoading}
              onClick={onShowRegister}
            >
              {t('auth.login.registerLink')}
            </button>
          </footer>

          <p className="auth-alpha-notice auth-login-notice">{t('auth.alphaNotice')}</p>
        </section>
      </div>
    </main>
  );
}

function getLoginHeroCopy(locale: string) {
  if (locale === 'hu') {
    return {
      welcome: 'Üdvözöljük az OMI Studióban!',
      intro: 'Az OMI Studio segít a kéziratok létrehozásában, szerkesztésében és publikálásra való felkészítésében.',
      featuresLabel: 'Az OMI Studio fő előnyei',
      write: 'Írjon szabadon',
      structure: 'Strukturáljon egyszer',
      publish: 'Publikáljon bárhol',
      orEmail: 'vagy e-mail-címmel',
      forgotPassword: 'Elfelejtette a jelszavát?',
    };
  }

  if (locale === 'de') {
    return {
      welcome: 'Willkommen im OMI Studio!',
      intro: 'OMI Studio unterstützt Sie beim Erstellen, Bearbeiten und Publikationsvorbereiten wissenschaftlicher Manuskripte.',
      featuresLabel: 'Die wichtigsten Vorteile von OMI Studio',
      write: 'Natürlich schreiben',
      structure: 'Einmal strukturieren',
      publish: 'Überall publizieren',
      orEmail: 'oder mit E-Mail',
      forgotPassword: 'Passwort vergessen?',
    };
  }

  return {
    welcome: 'Welcome to OMI Studio!',
    intro: 'OMI Studio helps you create, edit and prepare scholarly manuscripts for publication.',
    featuresLabel: 'Key benefits of OMI Studio',
    write: 'Write naturally',
    structure: 'Structure once',
    publish: 'Publish everywhere',
    orEmail: 'or with e-mail',
    forgotPassword: 'Forgot your password?',
  };
}

function providerButtonLabel(label: string, locale: string): string {
  if (locale === 'hu') return `Bejelentkezés – ${label}`;
  if (locale === 'de') return `Anmelden mit ${label}`;
  return `Sign in with ${label}`;
}

function providerOpenError(label: string, locale: string): string {
  if (locale === 'hu') return `A(z) ${label} bejelentkezés nem nyitható meg. Próbálja újra.`;
  if (locale === 'de') return `${label} konnte nicht geöffnet werden. Bitte versuchen Sie es erneut.`;
  return `${label} sign-in could not be opened. Please try again.`;
}

function federatedErrorMessage(code: string, locale: string): string {
  const messages: Record<string, [string, string, string]> = {
    orcid_not_linked: [
      'This ORCID iD is not linked to a Studio account yet. Sign in with e-mail first and link ORCID from your profile.',
      'Ez az ORCID iD még nincs Studio-fiókhoz kapcsolva. Jelentkezzen be e-maillel, majd kapcsolja hozzá az ORCID-ot a profiljában.',
      'Diese ORCID iD ist noch nicht mit einem Studio-Konto verknüpft. Melden Sie sich zuerst per E-Mail an und verknüpfen Sie ORCID im Profil.',
    ],
    orcid_state_expired: ['The ORCID sign-in request expired. Please try again.', 'Az ORCID-bejelentkezési kérés lejárt. Próbálja újra.', 'Die ORCID-Anmeldung ist abgelaufen. Bitte versuchen Sie es erneut.'],
    orcid_signin_failed: ['ORCID sign-in failed.', 'Az ORCID-bejelentkezés nem sikerült.', 'Die ORCID-Anmeldung ist fehlgeschlagen.'],
    orcid_callback_invalid: ['The ORCID response is invalid.', 'Az ORCID válasza érvénytelen.', 'Die ORCID-Antwort ist ungültig.'],
    oidc_account_exists: [
      'A Studio account already exists with this e-mail address. Sign in with e-mail first and connect the provider from Account settings.',
      'Ezzel az e-mail-címmel már létezik Studio-fiók. Először jelentkezzen be e-maillel, majd a Fiók beállításainál kapcsolja hozzá a szolgáltatót.',
      'Für diese E-Mail-Adresse existiert bereits ein Studio-Konto. Melden Sie sich zuerst per E-Mail an und verbinden Sie den Anbieter in den Kontoeinstellungen.',
    ],
    oidc_state_expired: ['The external sign-in request expired. Please try again.', 'A külső bejelentkezési kérés lejárt. Próbálja újra.', 'Die externe Anmeldung ist abgelaufen. Bitte versuchen Sie es erneut.'],
    oidc_signin_failed: ['External sign-in failed.', 'A külső bejelentkezés nem sikerült.', 'Die externe Anmeldung ist fehlgeschlagen.'],
    oidc_callback_invalid: ['The external sign-in response is invalid.', 'A külső bejelentkezési válasz érvénytelen.', 'Die externe Anmeldeantwort ist ungültig.'],
  };
  const value = messages[code] ?? messages.oidc_signin_failed;
  return locale === 'hu' ? value[1] : locale === 'de' ? value[2] : value[0];
}

function getAuthErrorTranslationKey(
  message: string,
): TranslationKey | undefined {
  const errorKeyMap: Record<string, TranslationKey> = {
    'Invalid e-mail address.': 'auth.errors.invalidEmail',
    'Incorrect e-mail address or password.': 'auth.errors.invalidCredentials',
    'The user account could not be found.': 'auth.errors.userNotFound',
    'The user account is not active.': 'auth.errors.accountNotActive',
    'Authentication is required.': 'auth.errors.authenticationRequired',
  };

  return errorKeyMap[message];
}
