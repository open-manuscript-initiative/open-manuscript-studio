export interface AccountDeletionCopy {
  title: string;
  description: string;
  retained: string;
  external: string;
  learnMore: string;
  start: string;
  cancel: string;
  confirmLabel: string;
  confirmHint: string;
  delete: string;
  deleting: string;
  blocked: string;
}

const copy: Record<string, AccountDeletionCopy> = {
  en: {
    title: 'Delete account',
    description: 'Permanently delete your Open Manuscript Studio account, sign-in identities, profile data, sessions, integration credentials, cloud connection metadata and direct-submission records.',
    retained: 'Scholarly review or publication history that must remain coherent is kept only in anonymized form and is no longer linked to your account identity.',
    external: 'Copies already sent to OJS/OMP or stored in your own third-party cloud account are controlled by those services and must be removed there separately.',
    learnMore: 'Account deletion and data retention details',
    start: 'Delete account',
    cancel: 'Cancel',
    confirmLabel: 'Type your account e-mail address to confirm',
    confirmHint: 'Deletion is irreversible. If you are the last owner of an institution or of central OMI administration, transfer ownership first.',
    delete: 'Permanently delete account',
    deleting: 'Deleting account…',
    blocked: 'Account deletion could not be completed.',
  },
  hu: {
    title: 'Fiók törlése',
    description: 'Véglegesen törli az Open Manuscript Studio-fiókot, a bejelentkezési identitásokat, profiladatokat, munkameneteket, integrációs hitelesítő adatokat, felhőkapcsolati metaadatokat és a közvetlen beküldések helyi nyilvántartását.',
    retained: 'A tudományos lektori vagy publikációs történet koherenciájához szükséges adatok csak anonimizált formában maradnak meg, és többé nem kapcsolódnak a fiókazonosságodhoz.',
    external: 'Az OJS/OMP-rendszerbe már elküldött, illetve saját külső felhőfiókodban tárolt példányokat az adott szolgáltatás kezeli; ezeket ott kell külön törölni.',
    learnMore: 'Fióktörlési és adatmegőrzési részletek',
    start: 'Fiók törlése',
    cancel: 'Mégse',
    confirmLabel: 'A megerősítéshez írd be a fiók e-mail-címét',
    confirmHint: 'A törlés nem vonható vissza. Ha egy intézmény vagy a központi OMI-adminisztráció utolsó tulajdonosa vagy, előbb add át a tulajdonosi szerepet.',
    delete: 'Fiók végleges törlése',
    deleting: 'Fiók törlése…',
    blocked: 'A fiók törlése nem hajtható végre.',
  },
  de: {
    title: 'Konto löschen',
    description: 'Löscht das Open-Manuscript-Studio-Konto, Anmeldeidentitäten, Profildaten, Sitzungen, Integrationszugänge, Cloud-Verbindungsmetadaten und lokale Einreichungsdatensätze dauerhaft.',
    retained: 'Wissenschaftliche Begutachtungs- oder Publikationshistorie, die für einen konsistenten Nachweis erforderlich ist, bleibt nur anonymisiert erhalten und ist nicht mehr mit Ihrer Kontoidentität verknüpft.',
    external: 'Bereits an OJS/OMP übermittelte Kopien oder Dateien in Ihrem eigenen externen Cloud-Konto werden vom jeweiligen Dienst verwaltet und müssen dort separat gelöscht werden.',
    learnMore: 'Details zu Kontolöschung und Datenaufbewahrung',
    start: 'Konto löschen',
    cancel: 'Abbrechen',
    confirmLabel: 'Geben Sie zur Bestätigung die E-Mail-Adresse des Kontos ein',
    confirmHint: 'Die Löschung kann nicht rückgängig gemacht werden. Übertragen Sie zuerst die Eigentümerrolle, wenn Sie der letzte Eigentümer einer Institution oder der zentralen OMI-Verwaltung sind.',
    delete: 'Konto endgültig löschen',
    deleting: 'Konto wird gelöscht…',
    blocked: 'Das Konto konnte nicht gelöscht werden.',
  },
};

export function getAccountDeletionCopy(locale: string): AccountDeletionCopy {
  return copy[locale] ?? copy.en;
}
