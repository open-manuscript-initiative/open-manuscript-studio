import { useState, type ChangeEvent } from 'react';

import { profileFromAccountBackup } from '../account/profileBackup';
import { useTranslation } from '../i18n';
import type { UpdateUserProfileInput } from '../model/user';
import { useAuthStore } from '../store/authStore';

const copy = {
  en: {
    title: 'Restore personal profile from a saved account-data copy',
    hint: 'After creating a new account and signing in, choose the omi-account-data.json file downloaded before deletion. The file is read locally and is not uploaded as a whole.',
    select: 'Choose account-data JSON',
    preview: 'Selected profile:',
    scope: 'Only the name, affiliation, biography, country, website, time zone and personal workflow preference can be imported. Email, account identity, verified ORCID, external sign-ins, passkeys, passwords, memberships, editorial/reviewer permissions, manuscripts and former access rights are not restored.',
    apply: 'Import profile into this account',
    applying: 'Importing…',
    success: 'Profile imported into your current account. Reconnect external accounts and request any necessary shared-manuscript invitations separately.',
    invalid: 'The selected file is not a supported account-data copy.',
    fileTooLarge: 'The selected file is too large.',
  },
  hu: {
    title: 'Személyes profil visszatöltése korábbi fiókmentésből',
    hint: 'Új fiók regisztrálása és bejelentkezés után kiválaszthatod a törlés előtt letöltött omi-account-data.json fájlt. A fájlt az alkalmazás helyben olvassa be, teljes tartalmát nem tölti fel.',
    select: 'Fiókadatmentés (JSON) kiválasztása',
    preview: 'A mentésben szereplő profil:',
    scope: 'Csak a név, intézményi megnevezés, bemutatkozás, ország, honlap, időzóna és személyes munkaszerep-beállítás tölthető vissza. Az e-mail-cím, a régi fiókazonosság, az ellenőrzött ORCID-kapcsolat, külső bejelentkezések, hozzáférési kulcsok, jelszó, intézményi és szerkesztői jogosultságok, kéziratok és korábbi hozzáférések nem állnak vissza.',
    apply: 'Profiladatok importálása ebbe a fiókba',
    applying: 'Importálás…',
    success: 'A profiladatok bekerültek a jelenlegi fiókba. A külső kapcsolatokat újra létre kell hozni, a közös kéziratokhoz pedig külön meghívás szükséges.',
    invalid: 'A kiválasztott fájl nem támogatott fiókadatmentés.',
    fileTooLarge: 'A kiválasztott fájl túl nagy.',
  },
  de: {
    title: 'Persönliches Profil aus einer Konto-Sicherung wiederherstellen',
    hint: 'Nach Neuregistrierung und Anmeldung kann die vor dem Löschen gespeicherte omi-account-data.json ausgewählt werden. Die Datei wird lokal gelesen und nicht vollständig hochgeladen.',
    select: 'Konto-JSON auswählen',
    preview: 'Profil in der Sicherung:',
    scope: 'Nur Name, Zugehörigkeit, Biografie, Land, Website, Zeitzone und persönliche Arbeitsrollenpräferenz werden übernommen. E-Mail, alte Kontoidentität, bestätigte ORCID-Verbindung, externe Anmeldungen, Zugangsdaten, Passwörter, Mitgliedschaften, redaktionelle Rechte, Manuskripte und frühere Zugriffsrechte werden nicht wiederhergestellt.',
    apply: 'Profildaten in dieses Konto übernehmen',
    applying: 'Import wird durchgeführt…',
    success: 'Profil wurde in das aktuelle Konto übernommen. Externe Verknüpfungen und Einladungen zu gemeinsamen Manuskripten müssen separat erneuert werden.',
    invalid: 'Die ausgewählte Datei ist keine unterstützte Konto-Sicherung.',
    fileTooLarge: 'Die ausgewählte Datei ist zu groß.',
  },
} as const;

const MAX_BACKUP_BYTES = 1024 * 1024;

export function AccountProfileRestoreSection() {
  const { locale } = useTranslation();
  const labels = locale === 'hu' ? copy.hu : locale === 'de' ? copy.de : copy.en;
  const updateCurrentUser = useAuthStore((state) => state.updateCurrentUser);
  const [profile, setProfile] = useState<UpdateUserProfileInput | null>(null);
  const [fileRevision, setFileRevision] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  async function selectBackup(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    setProfile(null);
    setSuccess(false);
    setError(null);
    if (!selected) return;
    if (selected.size > MAX_BACKUP_BYTES) {
      setError(labels.fileTooLarge);
      return;
    }
    try {
      const value: unknown = JSON.parse(await selected.text());
      setProfile(profileFromAccountBackup(value));
    } catch {
      setError(labels.invalid);
    }
  }

  async function restore() {
    if (!profile || busy) return;
    setBusy(true);
    setError(null);
    try {
      await updateCurrentUser(profile);
      setSuccess(true);
      setProfile(null);
      setFileRevision((revision) => revision + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : labels.invalid);
    } finally {
      setBusy(false);
    }
  }

  return <section className="account-profile-restore" aria-label={labels.title}>
    <h3>{labels.title}</h3>
    <p>{labels.hint}</p>
    <label>
      {labels.select}
      <input
        key={fileRevision}
        type="file"
        accept=".json,application/json"
        onChange={(event) => { void selectBackup(event); }}
        disabled={busy}
      />
    </label>
    <p>{labels.scope}</p>
    {profile ? <>
      <p><strong>{labels.preview}</strong> {profile.fullName}</p>
      <button type="button" disabled={busy} onClick={() => { void restore(); }}>
        {busy ? labels.applying : labels.apply}
      </button>
    </> : null}
    {success ? <p role="status">{labels.success}</p> : null}
    {error ? <p role="alert">{error}</p> : null}
  </section>;
}
