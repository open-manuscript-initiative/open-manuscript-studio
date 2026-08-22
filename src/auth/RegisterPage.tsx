import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  FilePenLine,
  Globe2,
  Layers3,
} from 'lucide-react';

import {
  useTranslation,
  type AuthTranslationKey,
} from '../i18n';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { OrcidEnvironmentBadge } from '../components/OrcidEnvironmentBadge';
import {
  getOrcidAuthUrl,
  getRegistrationInvitation,
} from '../services/authApi';
import { AuthRorAffiliationField } from './AuthRorAffiliationField';
import { AuthOrcidLookupField } from './AuthOrcidLookupField';
import { useOrcidProvider } from './useOrcidProvider';
import { useAuthStore } from '../store/authStore';

interface RegisterPageProps {
  onShowLogin: () => void;
}

export function RegisterPage({
  onShowLogin,
}: RegisterPageProps) {
  const { t, locale } = useTranslation();

  const register = useAuthStore((state) => state.register);
  const isLoading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);
  const clearError = useAuthStore((state) => state.clearError);

  const invitationToken = useMemo(
    () => new URLSearchParams(window.location.search).get('invite')?.trim() || undefined,
    [],
  );
  const [invitationLoading, setInvitationLoading] = useState(Boolean(invitationToken));
  const [invitationError, setInvitationError] = useState('');
  const [invitedEmail, setInvitedEmail] = useState('');
  const orcidProvider = useOrcidProvider();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [affiliation, setAffiliation] = useState('');
  const [affiliationRorId, setAffiliationRorId] = useState('');
  const [orcid, setOrcid] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [localErrorKey, setLocalErrorKey] = useState<AuthTranslationKey | null>(null);
  const heroCopy = getRegisterHeroCopy(locale);

  useEffect(() => {
    clearError();
  }, [clearError]);

  useEffect(() => {
    if (!invitationToken) return;
    let active = true;
    setInvitationLoading(true);
    setInvitationError('');
    void getRegistrationInvitation(invitationToken)
      .then((invitation) => {
        if (!active) return;
        setEmail(invitation.email);
        setInvitedEmail(invitation.email);
        setFullName(invitation.fullName);
      })
      .catch((caught) => {
        if (!active) return;
        setInvitationError(caught instanceof Error ? caught.message : 'The invitation is invalid or has expired.');
      })
      .finally(() => {
        if (active) setInvitationLoading(false);
      });
    return () => { active = false; };
  }, [invitationToken]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalErrorKey(null);

    if (password !== passwordConfirmation) {
      setLocalErrorKey('auth.errors.passwordsDoNotMatch');
      return;
    }

    try {
      await register({
        email,
        password,
        fullName,
        affiliation: affiliation.trim() || undefined,
        affiliationRorId: affiliationRorId.trim() || undefined,
        orcid: orcid.trim() || undefined,
        interfaceLanguage: locale,
        workingLanguages: [],
        invitationToken,
      });
      if (invitationToken) {
        const url = new URL(window.location.href);
        url.searchParams.delete('invite');
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
      }
    } catch {
      // The auth store exposes the error state.
    }
  };

  const resetErrors = () => {
    if (error) clearError();
    if (localErrorKey) setLocalErrorKey(null);
  };

  const registrationDisabled = isLoading || invitationLoading || Boolean(invitationError);

  return (
    <main className="auth-page auth-page-login auth-page-register">
      <div className="auth-login-shell auth-register-shell">
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
          className="auth-card auth-login-card auth-register-card"
          aria-labelledby="register-title"
        >
          <div className="auth-language-switcher auth-login-language-switcher">
            <LanguageSwitcher showAllLocales />
          </div>

          <div className="auth-brand auth-login-mobile-brand">
            <div className="auth-brand-name">{t('auth.brand.name')}</div>
            <div className="auth-brand-description">{t('auth.brand.description')}</div>
          </div>

          <header className="auth-header auth-login-header auth-register-header">
            <h1 id="register-title">{t('auth.register.title')}</h1>
            <p>{t('auth.register.description')}</p>
            {invitationToken && !invitationError ? (
              <p className="auth-field-hint auth-register-invitation-hint">
                {invitationLoading
                  ? 'Loading assignment invitation…'
                  : 'Complete your Studio registration to open the assignment sent to this e-mail address.'}
              </p>
            ) : null}
          </header>

          {invitationToken && orcidProvider?.enabled && !invitationError ? (
            <div className="auth-form auth-register-orcid">
              <a className="auth-primary-button" href={getOrcidAuthUrl({ invitationToken })}>
                {locale === 'hu'
                  ? 'Meghívás elfogadása ORCID-dal'
                  : locale === 'de'
                    ? 'Einladung mit ORCID annehmen'
                    : 'Accept invitation with ORCID'}
              </a>
              <OrcidEnvironmentBadge provider={orcidProvider} locale={locale} />
              <div className="auth-field-hint">
                {locale === 'hu'
                  ? 'Az ORCID-hitelesítés aktiválja a meghívott Studio-fiókot; külön Studio-jelszó létrehozása nem szükséges.'
                  : locale === 'de'
                    ? 'Die ORCID-Authentifizierung aktiviert das eingeladene Studio-Konto; ein separates Studio-Passwort ist nicht erforderlich.'
                    : 'ORCID authentication activates the invited Studio account; a separate Studio password is not required.'}
              </div>
            </div>
          ) : null}

          <form className="auth-form auth-register-form" onSubmit={handleSubmit}>
            <div className="auth-field">
              <label htmlFor="register-name">{t('auth.fields.fullName.label')}</label>
              <input
                id="register-name"
                name="fullName"
                type="text"
                value={fullName}
                autoComplete="name"
                placeholder={t('auth.fields.fullName.placeholder')}
                required
                disabled={registrationDisabled}
                onChange={(event) => {
                  setFullName(event.target.value);
                  resetErrors();
                }}
              />
            </div>

            <div className="auth-field">
              <label htmlFor="register-email">{t('auth.fields.email.label')}</label>
              <input
                id="register-email"
                name="email"
                type="email"
                value={email}
                autoComplete="email"
                placeholder={t('auth.fields.email.placeholder')}
                required
                readOnly={Boolean(invitedEmail)}
                disabled={registrationDisabled}
                onChange={(event) => {
                  setEmail(event.target.value);
                  resetErrors();
                }}
              />
              {invitedEmail ? (
                <div className="auth-field-hint">This e-mail address is fixed by the invitation.</div>
              ) : null}
            </div>

            <AuthRorAffiliationField
              value={affiliation}
              rorId={affiliationRorId}
              label={t('auth.fields.affiliation.label')}
              placeholder={t('auth.fields.affiliation.placeholder')}
              disabled={registrationDisabled}
              onChange={(nextAffiliation, nextRorId) => {
                setAffiliation(nextAffiliation);
                setAffiliationRorId(nextRorId);
                resetErrors();
              }}
            />

            <AuthOrcidLookupField
              fullName={fullName}
              affiliation={affiliation}
              rorId={affiliationRorId}
              value={orcid}
              label={t('auth.fields.orcid.label')}
              placeholder={t('auth.fields.orcid.placeholder')}
              hint={t('auth.fields.orcid.hint')}
              invalidMessage={t('auth.errors.invalidOrcid')}
              disabled={registrationDisabled}
              onChange={(nextOrcid) => {
                setOrcid(nextOrcid);
                resetErrors();
              }}
            />

            <div className="auth-field">
              <label htmlFor="register-password">{t('auth.fields.password.label')}</label>
              <input
                id="register-password"
                name="password"
                type="password"
                value={password}
                autoComplete="new-password"
                placeholder={t('auth.fields.password.placeholder')}
                required
                disabled={registrationDisabled}
                onChange={(event) => {
                  setPassword(event.target.value);
                  resetErrors();
                }}
              />
              <div className="auth-field-hint">{t('auth.fields.password.hint')}</div>
            </div>

            <div className="auth-field">
              <label htmlFor="register-password-confirmation">{t('auth.fields.passwordConfirmation.label')}</label>
              <input
                id="register-password-confirmation"
                name="passwordConfirmation"
                type="password"
                value={passwordConfirmation}
                autoComplete="new-password"
                placeholder={t('auth.fields.passwordConfirmation.placeholder')}
                required
                disabled={registrationDisabled}
                onChange={(event) => {
                  setPasswordConfirmation(event.target.value);
                  resetErrors();
                }}
              />
            </div>

            {(localErrorKey || error || invitationError) && (
              <div className="auth-error auth-register-full" role="alert">
                {invitationError || (localErrorKey
                  ? t(localErrorKey)
                  : translateRegisterError(t, error ?? ''))}
              </div>
            )}

            <button
              className="auth-primary-button auth-login-submit auth-register-submit auth-register-full"
              type="submit"
              disabled={registrationDisabled}
            >
              {isLoading ? t('auth.register.submitting') : t('auth.register.submit')}
            </button>
          </form>

          <footer className="auth-footer auth-login-footer auth-register-footer">
            <span>{t('auth.register.hasAccount')}</span>
            <button
              type="button"
              className="auth-link-button"
              disabled={isLoading}
              onClick={onShowLogin}
            >
              {t('auth.register.loginLink')}
            </button>
          </footer>

          <p className="auth-alpha-notice auth-login-notice auth-register-notice">{t('auth.alphaNotice')}</p>
        </section>
      </div>
    </main>
  );
}

