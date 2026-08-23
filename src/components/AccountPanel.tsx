import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Building2,
  LogOut,
  Save,
  ShieldCheck,
  UserRound,
} from 'lucide-react';

import { getSystemTimeZone, getTimeZoneOptions } from '../account/timeZones';
import { useTranslation } from '../i18n';
import { getCurrentUser, useAuthStore } from '../store/authStore';
import { InstitutionalProfilesSettings } from './InstitutionalProfilesSettings';
import { LinkedIdentitiesSettings } from './LinkedIdentitiesSettings';
import '../styles/account.css';

const copy = {
  en: {
    title: 'Account',
    subtitle: 'Personal identity, institutional roles and sign-in methods',
    personal: 'Personal profile',
    institutional: 'Institutional profiles',
    personalDescription: 'Your durable scholarly identity. Organization-specific affiliations are managed separately.',
    name: 'Full name',
    orcid: 'ORCID iD',
    bio: 'Short biography',
    preferences: 'Personal preferences',
    timezone: 'Time zone',
    timezoneHint: 'Standard IANA time-zone identifier; the current UTC offset is shown for reference.',
    identity: 'Account identity',
    verified: 'Verified e-mail',
    unverified: 'E-mail not verified',
    save: 'Save personal profile',
    saved: 'Personal profile saved.',
    logout: 'Sign out',
  },
  hu: {
    title: 'Fiók',
    subtitle: 'Személyes identitás, intézményi szerepek és bejelentkezési módok',
    personal: 'Személyes profil',
    institutional: 'Intézményi profilok',
    personalDescription: 'A tartós személyes tudományos identitásod. Az intézményi affiliációk külön kezelhetők.',
    name: 'Teljes név',
    orcid: 'ORCID iD',
    bio: 'Rövid bemutatkozás',
    preferences: 'Személyes beállítások',
    timezone: 'Időzóna',
    timezoneHint: 'Szabványos IANA-időzóna; tájékoztatásként az aktuális UTC-eltolás is látható.',
    identity: 'Fiókazonosság',
    verified: 'Ellenőrzött e-mail-cím',
    unverified: 'Nem ellenőrzött e-mail-cím',
    save: 'Személyes profil mentése',
    saved: 'A személyes profil elmentve.',
    logout: 'Kijelentkezés',
  },
  de: {
    title: 'Konto',
    subtitle: 'Persönliche Identität, institutionelle Rollen und Anmeldemethoden',
    personal: 'Persönliches Profil',
    institutional: 'Institutionelle Profile',
    personalDescription: 'Ihre dauerhafte wissenschaftliche Identität. Organisationsbezogene Zugehörigkeiten werden separat verwaltet.',
    name: 'Vollständiger Name',
    orcid: 'ORCID iD',
    bio: 'Kurzbiografie',
    preferences: 'Persönliche Einstellungen',
    timezone: 'Zeitzone',
    timezoneHint: 'Standardisierte IANA-Zeitzone; der aktuelle UTC-Versatz wird zur Orientierung angezeigt.',
    identity: 'Kontoidentität',
    verified: 'Bestätigte E-Mail-Adresse',
    unverified: 'E-Mail-Adresse nicht bestätigt',
    save: 'Persönliches Profil speichern',
    saved: 'Persönliches Profil gespeichert.',
    logout: 'Abmelden',
  },
} as const;

type AccountFormState = {
  fullName: string;
  orcid: string;
  bio: string;
  timeZone: string;
};

type ProfileView = 'personal' | 'institutional';

