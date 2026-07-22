import {
  type FormEvent,
  useEffect,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';

import { useAuthStore } from '../store/authStore';

interface RegisterPageProps {
  onShowLogin: () => void;
}

export function RegisterPage({
  onShowLogin,
}: RegisterPageProps) {
  const { t, i18n } = useTranslation();

  const register = useAuthStore(
    (state) => state.register,
  );
  const isLoading = useAuthStore(
    (state) => state.isLoading,
  );
  const error = useAuthStore((state) => state.error);
  const clearError = useAuthStore(
    (state) => state.clearError,
  );

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [affiliation, setAffiliation] = useState('');
  const [orcid, setOrcid] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] =
    useState('');
  const [localErrorKey, setLocalErrorKey] = useState<
    string | null
  >(null);

  useEffect(() => {
    clearError();
  }, [clearError]);

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    setLocalErrorKey(null);

    if (password !== passwordConfirmation) {
      setLocalErrorKey(
        'auth.errors.passwordsDoNotMatch',
      );
      return;
    }

    try {
      await register({
        email,
        password,
        fullName,
        affiliation:
          affiliation.trim() || undefined,
        orcid: orcid.trim() || undefined,
        interfaceLanguage:
          getBaseLanguage(i18n.resolvedLanguage),
        workingLanguages: [],
      });
    } catch {
      // The auth store exposes the error state.
    }
  };

  const resetErrors = () => {
    if (error) {
      clearError();
    }

    if (localErrorKey) {
      setLocalErrorKey(null);
    }
  };

  return (
    <main className="auth-page">
      <section
        className="auth-card auth-card-wide"
        aria-labelledby="register-title"
      >
        <div className="auth-brand">
          <div className="auth-brand-name">
            {t('auth.brand.name')}
          </div>

          <div className="auth-brand-description">
            {t('auth.brand.description')}
          </div>
        </div>

        <header className="auth-header">
          <h1 id="register-title">
            {t('auth.register.title')}
          </h1>

          <p>{t('auth.register.description')}</p>
        </header>

        <form
          className="auth-form"
          onSubmit={handleSubmit}
        >
          <div className="auth-field">
            <label htmlFor="register-name">
              {t('auth.fields.fullName.label')}
            </label>

            <input
              id="register-name"
              name="fullName"
              type="text"
              value={fullName}
              autoComplete="name"
              placeholder={t(
                'auth.fields.fullName.placeholder',
              )}
              required
              disabled={isLoading}
              onChange={(event) => {
                setFullName(event.target.value);
                resetErrors();
              }}
            />
          </div>

          <div className="auth-field">
            <label htmlFor="register-email">
              {t('auth.fields.email.label')}
            </label>

            <input
              id="register-email"
              name="email"
              type="email"
              value={email}
              autoComplete="email"
              placeholder={t(
                'auth.fields.email.placeholder',
              )}
              required
              disabled={isLoading}
              onChange={(event) => {
                setEmail(event.target.value);
                resetErrors();
              }}
            />
          </div>

          <div className="auth-field">
            <label htmlFor="register-affiliation">
              {t('auth.fields.affiliation.label')}
            </label>

            <input
              id="register-affiliation"
              name="affiliation"
              type="text"
              value={affiliation}
              autoComplete="organization"
              placeholder={t(
                'auth.fields.affiliation.placeholder',
              )}
              disabled={isLoading}
              onChange={(event) => {
                setAffiliation(event.target.value);
                resetErrors();
              }}
            />
          </div>

          <div className="auth-field">
            <label htmlFor="register-orcid">
              {t('auth.fields.orcid.label')}
            </label>

            <input
              id="register-orcid"
              name="orcid"
              type="text"
              value={orcid}
              inputMode="text"
              placeholder={t(
                'auth.fields.orcid.placeholder',
              )}
              disabled={isLoading}
              onChange={(event) => {
                setOrcid(event.target.value);
                resetErrors();
              }}
            />

            <div className="auth-field-hint">
              {t('auth.fields.orcid.hint')}
            </div>
          </div>

          <div className="auth-field">
            <label htmlFor="register-password">
              {t('auth.fields.password.label')}
            </label>

            <input
              id="register-password"
              name="password"
              type="password"
              value={password}
              autoComplete="new-password"
              placeholder={t(
                'auth.fields.password.placeholder',
              )}
              required
              disabled={isLoading}
              onChange={(event) => {
                setPassword(event.target.value);
                resetErrors();
              }}
            />

            <div className="auth-field-hint">
              {t('auth.fields.password.hint')}
            </div>
          </div>

          <div className="auth-field">
            <label htmlFor="register-password-confirmation">
              {t(
                'auth.fields.passwordConfirmation.label',
              )}
            </label>

            <input
              id="register-password-confirmation"
              name="passwordConfirmation"
              type="password"
              value={passwordConfirmation}
              autoComplete="new-password"
              placeholder={t(
                'auth.fields.passwordConfirmation.placeholder',
              )}
              required
              disabled={isLoading}
              onChange={(event) => {
                setPasswordConfirmation(
                  event.target.value,
                );
                resetErrors();
              }}
            />
          </div>

          {(localErrorKey || error) && (
            <div
              className="auth-error"
              role="alert"
            >
              {localErrorKey
                ? t(localErrorKey)
                : translateRegisterError(
                    t,
                    error ?? '',
                  )}
            </div>
          )}

          <button
            className="auth-primary-button"
            type="submit"
            disabled={isLoading}
          >
            {isLoading
              ? t('auth.register.submitting')
              : t('auth.register.submit')}
          </button>
        </form>

        <footer className="auth-footer">
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

        <p className="auth-alpha-notice">
          {t('auth.alphaNotice')}
        </p>
      </section>
    </main>
  );
}

type TranslateFunction = (
  key: string,
  options?: Record<string, unknown>,
) => string;

function translateRegisterError(
  t: TranslateFunction,
  message: string,
): string {
  const errorKeyMap: Record<string, string> = {
    'Invalid e-mail address.':
      'auth.errors.invalidEmail',

    'An account already exists with this e-mail address.':
      'auth.errors.emailAlreadyExists',

    'The password must contain at least 8 characters.':
      'auth.errors.passwordTooShort',

    'The password must contain at least one letter.':
      'auth.errors.passwordNeedsLetter',

    'The password must contain at least one number.':
      'auth.errors.passwordNeedsNumber',

    'The user name is required.':
      'auth.errors.fullNameRequired',

    'Invalid ORCID identifier.':
      'auth.errors.invalidOrcid',
  };

  const translationKey = errorKeyMap[message];

  return translationKey
    ? t(translationKey)
    : message;
}

function getBaseLanguage(
  language: string | undefined,
): string {
  return language?.split('-')[0]?.toLowerCase() || 'en';
            }
