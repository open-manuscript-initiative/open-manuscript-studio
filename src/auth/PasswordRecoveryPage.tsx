import { type FormEvent, useState } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';

import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { useTranslation } from '../i18n';
import {
  requestPasswordReset,
  resetPassword,
} from '../services/authApi';

type RecoveryMode = 'forgot' | 'reset';

interface PasswordRecoveryPageProps {
  mode: RecoveryMode;
  token?: string;
  initialEmail?: string;
  onBack: () => void;
}

export function PasswordRecoveryPage({
  mode,
  token,
  initialEmail = '',
  onBack,
}: PasswordRecoveryPageProps) {
  const { locale } = useTranslation();
  const copy = getCopy(locale);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function submitForgot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (caught) {
      setError(caught instanceof Error ? localizeApiError(caught.message, locale) : copy.genericError);
    } finally {
      setLoading(false);
    }
  }

  async function submitReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (!token) {
      setError(copy.invalidLink);
      return;
    }
    if (password !== confirmation) {
      setError(copy.passwordsDoNotMatch);
      return;
    }
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setError(copy.passwordRequirements);
      return;
    }

    setLoading(true);
    try {
      await resetPassword({ token, password });
      const url = new URL(window.location.href);
      url.searchParams.delete('resetPassword');
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
      // Reload so a previously authenticated browser also revalidates its now
      // revoked session and returns to a clean login state.
      window.location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? localizeApiError(caught.message, locale) : copy.genericError);
      setLoading(false);
    }
  }

  return (
    <main className="auth-page auth-page-login auth-recovery-page">
      <div className="auth-login-shell auth-recovery-shell">
        <aside className="auth-login-hero" aria-label="OMI Studio">
          <div className="auth-login-hero-content">
            <div className="auth-login-lockup">
              <img
                className="auth-login-logo"
                src="/android-chrome-512x512.png"
                alt=""
              />
              <div className="auth-login-product-name">OMI Studio</div>
            </div>
            <p className="auth-login-tagline">Write naturally. Structure once. Publish everywhere.</p>
            <p className="auth-login-intro">{copy.securityIntro}</p>
            <div className="auth-recovery-security-note">
              <ShieldCheck aria-hidden="true" />
              <span>{copy.securityNote}</span>
            </div>
          </div>
        </aside>

        <section className="auth-card auth-login-card auth-recovery-card" aria-labelledby="recovery-title">
          <div className="auth-language-switcher auth-login-language-switcher">
            <LanguageSwitcher showAllLocales />
          </div>

          <div className="auth-recovery-icon" aria-hidden="true">
            <KeyRound />
          </div>

          <header className="auth-header auth-login-header">
            <h1 id="recovery-title">
              {mode === 'forgot' ? copy.forgotTitle : copy.resetTitle}
            </h1>
            <p>{mode === 'forgot' ? copy.forgotDescription : copy.resetDescription}</p>
          </header>

          {mode === 'forgot' ? (
            sent ? (
              <div className="auth-recovery-success" role="status">
                <strong>{copy.sentTitle}</strong>
                <p>{copy.sentDescription}</p>
                <button type="button" className="auth-primary-button" onClick={onBack}>
                  {copy.backToLogin}
                </button>
              </div>
            ) : (
              <form className="auth-form auth-login-email-form" onSubmit={submitForgot}>
                <div className="auth-field">
                  <label htmlFor="password-reset-email">{copy.email}</label>
                  <input
                    id="password-reset-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    required
                    disabled={loading}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>
                {error ? <div className="auth-error" role="alert">{error}</div> : null}
                <button className="auth-primary-button auth-login-submit" type="submit" disabled={loading}>
                  {loading ? copy.sending : copy.sendLink}
                </button>
                <button type="button" className="auth-link-button auth-recovery-back" onClick={onBack} disabled={loading}>
                  {copy.backToLogin}
                </button>
              </form>
            )
          ) : (
            <form className="auth-form auth-login-email-form" onSubmit={submitReset}>
              <div className="auth-field">
                <label htmlFor="new-password">{copy.newPassword}</label>
                <input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  required
                  disabled={loading}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <div className="auth-field-hint">{copy.passwordRequirements}</div>
              </div>
              <div className="auth-field">
                <label htmlFor="new-password-confirmation">{copy.confirmPassword}</label>
                <input
                  id="new-password-confirmation"
                  type="password"
                  autoComplete="new-password"
                  value={confirmation}
                  required
                  disabled={loading}
                  onChange={(event) => setConfirmation(event.target.value)}
                />
              </div>
              {error ? <div className="auth-error" role="alert">{error}</div> : null}
              <button className="auth-primary-button auth-login-submit" type="submit" disabled={loading}>
                {loading ? copy.saving : copy.savePassword}
              </button>
              <button type="button" className="auth-link-button auth-recovery-back" onClick={onBack} disabled={loading}>
                {copy.backToLogin}
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}

function localizeApiError(message: string, locale: string): string {
  const copy = getCopy(locale);
  if (message === 'Invalid e-mail address.') return copy.invalidEmail;
  if (message === 'The password reset link is invalid or has expired.') return copy.invalidLink;
  if (
    message === 'The password must contain at least 8 characters.' ||
    message === 'The password must contain at least one letter.' ||
    message === 'The password must contain at least one number.'
  ) {
    return copy.passwordRequirements;
  }
  return message || copy.genericError;
}

function getCopy(locale: string) {
  if (locale === 'hu') {
    return {
      forgotTitle: 'Elfelejtette a jelszavát?',
      forgotDescription: 'Adja meg a Studio-fiókjához tartozó e-mail-címet. Ha létezik ilyen fiók, elküldjük a jelszó-visszaállító hivatkozást.',
      resetTitle: 'Új jelszó beállítása',
      resetDescription: 'Adjon meg egy új jelszót az OMI Studio-fiókjához.',
      email: 'E-mail-cím',
      sendLink: 'Visszaállító hivatkozás küldése',
      sending: 'Küldés…',
      sentTitle: 'Ellenőrizze a postafiókját',
      sentDescription: 'Ha az e-mail-címhez tartozik aktív Studio-fiók, elküldtük a jelszó-visszaállító hivatkozást. A hivatkozás egyszer használható és korlátozott ideig érvényes.',
      newPassword: 'Új jelszó',
      confirmPassword: 'Új jelszó megerősítése',
      savePassword: 'Új jelszó mentése',
      saving: 'Mentés…',
      backToLogin: 'Vissza a bejelentkezéshez',
      passwordsDoNotMatch: 'A két jelszó nem egyezik.',
      passwordRequirements: 'Legalább 8 karakter, legalább egy betű és egy szám szükséges.',
      invalidEmail: 'Érvénytelen e-mail-cím.',
      invalidLink: 'A jelszó-visszaállító hivatkozás érvénytelen vagy lejárt.',
      genericError: 'A jelszó-visszaállítás nem sikerült.',
      securityIntro: 'A jelszó-visszaállítás a központi OMI Studio-fiókot frissíti, ezért az új jelszó minden támogatott eszközön használható.',
      securityNote: 'Sikeres jelszócsere után a korábbi bejelentkezések biztonsági okból megszűnnek.',
    };
  }

  if (locale === 'de') {
    return {
      forgotTitle: 'Passwort vergessen?',
      forgotDescription: 'Geben Sie die E-Mail-Adresse Ihres Studio-Kontos ein. Wenn ein Konto existiert, senden wir einen Link zum Zurücksetzen des Passworts.',
      resetTitle: 'Neues Passwort festlegen',
      resetDescription: 'Legen Sie ein neues Passwort für Ihr OMI-Studio-Konto fest.',
      email: 'E-Mail-Adresse',
      sendLink: 'Link zum Zurücksetzen senden',
      sending: 'Wird gesendet…',
      sentTitle: 'Prüfen Sie Ihr Postfach',
      sentDescription: 'Wenn zu dieser E-Mail-Adresse ein aktives Studio-Konto gehört, wurde ein Link zum Zurücksetzen gesendet. Der Link ist nur einmal und für begrenzte Zeit gültig.',
      newPassword: 'Neues Passwort',
      confirmPassword: 'Neues Passwort bestätigen',
      savePassword: 'Neues Passwort speichern',
      saving: 'Wird gespeichert…',
      backToLogin: 'Zurück zur Anmeldung',
      passwordsDoNotMatch: 'Die beiden Passwörter stimmen nicht überein.',
      passwordRequirements: 'Mindestens 8 Zeichen, mindestens ein Buchstabe und eine Zahl.',
      invalidEmail: 'Ungültige E-Mail-Adresse.',
      invalidLink: 'Der Link zum Zurücksetzen ist ungültig oder abgelaufen.',
      genericError: 'Das Passwort konnte nicht zurückgesetzt werden.',
      securityIntro: 'Die Passwortzurücksetzung aktualisiert Ihr zentrales OMI-Studio-Konto; das neue Passwort gilt daher auf allen unterstützten Geräten.',
      securityNote: 'Nach einer erfolgreichen Passwortänderung werden frühere Sitzungen aus Sicherheitsgründen beendet.',
    };
  }

  return {
    forgotTitle: 'Forgot your password?',
    forgotDescription: 'Enter the e-mail address used for your Studio account. If an account exists, we will send a password-reset link.',
    resetTitle: 'Choose a new password',
    resetDescription: 'Set a new password for your OMI Studio account.',
    email: 'E-mail address',
    sendLink: 'Send reset link',
    sending: 'Sending…',
    sentTitle: 'Check your inbox',
    sentDescription: 'If an active Studio account exists for that e-mail address, we sent a password-reset link. The link is single-use and expires after a limited time.',
    newPassword: 'New password',
    confirmPassword: 'Confirm new password',
    savePassword: 'Save new password',
    saving: 'Saving…',
    backToLogin: 'Back to sign in',
    passwordsDoNotMatch: 'The passwords do not match.',
    passwordRequirements: 'Use at least 8 characters with at least one letter and one number.',
    invalidEmail: 'Invalid e-mail address.',
    invalidLink: 'The password-reset link is invalid or has expired.',
    genericError: 'The password could not be reset.',
    securityIntro: 'Password recovery updates your central OMI Studio account, so the new password works across supported devices.',
    securityNote: 'After a successful password change, previous sessions are closed for security.',
  };
}
