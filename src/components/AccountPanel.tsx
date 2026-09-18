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
import { getAccountPanelCopy } from '../i18n/accountPanelTranslations';
import { getCentralAdminContext, type CentralAdminRole } from '../services/centralAdminApi';
import { getCurrentUser, useAuthStore } from '../store/authStore';
import { AccountDeletionSection } from './AccountDeletionSection';
import {
  deletePersonalOjsCredential,
  deletePersonalOmpCredential,
  getPersonalOjsCredential,
  getPersonalOmpCredential,
  savePersonalOjsCredential,
  savePersonalOmpCredential,
} from '../services/authApi';
import { CentralAdministrationSettings } from './CentralAdministrationSettings';
import { InstitutionalProfilesSettings } from './InstitutionalProfilesSettings';
import { LinkedIdentitiesSettings } from './LinkedIdentitiesSettings';
import '../styles/account.css';

type AccountFormState = {
  fullName: string;
  orcid: string;
  bio: string;
  timeZone: string;
};

type ProfileView = 'personal' | 'institutional' | 'central';

export function AccountPanel() {
  const { locale } = useTranslation();
  const labels = getAccountPanelCopy(locale);
  const ompLabels =
    locale === 'hu'
      ? {
          title: 'OMP-szerkesztői API-kulcs',
          description:
            'A kulcs a különálló személyes profiladatbázisban titkosítva tárolódik, és soha nem jelenítjük meg.',
          baseUrl: 'OMP-telepítés URL-je',
          apiKey: 'Szerkesztői OMP API-kulcs',
          configured: 'Személyes OMP-kulcs beállítva.',
          saved: 'Az OMP-kulcs mentve.',
          save: 'OMP-kulcs mentése',
          remove: 'Mentett OMP-kulcs törlése',
        }
      : {
          title: 'OMP editor API key',
          description:
            'The key is encrypted in your separate personal profile database and is never displayed again.',
          baseUrl: 'OMP installation URL',
          apiKey: 'OMP editor API key',
          configured: 'Personal OMP key configured.',
          saved: 'OMP key saved.',
          save: 'Save OMP key',
          remove: 'Remove saved OMP key',
        };
  const user = useAuthStore(getCurrentUser);
  const update = useAuthStore((state) => state.updateCurrentUser);
  const logout = useAuthStore((state) => state.logout);
  const loading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);
  const [profileView, setProfileView] = useState<ProfileView>('personal');
  const [centralRole, setCentralRole] = useState<CentralAdminRole | null>(null);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState<AccountFormState>({
    fullName: '',
    orcid: '',
    bio: '',
    timeZone: getSystemTimeZone(),
  });
  const [ojsCredential, setOjsCredential] = useState({ apiKey: '', baseUrl: '' });
  const [ojsConfigured, setOjsConfigured] = useState(false);
  const [ojsSaved, setOjsSaved] = useState(false);
  const [ompCredential, setOmpCredential] = useState({ apiKey: '', baseUrl: '' });
  const [ompConfigured, setOmpConfigured] = useState(false);
  const [ompSaved, setOmpSaved] = useState(false);
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
    void getCentralAdminContext()
      .then((context) => setCentralRole(context.centralAdmin ? context.role : null))
      .catch(() => setCentralRole(null));
    void getPersonalOjsCredential().then((state) => { setOjsConfigured(state.configured); setOjsCredential((current) => ({ ...current, baseUrl: state.baseUrl ?? '' })); }).catch(() => undefined);
    void getPersonalOmpCredential()
      .then((state) => {
        setOmpConfigured(state.configured);
        setOmpCredential((current) => ({
          ...current,
          baseUrl: state.baseUrl ?? '',
        }));
      })
      .catch(() => undefined);
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
        {centralRole ? (
          <button
            type="button"
            role="tab"
            aria-selected={profileView === 'central'}
            className={profileView === 'central' ? 'account-profile-tab account-profile-tab--active' : 'account-profile-tab'}
            onClick={() => setProfileView('central')}
          >
            <ShieldCheck size={17} aria-hidden="true" />
            {labels.central}
          </button>
        ) : null}
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
              <section className="account-ojs-credential" aria-labelledby="account-ojs-credential-title">
                <h2 id="account-ojs-credential-title">{labels.ojsCredentialTitle ?? 'OJS editor API key'}</h2>
                <p>{labels.ojsCredentialDescription ?? 'The key is encrypted in your separate personal profile.'}</p>
                <label>{labels.ojsBaseUrl ?? 'OJS installation URL'}<input type="url" value={ojsCredential.baseUrl} onChange={(event) => setOjsCredential({ ...ojsCredential, baseUrl: event.target.value })} placeholder="https://journal.example.org/ojs" /></label>
                <label>{labels.ojsApiKey ?? 'OJS editor API key'}<input type="password" autoComplete="new-password" value={ojsCredential.apiKey} onChange={(event) => { setOjsSaved(false); setOjsCredential({ ...ojsCredential, apiKey: event.target.value }); }} placeholder={ojsConfigured ? '••••••••••••' : ''} /></label>
                {ojsConfigured && !ojsCredential.apiKey ? <small>{labels.ojsApiKeyConfigured ?? 'Personal OJS key configured.'}</small> : null}
                {ojsSaved ? <div className="account-success" role="status">{labels.ojsApiKeySaved ?? 'OJS key saved.'}</div> : null}
                <div className="account-actions">
                  <button className="account-primary" type="button" disabled={loading || !ojsCredential.apiKey.trim() || !ojsCredential.baseUrl.trim()} onClick={() => void savePersonalOjsCredential(ojsCredential).then((state) => { setOjsConfigured(state.configured); setOjsCredential({ apiKey: '', baseUrl: state.baseUrl ?? ojsCredential.baseUrl }); setOjsSaved(true); })}>{labels.ojsApiKeySave ?? 'Save OJS key'}</button>
                  {ojsConfigured ? <button type="button" onClick={() => void deletePersonalOjsCredential().then(() => { setOjsConfigured(false); setOjsCredential({ apiKey: '', baseUrl: '' }); setOjsSaved(false); })}>{labels.ojsApiKeyRemove ?? 'Remove saved OJS key'}</button> : null}
                </div>
              </section>
              <section className="account-ojs-credential" aria-labelledby="account-omp-credential-title">
                <h2 id="account-omp-credential-title">{ompLabels.title}</h2>
                <p>{ompLabels.description}</p>
                <label>
                  {ompLabels.baseUrl}
                  <input
                    type="url"
                    value={ompCredential.baseUrl}
                    onChange={(event) =>
                      setOmpCredential({
                        ...ompCredential,
                        baseUrl: event.target.value,
                      })
                    }
                    placeholder="https://press.example.org/omp"
                  />
                </label>
                <label>
                  {ompLabels.apiKey}
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={ompCredential.apiKey}
                    onChange={(event) => {
                      setOmpSaved(false);
                      setOmpCredential({
                        ...ompCredential,
                        apiKey: event.target.value,
                      });
                    }}
                    placeholder={ompConfigured ? '••••••••••••' : ''}
                  />
                </label>
                {ompConfigured && !ompCredential.apiKey ? (
                  <small>{ompLabels.configured}</small>
                ) : null}
                {ompSaved ? (
                  <div className="account-success" role="status">
                    {ompLabels.saved}
                  </div>
                ) : null}
                <div className="account-actions">
                  <button
                    className="account-primary"
                    type="button"
                    disabled={
                      loading ||
                      !ompCredential.apiKey.trim() ||
                      !ompCredential.baseUrl.trim()
                    }
                    onClick={() =>
                      void savePersonalOmpCredential(ompCredential).then(
                        (state) => {
                          setOmpConfigured(state.configured);
                          setOmpCredential({
                            apiKey: '',
                            baseUrl: state.baseUrl ?? ompCredential.baseUrl,
                          });
                          setOmpSaved(true);
                        },
                      )
                    }
                  >
                    {ompLabels.save}
                  </button>
                  {ompConfigured ? (
                    <button
                      type="button"
                      onClick={() =>
                        void deletePersonalOmpCredential().then(() => {
                          setOmpConfigured(false);
                          setOmpCredential({ apiKey: '', baseUrl: '' });
                          setOmpSaved(false);
                        })
                      }
                    >
                      {ompLabels.remove}
                    </button>
                  ) : null}
                </div>
              </section>
            </form>
          ) : profileView === 'institutional' ? (
            <div className="account-card">
              <InstitutionalProfilesSettings locale={locale} />
            </div>
          ) : centralRole ? (
            <div className="account-card account-card--central-admin">
              <CentralAdministrationSettings locale={locale} role={centralRole} />
            </div>
          ) : null}
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

          <AccountDeletionSection email={user.email} />
        </aside>
      </div>
    </section>
  );
}
