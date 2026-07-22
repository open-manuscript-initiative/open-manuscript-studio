import {
  type FormEvent,
  useEffect,
  useState,
} from 'react';

import {
  useTranslation,
  type TranslationKey,
} from '../i18n';

import { useAuthStore } from '../store/authStore';

interface LoginPageProps {
  onShowRegister: () => void;
}

export function LoginPage({
  onShowRegister,
}: LoginPageProps) {
  const { t } = useTranslation();

  const login = useAuthStore((state) => state.login);

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
      // A bejelentkezési hibát az authStore
      // error állapota tartalmazza.
    }
  };

  return (
    <main className="auth-page">
      <section
        className="auth-card"
        aria-labelledby="login-title"
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
          <h1 id="login-title">
            {t('auth.login.title')}
          </h1>

          <p>
            {t('auth.login.description')}
          </p>
        </header>

        <form
          className="auth-form"
          onSubmit={handleSubmit}
        >
          <div className="auth-field">
            <label htmlFor="login-email">
              {t('auth.fields.email.label')}
            </label>

            <input
              id="login-email"
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

                if (error) {
                  clearError();
                }
              }}
            />
          </div>

          <div className="auth-field">
            <label htmlFor="login-password">
              {t('auth.fields.password.label')}
            </label>

            <input
              id="login-password"
              name="password"
              type="password"
              value={password}
              autoComplete="current-password"
              placeholder={t(
                'auth.fields.password.placeholder',
              )}
              required
              disabled={isLoading}
              onChange={(event) => {
                setPassword(event.target.value);

                if (error) {
                  clearError();
                }
              }}
            />
          </div>

          {error && (
            <div
              className="auth-error"
              role="alert"
            >
              {translateAuthError(t, error)}
            </div>
          )}

          <button
            className="auth-primary-button"
            type="submit"
            disabled={isLoading}
          >
            {isLoading
              ? t('auth.login.submitting')
              : t('auth.login.submit')}
          </button>
        </form>

        <footer className="auth-footer">
          <span>
            {t('auth.login.noAccount')}
          </span>

          <button
            type="button"
            className="auth-link-button"
            disabled={isLoading}
            onClick={onShowRegister}
          >
            {t('auth.login.registerLink')}
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
  key: TranslationKey,
) => string;

function translateAuthError(
  t: TranslateFunction,
  message: string,
): string {
  const errorKeyMap: Partial<
    Record<string, TranslationKey>
  > = {
    'Invalid e-mail address.':
      'auth.errors.invalidEmail',

    'Incorrect e-mail address or password.':
      'auth.errors.invalidCredentials',

    'The user account could not be found.':
      'auth.errors.userNotFound',

    'The user account is not active.':
      'auth.errors.accountNotActive',

    'Authentication is required.':
      'auth.errors.authenticationRequired',
  };

  const translationKey = errorKeyMap[message];

  return translationKey
    ? t(translationKey)
    : message;
}
