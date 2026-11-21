import type { z } from 'zod';
import type { studioFeedbackSchema } from './studioFeedbackSchema.js';

type Feedback = z.infer<typeof studioFeedbackSchema>;
type FeedbackLocale = 'en' | 'hu' | 'de' | 'fr' | 'it' | 'es' | 'nl' | 'pl';

type FeedbackMailCopy = {
  subject: string;
  reference: string;
  category: string;
  area: string;
  title: string;
  description: string;
  reproductionSteps: string;
  expectedResult: string;
  testOutcome: string;
  contact: string;
  technical: string;
  platform: string;
  appVersion: string;
  interfaceLanguage: string;
  notProvided: string;
  categories: Record<Feedback['category'], string>;
  areas: Record<Feedback['area'], string>;
  outcomes: Record<NonNullable<Feedback['testOutcome']>, string>;
  platforms: Record<NonNullable<Feedback['technical']>['platform'], string>;
};

const MAIL_COPY: Record<FeedbackLocale, FeedbackMailCopy> = {
  en: {
    subject: 'feedback', reference: 'Report ID', category: 'Category', area: 'Area',
    title: 'Title', description: 'Description', reproductionSteps: 'Reproduction steps',
    expectedResult: 'Expected result', testOutcome: 'Test outcome',
    contact: 'Contact e-mail (optional)', technical: 'Technical data (optional)',
    platform: 'Platform', appVersion: 'Application version', interfaceLanguage: 'Interface language',
    notProvided: 'Not provided',
    categories: { bug: 'Bug report', suggestion: 'Improvement suggestion', test: 'Testing experience' },
    areas: { editor: 'Editor', import: 'Import', export: 'Export', notes: 'Notes and citations', collaboration: 'Collaboration', publishing: 'Publication editor', account: 'Account and sign-in', other: 'Other' },
    outcomes: { success: 'Successful', problem: 'Problem found', not_applicable: 'Not applicable' },
    platforms: { android: 'Android', ios: 'iOS', desktop: 'Desktop', web: 'Web' },
  },
  hu: {
    subject: 'visszajelzés', reference: 'Bejelentésazonosító', category: 'Kategória', area: 'Érintett funkció',
    title: 'Cím', description: 'Leírás', reproductionSteps: 'A hiba előidézésének lépései',
    expectedResult: 'Elvárt működés', testOutcome: 'A teszt eredménye',
    contact: 'Kapcsolattartási e-mail (nem kötelező)', technical: 'Technikai adatok (nem kötelező)',
    platform: 'Platform', appVersion: 'Alkalmazásverzió', interfaceLanguage: 'A felület nyelve',
    notProvided: 'Nincs megadva',
    categories: { bug: 'Hibabejelentés', suggestion: 'Fejlesztési javaslat', test: 'Tesztelési tapasztalat' },
    areas: { editor: 'Szövegszerkesztő', import: 'Importálás', export: 'Exportálás', notes: 'Jegyzetek és hivatkozások', collaboration: 'Együttműködés', publishing: 'Kiadványszerkesztő', account: 'Fiók és bejelentkezés', other: 'Egyéb' },
    outcomes: { success: 'Sikeres', problem: 'Hiba tapasztalható', not_applicable: 'Nem értékelhető' },
    platforms: { android: 'Android', ios: 'iOS', desktop: 'Asztali alkalmazás', web: 'Webes változat' },
  },
  de: {
    subject: 'Rückmeldung', reference: 'Meldungskennung', category: 'Kategorie', area: 'Betroffener Bereich',
    title: 'Titel', description: 'Beschreibung', reproductionSteps: 'Schritte zum Reproduzieren',
    expectedResult: 'Erwartetes Verhalten', testOutcome: 'Testergebnis',
    contact: 'Kontakt-E-Mail (optional)', technical: 'Technische Angaben (optional)',
    platform: 'Plattform', appVersion: 'App-Version', interfaceLanguage: 'Oberflächensprache',
    notProvided: 'Nicht angegeben',
    categories: { bug: 'Fehlerbericht', suggestion: 'Verbesserungsvorschlag', test: 'Testerfahrung' },
    areas: { editor: 'Editor', import: 'Import', export: 'Export', notes: 'Anmerkungen und Zitate', collaboration: 'Zusammenarbeit', publishing: 'Publikationseditor', account: 'Konto und Anmeldung', other: 'Sonstiges' },
    outcomes: { success: 'Erfolgreich', problem: 'Problem aufgetreten', not_applicable: 'Nicht zutreffend' },
    platforms: { android: 'Android', ios: 'iOS', desktop: 'Desktop-Anwendung', web: 'Web' },
  },
  fr: {
    subject: "retour d'expérience", reference: 'Identifiant du rapport', category: 'Catégorie', area: 'Fonction concernée',
    title: 'Titre', description: 'Description', reproductionSteps: 'Étapes de reproduction',
    expectedResult: 'Résultat attendu', testOutcome: 'Résultat du test',
    contact: 'E-mail de contact (facultatif)', technical: 'Données techniques (facultatif)',
    platform: 'Plateforme', appVersion: "Version de l'application", interfaceLanguage: "Langue de l'interface",
    notProvided: 'Non renseigné',
    categories: { bug: 'Signalement de bogue', suggestion: "Suggestion d'amélioration", test: 'Résultat de test' },
    areas: { editor: 'Éditeur', import: 'Importation', export: 'Exportation', notes: 'Notes et références', collaboration: 'Collaboration', publishing: 'Éditeur de publication', account: 'Compte et connexion', other: 'Autre' },
    outcomes: { success: 'Réussi', problem: 'Problème constaté', not_applicable: 'Sans objet' },
    platforms: { android: 'Android', ios: 'iOS', desktop: 'Application de bureau', web: 'Web' },
  },
  it: {
    subject: 'segnalazione', reference: 'Identificativo del rapporto', category: 'Categoria', area: 'Funzione interessata',
    title: 'Titolo', description: 'Descrizione', reproductionSteps: 'Passaggi per riprodurre il problema',
    expectedResult: 'Comportamento previsto', testOutcome: 'Esito del test',
    contact: 'E-mail di contatto (facoltativa)', technical: 'Dati tecnici (facoltativi)',
    platform: 'Piattaforma', appVersion: "Versione dell'app", interfaceLanguage: "Lingua dell'interfaccia",
    notProvided: 'Non fornito',
    categories: { bug: 'Segnalazione di errore', suggestion: 'Proposta di miglioramento', test: 'Esperienza di test' },
    areas: { editor: 'Editor', import: 'Importazione', export: 'Esportazione', notes: 'Note e citazioni', collaboration: 'Collaborazione', publishing: 'Editor delle pubblicazioni', account: 'Account e accesso', other: 'Altro' },
    outcomes: { success: 'Riuscito', problem: 'Problema riscontrato', not_applicable: 'Non applicabile' },
    platforms: { android: 'Android', ios: 'iOS', desktop: 'Applicazione desktop', web: 'Web' },
  },
  es: {
    subject: 'comentarios', reference: 'Identificador del informe', category: 'Categoría', area: 'Función afectada',
    title: 'Título', description: 'Descripción', reproductionSteps: 'Pasos para reproducir el error',
    expectedResult: 'Resultado esperado', testOutcome: 'Resultado de la prueba',
    contact: 'Correo de contacto (opcional)', technical: 'Datos técnicos (opcionales)',
    platform: 'Plataforma', appVersion: 'Versión de la aplicación', interfaceLanguage: 'Idioma de la interfaz',
    notProvided: 'No facilitado',
    categories: { bug: 'Informe de error', suggestion: 'Sugerencia de mejora', test: 'Experiencia de prueba' },
    areas: { editor: 'Editor', import: 'Importación', export: 'Exportación', notes: 'Notas y citas', collaboration: 'Colaboración', publishing: 'Editor de publicaciones', account: 'Cuenta e inicio de sesión', other: 'Otro' },
    outcomes: { success: 'Correcto', problem: 'Se detectó un problema', not_applicable: 'No aplicable' },
    platforms: { android: 'Android', ios: 'iOS', desktop: 'Aplicación de escritorio', web: 'Web' },
  },
  nl: {
    subject: 'feedback', reference: 'Meldingsnummer', category: 'Categorie', area: 'Betrokken functie',
    title: 'Titel', description: 'Beschrijving', reproductionSteps: 'Stappen om het probleem te reproduceren',
    expectedResult: 'Verwacht resultaat', testOutcome: 'Testresultaat',
    contact: 'Contact-e-mailadres (optioneel)', technical: 'Technische gegevens (optioneel)',
    platform: 'Platform', appVersion: 'Appversie', interfaceLanguage: 'Interfacetaal',
    notProvided: 'Niet opgegeven',
    categories: { bug: 'Foutmelding', suggestion: 'Verbeteringsvoorstel', test: 'Testervaring' },
    areas: { editor: 'Editor', import: 'Importeren', export: 'Exporteren', notes: 'Noten en verwijzingen', collaboration: 'Samenwerking', publishing: 'Publicatie-editor', account: 'Account en aanmelden', other: 'Overig' },
    outcomes: { success: 'Geslaagd', problem: 'Probleem vastgesteld', not_applicable: 'Niet van toepassing' },
    platforms: { android: 'Android', ios: 'iOS', desktop: 'Desktopapplicatie', web: 'Web' },
  },
  pl: {
    subject: 'opinia', reference: 'Identyfikator zgłoszenia', category: 'Kategoria', area: 'Obszar funkcjonalny',
    title: 'Tytuł', description: 'Opis', reproductionSteps: 'Kroki odtworzenia błędu',
    expectedResult: 'Oczekiwane działanie', testOutcome: 'Wynik testu',
    contact: 'Kontaktowy adres e-mail (opcjonalnie)', technical: 'Dane techniczne (opcjonalnie)',
    platform: 'Platforma', appVersion: 'Wersja aplikacji', interfaceLanguage: 'Język interfejsu',
    notProvided: 'Nie podano',
    categories: { bug: 'Zgłoszenie błędu', suggestion: 'Propozycja ulepszenia', test: 'Wynik testu' },
    areas: { editor: 'Edytor', import: 'Import', export: 'Eksport', notes: 'Przypisy i cytowania', collaboration: 'Współpraca', publishing: 'Edytor publikacji', account: 'Konto i logowanie', other: 'Inne' },
    outcomes: { success: 'Powodzenie', problem: 'Wystąpił problem', not_applicable: 'Nie dotyczy' },
    platforms: { android: 'Android', ios: 'iOS', desktop: 'Aplikacja komputerowa', web: 'Web' },
  },
};

