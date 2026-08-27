import { ImagePlus, LockKeyhole, Save, Trash2, UnlockKeyhole } from 'lucide-react';
import { useMemo, useState, type ChangeEvent } from 'react';

import { stagePublicationProfileChange } from '../app/publicationProfileActions';
import { useTranslation } from '../i18n';
import {
  OMI_PUBLICATION_PROFILE_MODEL,
  type OmiPublicationProfile,
} from '../model/publicationProfile';
import {
  canProtectPublisherProfile,
  canUnlockPublisherProfile,
  isPublisherProfileReadOnly,
  protectPublisherProfile,
  publisherProfileIdentityLabel,
  unlockPublisherProfile,
  type PublisherProfileActor,
} from '../model/publisherProfileProtection';
import {
  deletePublisherProfile,
  loadPublisherProfiles,
  saveProtectedPublisherProfile,
  savePublisherProfile,
  saveUnlockedPublisherProfile,
} from '../services/publisherProfileStorage';
import { getCurrentUser, useAuthStore } from '../store/authStore';

const MAX_LOGO_BYTES = 1024 * 1024;

export function PublisherProfileEditor({
  baseProfile,
}: {
  baseProfile: OmiPublicationProfile;
}) {
  const { locale } = useTranslation();
  const labels = copy(locale);
  const currentUser = useAuthStore(getCurrentUser);
  const [savedProfiles, setSavedProfiles] = useState(loadPublisherProfiles);
  const [draft, setDraft] = useState<OmiPublicationProfile>(() => cloneAsCustom(baseProfile));
  const [message, setMessage] = useState('');

  const protectedProfile = isPublisherProfileReadOnly(draft);
  const canSave = !protectedProfile
    && draft.name.trim().length > 0
    && (draft.publisher ?? '').trim().length > 0;
  const actor = useMemo<PublisherProfileActor | undefined>(() => currentUser ? ({
    userId: currentUser.id,
    email: currentUser.email,
    displayName: currentUser.profile.fullName || currentUser.email,
    status: currentUser.status,
    emailVerified: currentUser.emailVerified,
    affiliation: currentUser.profile.affiliation,
    affiliationRorId: currentUser.profile.affiliationRorId,
    identityProviders: currentUser.identities.map((identity) => identity.provider),
  }) : undefined, [currentUser]);

  const profileIdPreview = useMemo(
    () => protectedProfile ? draft.id : makeProfileId(draft.publisher ?? '', draft.name),
    [draft.id, draft.publisher, draft.name, protectedProfile],
  );
  const isPersisted = savedProfiles.some(
    (profile) => profile.id === draft.id && profile.version === draft.version,
  );

  function update<K extends keyof OmiPublicationProfile>(key: K, value: OmiPublicationProfile[K]) {
    if (protectedProfile) return;
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateBranding(key: string, value: string | undefined) {
    if (protectedProfile) return;
    setDraft((current) => ({
      ...current,
      branding: { ...current.branding, [key]: value },
    }));
  }

  function handleLogo(event: ChangeEvent<HTMLInputElement>) {
    if (protectedProfile) return;
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMessage(labels.imageOnly);
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setMessage(labels.imageTooLarge);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      updateBranding('logoDataUrl', String(reader.result ?? ''));
      updateBranding('logoAlt', file.name.replace(/\.[^.]+$/, ''));
      setMessage('');
    };
    reader.readAsDataURL(file);
  }

  function persistAndApply() {
    if (!canSave) return;
    const profile: OmiPublicationProfile = {
      ...draft,
      model: OMI_PUBLICATION_PROFILE_MODEL,
      id: profileIdPreview,
      version: new Date().toISOString().slice(0, 19).replace(/[-:T]/g, ''),
      name: draft.name.trim(),
      publisher: draft.publisher?.trim(),
      description: draft.description.trim(),
    };
    try {
      setSavedProfiles(savePublisherProfile(profile));
      setDraft(profile);
      stagePublicationProfileChange(profile);
      setMessage(labels.saved);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : labels.saveFailed);
    }
  }

  function makeReadOnly() {
    if (!actor || !canProtectPublisherProfile(actor)) {
      setMessage(labels.identificationRequired);
      return;
    }
    if (!isPersisted) {
      setMessage(labels.saveBeforeProtect);
      return;
    }
    try {
      const next = protectPublisherProfile(draft, actor);
      setSavedProfiles(saveProtectedPublisherProfile(next));
      setDraft(next);
      stagePublicationProfileChange(next);
      setMessage(labels.protected);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : labels.protectFailed);
    }
  }

  function removeReadOnly() {
    if (!currentUser || !canUnlockPublisherProfile(draft, currentUser.id)) {
      setMessage(labels.unlockDenied);
      return;
    }
    try {
      const editable = unlockPublisherProfile(draft, currentUser.id);
      setSavedProfiles(saveUnlockedPublisherProfile(editable, currentUser.id));
      setDraft(editable);
      stagePublicationProfileChange(editable);
      setMessage(labels.unlocked);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : labels.unlockDenied);
    }
  }

  function editSaved(profile: OmiPublicationProfile) {
    setDraft(JSON.parse(JSON.stringify(profile)) as OmiPublicationProfile);
    setMessage('');
  }

  const logo = draft.branding?.logoDataUrl;

  return (
    <section className="publisher-profile-editor" aria-labelledby="publisher-profile-editor-title">
      <div className="publication-profile-section-heading">
        <div>
          <h4 id="publisher-profile-editor-title">{labels.title}</h4>
          <p>{labels.description}</p>
          <p className="publication-profile-experimental-note">{labels.styleNotice}</p>
        </div>
      </div>

      {savedProfiles.length > 0 ? (
        <div className="publisher-profile-saved-list">
          {savedProfiles.map((profile) => (
            <div className="publisher-profile-saved" key={`${profile.id}@${profile.version}`}>
              {profile.branding?.logoDataUrl ? (
                <img src={profile.branding.logoDataUrl} alt={profile.branding.logoAlt ?? profile.publisher ?? profile.name} />
              ) : (
                <span className="publisher-profile-logo-placeholder" aria-hidden="true">{initials(profile.publisher ?? profile.name)}</span>
              )}
              <button type="button" className="publisher-profile-open" onClick={() => editSaved(profile)}>
                <strong>{profile.name}</strong>
                <span>{profile.publisher} · {profile.version}</span>
              </button>
              {isPublisherProfileReadOnly(profile) ? (
                <span className="publisher-profile-lock-badge" title={labels.readOnly}>
                  <LockKeyhole size={14} aria-hidden="true" />
                </span>
              ) : (
                <button
                  type="button"
                  className="publisher-profile-delete"
                  aria-label={`${labels.delete}: ${profile.name}`}
                  title={labels.delete}
                  onClick={() => setSavedProfiles(deletePublisherProfile(profile.id, profile.version))}
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : null}

      <div className="publisher-profile-brand-preview" style={{ '--publisher-primary': draft.branding?.primaryColor ?? '#6d2130' } as React.CSSProperties}>
        <div className="publisher-profile-logo-box">
          {logo ? <img src={logo} alt={draft.branding?.logoAlt ?? labels.logo} /> : <span>{initials(draft.publisher ?? draft.name)}</span>}
        </div>
        <div>
          <small>{labels.preview}</small>
          <strong>{draft.publisher || labels.publisherPlaceholder}</strong>
          <span>{draft.name || labels.namePlaceholder}</span>
        </div>
        {protectedProfile ? (
          <div className="publisher-profile-protection-summary">
            <LockKeyhole size={16} aria-hidden="true" />
            <div>
              <strong>{labels.readOnly}</strong>
              <span>{labels.protectedBy}: {draft.protection.lockedByName}</span>
              <span>{identityCopy(publisherProfileIdentityLabel(draft), locale)}</span>
            </div>
          </div>
        ) : null}
      </div>

      <fieldset className="publisher-profile-editable-fields" disabled={protectedProfile}>
        <div className="publisher-profile-form-grid">
          <label><span>{labels.profileName}</span><input value={draft.name} onChange={(e) => update('name', e.target.value)} placeholder={labels.namePlaceholder} /></label>
          <label><span>{labels.publisher}</span><input value={draft.publisher ?? ''} onChange={(e) => update('publisher', e.target.value)} placeholder={labels.publisherPlaceholder} /></label>
          <label className="publisher-profile-wide"><span>{labels.descriptionField}</span><textarea rows={3} value={draft.description} onChange={(e) => update('description', e.target.value)} /></label>
          <label><span>{labels.website}</span><input type="url" value={draft.branding?.website ?? ''} onChange={(e) => updateBranding('website', e.target.value)} placeholder="https://…" /></label>
          <label><span>{labels.logoAlt}</span><input value={draft.branding?.logoAlt ?? ''} onChange={(e) => updateBranding('logoAlt', e.target.value)} /></label>
          <label><span>{labels.primaryColor}</span><input type="color" value={draft.branding?.primaryColor ?? '#6d2130'} onChange={(e) => updateBranding('primaryColor', e.target.value)} /></label>
          <label><span>{labels.accentColor}</span><input type="color" value={draft.branding?.accentColor ?? '#275d70'} onChange={(e) => updateBranding('accentColor', e.target.value)} /></label>
          <label className="publisher-profile-wide publisher-profile-logo-upload">
            <span>{labels.logo}</span>
            <span className="publisher-profile-file-button"><ImagePlus size={16} aria-hidden="true" />{labels.chooseLogo}</span>
            <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={handleLogo} />
            {logo ? <button type="button" onClick={() => updateBranding('logoDataUrl', undefined)}>{labels.removeLogo}</button> : null}
          </label>
        </div>
      </fieldset>

      <div className="publisher-profile-actions">
        <div>
          <code>{draft.id || profileIdPreview}@{draft.version}</code>
          {message ? <span role="status">{message}</span> : null}
        </div>
        <div className="publisher-profile-action-buttons">
          {protectedProfile ? (
            <button type="button" className="studio-menu-secondary-action" disabled={!currentUser || !canUnlockPublisherProfile(draft, currentUser.id)} onClick={removeReadOnly}>
              <UnlockKeyhole size={16} aria-hidden="true" />{labels.unlock}
            </button>
          ) : (
            <>
              <button type="button" className="studio-menu-secondary-action" disabled={!isPersisted || !canProtectPublisherProfile(actor)} onClick={makeReadOnly} title={!actor ? labels.identificationRequired : labels.protectHelp}>
                <LockKeyhole size={16} aria-hidden="true" />{labels.protect}
              </button>
              <button type="button" className="studio-menu-primary-action" disabled={!canSave} onClick={persistAndApply}>
                <Save size={16} aria-hidden="true" />{labels.saveApply}
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function cloneAsCustom(profile: OmiPublicationProfile): OmiPublicationProfile {
  const clone = JSON.parse(JSON.stringify(profile)) as OmiPublicationProfile;
  return {
    ...clone,
    id: `custom-${crypto.randomUUID()}`,
    version: '1',
    name: profile.publisher === 'Open Manuscript Initiative' ? '' : profile.name,
    publisher: profile.publisher === 'Open Manuscript Initiative' ? '' : profile.publisher,
    branding: clone.branding ?? { primaryColor: '#6d2130', accentColor: '#275d70' },
  };
}

function makeProfileId(publisher: string, name: string): string {
  const value = `${publisher}-${name}`.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64);
  return `publisher:${value || 'custom-profile'}`;
}

function initials(value: string): string {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'P';
}

function identityCopy(method: string | undefined, locale: string): string {
  const values: Record<string, Record<string, string>> = {
    hu: {
      'authenticated-account': 'Azonosítás: bejelentkezett OMI-fiók',
      'verified-email': 'Azonosítás: ellenőrzött e-mail-cím',
      'ror-affiliation': 'Azonosítás: ROR-hoz kapcsolt intézmény',
      'institutional-identity': 'Azonosítás: intézményi identitás',
    },
    de: {
      'authenticated-account': 'Identität: angemeldetes OMI-Konto',
      'verified-email': 'Identität: bestätigte E-Mail-Adresse',
      'ror-affiliation': 'Identität: ROR-verknüpfte Institution',
      'institutional-identity': 'Identität: institutionelle Identität',
    },
    en: {
      'authenticated-account': 'Identity: authenticated OMI account',
      'verified-email': 'Identity: verified email address',
      'ror-affiliation': 'Identity: ROR-linked affiliation',
      'institutional-identity': 'Identity: institutional identity',
    },
  };
  return values[locale]?.[method ?? ''] ?? values.en?.[method ?? ''] ?? '';
}

function copy(locale: string) {
  if (locale === 'hu') return {
    title: 'Saját kiadói profil', description: 'A kiadó vagy folyóirat identitásának, arculatának és tulajdonosi védelmének beállítása.',
    styleNotice: 'A tipográfiát, lapméretet, margókat, címsorokat és lábjegyzeteket az alábbi Kiadványstílus szerkesztő kezeli.',
    preview: 'Arculati előnézet', profileName: 'Profil neve', publisher: 'Kiadó / folyóirat', descriptionField: 'Leírás', website: 'Weboldal', logo: 'Logó', logoAlt: 'Logó alternatív szövege', chooseLogo: 'Logó kiválasztása', removeLogo: 'Logó eltávolítása', primaryColor: 'Elsődleges szín', accentColor: 'Kiemelő szín', saveApply: 'Profil mentése és alkalmazása', saved: 'A profil mentve és alkalmazva.', delete: 'Profil törlése', imageOnly: 'Csak képfájl tölthető fel.', imageTooLarge: 'A logó legfeljebb 1 MB lehet.', publisherPlaceholder: 'Kiadó neve', namePlaceholder: 'Pl. Folyóirat kiadói profil', saveFailed: 'A profil mentése nem sikerült.', protect: 'Profil zárolása', protectHelp: 'A mentett kiadói identitás zárolása.', protected: 'A kiadói profil zárolva.', readOnly: 'Zárolt kiadói profil', protectedBy: 'Zárolta', identificationRequired: 'A zároláshoz aktív, bejelentkezett kiadói fiók szükséges.', saveBeforeProtect: 'Előbb mentse el a profilt, majd zárolhatja.', protectFailed: 'A profil zárolása nem sikerült.', unlock: 'Zárolás feloldása', unlocked: 'A zárolás feloldva.', unlockDenied: 'A zárolást csak a jogosult bejelentkezett fiók oldhatja fel.',
  };
  if (locale === 'de') return {
    title: 'Eigenes Verlagsprofil', description: 'Identität, Branding und Eigentumsschutz des Verlags oder der Zeitschrift verwalten.',
    styleNotice: 'Typografie, Seitengröße, Ränder, Überschriften und Fußnoten werden ausschließlich im Publikationsstil-Editor unten bearbeitet.',
    preview: 'Branding-Vorschau', profileName: 'Profilname', publisher: 'Verlag / Zeitschrift', descriptionField: 'Beschreibung', website: 'Website', logo: 'Logo', logoAlt: 'Alternativtext des Logos', chooseLogo: 'Logo auswählen', removeLogo: 'Logo entfernen', primaryColor: 'Primärfarbe', accentColor: 'Akzentfarbe', saveApply: 'Profil speichern und anwenden', saved: 'Profil gespeichert und angewendet.', delete: 'Profil löschen', imageOnly: 'Es können nur Bilddateien hochgeladen werden.', imageTooLarge: 'Das Logo darf höchstens 1 MB groß sein.', publisherPlaceholder: 'Name des Verlags', namePlaceholder: 'z. B. Verlagsprofil der Zeitschrift', saveFailed: 'Profil konnte nicht gespeichert werden.', protect: 'Profil sperren', protectHelp: 'Die gespeicherte Verlagsidentität sperren.', protected: 'Das Verlagsprofil ist gesperrt.', readOnly: 'Gesperrtes Verlagsprofil', protectedBy: 'Gesperrt von', identificationRequired: 'Zum Sperren ist ein aktives angemeldetes Verlagskonto erforderlich.', saveBeforeProtect: 'Speichern Sie das Profil zuerst und sperren Sie es danach.', protectFailed: 'Profil konnte nicht gesperrt werden.', unlock: 'Sperre aufheben', unlocked: 'Sperre aufgehoben.', unlockDenied: 'Nur das berechtigte angemeldete Konto kann die Sperre aufheben.',
  };
  return {
    title: 'Custom publisher profile', description: 'Manage publisher or journal identity, branding, and ownership protection.',
    styleNotice: 'Typography, page size, margins, headings, and footnotes are edited only in the Publication Style editor below.',
    preview: 'Brand preview', profileName: 'Profile name', publisher: 'Publisher / journal', descriptionField: 'Description', website: 'Website', logo: 'Logo', logoAlt: 'Logo alternative text', chooseLogo: 'Choose logo', removeLogo: 'Remove logo', primaryColor: 'Primary color', accentColor: 'Accent color', saveApply: 'Save and apply profile', saved: 'Profile saved and applied.', delete: 'Delete profile', imageOnly: 'Only image files can be uploaded.', imageTooLarge: 'Logo must be 1 MB or smaller.', publisherPlaceholder: 'Publisher name', namePlaceholder: 'e.g. Journal publisher profile', saveFailed: 'Could not save the profile.', protect: 'Lock profile', protectHelp: 'Lock the saved publisher identity.', protected: 'The publisher profile is locked.', readOnly: 'Locked publisher profile', protectedBy: 'Locked by', identificationRequired: 'An active signed-in publisher account is required to lock a profile.', saveBeforeProtect: 'Save the profile first, then lock it.', protectFailed: 'Could not lock the profile.', unlock: 'Unlock profile', unlocked: 'Profile unlocked.', unlockDenied: 'Only the authorized signed-in account can unlock this profile.',
  };
}
