import { CopyPlus, Download, FileUp, ImagePlus, LockKeyhole, Save, Trash2, UnlockKeyhole } from 'lucide-react';
import { useMemo, useRef, useState, type ChangeEvent } from 'react';

import { stagePublicationProfileChange } from '../app/publicationProfileActions';
import templateJson from '../document/publicationStyles/egyhaztorteneti-szemle.json';
import { useTranslation } from '../i18n';
import { serializePublicationProfileWithFrontMatter } from '../model/frontMatter';
import {
  OMI_PUBLICATION_PROFILE_MODEL,
  type OmiPublicationProfile,
  type OmiPublicationProfileDistribution,
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
import { importPublicationStyleFromIdml, type IdmlPublicationStyleImportResult } from '../services/idmlPublicationStyleImport';
import { normalizePublicationStyle, type PublicationStyle } from '../services/publicationStyleExport';
import { CITATION_STYLE_CATALOG } from '../model/cslRendering';
import { getCurrentUser, useAuthStore } from '../store/authStore';
import { PublisherProfileCatalog } from './PublisherProfileCatalog';

const MAX_LOGO_BYTES = 1024 * 1024;
const STYLE_LIBRARY_KEY = 'omi:publication-style-library:v1';
const ACTIVE_STYLE_KEY = 'omi:publication-style-active:v1';
const LEGACY_STYLE_KEY = 'omi:publication-style:egyhaztorteneti-szemle';

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
  const idmlInputRef = useRef<HTMLInputElement>(null);

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

  function updateCitationRule(key: 'bibliographyStyle' | 'noteFirstStyle' | 'noteSubsequentStyle', value: string) {
    if (protectedProfile) return;
    setDraft((current) => ({
      ...current,
      rules: {
        ...current.rules,
        citations: { ...current.rules.citations, [key]: value as OmiPublicationProfile['rules']['citations']['style'] },
      },
    }));
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

  async function handleIdmlImport(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || protectedProfile) return;
    setMessage(labels.importing);
    try {
      const imported = await importPublicationStyleFromIdml(file);
      const style = createPublicationStyle(imported);
      const existing = loadPublicationStyles();
      window.localStorage.setItem(STYLE_LIBRARY_KEY, JSON.stringify([
        ...existing.filter((item) => item.id !== style.id), style,
      ]));
      setDraft((current) => ({ ...current, publicationStyle: style }));
      setMessage(labels.imported.replace('{name}', style.name));
    } catch {
      setMessage(labels.importFailed);
    }
  }

  function activateAttachedStyle(profile: OmiPublicationProfile): void {
    const style = profile.publicationStyle;
    if (!style) return;
    const normalized = normalizePublicationStyle(style);
    const library = loadPublicationStyles();
    window.localStorage.setItem(STYLE_LIBRARY_KEY, JSON.stringify([
      ...library.filter((item) => item.id !== normalized.id), normalized,
    ]));
    window.localStorage.setItem(ACTIVE_STYLE_KEY, normalized.id);
    // Existing HTML/PDF readers use this compatibility key.
    window.localStorage.setItem(LEGACY_STYLE_KEY, JSON.stringify(normalized));
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
      activateAttachedStyle(profile);
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
      activateAttachedStyle(next);
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
      activateAttachedStyle(editable);
      setMessage(labels.unlocked);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : labels.unlockDenied);
    }
  }

  function editSaved(profile: OmiPublicationProfile) {
    setDraft(JSON.parse(JSON.stringify(profile)) as OmiPublicationProfile);
    setMessage('');
  }

  function downloadProfile(profile: OmiPublicationProfile) {
    const blob = new Blob(
      [serializePublicationProfileWithFrontMatter(profile)],
      { type: 'application/json;charset=utf-8' },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${profile.id}-${profile.version}.omi-profile.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setMessage(labels.downloaded);
  }

  function importProfile(profile: OmiPublicationProfile, distribution: OmiPublicationProfileDistribution): boolean {
    if (savedProfiles.some((item) => item.id === profile.id && item.version === profile.version)) {
      return false;
    }
    try {
      const imported = { ...profile, distribution };
      setSavedProfiles(savePublisherProfile(imported));
      setDraft(JSON.parse(JSON.stringify(imported)) as OmiPublicationProfile);
      stagePublicationProfileChange(imported);
      activateAttachedStyle(imported);
      return true;
    } catch {
      return false;
    }
  }

  function copyForEditing(profile: OmiPublicationProfile) {
    const copy = JSON.parse(JSON.stringify(profile)) as OmiPublicationProfile & { protection?: unknown };
    delete copy.protection;
    copy.id = `custom-${crypto.randomUUID()}`;
    copy.version = '1';
    setDraft(copy);
    setMessage(labels.copyCreated);
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

      <PublisherProfileCatalog locale={locale} onImport={importProfile} />

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
                {profile.distribution?.sourceUrl ? <small>{labels.source}: {profile.distribution.sourceUrl}</small> : null}
              </button>
              <button
                type="button"
                className="publisher-profile-download"
                aria-label={`${labels.downloadProfile}: ${profile.name}`}
                title={labels.downloadProfile}
                onClick={() => downloadProfile(profile)}
              >
                <Download size={15} aria-hidden="true" />
              </button>
              {isPublisherProfileReadOnly(profile) ? (
                <>
                  <span className="publisher-profile-lock-badge" title={labels.readOnly}>
                    <LockKeyhole size={14} aria-hidden="true" />
                  </span>
                  <button type="button" className="publisher-profile-copy" aria-label={`${labels.copyForEditing}: ${profile.name}`} title={labels.copyForEditing} onClick={() => copyForEditing(profile)}>
                    <CopyPlus size={15} aria-hidden="true" />
                  </button>
                </>
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
          {draft.publisher ? <strong>{draft.publisher}</strong> : null}
          {draft.name ? <span>{draft.name}</span> : null}
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
          <label><span>{labels.profileName}</span><input value={draft.name} onChange={(e) => update('name', e.target.value)} /></label>
          <label><span>{labels.publisher}</span><input value={draft.publisher ?? ''} onChange={(e) => update('publisher', e.target.value)} /></label>
          <label className="publisher-profile-wide"><span>{labels.descriptionField}</span><textarea rows={3} value={draft.description} onChange={(e) => update('description', e.target.value)} /></label>
          <label><span>{labels.bibliographyStyle}</span><select value={draft.rules.citations.bibliographyStyle ?? draft.rules.citations.style} onChange={(e) => updateCitationRule('bibliographyStyle', e.target.value)}>{CITATION_STYLE_CATALOG.map((style) => <option key={style.id} value={style.id}>{style.label}</option>)}</select></label>
          <label><span>{labels.firstNoteStyle}</span><select value={draft.rules.citations.noteFirstStyle ?? draft.rules.citations.style} onChange={(e) => updateCitationRule('noteFirstStyle', e.target.value)}>{CITATION_STYLE_CATALOG.map((style) => <option key={style.id} value={style.id}>{style.label}</option>)}</select></label>
          <label><span>{labels.subsequentNoteStyle}</span><select value={draft.rules.citations.noteSubsequentStyle ?? draft.rules.citations.style} onChange={(e) => updateCitationRule('noteSubsequentStyle', e.target.value)}>{CITATION_STYLE_CATALOG.map((style) => <option key={style.id} value={style.id}>{style.label}</option>)}</select></label>
          <label><span>{labels.website}</span><input type="url" value={draft.branding?.website ?? ''} onChange={(e) => updateBranding('website', e.target.value)} /></label>
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
        <div className="publisher-profile-indesign-settings">
          <div>
            <strong>{labels.indesignSettings}</strong>
            <p>{draft.publicationStyle ? labels.attachedStyle.replace('{name}', draft.publicationStyle.name) : labels.noAttachedStyle}</p>
          </div>
          <input ref={idmlInputRef} type="file" accept=".idml,application/vnd.adobe.indesign-idml-package" hidden onChange={(event) => void handleIdmlImport(event)} />
          <button type="button" className="studio-menu-secondary-action" onClick={() => idmlInputRef.current?.click()}>
            <FileUp size={16} aria-hidden="true" />{labels.importIdml}
          </button>
          {draft.publicationStyle ? <button type="button" className="studio-menu-secondary-action" onClick={() => update('publicationStyle', undefined)}>{labels.removeSettings}</button> : null}
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
    description: profile.publisher === 'Open Manuscript Initiative' ? '' : profile.description,
    branding: clone.branding ?? { primaryColor: '#6d2130', accentColor: '#275d70' },
  };
}

function makeProfileId(publisher: string, name: string): string {
  const value = `${publisher}-${name}`.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64);
  return `publisher:${value || 'custom-profile'}`;
}

function createPublicationStyle(imported: IdmlPublicationStyleImportResult): PublicationStyle {
  const next = JSON.parse(JSON.stringify(templateJson)) as PublicationStyle;
  next.id = `publication-style:idml:${crypto.randomUUID()}`;
  next.name = imported.sourceName;
  next.description = `Imported from Adobe InDesign IDML: ${imported.sourceName}`;
  if (imported.page?.width !== undefined) next.page.width = imported.page.width;
  if (imported.page?.height !== undefined) next.page.height = imported.page.height;
  const margins = imported.page?.margins;
  if (margins?.top !== undefined) next.page.margins.top = margins.top;
  if (margins?.bottom !== undefined) next.page.margins.bottom = margins.bottom;
  if (margins?.inner !== undefined) next.page.margins.inner = margins.inner;
  if (margins?.outer !== undefined) next.page.margins.outer = margins.outer;
  if (imported.paragraphStyles.length) {
    const importedIds = new Set(imported.paragraphStyles.map((style) => style.id));
    const mappedBodyId = imported.mappedStyles.find((mapping) => mapping.target === 'body' && importedIds.has(mapping.sourceId))?.sourceId;
    next.paragraphStyles = { defaultStyleId: mappedBodyId ?? imported.paragraphStyles[0].id, items: imported.paragraphStyles };
  }
  let bodyFont: string | undefined;
  let noteFont: string | undefined;
  for (const [key, patch] of Object.entries(imported.styles)) {
    if (!(key in next.styles)) continue;
    const target = next.styles[key as keyof typeof next.styles] as Record<string, unknown>;
    for (const field of ['fontSize', 'lineHeight', 'fontWeight', 'fontStyle', 'alignment', 'firstLineIndent', 'spaceBefore', 'spaceAfter', 'hyphenation', 'keepWithNext'] as const) {
      const value = patch?.[field];
      if (value !== undefined) target[field] = value;
    }
    const fontFamily = patch?.fontFamily;
    if (fontFamily) {
      if (key === 'footnote') noteFont = fontFamily;
      else bodyFont ??= fontFamily;
    }
  }
  if (bodyFont) {
    next.fonts.body.family = bodyFont;
    if (!noteFont) next.fonts.note.family = bodyFont;
  }
  if (noteFont) next.fonts.note.family = noteFont;
  return normalizePublicationStyle(next);
}

function loadPublicationStyles(): PublicationStyle[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STYLE_LIBRARY_KEY) ?? '[]') as unknown;
    return Array.isArray(parsed) ? parsed as PublicationStyle[] : [];
  } catch {
    return [];
  }
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
    styleNotice: 'A hivatkozások és a tördelés stílusa külön állítható. InDesign-beállításokat itt lehet importálni a profilhoz. A tipográfia, lapméret, margók és stílusok az alábbi Kiadványstílus szerkesztőben tovább szerkeszthetők.',
    bibliographyStyle: 'Bibliográfia hivatkozási stílusa', firstNoteStyle: 'Jegyzet: első előfordulás', subsequentNoteStyle: 'Jegyzet: további előfordulások', indesignSettings: 'InDesign tördelési beállítások', noAttachedStyle: 'Nincs IDML-beállítás a profilhoz kapcsolva.', attachedStyle: 'Kapcsolt beállítás: {name}', importIdml: 'IDML-fájl importálása és kapcsolása', removeSettings: 'Kapcsolat eltávolítása', importing: 'InDesign-beállítások importálása…', imported: 'Az IDML-beállítások importálva és a profilhoz kapcsolva: {name}.', importFailed: 'Az IDML-beállítások importálása nem sikerült.',
    preview: 'Arculati előnézet', profileName: 'Profil neve', publisher: 'Kiadó / folyóirat', descriptionField: 'Leírás', website: 'Weboldal', logo: 'Logó', logoAlt: 'Logó alternatív szövege', chooseLogo: 'Logó kiválasztása', removeLogo: 'Logó eltávolítása', primaryColor: 'Elsődleges szín', accentColor: 'Kiemelő szín', saveApply: 'Profil mentése és alkalmazása', saved: 'A profil mentve és alkalmazva.', delete: 'Profil törlése', imageOnly: 'Csak képfájl tölthető fel.', imageTooLarge: 'A logó legfeljebb 1 MB lehet.', saveFailed: 'A profil mentése nem sikerült.', protect: 'Profil zárolása', protectHelp: 'A mentett kiadói identitás zárolása.', protected: 'A kiadói profil zárolva.', readOnly: 'Zárolt kiadói profil', protectedBy: 'Zárolta', identificationRequired: 'A zároláshoz aktív, bejelentkezett kiadói fiók szükséges.', saveBeforeProtect: 'Előbb mentse el a profilt, majd zárolhatja.', protectFailed: 'A profil zárolása nem sikerült.', unlock: 'Zárolás feloldása', unlocked: 'A zárolás feloldva.', unlockDenied: 'A zárolást csak a jogosult bejelentkezett fiók oldhatja fel.',
    downloadProfile: 'Profil letöltése', downloaded: 'A kiadói profil letöltése elindult.', copyForEditing: 'Szerkeszthető másolat készítése', copyCreated: 'Szerkeszthető profil-másolat készült. Mentés előtt módosítható.', source: 'Forrás',
  };
  if (locale === 'de') return {
    title: 'Eigenes Verlagsprofil', description: 'Identität, Branding und Eigentumsschutz des Verlags oder der Zeitschrift verwalten.',
    styleNotice: 'Zitations- und Satzstil lassen sich unabhängig einstellen. InDesign-Einstellungen können hier in das Profil importiert werden. Typografie, Seitengröße, Ränder und Formate lassen sich anschließend im Publikationsstil-Editor unten weiter bearbeiten.',
    bibliographyStyle: 'Zitationsstil des Literaturverzeichnisses', firstNoteStyle: 'Fußnote: erste Nennung', subsequentNoteStyle: 'Fußnote: weitere Nennungen', indesignSettings: 'InDesign-Satzparameter', noAttachedStyle: 'Dem Profil sind keine IDML-Einstellungen zugeordnet.', attachedStyle: 'Zugeordnete Einstellungen: {name}', importIdml: 'IDML-Datei importieren und zuordnen', removeSettings: 'Zuordnung entfernen', importing: 'InDesign-Einstellungen werden importiert…', imported: 'IDML-Einstellungen importiert und dem Profil zugeordnet: {name}.', importFailed: 'IDML-Einstellungen konnten nicht importiert werden.',
    preview: 'Branding-Vorschau', profileName: 'Profilname', publisher: 'Verlag / Zeitschrift', descriptionField: 'Beschreibung', website: 'Website', logo: 'Logo', logoAlt: 'Alternativtext des Logos', chooseLogo: 'Logo auswählen', removeLogo: 'Logo entfernen', primaryColor: 'Primärfarbe', accentColor: 'Akzentfarbe', saveApply: 'Profil speichern und anwenden', saved: 'Profil gespeichert und angewendet.', delete: 'Profil löschen', imageOnly: 'Es können nur Bilddateien hochgeladen werden.', imageTooLarge: 'Das Logo darf höchstens 1 MB groß sein.', saveFailed: 'Profil konnte nicht gespeichert werden.', protect: 'Profil sperren', protectHelp: 'Die gespeicherte Verlagsidentität sperren.', protected: 'Das Verlagsprofil ist gesperrt.', readOnly: 'Gesperrtes Verlagsprofil', protectedBy: 'Gesperrt von', identificationRequired: 'Zum Sperren ist ein aktives angemeldetes Verlagskonto erforderlich.', saveBeforeProtect: 'Speichern Sie das Profil zuerst und sperren Sie es danach.', protectFailed: 'Profil konnte nicht gesperrt werden.', unlock: 'Sperre aufheben', unlocked: 'Sperre aufgehoben.', unlockDenied: 'Nur das berechtigte angemeldete Konto kann die Sperre aufheben.',
    downloadProfile: 'Profil herunterladen', downloaded: 'Der Download des Verlagsprofils wurde gestartet.', copyForEditing: 'Bearbeitbare Kopie erstellen', copyCreated: 'Eine bearbeitbare Profilkopie wurde erstellt. Sie kann vor dem Speichern geändert werden.', source: 'Quelle',
  };
  return {
    title: 'Custom publisher profile', description: 'Manage publisher or journal identity, branding, and ownership protection.',
    styleNotice: 'Citation and typesetting styles can be configured independently. Import InDesign settings into this profile here. Typography, page size, margins, and styles can then be edited in the Publication Style editor below.',
    bibliographyStyle: 'Bibliography citation style', firstNoteStyle: 'Note: first citation', subsequentNoteStyle: 'Note: later citations', indesignSettings: 'InDesign typesetting settings', noAttachedStyle: 'No IDML settings are attached to this profile.', attachedStyle: 'Attached settings: {name}', importIdml: 'Import and attach IDML file', removeSettings: 'Remove attachment', importing: 'Importing InDesign settings…', imported: 'IDML settings imported and attached to the profile: {name}.', importFailed: 'Could not import the IDML settings.',
    preview: 'Brand preview', profileName: 'Profile name', publisher: 'Publisher / journal', descriptionField: 'Description', website: 'Website', logo: 'Logo', logoAlt: 'Logo alternative text', chooseLogo: 'Choose logo', removeLogo: 'Remove logo', primaryColor: 'Primary color', accentColor: 'Accent color', saveApply: 'Save and apply profile', saved: 'Profile saved and applied.', delete: 'Delete profile', imageOnly: 'Only image files can be uploaded.', imageTooLarge: 'Logo must be 1 MB or smaller.', saveFailed: 'Could not save the profile.', protect: 'Lock profile', protectHelp: 'Lock the saved publisher identity.', protected: 'The publisher profile is locked.', readOnly: 'Locked publisher profile', protectedBy: 'Locked by', identificationRequired: 'An active signed-in publisher account is required to lock a profile.', saveBeforeProtect: 'Save the profile first, then lock it.', protectFailed: 'Could not lock the profile.', unlock: 'Unlock profile', unlocked: 'Profile unlocked.', unlockDenied: 'Only the authorized signed-in account can unlock this profile.',
    downloadProfile: 'Download profile', downloaded: 'Publisher profile download started.', copyForEditing: 'Create editable copy', copyCreated: 'An editable profile copy was created. You can change it before saving.', source: 'Source',
  };
}