/** Report language selection is independent from optional diagnostic metadata. */
export function resolveFeedbackMailLocale(value: string | undefined): FeedbackLocale {
  const candidate = value?.trim().toLowerCase().replace(/_/g, '-').split('-')[0] ?? 'en';
  return candidate in MAIL_COPY ? candidate as FeedbackLocale : 'en';
}

function mimeHeaderWord(value: string): string {
  // RFC 2047 encoded-word for a short, fixed localized subject fragment.
  return '=?UTF-8?B?' + Buffer.from(value, 'utf8').toString('base64') + '?=';
}

export function formatStudioFeedbackMail(
  reportId: string,
  data: Feedback,
  from: string,
  to: string,
): string {
  const text = MAIL_COPY[resolveFeedbackMailLocale(data.messageLocale)];
  const optional = (value: string | undefined) => value || text.notProvided;
  const lines = [
    'OMI Studio — ' + text.reference + ': ' + reportId,
    text.category + ': ' + text.categories[data.category],
    text.area + ': ' + text.areas[data.area],
    text.title + ': ' + data.title,
    text.description + ':',
    data.description,
    text.reproductionSteps + ':',
    optional(data.reproductionSteps),
    text.expectedResult + ':',
    optional(data.expectedResult),
    text.testOutcome + ': ' + (data.testOutcome ? text.outcomes[data.testOutcome] : text.notProvided),
    text.contact + ': ' + optional(data.contactEmail),
    text.technical + ':',
    ...(data.technical ? [
      text.platform + ': ' + text.platforms[data.technical.platform],
      text.appVersion + ': ' + data.technical.appVersion,
      text.interfaceLanguage + ': ' + data.technical.locale,
    ] : [text.notProvided]),
  ];
  // User-controlled text appears ONLY in the body. Subject contains fixed
  // translations and the random server-generated identifier.
  return [
    'From: ' + from,
    'To: ' + to,
    'Subject: OMI Studio ' + mimeHeaderWord(text.subject) + ' ' + reportId,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Auto-Submitted: auto-generated',
    '',
    lines.join('\r\n'),
    '',
  ].join('\r\n');
}
