import { useRef, useState, type ChangeEvent } from 'react';
import { Download, Globe, Upload } from 'lucide-react';

import { OMI_PUBLICATION_PROFILE_MODEL, type OmiPublicationProfile } from '../model/publicationProfile';
import type { ProtectablePublicationProfile } from '../model/publisherProfileProtection';

const DEFAULT_CATALOG_URL = 'https://raw.githubusercontent.com/open-manuscript-initiative/open-manuscript-studio/main/public/publisher-profile-catalog.json';
const MAX_PROFILE_BYTES = 2 * 1024 * 1024;

interface CatalogEntry {
  id: string;
  name: string;
  publisher: string;
  version: string;
  description?: string;
  url: string;
  sha256?: string;
}

interface CatalogDocument {
  format: 'omi-publisher-profile-catalog';
  version: 1;
  profiles: CatalogEntry[];
}

export function PublisherProfileCatalog({
  locale,
  onImport,
}: {
  locale: string;
  onImport: (profile: ProtectablePublicationProfile) => boolean;
}) {
  const labels = copy(locale);
  const fileRef = useRef<HTMLInputElement>(null);
  const [profileUrl, setProfileUrl] = useState('');
  const [catalog, setCatalog] = useState<CatalogDocument | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function readProfile(url: string, expectedSha256?: string): Promise<ProtectablePublicationProfile> {
    const parsedUrl = new URL(url, window.location.href);
    if (parsedUrl.protocol !== 'https:' && parsedUrl.hostname !== 'localhost') {
      throw new Error(labels.httpsOnly);
    }
    const response = await fetch(parsedUrl.toString(), { credentials: 'omit' });
    if (!response.ok) throw new Error(labels.fetchFailed);
    const text = await response.text();
    if (new TextEncoder().encode(text).length > MAX_PROFILE_BYTES) throw new Error(labels.tooLarge);
    if (expectedSha256) {
      if (!globalThis.crypto?.subtle) throw new Error(labels.integrityUnavailable);
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      const actual = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
      if (actual.toLowerCase() !== expectedSha256.toLowerCase()) throw new Error(labels.integrityFailed);
    }
    return validateProfile(JSON.parse(text));
  }

  function importProfile(profile: ProtectablePublicationProfile) {
    setMessage(onImport(profile) ? labels.imported : labels.duplicate);
  }

  async function importFromUrl() {
    setBusy(true);
    setMessage('');
    try {
      importProfile(await readProfile(profileUrl));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : labels.fetchFailed);
    } finally {
      setBusy(false);
    }
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    setMessage('');
    try {
      if (file.size > MAX_PROFILE_BYTES) throw new Error(labels.tooLarge);
      importProfile(validateProfile(JSON.parse(await file.text())));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : labels.invalidProfile);
    } finally {
      setBusy(false);
    }
  }

  async function browseCatalog() {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(DEFAULT_CATALOG_URL, { credentials: 'omit' });
      if (!response.ok) throw new Error(labels.catalogFailed);
      const text = await response.text();
      if (new TextEncoder().encode(text).length > MAX_PROFILE_BYTES) throw new Error(labels.tooLarge);
      const value = JSON.parse(text) as Partial<CatalogDocument>;
      if (value.format !== 'omi-publisher-profile-catalog' || value.version !== 1 || !Array.isArray(value.profiles)) {
        throw new Error(labels.catalogInvalid);
      }
      const entries = value.profiles.filter(isCatalogEntry);
      setCatalog({ format: value.format, version: 1, profiles: entries });
      if (!entries.length) setMessage(labels.catalogEmpty);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : labels.catalogFailed);
    } finally {
      setBusy(false);
    }
  }

  async function importCatalogEntry(entry: CatalogEntry) {
    setBusy(true);
    setMessage('');
    try {
      const profile = await readProfile(entry.url, entry.sha256);
      if (profile.id !== entry.id || profile.name !== entry.name || profile.version !== entry.version) {
        throw new Error(labels.catalogMismatch);
      }
      importProfile(profile);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : labels.fetchFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="publisher-profile-catalog" aria-label={labels.title}>
      <div className="publisher-profile-catalog-actions">
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="sr-only"
          aria-label={labels.importFile}
          onChange={(event) => void importFile(event)}
        />
        <button type="button" className="button button--secondary" disabled={busy} onClick={() => fileRef.current?.click()}>
          <Upload size={15} aria-hidden="true" /> {labels.importFile}
        </button>
        <button type="button" className="button button--secondary" disabled={busy} onClick={() => void browseCatalog()}>
          <Globe size={15} aria-hidden="true" /> {labels.browse}
        </button>
      </div>
      <div className="publisher-profile-catalog-url">
        <label htmlFor="publisher-profile-url">{labels.profileUrl}</label>
        <div>
          <input id="publisher-profile-url" type="url" value={profileUrl} onChange={(event) => setProfileUrl(event.target.value)} placeholder="https://publisher.example/profile.omi-profile.json" />
          <button type="button" className="button button--secondary" disabled={busy || !profileUrl.trim()} onClick={() => void importFromUrl()}>
            <Download size={15} aria-hidden="true" /> {labels.importUrl}
          </button>
        </div>
      </div>
      {catalog?.profiles.length ? (
        <div className="publisher-profile-catalog-list">
          {catalog.profiles.map((entry) => (
            <article key={entry.id + '@' + entry.version}>
              <div><strong>{entry.name}</strong><span>{entry.publisher} · {entry.version}</span>{entry.description ? <p>{entry.description}</p> : null}</div>
              <button type="button" className="button button--secondary" disabled={busy} onClick={() => void importCatalogEntry(entry)}>{labels.importEntry}</button>
            </article>
          ))}
        </div>
      ) : null}
      {message ? <p className="publisher-profile-catalog-message" role="status">{message}</p> : null}
      <p className="publisher-profile-catalog-help">{labels.help}</p>
    </section>
  );
}