function getRegisterHeroCopy(locale: string) {
  if (locale === 'hu') {
    return {
      intro: 'Hozzon létre egy Studio-fiókot, és készítse elő kéziratait szerkesztésre, együttműködésre és publikálásra.',
      featuresLabel: 'Az OMI Studio fő előnyei',
      write: 'Írjon szabadon',
      structure: 'Strukturáljon egyszer',
      publish: 'Publikáljon bárhol',
    };
  }

  if (locale === 'de') {
    return {
      intro: 'Erstellen Sie ein Studio-Konto und bereiten Sie Ihre Manuskripte für Bearbeitung, Zusammenarbeit und Publikation vor.',
      featuresLabel: 'Die wichtigsten Vorteile von OMI Studio',
      write: 'Natürlich schreiben',
      structure: 'Einmal strukturieren',
      publish: 'Überall publizieren',
    };
  }

  return {
    intro: 'Create a Studio account and prepare your manuscripts for editing, collaboration and publication.',
    featuresLabel: 'Key benefits of OMI Studio',
    write: 'Write naturally',
    structure: 'Structure once',
    publish: 'Publish everywhere',
  };
}

type TranslateFunction = (key: AuthTranslationKey) => string;

function translateRegisterError(
  t: TranslateFunction,
  message: string,
): string {
  const errorKeyMap: Record<string, AuthTranslationKey> = {
    'Invalid e-mail address.': 'auth.errors.invalidEmail',
    'An account already exists with this e-mail address.': 'auth.errors.emailAlreadyExists',
    'The password must contain at least 8 characters.': 'auth.errors.passwordTooShort',
    'The password must contain at least one letter.': 'auth.errors.passwordNeedsLetter',
    'The password must contain at least one number.': 'auth.errors.passwordNeedsNumber',
    'The user name is required.': 'auth.errors.fullNameRequired',
    'Invalid ORCID identifier.': 'auth.errors.invalidOrcid',
  };

  const translationKey = errorKeyMap[message];
  return translationKey ? t(translationKey) : message;
}
