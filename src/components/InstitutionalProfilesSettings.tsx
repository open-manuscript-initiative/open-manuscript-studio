import {
  BadgeCheck,
  Building2,
  Check,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

import type { InstitutionalProfile, InstitutionalProfileInput } from '../model/user';
import {
  createInstitutionalProfile,
  deleteInstitutionalProfile,
  getInstitutionalProfiles,
  setDefaultInstitutionalProfile,
  updateInstitutionalProfile,
} from '../services/institutionalProfileApi';
import {
  getLinkedIdentitySettings,
  type LinkedIdentityRecord,
} from '../services/linkedIdentityApi';

interface InstitutionalProfilesSettingsProps {
  locale: string;
}

type FormState = {
  organizationName: string;
  rorId: string;
  department: string;
  positionTitle: string;
  institutionalEmail: string;
  identityId: string;
  isDefault: boolean;
};

const EMPTY_FORM: FormState = {
  organizationName: '',
  rorId: '',
  department: '',
  positionTitle: '',
  institutionalEmail: '',
  identityId: '',
  isDefault: false,
};

const copy = {
  en: {
    title: 'Institutional profiles',
    description: 'Keep organization-specific affiliations separate from your personal scholarly profile. You can maintain more than one institution and choose a default.',
    add: 'Add institution',
    edit: 'Edit',
    cancel: 'Cancel',
    save: 'Save institution',
    create: 'Add institutional profile',
    organization: 'Institution / organization',
    ror: 'ROR identifier',
    rorHint: 'Optional. Example: https://ror.org/03yrm5c26',
    department: 'Department / unit',
    position: 'Position / role',
    email: 'Institutional e-mail',
    identity: 'Institutional sign-in identity',
    noIdentity: 'No connected institutional identity',
    identityHint: 'Optional. Connect Google, Microsoft, institutional OIDC or SAML under Connected identities first.',
    default: 'Default institution',
    makeDefault: 'Make default',
    defaultHint: 'The default institution is used as the compatibility affiliation for existing Studio workflows.',
    linkedIdentity: 'Connected identity',
    noProfiles: 'No institutional profile has been added yet.',
    delete: 'Delete',
    confirmDelete: 'Delete this institutional profile? The connected identity itself will not be removed.',
    loading: 'Loading institutional profiles…',
    saved: 'Institutional profile saved.',
    deleted: 'Institutional profile deleted.',
    error: 'Institutional profiles could not be loaded.',
    unverified: 'Institutional e-mail not verified',
  },
  hu: {
    title: 'Intézményi profilok',
    description: 'Az intézményi affiliációk külön kezelhetők a személyes tudományos profiltól. Több intézmény is megadható, és kijelölhető egy alapértelmezett.',
    add: 'Intézmény hozzáadása',
    edit: 'Szerkesztés',
    cancel: 'Mégse',
    save: 'Intézmény mentése',
    create: 'Intézményi profil hozzáadása',
    organization: 'Intézmény / szervezet',
    ror: 'ROR-azonosító',
    rorHint: 'Nem kötelező. Példa: https://ror.org/03yrm5c26',
    department: 'Tanszék / szervezeti egység',
    position: 'Beosztás / szerepkör',
    email: 'Intézményi e-mail-cím',
    identity: 'Intézményi bejelentkezési azonosító',
    noIdentity: 'Nincs kapcsolt intézményi azonosító',
    identityHint: 'Nem kötelező. Előbb a Kapcsolt azonosítók alatt kapcsolható Google-, Microsoft-, intézményi OIDC- vagy SAML-fiók.',
    default: 'Alapértelmezett intézmény',
    makeDefault: 'Legyen alapértelmezett',
    defaultHint: 'Az alapértelmezett intézményt használják a kompatibilitás miatt a korábbi Studio-munkafolyamatok.',
    linkedIdentity: 'Kapcsolt azonosító',
    noProfiles: 'Még nincs intézményi profil megadva.',
    delete: 'Törlés',
    confirmDelete: 'Törlöd ezt az intézményi profilt? A kapcsolt bejelentkezési azonosító nem törlődik.',
    loading: 'Intézményi profilok betöltése…',
    saved: 'Az intézményi profil elmentve.',
    deleted: 'Az intézményi profil törölve.',
    error: 'Az intézményi profilok nem tölthetők be.',
    unverified: 'Az intézményi e-mail-cím nincs ellenőrizve',
  },
  de: {
    title: 'Institutionelle Profile',
    description: 'Organisationsbezogene Zugehörigkeiten werden getrennt vom persönlichen wissenschaftlichen Profil verwaltet. Mehrere Institutionen und eine Standardinstitution sind möglich.',
    add: 'Institution hinzufügen',
    edit: 'Bearbeiten',
    cancel: 'Abbrechen',
    save: 'Institution speichern',
    create: 'Institutionelles Profil hinzufügen',
    organization: 'Institution / Organisation',
    ror: 'ROR-Kennung',
    rorHint: 'Optional. Beispiel: https://ror.org/03yrm5c26',
    department: 'Abteilung / Einheit',
    position: 'Position / Rolle',
    email: 'Institutionelle E-Mail-Adresse',
    identity: 'Institutionelle Anmeldeidentität',
    noIdentity: 'Keine verknüpfte institutionelle Identität',
    identityHint: 'Optional. Google, Microsoft, institutionelles OIDC oder SAML zuerst unter Verknüpfte Identitäten verbinden.',
    default: 'Standardinstitution',
    makeDefault: 'Als Standard festlegen',
    defaultHint: 'Die Standardinstitution wird für bestehende Studio-Abläufe als Kompatibilitäts-Zugehörigkeit verwendet.',
    linkedIdentity: 'Verknüpfte Identität',
    noProfiles: 'Noch kein institutionelles Profil vorhanden.',
    delete: 'Löschen',
    confirmDelete: 'Dieses institutionelle Profil löschen? Die verknüpfte Anmeldeidentität selbst bleibt erhalten.',
    loading: 'Institutionelle Profile werden geladen…',
    saved: 'Institutionelles Profil gespeichert.',
    deleted: 'Institutionelles Profil gelöscht.',
    error: 'Institutionelle Profile konnten nicht geladen werden.',
    unverified: 'Institutionelle E-Mail-Adresse nicht bestätigt',
  },
} as const;

export function InstitutionalProfilesSettings({ locale }: InstitutionalProfilesSettingsProps) {
  const labels = copy[locale as keyof typeof copy] ?? copy.en;
  const [profiles, setProfiles] = useState<InstitutionalProfile[] | null>(null);
  const [identities, setIdentities] = useState<LinkedIdentityRecord[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setError('');
    try {
      const [nextProfiles, identitySettings] = await Promise.all([
        getInstitutionalProfiles(),
        getLinkedIdentitySettings(),
      ]);
      setProfiles(nextProfiles);
      setIdentities(identitySettings.identities.filter((identity) => identity.provider !== 'ORCID'));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : labels.error);
    }
  }, [labels.error]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const identityOptions = useMemo(
    () => identities.map((identity) => ({
      id: identity.id,
      label: `${identity.label} · ${identity.displayName || identity.email || identity.subject}`,
    })),
    [identities],
  );

  function beginCreate(): void {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, isDefault: (profiles?.length ?? 0) === 0 });
    setMessage('');
    setError('');
    setShowForm(true);
  }

  function beginEdit(profile: InstitutionalProfile): void {
    setEditingId(profile.id);
    setForm({
      organizationName: profile.organizationName,
      rorId: profile.rorId ?? '',
      department: profile.department ?? '',
      positionTitle: profile.positionTitle ?? '',
      institutionalEmail: profile.institutionalEmail ?? '',
      identityId: profile.identityId ?? '',
      isDefault: profile.isDefault,
    });
    setMessage('');
    setError('');
    setShowForm(true);
  }

  function closeForm(): void {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(false);
  }

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    const input: InstitutionalProfileInput = {
      organizationName: form.organizationName.trim(),
      rorId: form.rorId.trim() || null,
      department: form.department.trim() || null,
      positionTitle: form.positionTitle.trim() || null,
      institutionalEmail: form.institutionalEmail.trim() || null,
      identityId: form.identityId || null,
      isDefault: form.isDefault,
    };
    try {
      if (editingId) {
        await updateInstitutionalProfile(editingId, input);
        if (form.isDefault) await setDefaultInstitutionalProfile(editingId);
      } else {
        await createInstitutionalProfile(input);
      }
      await refresh();
      closeForm();
      setMessage(labels.saved);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : labels.error);
    } finally {
      setBusy(false);
    }
  }

  async function makeDefault(profileId: string): Promise<void> {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await setDefaultInstitutionalProfile(profileId);
      await refresh();
      setMessage(labels.saved);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : labels.error);
    } finally {
      setBusy(false);
    }
  }

  async function remove(profile: InstitutionalProfile): Promise<void> {
    if (!window.confirm(labels.confirmDelete)) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await deleteInstitutionalProfile(profile.id);
      await refresh();
      if (editingId === profile.id) closeForm();
      setMessage(labels.deleted);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : labels.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="account-institutional-settings">
      <div className="account-section-heading">
        <div>
          <h2>{labels.title}</h2>
          <p>{labels.description}</p>
        </div>
        {!showForm ? (
          <button type="button" className="account-primary account-profile-add" onClick={beginCreate}>
            <Plus size={16} aria-hidden="true" /> {labels.add}
          </button>
        ) : null}
      </div>

      {profiles === null && !error ? <p className="account-identity-muted">{labels.loading}</p> : null}

      {profiles?.length ? (
        <div className="account-institution-list">
          {profiles.map((profile) => (
            <article className={`account-institution-card${profile.isDefault ? ' account-institution-card--default' : ''}`} key={profile.id}>
              <div className="account-institution-icon"><Building2 size={20} aria-hidden="true" /></div>
              <div className="account-institution-copy">
                <div className="account-institution-title-row">
                  <strong>{profile.organizationName}</strong>
                  {profile.isDefault ? <span className="account-default-badge"><Check size={13} aria-hidden="true" /> {labels.default}</span> : null}
                </div>
                {profile.department ? <span>{profile.department}</span> : null}
                {profile.positionTitle ? <span>{profile.positionTitle}</span> : null}
                {profile.rorId ? <small>ROR: {profile.rorId}</small> : null}
                {profile.institutionalEmail ? (
                  <small>
                    {profile.institutionalEmail}
                    {!profile.emailVerified ? ` · ${labels.unverified}` : ''}
                  </small>
                ) : null}
                {profile.identity ? (
                  <small className="account-institution-identity">
                    <BadgeCheck size={13} aria-hidden="true" /> {labels.linkedIdentity}: {profile.identity.displayName || profile.identity.subject}
                  </small>
                ) : null}
              </div>
              <div className="account-institution-actions">
                {!profile.isDefault ? (
                  <button type="button" className="account-identity-action" disabled={busy} onClick={() => void makeDefault(profile.id)}>
                    <Check size={14} aria-hidden="true" /> {labels.makeDefault}
                  </button>
                ) : null}
                <button type="button" className="account-identity-action" disabled={busy} onClick={() => beginEdit(profile)}>
                  <Pencil size={14} aria-hidden="true" /> {labels.edit}
                </button>
                <button type="button" className="account-identity-action account-identity-action--danger" disabled={busy} onClick={() => void remove(profile)}>
                  <Trash2 size={14} aria-hidden="true" /> {labels.delete}
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : profiles ? <p className="account-empty-profile">{labels.noProfiles}</p> : null}

      {showForm ? (
        <form className="account-institution-form" onSubmit={(event) => void submit(event)}>
          <div className="account-section-heading account-section-heading--compact">
            <h3>{editingId ? labels.edit : labels.create}</h3>
            <button type="button" className="account-identity-action" onClick={closeForm} disabled={busy}>
              <X size={14} aria-hidden="true" /> {labels.cancel}
            </button>
          </div>
          <div className="account-institution-fields">
            <label>
              {labels.organization}
              <input required maxLength={300} value={form.organizationName} onChange={(event) => setForm({ ...form, organizationName: event.target.value })} />
            </label>
            <label>
              {labels.ror}
              <input maxLength={128} placeholder="https://ror.org/…" value={form.rorId} onChange={(event) => setForm({ ...form, rorId: event.target.value })} />
              <small className="account-field-hint">{labels.rorHint}</small>
            </label>
            <label>
              {labels.department}
              <input maxLength={300} value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} />
            </label>
            <label>
              {labels.position}
              <input maxLength={200} value={form.positionTitle} onChange={(event) => setForm({ ...form, positionTitle: event.target.value })} />
            </label>
            <label>
              {labels.email}
              <input type="email" maxLength={320} value={form.institutionalEmail} onChange={(event) => setForm({ ...form, institutionalEmail: event.target.value })} />
            </label>
            <label>
              {labels.identity}
              <select value={form.identityId} onChange={(event) => setForm({ ...form, identityId: event.target.value })}>
                <option value="">{labels.noIdentity}</option>
                {identityOptions.map((identity) => <option value={identity.id} key={identity.id}>{identity.label}</option>)}
              </select>
              <small className="account-field-hint">{labels.identityHint}</small>
            </label>
          </div>
          <label className="account-default-toggle">
            <input type="checkbox" checked={form.isDefault} onChange={(event) => setForm({ ...form, isDefault: event.target.checked })} />
            <span><strong>{labels.default}</strong><small>{labels.defaultHint}</small></span>
          </label>
          <button className="account-primary" type="submit" disabled={busy || !form.organizationName.trim()}>
            <Save size={16} aria-hidden="true" /> {labels.save}
          </button>
        </form>
      ) : null}

      {message ? <div className="account-success" role="status">{message}</div> : null}
      {error ? <div className="account-error" role="alert">{error}</div> : null}
    </section>
  );
}
