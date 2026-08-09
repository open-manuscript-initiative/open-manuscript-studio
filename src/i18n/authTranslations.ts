import type { SupportedLocale } from './types';

export type AuthTranslationKey =
  | 'auth.brand.name'
  | 'auth.brand.description'
  | 'auth.login.title'
  | 'auth.login.description'
  | 'auth.login.submit'
  | 'auth.login.submitting'
  | 'auth.login.noAccount'
  | 'auth.login.registerLink'
  | 'auth.logout'
  | 'auth.register.title'
  | 'auth.register.description'
  | 'auth.register.submit'
  | 'auth.register.submitting'
  | 'auth.register.hasAccount'
  | 'auth.register.loginLink'
  | 'auth.fields.fullName.label'
  | 'auth.fields.fullName.placeholder'
  | 'auth.fields.email.label'
  | 'auth.fields.email.placeholder'
  | 'auth.fields.affiliation.label'
  | 'auth.fields.affiliation.placeholder'
  | 'auth.fields.orcid.label'
  | 'auth.fields.orcid.placeholder'
  | 'auth.fields.orcid.hint'
  | 'auth.fields.password.label'
  | 'auth.fields.password.placeholder'
  | 'auth.fields.password.hint'
  | 'auth.fields.passwordConfirmation.label'
  | 'auth.fields.passwordConfirmation.placeholder'
  | 'auth.errors.invalidEmail'
  | 'auth.errors.invalidCredentials'
  | 'auth.errors.userNotFound'
  | 'auth.errors.accountNotActive'
  | 'auth.errors.authenticationRequired'
  | 'auth.errors.passwordsDoNotMatch'
  | 'auth.errors.emailAlreadyExists'
  | 'auth.errors.passwordTooShort'
  | 'auth.errors.passwordNeedsLetter'
  | 'auth.errors.passwordNeedsNumber'
  | 'auth.errors.fullNameRequired'
  | 'auth.errors.invalidOrcid'
  | 'auth.alphaNotice';

type AuthTranslations = Record<AuthTranslationKey, string>;

