import { FilePlus2, ImagePlus, LockKeyhole, Save, Trash2, UnlockKeyhole } from 'lucide-react';
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
  createEditablePublisherProfileVersion,
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

  const logo = draft.branding?.logoDataUrl;
  const readOnly = isPublisherProfileReadOnly(draft);
  const canSave = !readOnly && draft.name.trim().length > 0 && (draft.publisher ?? '').trim().length > 0;
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
    () => readOnly ? draft.id : makeProfileId(draft.publisher ?? '', draft.name),
    [draft.id, draft.publisher, draft.name, readOnly],
  );
  const isPersisted = savedProfiles.some(
    (profile) => profile.id === draft.id && profile.version === draft.version,
  );

  function update<K extends keyof OmiPublicationProfile>(key: K, value: OmiPublicationProfile[K]) {
    if (readOnly) return;
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateBranding(key: string, value: string | undefined) {
    if (readOnly) return;
    setDraft((current) => ({
      ...current,
      branding: { ...current.branding, [key]: value },
    }));
  }

  function updateLayout(key: string, value: string | number) {
    if (readOnly) return;
    setDraft((current) => ({
      ...current,
      rules: {
        ...current.rules,
        layout: { ...current.rules.layout, [key]: value },
      },
    }));
  }

  function updateMetadata(key: string, value: string | number | boolean) {
    if (readOnly) return;
    setDraft((current) => ({
      ...current,
      rules: {
        ...current.rules,
        metadata: { ...current.rules.metadata, [key]: value },
      },
    }));
  }

  function handleLogo(event: ChangeEvent<HTMLInputElement>) {
    if (readOnly) return;
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
      const protectedProfile = protectPublisherProfile(draft, actor);
      setSavedProfiles(saveProtectedPublisherProfile(protectedProfile));
      setDraft(protectedProfile);
      stagePublicationProfileChange(protectedProfile);
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

  function startNewVersion() {
    const editable = createEditablePublisherProfileVersion(draft);
    setDraft(editable);
    setMessage(labels.newVersionReady);
  }

  function editSaved(profile: OmiPublicationProfile) {
    setDraft(JSON.parse(JSON.stringify(profile)) as OmiPublicationProfile);
    setMessage('');
  }

  return (
    <section className="publisher-profile-editor" aria-labelledby="publisher-profile-editor-title">
      <div className="publication-profile-section-heading">
        <div>
          <h4 id="publisher-profile-editor-title">{labels.title}</h4>
          <p>{labels.description}</p>
        </div>
      </div>

      {savedProfiles.length > 0 ? (
        <div className="publisher-profile-saved-list">
          {savedProfiles.map((profile) => {
            const protectedProfile = isPublisherProfileReadOnly(profile);
            return (
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
                {protectedProfile ? (
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
            );
          })}
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
        {readOnly ? (
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

      <fieldset className="publisher-profile-editable-fields" disabled={readOnly}>
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

        <details className="publisher-profile-rules-editor">
          <summary>{labels.rules}</summary>
          <div className="publisher-profile-form-grid">
            <label><span>{labels.pageSize}</span><select value={draft.rules.layout.pageSize} onChange={(e) => updateLayout('pageSize', e.target.value)}><option>A4</option><option>Letter</option></select></label>
            <label><span>{labels.columns}</span><select value={draft.rules.layout.columns} onChange={(e) => updateLayout('columns', Number(e.target.value))}><option value="1">1</option><option value="2">2</option></select></label>
            <label><span>{labels.font}</span><select value={draft.rules.layout.fontFamily} onChange={(e) => updateLayout('fontFamily', e.target.value)}><option value="serif">Serif</option><option value="sans-serif">Sans serif</option></select></label>
            <label><span>{labels.fontSize}</span><input type="number" min="7" max="20" step="0.5" value={draft.rules.layout.baseFontSizePt} onChange={(e) => updateLayout('baseFontSizePt', Number(e.target.value))} /></label>
            <label><span>{labels.lineHeight}</span><input type="number" min="1" max="2.5" step="0.05" value={draft.rules.layout.lineHeight} onChange={(e) => updateLayout('lineHeight', Number(e.target.value))} /></label>
            <label><span>{labels.minimumKeywords}</span><input type="number" min="0" max="20" value={draft.rules.metadata.minimumKeywords} onChange={(e) => updateMetadata('minimumKeywords', Number(e.target.value))} /></label>
            <label className="publisher-profile-checkbox"><input type="checkbox" checked={draft.rules.metadata.requireAbstract} onChange={(e) => updateMetadata('requireAbstract', e.target.checked)} /><span>{labels.requireAbstract}</span></label>
            <label className="publisher-profile-checkbox"><input type="checkbox" checked={draft.rules.contributors.showOrcid} onChange={(e) => setDraft((current) => ({ ...current, rules: { ...current.rules, contributors: { ...current.rules.contributors, showOrcid: e.target.checked } } }))} /><span>{labels.showOrcid}</span></label>
          </div>
        </details>
      </fieldset>

      <div className="publisher-profile-actions">
        <div>
          <code>{draft.id || profileIdPreview}@{draft.version}</code>
          {message ? <span role="status">{message}</span> : null}
        </div>
        <div className="publisher-profile-action-buttons">
          {readOnly ? (
            <>
              <button type="button" className="studio-menu-secondary-action" onClick={startNewVersion}>
                <FilePlus2 size={16} aria-hidden="true" />{labels.newVersion}
              </button>
              <button type="button" className="studio-menu-secondary-action" disabled={!currentUser || !canUnlockPublisherProfile(draft, currentUser.id)} onClick={removeReadOnly}>
                <UnlockKeyhole size={16} aria-hidden="true" />{labels.unlock}
              </button>
            </>
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
    title: 'Saját kiadói profil', description: 'Készítsen névvel menthető, hordozható kiadói profilt saját arculattal és kiadványszabályokkal.',
    preview: 'Arculati előnézet', profileName: 'Profil neve', publisher: 'Kiadó / folyóirat', descriptionField: 'Leírás', website: 'Weboldal', logo: 'Logó', logoAlt: 'Logó alternatív szövege', chooseLogo: 'Logó kiválasztása', removeLogo: 'Logó eltávolítása', primaryColor: 'Elsődleges szín', accentColor: 'Kiemelő szín', rules: 'Kiadványszabályok szerkesztése', pageSize: 'Oldalméret', columns: 'Hasábok', font: 'Betűcsalád', fontSize: 'Betűméret (pt)', lineHeight: 'Sorköz', minimumKeywords: 'Minimális kulcsszószám', requireAbstract: 'Absztrakt kötelező', showOrcid: 'ORCID megjelenítése', saveApply: 'Profil mentése és alkalmazása', saved: 'A profil mentve és alkalmazva.', delete: 'Profil törlése', imageOnly: 'Csak képfájl tölthető fel.', imageTooLarge: 'A logó legfeljebb 1 MB lehet.', publisherPlaceholder: 'Kiadó neve', namePlaceholder: 'Pl. Folyóirat szerzői profil', saveFailed: 'A profil mentése nem sikerült.', protect: 'Írásvédelem', protectHelp: 'A mentett profil lezárása a jelenlegi azonosított fiókkal.', protected: 'A profil írásvédett. Tartalma csak új verzióban módosítható.', readOnly: 'Írásvédett profil', protectedBy: 'Lezárta', identificationRequired: 'Az írásvédelemhez aktív, bejelentkezett kiadói fiók szükséges.', saveBeforeProtect: 'Előbb mentse el a profilt, majd teheti írásvédetté.', protectFailed: 'Az írásvédelem beállítása nem sikerült.', unlock: 'Írásvédelem feloldása', unlocked: 'Az írásvédelem feloldva.', unlockDenied: 'Az írásvédelmet csak az a bejelentkezett fiók oldhatja fel, amely lezárta a profilt.', newVersion: 'Új verzió', newVersionReady: 'Szerkeszthető új verzió készült. Mentse el a módosítások után.',
  };
  if (locale === 'de') return {
    title: 'Eigenes Verlagsprofil', description: 'Erstellen Sie ein benanntes, portables Verlagsprofil mit eigenem Branding und Publikationsregeln.', preview: 'Branding-Vorschau', profileName: 'Profilname', publisher: 'Verlag / Zeitschrift', descriptionField: 'Beschreibung', website: 'Website', logo: 'Logo', logoAlt: 'Alternativtext des Logos', chooseLogo: 'Logo auswählen', removeLogo: 'Logo entfernen', primaryColor: 'Primärfarbe', accentColor: 'Akzentfarbe', rules: 'Publikationsregeln bearbeiten', pageSize: 'Seitengröße', columns: 'Spalten', font: 'Schriftfamilie', fontSize: 'Schriftgröße (pt)', lineHeight: 'Zeilenabstand', minimumKeywords: 'Mindestzahl Schlüsselwörter', requireAbstract: 'Abstract erforderlich', showOrcid: 'ORCID anzeigen', saveApply: 'Profil speichern und anwenden', saved: 'Profil gespeichert und angewendet.', delete: 'Profil löschen', imageOnly: 'Es können nur Bilddateien hochgeladen werden.', imageTooLarge: 'Das Logo darf höchstens 1 MB groß sein.', publisherPlaceholder: 'Name des Verlags', namePlaceholder: 'z. B. Autorenprofil der Zeitschrift', saveFailed: 'Profil konnte nicht gespeichert werden.', protect: 'Schreibschutz', protectHelp: 'Das gespeicherte Profil mit dem aktuellen identifizierten Konto sperren.', protected: 'Das Profil ist schreibgeschützt. Änderungen sind nur in einer neuen Version möglich.', readOnly: 'Schreibgeschütztes Profil', protectedBy: 'Gesperrt von', identificationRequired: 'Für den Schreibschutz ist ein aktives angemeldetes Verlagskonto erforderlich.', saveBeforeProtect: 'Speichern Sie das Profil zuerst und aktivieren Sie danach den Schreibschutz.', protectFailed: 'Schreibschutz konnte nicht aktiviert werden.', unlock: 'Schreibschutz aufheben', unlocked: 'Schreibschutz aufgehoben.', unlockDenied: 'Nur das angemeldete Konto, das das Profil gesperrt hat, kann den Schreibschutz aufheben.', newVersion: 'Neue Version', newVersionReady: 'Eine bearbeitbare neue Version wurde erstellt. Speichern Sie sie nach den Änderungen.',
  };
  return {
    title: 'Custom publisher profile', description: 'Create a named, portable publisher profile with your own branding and publication rules.', preview: 'Brand preview', profileName: 'Profile name', publisher: 'Publisher / journal', descriptionField: 'Description', website: 'Website', logo: 'Logo', logoAlt: 'Logo alternative text', chooseLogo: 'Choose logo', removeLogo: 'Remove logo', primaryColor: 'Primary color', accentColor: 'Accent color', rules: 'Edit publication rules', pageSize: 'Page size', columns: 'Columns', font: 'Font family', fontSize: 'Font size (pt)', lineHeight: 'Line height', minimumKeywords: 'Minimum keywords', requireAbstract: 'Abstract required', showOrcid: 'Show ORCID', saveApply: 'Save and apply profile', saved: 'Profile saved and applied.', delete: 'Delete profile', imageOnly: 'Only image files can be uploaded.', imageTooLarge: 'Logo must be 1 MB or smaller.', publisherPlaceholder: 'Publisher name', namePlaceholder: 'e.g. Journal author profile', saveFailed: 'Could not save the profile.', protect: 'Make read-only', protectHelp: 'Lock the saved profile with the current identified account.', protected: 'The profile is now read-only. Its contents can only be changed in a new version.', readOnly: 'Read-only profile', protectedBy: 'Locked by', identificationRequired: 'An active signed-in publisher account is required to protect a profile.', saveBeforeProtect: 'Save the profile first, then make it read-only.', protectFailed: 'Could not protect the profile.', unlock: 'Remove protection', unlocked: 'Read-only protection removed.', unlockDenied: 'Only the signed-in account that protected this profile can remove its protection.', newVersion: 'New version', newVersionReady: 'An editable new version was created. Save it after making changes.',
  };
}
