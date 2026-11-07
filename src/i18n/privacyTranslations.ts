export function getPrivacyCopy(locale: string) {
  if (locale === 'hu') return {
    title: 'Adatvédelem és személyes adatok', loading: 'Tájékoztató betöltése…',
    missing: 'Ehhez a szerverhez az üzemeltető még nem adott meg ellenőrzött adatkezelési tájékoztatást. A regisztráció előtt kérje azt a szerver üzemeltetőjétől.',
    unavailable: 'A szerver adatkezelési tájékoztatója most nem érhető el.', retry: 'Újrapróbálás',
    controller: 'Adatkezelő', dpo: 'Adatvédelmi tisztviselő', notice: 'Teljes adatkezelési tájékoztató', version: 'Verzió',
    purpose: 'Cél', categories: 'Adatok', legalBasis: 'Jogalap', retention: 'Megőrzés', recipients: 'Címzettek', internationalTransfers: 'Nemzetközi adattovábbítás',
    rights: 'Joggyakorlás', dataSources: 'Adatok forrása', requiredData: 'Kötelező adatok és következmények', automatedDecisions: 'Automatizált döntéshozatal',
    cookies: 'Sütik és eszköztárolás', backups: 'Biztonsági mentések', deletion: 'Törlés és megmaradó adatok', authority: 'Panasz a felügyeleti hatóságnál',
    contact: 'Adatvédelmi kérelem küldése', subject: 'OMI – érintetti joggyakorlási kérelem',
    contactHint: 'Hozzáférést, helyesbítést, törlést, korlátozást, tiltakozást vagy – feltételeinek fennállásakor – adathordozhatóságot kérhet. A kérelmekre főszabály szerint egy hónapon belül kell válaszolni. A hivatkozás a levelezőprogramot nyitja meg; az üzenetet Ön küldi el.',
    export: 'Fiókadatok másolatának letöltése', exporting: 'Másolat készítése…',
    exportHint: 'JSON-másolat a profilról, a kapcsolt belépési azonosítókról, az intézményi tagságról és a belépési metaadatokról. A kéziratok, bírálatok és naplók teljes körű adatigényléséhez forduljon az adatkezelőhöz.',
    exportError: 'A fiókadatok másolata nem tölthető le.', back: 'Vissza a Stúdióhoz',
  };
  if (locale === 'de') return {
    title: 'Datenschutz und personenbezogene Daten', loading: 'Datenschutzhinweise werden geladen…',
    missing: 'Für diesen Server hat der Betreiber noch keine geprüften Datenschutzhinweise bereitgestellt. Fordern Sie diese vor der Registrierung beim Serverbetreiber an.',
    unavailable: 'Die Datenschutzhinweise dieses Servers sind derzeit nicht verfügbar.', retry: 'Erneut versuchen',
    controller: 'Verantwortlicher', dpo: 'Datenschutzbeauftragter', notice: 'Vollständige Datenschutzhinweise', version: 'Version',
    purpose: 'Zweck', categories: 'Daten', legalBasis: 'Rechtsgrundlage', retention: 'Aufbewahrung', recipients: 'Empfänger', internationalTransfers: 'Internationale Datenübermittlung',
    rights: 'Betroffenenrechte', dataSources: 'Datenquellen', requiredData: 'Erforderliche Daten und Folgen', automatedDecisions: 'Automatisierte Entscheidungen',
    cookies: 'Cookies und Gerätespeicher', backups: 'Sicherungskopien', deletion: 'Löschung und verbleibende Daten', authority: 'Beschwerde bei der Aufsichtsbehörde',
    contact: 'Datenschutzanfrage senden', subject: 'OMI – Antrag auf Ausübung von Betroffenenrechten',
    contactHint: 'Sie können Auskunft, Berichtigung, Löschung, Einschränkung, Widerspruch oder gegebenenfalls Datenübertragbarkeit verlangen. Anfragen sind grundsätzlich innerhalb eines Monats zu beantworten. Der Link öffnet Ihr E-Mail-Programm; Sie versenden die Nachricht selbst.',
    export: 'Kopie der Kontodaten herunterladen', exporting: 'Kopie wird erstellt…',
    exportHint: 'JSON-Kopie von Profil, verknüpften Anmeldeidentitäten, institutionellen Mitgliedschaften und Anmeldemetadaten. Für eine vollständige Auskunft einschließlich Manuskripten, Gutachten und Protokollen wenden Sie sich an den Verantwortlichen.',
    exportError: 'Die Kontodaten konnten nicht heruntergeladen werden.', back: 'Zurück zum Studio',
  };
  return {
    title: 'Privacy and personal data', loading: 'Loading privacy information…',
    missing: 'The operator has not supplied reviewed privacy information for this server. Request it from the server operator before registering.',
    unavailable: 'This server’s privacy information is currently unavailable.', retry: 'Retry',
    controller: 'Controller', dpo: 'Data protection officer', notice: 'Full privacy notice', version: 'Version',
    purpose: 'Purpose', categories: 'Data', legalBasis: 'Legal basis', retention: 'Retention', recipients: 'Recipients', internationalTransfers: 'International transfers',
    rights: 'Your rights', dataSources: 'Data sources', requiredData: 'Required data and consequences', automatedDecisions: 'Automated decisions',
    cookies: 'Cookies and device storage', backups: 'Backups', deletion: 'Deletion and retained data', authority: 'Complain to the supervisory authority',
    contact: 'Send a privacy request', subject: 'OMI – data subject rights request',
    contactHint: 'You may request access, rectification, erasure, restriction, objection or, where applicable, portability. Requests normally require a response within one month. The link opens your mail application; you send the message yourself.',
    export: 'Download a copy of account data', exporting: 'Preparing copy…',
    exportHint: 'JSON copy of profile, linked sign-in identities, institution memberships and sign-in metadata. For a full response covering manuscripts, reviews and logs, contact the controller.',
    exportError: 'The account data copy could not be downloaded.', back: 'Back to Studio',
  };
}
