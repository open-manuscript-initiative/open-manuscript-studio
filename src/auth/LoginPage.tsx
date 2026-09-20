import {
  type FormEvent,
  useEffect,
  useState,
} from 'react';
import {
  Building2,
  FilePenLine,
  Globe2,
  Layers3,
  UserRound,
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
import {
  clearInstitutionAdminLoginPending,
  getAuthDeploymentInfo,
  markInstitutionAdminLoginPending,
} from '../services/institutionAdminApi';
import { useAuthStore } from '../store/authStore';
import { PasswordRecoveryPage } from './PasswordRecoveryPage';
import { useAuthProviders } from './useOrcidProvider';

interface LoginPageProps {
  onShowRegister: () => void;
}

export function LoginPage({ onShowRegister }: LoginPageProps) {
  const { t, locale } = useTranslation();
  const login = useAuthStore((state) => state.login);
  const isLoading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);
  const clearError = useAuthStore((state) => state.clearError);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [federatedStartError, setFederatedStartError] = useState('');
  const [adminMode, setAdminMode] = useState(false);
  const [institutionalDeployment, setInstitutionalDeployment] = useState(false);

  const providers = useAuthProviders();
  const orcidProvider = providers?.orcid ?? null;
  const omiProvider = providers?.omi ?? null;
  const institutionalProvider = providers?.oidc ?? null;
  const auxiliaryOidcProviders = providers
    ? (['google', 'microsoft'] as const)
        .map((key) => ({ key, provider: providers[key] }))
        .filter(({ provider }) => provider?.enabled)
    : [];
  const showOmi = !adminMode && Boolean(omiProvider?.enabled);
  const showInstitutional = Boolean(institutionalProvider?.enabled);
  const showOrcid = !adminMode && Boolean(orcidProvider?.enabled);
  const hasFederatedProvider =
    showOmi || showInstitutional || showOrcid || auxiliaryOidcProviders.length > 0;
  const authErrorCode = getAuthErrorCodeFromLocation();
  const resetToken = new URLSearchParams(window.location.search).get('resetPassword')?.trim() ?? '';
  const heroCopy = getLoginHeroCopy(locale);
  const pathwayCopy = getLoginPathwayCopy(locale);
  const adminCopy = getInstitutionAdminCopy(locale);
  const productName = locale === 'hu' ? 'OMI Stúdió' : 'OMI Studio';

  useEffect(() => {
    clearError();
    void getAuthDeploymentInfo()
      .then((deployment) => setInstitutionalDeployment(deployment.mode === 'institutional'))
      .catch(() => setInstitutionalDeployment(false));
  }, [clearError]);

  useEffect(() => {
    if (authErrorCode) clearInstitutionAdminLoginPending();
  }, [authErrorCode]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await login({
        email,
        password,
        institutionAdmin: adminMode,
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
    if (adminMode) markInstitutionAdminLoginPending();
    try {
      await startOidcAuthentication(provider, locale);
    } catch {
      if (adminMode) clearInstitutionAdminLoginPending();
      setFederatedStartError(providerOpenError(label, locale));
    }
  };

  const switchMode = (nextAdminMode: boolean) => {
    clearError();
    setFederatedStartError('');
    if (!nextAdminMode) clearInstitutionAdminLoginPending();
    setAdminMode(nextAdminMode);
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

  const errorTranslationKey = error ? getAuthErrorTranslationKey(error) : undefined;
  const federatedError = authErrorCode ? federatedErrorMessage(authErrorCode, locale) : '';

  return (
    <main className="auth-page auth-page-login">
      <div className="auth-login-shell">
        <aside className="auth-login-hero" aria-label={t('auth.brand.name')}>
          <div className="auth-login-hero-content">
            <div className="auth-login-lockup">
              <img className="auth-login-logo" src="/android-chrome-512x512.png" alt="" />
              <div className="auth-login-product-name">{productName}</div>
            </div>

            <p className="auth-login-tagline">
              Write naturally. Structure once. Publish everywhere.
            </p>

            <p className="auth-login-intro">
              {adminMode ? adminCopy.hero : heroCopy.intro}
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

        <section className="auth-card auth-login-card" aria-labelledby="login-title">
          <div className="auth-language-switcher auth-login-language-switcher">
            <LanguageSwitcher showAllLocales />
          </div>

          <div className="auth-brand auth-login-mobile-brand">
            <div className="auth-brand-name">{t('auth.brand.name')}</div>
            <div className="auth-brand-description">{t('auth.brand.description')}</div>
          </div>

          {institutionalDeployment ? (
            <div className="auth-login-mode-switch" role="tablist" aria-label={adminCopy.modeLabel}>
              <button
                type="button"
                role="tab"
                aria-selected={!adminMode}
                className={!adminMode ? 'auth-login-mode auth-login-mode--active' : 'auth-login-mode'}
                onClick={() => switchMode(false)}
              >
                <UserRound size={16} aria-hidden="true" />
                {adminCopy.personalMode}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={adminMode}
                className={adminMode ? 'auth-login-mode auth-login-mode--active' : 'auth-login-mode'}
                onClick={() => switchMode(true)}
              >
                <Building2 size={16} aria-hidden="true" />
                {adminCopy.adminMode}
              </button>
            </div>
          ) : null}

          <header className="auth-header auth-login-header">
            <h1 id="login-title">
              {adminMode ? adminCopy.welcome : heroCopy.welcome}
            </h1>
            <p>{adminMode ? adminCopy.description : t('auth.login.description')}</p>
          </header>

          {hasFederatedProvider ? (
            <div className="auth-form auth-login-federated">
              {showOmi && omiProvider ? (
                <div className="auth-login-path auth-login-path--omi">
                  <div className="auth-login-path-copy">
                    <strong>{pathwayCopy.omiTitle}</strong>
                    <span>{pathwayCopy.omiHint}</span>
                  </div>
                  <button
                    className="auth-primary-button auth-provider-button auth-provider-button--omi"
                    type="button"
                    onClick={() => void handleOidcSignIn('omi', omiProvider.label)}
                  >
                    {pathwayCopy.omiAction}
                  </button>
                </div>
              ) : null}

              {showInstitutional && institutionalProvider ? (
                <div className="auth-login-path auth-login-path--institutional">
                  <div className="auth-login-path-copy">
                    <strong>{pathwayCopy.institutionTitle}</strong>
                    <span>{adminMode ? adminCopy.federatedHint : pathwayCopy.institutionHint}</span>
                  </div>
                  <button
                    className="auth-primary-button auth-provider-button auth-provider-button--oidc"
                    type="button"
                    onClick={() => void handleOidcSignIn('oidc', institutionalProvider.label)}
                  >
                    {adminMode
                      ? adminProviderButtonLabel(institutionalProvider.label, locale)
                      : pathwayCopy.institutionAction}
                  </button>
                </div>
              ) : null}

              {showOrcid || auxiliaryOidcProviders.length > 0 ? (
                <div className="auth-login-secondary-providers">
                  <div className="auth-login-secondary-label">{pathwayCopy.otherProviders}</div>
                  <div className="auth-login-provider-grid">
                    {showOrcid ? (
                      <button
                        className="auth-primary-button auth-provider-button auth-orcid-button"
                        type="button"
                        onClick={() => void handleOrcidSignIn()}
                      >
                        {providerButtonLabel('ORCID', locale)}
                      </button>
                    ) : null}
                    {auxiliaryOidcProviders.map(({ key, provider }) => (
                      <button
                        className={`auth-primary-button auth-provider-button auth-provider-button--${key}`}
                        type="button"
                        key={key}
                        onClick={() => void handleOidcSignIn(key, provider.label)}
                      >
                        {adminMode
                          ? adminProviderButtonLabel(provider.label, locale)
                          : providerButtonLabel(provider.label, locale)}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {showOrcid && orcidProvider ? (
                <div className="auth-login-orcid-meta">
                  <OrcidEnvironmentBadge provider={orcidProvider} locale={locale} />
                  <div className="auth-field-hint auth-login-orcid-hint">
                    {locale === 'hu'
                      ? 'Az ORCID-hitelesítés a Stúdió-fiókhoz kapcsolt, ellenőrzött ORCID iD-t használja.'
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

          <div className="auth-login-local-heading">
            <strong>{pathwayCopy.localTitle}</strong>
            <span>{adminMode ? adminCopy.description : pathwayCopy.localHint}</span>
          </div>

          <form className="auth-form auth-login-email-form" onSubmit={handleSubmit}>
            <div className="auth-field">
              <label htmlFor="login-email">{t('auth.fields.email.label')}</label>
              <input
                id="login-email"
                name="email"
                type="email"
                value={email}
                autoComplete="email"
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

            <button className="auth-primary-button auth-login-submit" type="submit" disabled={isLoading}>
              {isLoading
                ? t('auth.login.submitting')
                : adminMode
                  ? adminCopy.submit
                  : t('auth.login.submit')}
            </button>
          </form>

          {adminMode ? (
            <footer className="auth-footer auth-login-footer auth-admin-login-footer">
              <span>{adminCopy.noRegistration}</span>
              <button
                type="button"
                className="auth-link-button"
                disabled={isLoading}
                onClick={() => switchMode(false)}
              >
                {adminCopy.backToPersonal}
              </button>
            </footer>
          ) : (
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
          )}
        </section>
      </div>
    </main>
  );
}

function getLoginHeroCopy(locale: string) {
  if (locale === 'hu') {
    return {
      welcome: 'Üdvözöljük az OMI Stúdióban!',
      intro: 'Az OMI Stúdió segít a kéziratok létrehozásában, szerkesztésében és publikálásra való felkészítésében.',
      featuresLabel: 'Az OMI Stúdió fő előnyei',
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

function getLoginPathwayCopy(locale: string) {
  if (locale === 'hu') {
    return {
      omiTitle: 'Központi OMI-fiók',
      omiHint: 'Egy hordozható OMI-azonosság több Stúdió-telepítéshez. A dokumentum- és szerepkör-jogosultságok továbbra is helyben maradnak.',
      omiAction: 'Bejelentkezés OMI-fiókkal',
      institutionTitle: 'Intézményi bejelentkezés',
      institutionHint: 'Használja az egyetem vagy más intézmény saját bejelentkezési szolgáltatását.',
      institutionAction: 'Bejelentkezés az intézményen keresztül',
      localTitle: 'Helyi Stúdió-fiók',
      localHint: 'Jelentkezzen be a Stúdióban létrehozott e-mail-címmel és jelszóval.',
      otherProviders: 'További kapcsolt azonosítók',
    };
  }
  if (locale === 'de') {
    return {
      omiTitle: 'Zentrales OMI-Konto',
      omiHint: 'Eine portable OMI-Identität für mehrere Studio-Installationen. Dokument- und Rollenrechte bleiben lokal.',
      omiAction: 'Mit OMI-Konto anmelden',
      institutionTitle: 'Institutionelle Anmeldung',
      institutionHint: 'Verwenden Sie den Anmeldedienst Ihrer Universität oder Organisation.',
      institutionAction: 'Über die Institution anmelden',
      localTitle: 'Lokales Studio-Konto',
      localHint: 'Melden Sie sich mit der im Studio registrierten E-Mail-Adresse und dem Passwort an.',
      otherProviders: 'Weitere verknüpfte Identitäten',
    };
  }
  return {
    omiTitle: 'Central OMI account',
    omiHint: 'One portable OMI identity across Studio installations. Document and role authorization remains local.',
    omiAction: 'Sign in with OMI account',
    institutionTitle: 'Institutional sign-in',
    institutionHint: 'Use the identity service provided by your university or organization.',
    institutionAction: 'Sign in through your institution',
    localTitle: 'Local Studio account',
    localHint: 'Use the e-mail address and password registered directly with this Studio installation.',
    otherProviders: 'Other linked identities',
  };
}

function getInstitutionAdminCopy(locale: string) {
  if (locale === 'hu') {
    return {
      modeLabel: 'Bejelentkezési mód',
      personalMode: 'Személyes',
      adminMode: 'Intézményi adminisztrátor',
      welcome: 'Intézményi adminisztrátor',
      description: 'Csak olyan Stúdió-fiókkal használható, amelyhez az intézmény ADMIN vagy OWNER jogosultságot rendelt.',
      hero: 'Az intézményi adminisztrátor a szervezet tagjait, szerepköreit és intézményi kapcsolatokat kezeli; a személyes szerzői profil ettől elkülönül.',
      federatedHint: 'Az intézményi azonosítóval történő belépés után a Stúdió szerveroldalon ellenőrzi az adminisztrátori jogosultságot.',
      submit: 'Adminisztrátori bejelentkezés',
      noRegistration: 'Adminisztrátori jogosultság itt nem hozható létre.',
      backToPersonal: 'Vissza a személyes belépéshez',
    };
  }
  if (locale === 'de') {
    return {
      modeLabel: 'Anmeldemodus',
      personalMode: 'Persönlich',
      adminMode: 'Institutionsadministrator',
      welcome: 'Institutionsadministrator',
      description: 'Nur für Studio-Konten mit einer von der Institution vergebenen ADMIN- oder OWNER-Rolle.',
      hero: 'Institutionelle Administratoren verwalten Mitglieder, Rollen und Organisationsverbindungen; das persönliche Autorenprofil bleibt davon getrennt.',
      federatedHint: 'Nach der Anmeldung mit einer institutionellen Identität prüft der Studio-Server die Administratorberechtigung.',
      submit: 'Als Administrator anmelden',
      noRegistration: 'Administratorrechte können hier nicht selbst erstellt werden.',
      backToPersonal: 'Zur persönlichen Anmeldung',
    };
  }
  return {
    modeLabel: 'Sign-in mode',
    personalMode: 'Personal',
    adminMode: 'Institution administrator',
    welcome: 'Institution administrator',
    description: 'Available only to Studio accounts that have an ADMIN or OWNER role assigned by the institution.',
    hero: 'Institution administrators manage organization membership, roles and institutional connections while the personal author profile remains separate.',
    federatedHint: 'After institutional sign-in, the Studio server verifies administrator permission before the admin context is accepted.',
    submit: 'Administrator sign in',
    noRegistration: 'Administrator permission cannot be self-registered here.',
    backToPersonal: 'Back to personal sign in',
  };
}

function providerButtonLabel(label: string, locale: string): string {
  if (locale === 'hu') return `Bejelentkezés – ${label}`;
  if (locale === 'de') return `Anmelden mit ${label}`;
  return `Sign in with ${label}`;
}

function adminProviderButtonLabel(label: string, locale: string): string {
  if (locale === 'hu') return `Adminisztrátori belépés – ${label}`;
  if (locale === 'de') return `Administrator-Anmeldung mit ${label}`;
  return `Administrator sign in with ${label}`;
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
      'Ez az ORCID iD még nincs Stúdió-fiókhoz kapcsolva. Jelentkezzen be e-maillel, majd kapcsolja hozzá az ORCID-ot a profiljában.',
      'Diese ORCID iD ist noch nicht mit einem Studio-Konto verknüpft. Melden Sie sich zuerst per E-Mail an und verknüpfen Sie ORCID im Profil.',
    ],
    orcid_state_expired: ['The ORCID sign-in request expired. Please try again.', 'Az ORCID-bejelentkezési kérés lejárt. Próbálja újra.', 'Die ORCID-Anmeldung ist abgelaufen. Bitte versuchen Sie es erneut.'],
    orcid_signin_failed: ['ORCID sign-in failed.', 'Az ORCID-bejelentkezés nem sikerült.', 'Die ORCID-Anmeldung ist fehlgeschlagen.'],
    orcid_callback_invalid: ['The ORCID response is invalid.', 'Az ORCID válasza érvénytelen.', 'Die ORCID-Antwort ist ungültig.'],
    omi_account_not_linked: [
      'This OMI account is not linked to this Studio account yet. Sign in locally first, then connect the OMI account under Account → Connected identities.',
      'Ez az OMI-fiók még nincs ehhez a Stúdió-fiókhoz kapcsolva. Először jelentkezzen be helyben, majd a Fiók → Kapcsolt identitások alatt kapcsolja hozzá az OMI-fiókot.',
      'Dieses OMI-Konto ist noch nicht mit diesem Studio-Konto verbunden. Melden Sie sich zuerst lokal an und verbinden Sie danach das OMI-Konto unter Konto → Verknüpfte Identitäten.',
    ],
    oidc_account_exists: [
      'A Studio account already exists with this e-mail address. Sign in with e-mail first and connect the provider from Account settings.',
      'Ezzel az e-mail-címmel már létezik Stúdió-fiók. Először jelentkezzen be e-maillel, majd a Fiók beállításainál kapcsolja hozzá a szolgáltatót.',
      'Für diese E-Mail-Adresse existiert bereits ein Studio-Konto. Melden Sie sich zuerst per E-Mail an und verbinden Sie den Anbieter in den Kontoeinstellungen.',
    ],
    oidc_state_expired: ['The external sign-in request expired. Please try again.', 'A külső bejelentkezési kérés lejárt. Próbálja újra.', 'Die externe Anmeldung ist abgelaufen. Bitte versuchen Sie es erneut.'],
    oidc_signin_failed: ['External sign-in failed.', 'A külső bejelentkezés nem sikerült.', 'Die externe Anmeldung ist fehlgeschlagen.'],
    oidc_callback_invalid: ['The external sign-in response is invalid.', 'A külső bejelentkezési válasz érvénytelen.', 'Die externe Anmeldeantwort ist ungültig.'],
  };
  const value = messages[code] ?? messages.oidc_signin_failed;
  return locale === 'hu' ? value[1] : locale === 'de' ? value[2] : value[0];
}

function getAuthErrorTranslationKey(message: string): TranslationKey | undefined {
  const errorKeyMap: Record<string, TranslationKey> = {
    'Invalid e-mail address.': 'auth.errors.invalidEmail',
    'Incorrect e-mail address or password.': 'auth.errors.invalidCredentials',
    'The user account could not be found.': 'auth.errors.userNotFound',
    'The user account is not active.': 'auth.errors.accountNotActive',
    'Authentication is required.': 'auth.errors.authenticationRequired',
  };

  return errorKeyMap[message];
}