export const authTranslations: Record<SupportedLocale, AuthTranslations> = {
  en: {
    'auth.brand.name': 'Open Manuscript Studio',
    'auth.brand.description': 'Collaborative scholarly writing',
    'auth.login.title': 'Sign in',
    'auth.login.description': 'Please sign in to continue.',
    'auth.login.submit': 'Sign in',
    'auth.login.submitting': 'Signing in…',
    'auth.login.noAccount': 'Do not have an account yet?',
    'auth.login.registerLink': 'Register',
    'auth.logout': 'Sign out',
    'auth.register.title': 'Create account',
    'auth.register.description': 'Create your Open Manuscript Studio account.',
    'auth.register.submit': 'Create account',
    'auth.register.submitting': 'Creating account…',
    'auth.register.hasAccount': 'Already have an account?',
    'auth.register.loginLink': 'Sign in',
    'auth.fields.fullName.label': 'Full name',
    'auth.fields.fullName.placeholder': 'Your full name',
    'auth.fields.email.label': 'Email address',
    'auth.fields.email.placeholder': 'name@example.com',
    'auth.fields.affiliation.label': 'Affiliation',
    'auth.fields.affiliation.placeholder': 'University, institute or organization',
    'auth.fields.orcid.label': 'ORCID',
    'auth.fields.orcid.placeholder': '0000-0000-0000-0000',
    'auth.fields.orcid.hint': 'Optional. Enter your 16-digit ORCID identifier.',
    'auth.fields.password.label': 'Password',
    'auth.fields.password.placeholder': 'Enter your password',
    'auth.fields.password.hint': 'Use at least 8 characters, including a letter and a number.',
    'auth.fields.passwordConfirmation.label': 'Confirm password',
    'auth.fields.passwordConfirmation.placeholder': 'Enter the password again',
    'auth.errors.invalidEmail': 'Invalid email address.',
    'auth.errors.invalidCredentials': 'Incorrect email address or password.',
    'auth.errors.userNotFound': 'The user account could not be found.',
    'auth.errors.accountNotActive': 'The user account is not active.',
    'auth.errors.authenticationRequired': 'Authentication is required.',
    'auth.errors.passwordsDoNotMatch': 'The passwords do not match.',
    'auth.errors.emailAlreadyExists': 'An account already exists with this email address.',
    'auth.errors.passwordTooShort': 'The password must contain at least 8 characters.',
    'auth.errors.passwordNeedsLetter': 'The password must contain at least one letter.',
    'auth.errors.passwordNeedsNumber': 'The password must contain at least one number.',
    'auth.errors.fullNameRequired': 'The full name is required.',
    'auth.errors.invalidOrcid': 'Invalid ORCID identifier.',
    'auth.alphaNotice': 'Alpha version – authentication is currently for testing purposes.'
  },
  hu: {
    'auth.brand.name': 'Open Manuscript Studio',
    'auth.brand.description': 'Együttműködésre épülő tudományos kéziratszerkesztő',
    'auth.login.title': 'Bejelentkezés',
    'auth.login.description': 'A folytatáshoz jelentkezzen be.',
    'auth.login.submit': 'Bejelentkezés',
    'auth.login.submitting': 'Bejelentkezés…',
    'auth.login.noAccount': 'Még nincs fiókja?',
    'auth.login.registerLink': 'Regisztráció',
    'auth.logout': 'Kijelentkezés',
    'auth.register.title': 'Fiók létrehozása',
    'auth.register.description': 'Hozza létre Open Manuscript Studio-fiókját.',
    'auth.register.submit': 'Fiók létrehozása',
    'auth.register.submitting': 'Fiók létrehozása…',
    'auth.register.hasAccount': 'Már van fiókja?',
    'auth.register.loginLink': 'Bejelentkezés',
    'auth.fields.fullName.label': 'Teljes név',
    'auth.fields.fullName.placeholder': 'Adja meg a teljes nevét',
    'auth.fields.email.label': 'E-mail-cím',
    'auth.fields.email.placeholder': 'nev@pelda.hu',
    'auth.fields.affiliation.label': 'Intézményi kapcsolat',
    'auth.fields.affiliation.placeholder': 'Egyetem, kutatóintézet vagy más szervezet',
    'auth.fields.orcid.label': 'ORCID',
    'auth.fields.orcid.placeholder': '0000-0000-0000-0000',
    'auth.fields.orcid.hint': 'Nem kötelező. Adja meg 16 jegyű ORCID-azonosítóját.',
    'auth.fields.password.label': 'Jelszó',
    'auth.fields.password.placeholder': 'Adja meg a jelszavát',
    'auth.fields.password.hint': 'Legalább 8 karaktert használjon, köztük legalább egy betűt és egy számot.',
    'auth.fields.passwordConfirmation.label': 'Jelszó megerősítése',
    'auth.fields.passwordConfirmation.placeholder': 'Adja meg újra a jelszavát',
    'auth.errors.invalidEmail': 'Érvénytelen e-mail-cím.',
    'auth.errors.invalidCredentials': 'Helytelen e-mail-cím vagy jelszó.',
    'auth.errors.userNotFound': 'A felhasználói fiók nem található.',
    'auth.errors.accountNotActive': 'A felhasználói fiók nem aktív.',
    'auth.errors.authenticationRequired': 'A művelethez bejelentkezés szükséges.',
    'auth.errors.passwordsDoNotMatch': 'A két jelszó nem egyezik.',
    'auth.errors.emailAlreadyExists': 'Ezzel az e-mail-címmel már létezik fiók.',
    'auth.errors.passwordTooShort': 'A jelszónak legalább 8 karakterből kell állnia.',
    'auth.errors.passwordNeedsLetter': 'A jelszónak legalább egy betűt kell tartalmaznia.',
    'auth.errors.passwordNeedsNumber': 'A jelszónak legalább egy számot kell tartalmaznia.',
    'auth.errors.fullNameRequired': 'A teljes név megadása kötelező.',
    'auth.errors.invalidOrcid': 'Érvénytelen ORCID-azonosító.',
    'auth.alphaNotice': 'Alfa verzió – a bejelentkezés jelenleg tesztelési célokat szolgál.'
  },
  de: {
    'auth.brand.name': 'Open Manuscript Studio',
    'auth.brand.description': 'Kollaboratives wissenschaftliches Schreiben',
    'auth.login.title': 'Anmelden',
    'auth.login.description': 'Melden Sie sich an, um fortzufahren.',
    'auth.login.submit': 'Anmelden',
    'auth.login.submitting': 'Anmeldung…',
    'auth.login.noAccount': 'Noch kein Konto?',
    'auth.login.registerLink': 'Registrieren',
    'auth.logout': 'Abmelden',
    'auth.register.title': 'Konto erstellen',
    'auth.register.description': 'Erstellen Sie Ihr Open-Manuscript-Studio-Konto.',
    'auth.register.submit': 'Konto erstellen',
    'auth.register.submitting': 'Konto wird erstellt…',
    'auth.register.hasAccount': 'Sie haben bereits ein Konto?',
    'auth.register.loginLink': 'Anmelden',
    'auth.fields.fullName.label': 'Vollständiger Name',
    'auth.fields.fullName.placeholder': 'Geben Sie Ihren vollständigen Namen ein',
    'auth.fields.email.label': 'E-Mail-Adresse',
    'auth.fields.email.placeholder': 'name@beispiel.de',
    'auth.fields.affiliation.label': 'Institution',
    'auth.fields.affiliation.placeholder': 'Universität, Institut oder Organisation',
    'auth.fields.orcid.label': 'ORCID',
    'auth.fields.orcid.placeholder': '0000-0000-0000-0000',
    'auth.fields.orcid.hint': 'Optional. Geben Sie Ihre 16-stellige ORCID-Kennung ein.',
    'auth.fields.password.label': 'Passwort',
    'auth.fields.password.placeholder': 'Passwort eingeben',
    'auth.fields.password.hint': 'Verwenden Sie mindestens 8 Zeichen, darunter einen Buchstaben und eine Zahl.',
    'auth.fields.passwordConfirmation.label': 'Passwort bestätigen',
    'auth.fields.passwordConfirmation.placeholder': 'Passwort erneut eingeben',
    'auth.errors.invalidEmail': 'Ungültige E-Mail-Adresse.',
    'auth.errors.invalidCredentials': 'E-Mail-Adresse oder Passwort ist falsch.',
    'auth.errors.userNotFound': 'Das Benutzerkonto wurde nicht gefunden.',
    'auth.errors.accountNotActive': 'Das Benutzerkonto ist nicht aktiv.',
    'auth.errors.authenticationRequired': 'Eine Anmeldung ist erforderlich.',
    'auth.errors.passwordsDoNotMatch': 'Die Passwörter stimmen nicht überein.',
    'auth.errors.emailAlreadyExists': 'Für diese E-Mail-Adresse besteht bereits ein Konto.',
    'auth.errors.passwordTooShort': 'Das Passwort muss mindestens 8 Zeichen enthalten.',
    'auth.errors.passwordNeedsLetter': 'Das Passwort muss mindestens einen Buchstaben enthalten.',
    'auth.errors.passwordNeedsNumber': 'Das Passwort muss mindestens eine Zahl enthalten.',
    'auth.errors.fullNameRequired': 'Der vollständige Name ist erforderlich.',
    'auth.errors.invalidOrcid': 'Ungültige ORCID-Kennung.',
    'auth.alphaNotice': 'Alpha-Version – die Anmeldung dient derzeit Testzwecken.'
  }
};