export function AccountPanel() {
  const { locale } = useTranslation();
  const labels = copy[locale] ?? copy.en;
  const user = useAuthStore(getCurrentUser);
  const update = useAuthStore((state) => state.updateCurrentUser);
  const logout = useAuthStore((state) => state.logout);
  const loading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);
  const [profileView, setProfileView] = useState<ProfileView>('personal');
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState<AccountFormState>({
    fullName: '',
    orcid: '',
    bio: '',
    timeZone: getSystemTimeZone(),
  });
  const timeZoneOptions = useMemo(
    () => getTimeZoneOptions(form.timeZone),
    [form.timeZone],
  );

  useEffect(() => {
    if (!user) return;
    setForm({
      fullName: user.profile.fullName ?? '',
      orcid: user.profile.orcid ?? '',
      bio: user.profile.bio ?? '',
      timeZone: user.preferences.timeZone || getSystemTimeZone(),
    });
  }, [user]);

  if (!user) return null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaved(false);
    await update({
      fullName: form.fullName,
      orcid: form.orcid || undefined,
      bio: form.bio || undefined,
      timeZone: form.timeZone || undefined,
    });
    setSaved(true);
  };

  return (
    <section className="account-page">
      <header className="account-heading">
        <div className="account-avatar">
          <UserRound size={30} aria-hidden="true" />
        </div>
        <div>
          <h1>{labels.title}</h1>
          <p>{labels.subtitle}</p>
        </div>
      </header>

      <div className="account-profile-switch" role="tablist" aria-label={labels.title}>
        <button
          type="button"
          role="tab"
          aria-selected={profileView === 'personal'}
          className={profileView === 'personal' ? 'account-profile-tab account-profile-tab--active' : 'account-profile-tab'}
          onClick={() => setProfileView('personal')}
        >
          <UserRound size={17} aria-hidden="true" />
          {labels.personal}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={profileView === 'institutional'}
          className={profileView === 'institutional' ? 'account-profile-tab account-profile-tab--active' : 'account-profile-tab'}
          onClick={() => setProfileView('institutional')}
        >
          <Building2 size={17} aria-hidden="true" />
          {labels.institutional}
        </button>
      </div>

      <div className="account-grid">
        <div className="account-profile-column">
          {profileView === 'personal' ? (
            <form
              className="account-card account-form"
              onSubmit={(event) => void submit(event)}
            >
              <div className="account-section-heading account-section-heading--form">
                <div>
                  <h2>{labels.personal}</h2>
                  <p>{labels.personalDescription}</p>
                </div>
              </div>

              <label>
                {labels.name}
                <input
                  value={form.fullName}
                  onChange={(event) => setForm({ ...form, fullName: event.target.value })}
                  required
                />
              </label>

              <label>
                {labels.orcid}
                <input
                  value={form.orcid}
                  onChange={(event) => setForm({ ...form, orcid: event.target.value })}
                  placeholder="0000-0000-0000-0000"
                />
              </label>

              <label>
                {labels.bio}
                <textarea
                  rows={4}
                  value={form.bio}
                  onChange={(event) => setForm({ ...form, bio: event.target.value })}
                />
              </label>

              <h2>{labels.preferences}</h2>
              <label>
                {labels.timezone}
                <select
                  value={form.timeZone}
                  onChange={(event) => setForm({ ...form, timeZone: event.target.value })}
                >
                  {timeZoneOptions.map((option) => (
                    <option value={option.id} key={option.id}>{option.label}</option>
                  ))}
                </select>
                <small className="account-field-hint">{labels.timezoneHint}</small>
              </label>

              {error ? <div className="account-error" role="alert">{error}</div> : null}
              {saved ? <div className="account-success" role="status">{labels.saved}</div> : null}

              <button className="account-primary" type="submit" disabled={loading}>
                <Save size={17} aria-hidden="true" />
                {labels.save}
              </button>
            </form>
          ) : (
            <div className="account-card">
              <InstitutionalProfilesSettings locale={locale} />
            </div>
          )}
        </div>

        <aside className="account-card account-identity">
          <h2>{labels.identity}</h2>
          <div className="account-email">
            <strong>{user.email}</strong>
            <span>
              {user.emailVerified ? (
                <BadgeCheck size={17} aria-hidden="true" />
              ) : (
                <ShieldCheck size={17} aria-hidden="true" />
              )}
              {user.emailVerified ? labels.verified : labels.unverified}
            </span>
          </div>

          <LinkedIdentitiesSettings locale={locale} email={user.email} />

          <button
            type="button"
            className="account-logout"
            onClick={() => void logout()}
            disabled={loading}
          >
            <LogOut size={17} aria-hidden="true" />
            {labels.logout}
          </button>
        </aside>
      </div>
    </section>
  );
}
