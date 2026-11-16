import { applyReturnedSupplementalOverlay } from './returnedTranslationOverlay';
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
  reviewTitle: string;
  reviewLead: string;
  deletedTitle: string;
  deletedAccount: string;
  deletedConnections: string;
  deletedPrivate: string;
  retainedTitle: string;
  retainedShared: string;
  retainedIdentity: string;
  externalTitle: string;
  backups: string;
  beforeDeleting: string;
  rights: string;
  acknowledge: string;
  backupTitle: string;
  backupDescription: string;
  backupAction: string;
  backupWorking: string;
  backupReady: string;
  backupError: string;
  backupRestore: string;
}

const copy: Record<string, AccountDeletionCopy> = {
  en: {
    title: 'Delete account',
    description: 'Permanently delete your Open Manuscript Studio account, sign-in identities, profile data, sessions, integration credentials, cloud connection metadata and direct-submission records.',
    retained: 'Shared scholarly history may retain a pseudonymized participant reference. Ask the server controller about remaining personal data and applicable retention or erasure rights.',
    external: 'Copies already sent to OJS/OMP or stored in your own third-party cloud account are controlled by those services and must be removed there separately.',
    learnMore: 'Account deletion and data retention details',
    start: 'Delete account',
    cancel: 'Cancel',
    confirmLabel: 'Type your account e-mail address to confirm',
    confirmHint: 'Deletion is irreversible. If you are the last owner of an institution or of central OMI administration, transfer ownership first or contact the controller for an alternative erasure procedure.',
    delete: 'Permanently delete account',
    deleting: 'Deleting account…',
    blocked: 'Account deletion could not be completed.',
    reviewTitle: "Before you permanently delete your account",
    reviewLead: "Please review the effects on your data and manuscripts. Deleting the account cannot be undone.",
    deletedTitle: "Deleted from the active Studio service",
    deletedAccount: "Your sign-in account, profile details (name, email, affiliation, ORCID), password credentials, linked identities and active sessions.",
    deletedConnections: "Stored integration credentials, cloud-connection metadata, cloud-backup index entries and local direct-submission records.",
    deletedPrivate: "Private server-stored documents, personal reference records, module preferences and account-scoped recognition-job records. Shared manuscripts and publication history are handled separately.",
    retainedTitle: "Shared scholarly materials that may remain",
    retainedShared: "Co-authored manuscripts, versions, reviews, comments and editorial history may be retained where necessary to protect collaborators' work and the integrity of the scholarly record.",
    retainedIdentity: "The account is shown as a deleted participant, but names or identifying information may still appear in manuscript metadata, versions, reviews or comments. Pseudonymization does not guarantee anonymity.",
    externalTitle: "Copies outside this Studio server",
    backups: "Server backups are governed by the operator's published retention schedule; deletion may not remove backup copies immediately. Restored backups must have prior deletions reapplied.",
    beforeDeleting: "Export any documents you need first. You will lose access to this account and its server-side work after deletion.",
    rights: "You can contact the selected server's data controller to request a review of retained personal data or exercise applicable erasure, restriction and objection rights. Any exception is assessed individually.",
    acknowledge: "I have read and understood what will be deleted, what may remain in shared scholarly records, and how to request a further privacy review.",
    backupTitle: "Save your profile before deletion",
    backupDescription: "Download a personal account-data JSON copy before deleting. It contains profile details and selected sign-in metadata, but not manuscript content. You can later import supported profile fields into a NEW account; it does not recover the deleted account, its password, old identity, ORCID verification, manuscript ownership or previous access rights.",
    backupAction: "Download account-data copy (JSON)",
    backupWorking: "Preparing copy…",
    backupReady: "Account-data copy saved. Keep the file private and export any manuscripts separately.",
    backupError: "The account-data copy could not be saved. Do not delete the account if you need this backup.",
    backupRestore: "To restore the profile later, register a new account and use the profile import in Account → Privacy. External identities, institutional permissions and manuscript access must be re-established separately.",
  },
  hu: {
    title: 'Fiók törlése',
    description: 'Véglegesen törli az Open Manuscript Stúdió-fiókot, a bejelentkezési identitásokat, profiladatokat, munkameneteket, integrációs hitelesítő adatokat, felhőkapcsolati metaadatokat és a közvetlen beküldések helyi nyilvántartását.',
    retained: 'A közös tudományos történetben álnevesített résztvevői hivatkozás maradhat. A megmaradó személyes adatokról, megőrzési időkről és törlési jogokról a szerver adatkezelőjétől kérhet tájékoztatást.',
    external: 'Az OJS/OMP-rendszerbe már elküldött, illetve saját külső felhőfiókodban tárolt példányokat az adott szolgáltatás kezeli; ezeket ott kell külön törölni.',
    learnMore: 'Fióktörlési és adatmegőrzési részletek',
    start: 'Fiók törlése',
    cancel: 'Mégse',
    confirmLabel: 'A megerősítéshez írd be a fiók e-mail-címét',
    confirmHint: 'A törlés nem vonható vissza. Ha egy intézmény vagy a központi OMI-adminisztráció utolsó tulajdonosa vagy, előbb adja át a tulajdonosi szerepet, vagy kérjen más törlési eljárást az adatkezelőtől.',
    delete: 'Fiók végleges törlése',
    deleting: 'Fiók törlése…',
    blocked: 'A fiók törlése nem hajtható végre.',
    reviewTitle: "Mielőtt véglegesen törlöd a fiókodat",
    reviewLead: "Olvasd át, mi történik az adataiddal és kézirataiddal. A fióktörlés nem vonható vissza.",
    deletedTitle: "Az aktív Stúdió-szolgáltatásból törlődő adatok",
    deletedAccount: "A bejelentkezési fiók, a profiladatok (név, e-mail-cím, intézmény, ORCID), a jelszóhoz tartozó hitelesítő adatok, a kapcsolt identitások és az aktív munkamenetek.",
    deletedConnections: "A tárolt integrációs hitelesítő adatok, felhőkapcsolati metaadatok, a felhőmentések indexbejegyzései és a közvetlen beküldések helyi nyilvántartása.",
    deletedPrivate: "A kizárólag a fiókhoz tartozó szerveres magándokumentumok, személyes hivatkozásrekordok, modulos beállítások és felismerési feladatok nyilvántartásai. A közös kéziratok és a publikálási előzmények kezelése ettől elkülönül.",
    retainedTitle: "A közös tudományos munkából megmaradható adatok",
    retainedShared: "A közös kéziratok, verziók, bírálatok, megjegyzések és szerkesztési előzmények megmaradhatnak, ha ez a szerzőtársak munkájának vagy a tudományos dokumentum hitelességének védelméhez szükséges.",
    retainedIdentity: "A fiók törölt résztvevőként jelenhet meg, de a kéziratok metaadataiban, korábbi verzióiban, bírálataiban vagy megjegyzéseiben név és más azonosító adat is maradhat. Az álnevesítés nem feltétlenül jelent anonimizálást.",
    externalTitle: "A Stúdió szerverén kívüli példányok",
    backups: "A szerver biztonsági mentéseire az üzemeltető közzétett megőrzési szabályai vonatkoznak; a törlés nem feltétlenül távolítja el azonnal a mentett példányokat. Visszaállításkor a korábbi törléseket újra érvényesíteni kell.",
    beforeDeleting: "A megtartani kívánt dokumentumokat előbb exportáld. A törlés után nem férsz hozzá ehhez a fiókhoz és a szerveren tárolt munkáidhoz.",
    rights: "A kiválasztott szerver adatkezelőjétől külön kérheted a megmaradó személyes adatok felülvizsgálatát, illetve gyakorolhatod a törléshez, korlátozáshoz és tiltakozáshoz való jogaidat. A kivételeket egyedileg kell elbírálni.",
    acknowledge: "Elolvastam és megértettem, hogy mely adatok törlődnek, melyek maradhatnak meg a közös tudományos munkában, és hogyan kérhetem a további adatvédelmi felülvizsgálatot.",
    backupTitle: "Mentsd el a profilodat a törlés előtt",
    backupDescription: "Töltsd le a személyes fiókadatok JSON-másolatát. Ez a profiladatokat és néhány bejelentkezési metaadatot tartalmaz, a kéziratokat nem. Egy ÚJ fiókba később visszatölthetők a támogatott profilmezők, de a törölt fiók, a jelszó, a korábbi azonosító, az ellenőrzött ORCID-kapcsolat, a kézirattulajdon és a régi hozzáférések nem állnak vissza.",
    backupAction: "Fiókadatok mentése (JSON)",
    backupWorking: "Mentés előkészítése…",
    backupReady: "A fiókadatmentés elkészült. Tárold bizalmasan, a kéziratokat pedig külön exportáld.",
    backupError: "Nem sikerült menteni a fiókadatokat. Ha szükséged van a mentésre, ne töröld a fiókot.",
    backupRestore: "A profil későbbi visszaállításához regisztrálj új fiókot, majd a Fiók → Adatvédelem részben importáld a mentést. A külső identitásokat, intézményi jogosultságokat és kézirathozzáféréseket külön kell újra létrehozni.",
  },
  de: {
    title: 'Konto löschen',
    description: 'Löscht das Open-Manuscript-Studio-Konto, Anmeldeidentitäten, Profildaten, Sitzungen, Integrationszugänge, Cloud-Verbindungsmetadaten und lokale Einreichungsdatensätze dauerhaft.',
    retained: 'Gemeinsame wissenschaftliche Historie kann einen pseudonymisierten Teilnehmerverweis behalten. Fragen Sie den Verantwortlichen nach verbleibenden personenbezogenen Daten, Aufbewahrung und Löschrechten.',
    external: 'Bereits an OJS/OMP übermittelte Kopien oder Dateien in Ihrem eigenen externen Cloud-Konto werden vom jeweiligen Dienst verwaltet und müssen dort separat gelöscht werden.',
    learnMore: 'Details zu Kontolöschung und Datenaufbewahrung',
    start: 'Konto löschen',
    cancel: 'Abbrechen',
    confirmLabel: 'Geben Sie zur Bestätigung die E-Mail-Adresse des Kontos ein',
    confirmHint: 'Die Löschung kann nicht rückgängig gemacht werden. Übertragen Sie zuerst die Eigentümerrolle, wenn Sie der letzte Eigentümer einer Institution oder der zentralen OMI-Verwaltung sind, oder beantragen Sie beim Verantwortlichen ein alternatives Löschverfahren.',
    delete: 'Konto endgültig löschen',
    deleting: 'Konto wird gelöscht…',
    blocked: 'Das Konto konnte nicht gelöscht werden.',
    reviewTitle: "Bevor Sie Ihr Konto endgültig löschen",
    reviewLead: "Bitte lesen Sie, was mit Ihren Daten und Manuskripten geschieht. Die Kontolöschung kann nicht rückgängig gemacht werden.",
    deletedTitle: "Aus dem aktiven Studio-Dienst gelöschte Daten",
    deletedAccount: "Anmeldekonto, Profildaten (Name, E-Mail, Zugehörigkeit, ORCID), Passwort-Zugangsdaten, verknüpfte Identitäten und aktive Sitzungen.",
    deletedConnections: "Gespeicherte Integrationszugänge, Cloud-Verbindungsmetadaten, Cloud-Backup-Indexeinträge und lokale Einreichungsdatensätze.",
    deletedPrivate: "Private, auf dem Server gespeicherte Dokumente, persönliche Referenzdatensätze, Moduleinstellungen und kontobezogene Erkennungsaufträge. Gemeinsame Manuskripte und Publikationsverläufe werden getrennt behandelt.",
    retainedTitle: "Gemeinsame wissenschaftliche Inhalte, die erhalten bleiben können",
    retainedShared: "Gemeinsame Manuskripte, Versionen, Gutachten, Kommentare und redaktionelle Verläufe können erhalten bleiben, soweit dies zum Schutz der Arbeit anderer und der wissenschaftlichen Integrität erforderlich ist.",
    retainedIdentity: "Das Konto kann als gelöschte mitwirkende Person erscheinen; Namen und identifizierende Daten können jedoch in Manuskriptmetadaten, Versionen, Gutachten oder Kommentaren verbleiben. Pseudonymisierung garantiert keine Anonymität.",
    externalTitle: "Kopien außerhalb dieses Studio-Servers",
    backups: "Für Server-Backups gelten die veröffentlichten Aufbewahrungsregeln des Betreibers; ihre Löschung erfolgt möglicherweise nicht sofort. Bei einer Wiederherstellung müssen frühere Löschungen erneut angewendet werden.",
    beforeDeleting: "Exportieren Sie zunächst alle benötigten Dokumente. Nach der Löschung verlieren Sie den Zugriff auf das Konto und dessen serverseitige Arbeiten.",
    rights: "Sie können beim Verantwortlichen des gewählten Servers die Prüfung verbleibender personenbezogener Daten sowie gegebenenfalls Löschung, Einschränkung und Widerspruch beantragen. Ausnahmen werden einzeln geprüft.",
    acknowledge: "Ich habe gelesen und verstanden, welche Daten gelöscht werden, was in gemeinsamen wissenschaftlichen Unterlagen verbleiben kann und wie ich eine weitere Datenschutzprüfung beantragen kann.",
    backupTitle: "Sichern Sie Ihr Profil vor der Löschung",
    backupDescription: "Laden Sie die JSON-Kopie Ihrer Kontodaten herunter. Sie enthält Profildaten und ausgewählte Anmeldemetadaten, aber keine Manuskripte. Unterstützte Profilfelder können später in ein NEUES Konto importiert werden. Gelöschtes Konto, Passwort, alte Identität, bestätigte ORCID-Verbindung, Manuskriptbesitz und frühere Zugriffsrechte werden nicht wiederhergestellt.",
    backupAction: "Kontodaten sichern (JSON)",
    backupWorking: "Sicherung wird vorbereitet…",
    backupReady: "Die Kontodaten wurden gesichert. Bewahren Sie die Datei vertraulich auf und exportieren Sie Manuskripte separat.",
    backupError: "Die Kontodatensicherung ist fehlgeschlagen. Löschen Sie das Konto nicht, wenn Sie diese Sicherung benötigen.",
    backupRestore: "Zur späteren Wiederherstellung erstellen Sie ein neues Konto und importieren die Daten unter Konto → Datenschutz. Externe Identitäten, institutionelle Rechte und Manuskriptzugriffe müssen separat erneut eingerichtet werden.",
  },
};

export function getAccountDeletionCopy(locale: string): AccountDeletionCopy {
  const current = copy[locale] ?? copy.en;
  const translated = applyReturnedSupplementalOverlay(locale, 'accountDeletion', current, copy.en);
  // Historical returned translations predate the retention/legal correction.
  // Keep these statements on the reviewed EN/HU/DE text until retranslated.
  return { ...translated, retained: current.retained, confirmHint: current.confirmHint, reviewTitle: current.reviewTitle, reviewLead: current.reviewLead, deletedTitle: current.deletedTitle, deletedAccount: current.deletedAccount, deletedConnections: current.deletedConnections, deletedPrivate: current.deletedPrivate, retainedTitle: current.retainedTitle, retainedShared: current.retainedShared, retainedIdentity: current.retainedIdentity, externalTitle: current.externalTitle, backups: current.backups, beforeDeleting: current.beforeDeleting, rights: current.rights, acknowledge: current.acknowledge , backupTitle: current.backupTitle, backupDescription: current.backupDescription, backupAction: current.backupAction, backupWorking: current.backupWorking, backupReady: current.backupReady, backupError: current.backupError, backupRestore: current.backupRestore };
}
