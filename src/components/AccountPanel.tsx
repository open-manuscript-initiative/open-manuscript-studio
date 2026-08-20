import { FormEvent, useEffect, useState } from 'react';
import { BadgeCheck, LogOut, Save, ShieldCheck, UserRound } from 'lucide-react';

import { useTranslation } from '../i18n';
import { getCurrentUser, useAuthStore } from '../store/authStore';

const copy = {
  en: { title: 'Account', subtitle: 'Profile and scholarly identity', profile: 'Profile', name: 'Full name', affiliation: 'Affiliation', orcid: 'ORCID iD', bio: 'Short biography', preferences: 'Preferences', language: 'Interface language', timezone: 'Time zone', identity: 'Account identity', verified: 'Verified e-mail', unverified: 'E-mail not verified', connected: 'Connected identities', save: 'Save changes', saved: 'Changes saved.', logout: 'Sign out' },
  hu: { title: 'Fiók', subtitle: 'Profil és tudományos identitás', profile: 'Profil', name: 'Teljes név', affiliation: 'Intézményi affiliáció', orcid: 'ORCID iD', bio: 'Rövid bemutatkozás', preferences: 'Beállítások', language: 'Felület nyelve', timezone: 'Időzóna', identity: 'Fiókazonosság', verified: 'Ellenőrzött e-mail-cím', unverified: 'Nem ellenőrzött e-mail-cím', connected: 'Kapcsolt azonosítók', save: 'Módosítások mentése', saved: 'Módosítások elmentve.', logout: 'Kijelentkezés' },
  de: { title: 'Konto', subtitle: 'Profil und wissenschaftliche Identität', profile: 'Profil', name: 'Vollständiger Name', affiliation: 'Institutionelle Zugehörigkeit', orcid: 'ORCID iD', bio: 'Kurzbiografie', preferences: 'Einstellungen', language: 'Oberflächensprache', timezone: 'Zeitzone', identity: 'Kontoidentität', verified: 'Bestätigte E-Mail-Adresse', unverified: 'E-Mail-Adresse nicht bestätigt', connected: 'Verknüpfte Identitäten', save: 'Änderungen speichern', saved: 'Änderungen gespeichert.', logout: 'Abmelden' },
} as const;

export function AccountPanel() {
  const { locale } = useTranslation();
  const labels = copy[locale as keyof typeof copy] ?? copy.en;
  const user = useAuthStore(getCurrentUser);
  const updateCurrentUser = useAuthStore((state) => state.updateCurrentUser);
  const logout = useAuthStore((state) => state.logout);
  const loading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({ fullName: '', affiliation: '', orcid: '', bio: '', interfaceLanguage: locale, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' });

  useEffect(() => {
    if (!user) return;
    setForm({
      fullName: user.profile.fullName ?? '',
      affiliation: user.profile.affiliation ?? '',
      orcid: user.profile.orcid ?? '',
      bio: user.profile.bio ?? '',
      interfaceLanguage: user.preferences.interfaceLanguage || locale,
      timeZone: user.preferences.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    });
  }, [user, locale]);

  if (!user) return null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaved(false);
    await updateCurrentUser({
      fullName: form.fullName,
      affiliation: form.affiliation || undefined,
      orcid: form.orcid || undefined,
      bio: form.bio || undefined,
      interfaceLanguage: form.interfaceLanguage,
      timeZone: form.timeZone || undefined,
    });
    setSaved(true);
  };

  return (
    <section className="account-page">
      <header className="account-heading">
        <div className="account-avatar"><UserRound size={30} aria-hidden="true" /></div>
        <div><h1>{labels.title}</h1><p>{labels.subtitle}</p></div>
      </header>

      <div className="account-grid">
        <form className="account-card account-form" onSubmit={(event) => void submit(event)}>
          <h2>{labels.profile}</h2>
          <label>{labels.name}<input value={form.fullName} onChange={(e) => setForm({...form, fullName: e.target.value})} required /></label>
          <label>{labels.affiliation}<input value={form.affiliation} onChange={(e) => setForm({...form, affiliation: e.target.value})} /></label>
          <label>{labels.orcid}<input value={form.orcid} onChange={(e) => setForm({...form, orcid: e.target.value})} placeholder="0000-0000-0000-0000" /></label>
          <label>{labels.bio}<textarea rows={4} value={form.bio} onChange={(e) => setForm({...form, bio: e.target.value})} /></label>

          <h2>{labels.preferences}</h2>
          <div className="account-form-row">
            <label>{labels.language}<select value={form.interfaceLanguage} onChange={(e) => setForm({...form, interfaceLanguage: e.target.value})}><option value="hu">Magyar</option><option value="en">English</option><option value="de">Deutsch</option></select></label>
            <label>{labels.timezone}<input value={form.timeZone} onChange={(e) => setForm({...form, timeZone: e.target.value})} /></label>
          </div>
          {error ? <div className="account-error" role="alert">{error}</div> : null}
          {saved ? <div className="account-success" role="status">{labels.saved}</div> : null}
          <button className="account-primary" type="submit" disabled={loading}><Save size={17} />{labels.save}</button>
        </form>

        <aside className="account-card account-identity">
          <h2>{labels.identity}</h2>
          <div className="account-email"><strong>{user.email}</strong><span>{user.emailVerified ? <BadgeCheck size={17} /> : <ShieldCheck size={17} />}{user.emailVerified ? labels.verified : labels.unverified}</span></div>
          <div className="account-identities"><h3>{labels.connected}</h3>{user.identities.length ? user.identities.map((identity) => <div className="account-identity-row" key={`${identity.provider}:${identity.providerUserId}`}><strong>{identity.provider === 'orcid' ? 'ORCID' : identity.provider}</strong><span>{identity.displayName || identity.providerUserId}</span></div>) : <span>—</span>}</div>
          <button type="button" className="account-logout" onClick={() => void logout()} disabled={loading}><LogOut size={17} />{labels.logout}</button>
        </aside>
      </div>
    </section>
  );
}