function validateProfile(value: unknown): ProtectablePublicationProfile {
  if (!value || typeof value !== 'object') throw new Error(copy('en').invalidProfile);
  const profile = value as Partial<OmiPublicationProfile> & Record<string, unknown>;
  if (
    profile.model !== OMI_PUBLICATION_PROFILE_MODEL
    || typeof profile.id !== 'string' || !profile.id.trim()
    || typeof profile.version !== 'string' || !profile.version.trim()
    || typeof profile.name !== 'string' || !profile.name.trim()
    || !profile.rules || typeof profile.rules !== 'object'
    || !('layout' in profile.rules) || !('metadata' in profile.rules)
  ) {
    throw new Error(copy('en').invalidProfile);
  }
  return profile as ProtectablePublicationProfile;
}

function isCatalogEntry(value: unknown): value is CatalogEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<CatalogEntry>;
  return typeof entry.id === 'string'
    && typeof entry.name === 'string'
    && typeof entry.publisher === 'string'
    && typeof entry.version === 'string'
    && typeof entry.url === 'string'
    && (!entry.sha256 || /^[a-f0-9]{64}$/i.test(entry.sha256));
}

function copy(locale: string) {
  if (locale === 'hu') return {
    title: 'Kiadói profilkönyvtár',
    importFile: 'Profil betöltése fájlból',
    browse: 'Közös katalógus böngészése',
    profileUrl: 'Profil webcíme',
    importUrl: 'Betöltés webcímről',
    importEntry: 'Profil betöltése',
    help: 'A katalógusba felvett profilok zárolt, verziózott pillanatképként tölthetők be. A kiadó a letöltött profilt a saját weboldalán is közzéteheti.',
    httpsOnly: 'A profil webcímének HTTPS-kapcsolatot kell használnia.',
    fetchFailed: 'A profil nem tölthető be. Ellenőrizze a webcímet és a forrás CORS-beállítását.',
    tooLarge: 'A profil legfeljebb 2 MB lehet.',
    integrityUnavailable: 'A biztonságos integritás-ellenőrzés nem érhető el ebben a környezetben.',
    integrityFailed: 'A profil ellenőrzőösszege nem egyezik a katalógusban megadottal.',
    imported: 'A profil betöltve és alkalmazva.',
    duplicate: 'Ez a profilverzió már szerepel a Saját kiadói profilok között.',
    invalidProfile: 'A fájl nem érvényes OMI kiadói profil.',
    catalogFailed: 'A közös katalógus nem tölthető be.',
    catalogInvalid: 'A katalógus formátuma nem érvényes.',
    catalogEmpty: 'A katalógus még nem tartalmaz nyilvános profilt.',
    catalogMismatch: 'A profil adatai nem egyeznek a katalógusbejegyzéssel.',
  };
  if (locale === 'de') return {
    title: 'Verlagsprofil-Bibliothek',
    importFile: 'Profil aus Datei laden',
    browse: 'Gemeinsamen Katalog durchsuchen',
    profileUrl: 'Profil-URL',
    importUrl: 'Aus URL laden',
    importEntry: 'Profil laden',
    help: 'Katalogprofile werden als gesperrte, versionierte Momentaufnahmen geladen. Verlage können heruntergeladene Profile auch auf ihrer eigenen Website veröffentlichen.',
    httpsOnly: 'Die Profil-URL muss HTTPS verwenden.',
    fetchFailed: 'Das Profil konnte nicht geladen werden. Prüfen Sie die URL und die CORS-Einstellungen der Quelle.',
    tooLarge: 'Das Profil darf höchstens 2 MB groß sein.',
    integrityUnavailable: 'Die sichere Integritätsprüfung ist in dieser Umgebung nicht verfügbar.',
    integrityFailed: 'Die Profil-Prüfsumme stimmt nicht mit dem Katalogeintrag überein.',
    imported: 'Profil geladen und angewendet.',
    duplicate: 'Diese Profilversion ist bereits unter Eigene Verlagsprofile vorhanden.',
    invalidProfile: 'Die Datei ist kein gültiges OMI-Verlagsprofil.',
    catalogFailed: 'Der gemeinsame Katalog konnte nicht geladen werden.',
    catalogInvalid: 'Das Katalogformat ist ungültig.',
    catalogEmpty: 'Der Katalog enthält noch keine öffentlichen Profile.',
    catalogMismatch: 'Die Profildaten stimmen nicht mit dem Katalogeintrag überein.',
  };
  return {
    title: 'Publisher profile library',
    importFile: 'Load profile from file',
    browse: 'Browse shared catalog',
    profileUrl: 'Profile URL',
    importUrl: 'Load from URL',
    importEntry: 'Load profile',
    help: 'Catalog profiles load as locked, versioned snapshots. Publishers can also publish downloaded profiles on their own websites.',
    httpsOnly: 'The profile URL must use HTTPS.',
    fetchFailed: 'The profile could not be loaded. Check the URL and the source CORS settings.',
    tooLarge: 'The profile must be 2 MB or smaller.',
    integrityUnavailable: 'Secure integrity verification is unavailable in this environment.',
    integrityFailed: 'The profile checksum does not match the catalog entry.',
    imported: 'Profile loaded and applied.',
    duplicate: 'This profile version is already in My publisher profiles.',
    invalidProfile: 'The file is not a valid OMI publisher profile.',
    catalogFailed: 'The shared catalog could not be loaded.',
    catalogInvalid: 'The catalog format is invalid.',
    catalogEmpty: 'The catalog does not contain any public profiles yet.',
    catalogMismatch: 'The profile data does not match the catalog entry.',
  };
}
