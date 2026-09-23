export interface StudioMenuSupplementalCopy {
  home: string;
  assignments: string;
  editorialWorkspace?: string;
  publicationEditor: string;
  signatures: string;
}

type StudioUiLocale =
  | 'bg'
  | 'cs'
  | 'da'
  | 'de'
  | 'el'
  | 'en'
  | 'es'
  | 'et'
  | 'fi'
  | 'fr'
  | 'ga'
  | 'hr'
  | 'hu'
  | 'it'
  | 'lt'
  | 'lv'
  | 'mt'
  | 'nl'
  | 'pl'
  | 'pt'
  | 'ro'
  | 'sk'
  | 'sl'
  | 'sv';

const studioMenuSupplementalTranslations: Record<StudioUiLocale, StudioMenuSupplementalCopy> = {
  bg: { home: 'Начало', assignments: 'Задания', editorialWorkspace: 'Редакционен работен процес', publicationEditor: 'Жив редактор', signatures: 'Подписи' },
  cs: { home: 'Domů', assignments: 'Úkoly', editorialWorkspace: 'Redakční pracovní postup', publicationEditor: 'Živý editor', signatures: 'Podpisy' },
  da: { home: 'Hjem', assignments: 'Opgaver', editorialWorkspace: 'Redaktionelt workflow', publicationEditor: 'Live-editor', signatures: 'Signaturer' },
  de: { home: 'Startseite', assignments: 'Aufträge', editorialWorkspace: 'Redaktionsbereich', publicationEditor: 'Live-Publikationseditor', signatures: 'Signaturen' },
  el: { home: 'Αρχική', assignments: 'Αναθέσεις', editorialWorkspace: 'Ροή εργασίας σύνταξης', publicationEditor: 'Ζωντανός επεξεργαστής', signatures: 'Υπογραφές' },
  en: { home: 'Home', assignments: 'Assignments', editorialWorkspace: 'Editorial workflow', publicationEditor: 'Live publication editor', signatures: 'Signatures' },
  es: { home: 'Inicio', assignments: 'Asignaciones', editorialWorkspace: 'Flujo editorial', publicationEditor: 'Editor de publicación en vivo', signatures: 'Firmas' },
  et: { home: 'Avaleht', assignments: 'Ülesanded', editorialWorkspace: 'Toimetusvoog', publicationEditor: 'Reaalajatoimetaja', signatures: 'Allkirjad' },
  fi: { home: 'Etusivu', assignments: 'Tehtävät', editorialWorkspace: 'Toimituksellinen työnkulku', publicationEditor: 'Reaaliaikainen julkaisueditori', signatures: 'Allekirjoitukset' },
  fr: { home: 'Accueil', assignments: 'Attributions', editorialWorkspace: 'Flux éditorial', publicationEditor: 'Éditeur de publication en direct', signatures: 'Signatures' },
  ga: { home: 'Baile', assignments: 'Sannacháin', editorialWorkspace: 'Sreabhadh oibre eagarthóireachta', publicationEditor: 'Eagarthóir beo', signatures: 'Sínithe' },
  hr: { home: 'Početna', assignments: 'Zaduženja', editorialWorkspace: 'Urednički tijek rada', publicationEditor: 'Uređivač publikacije uživo', signatures: 'Potpisi' },
  hu: { home: 'Főoldal', assignments: 'Megbízások', editorialWorkspace: 'Szerkesztőségi munkatér', publicationEditor: 'Élő kiadványszerkesztő', signatures: 'Aláírások' },
  it: { home: 'Pagina iniziale', assignments: 'Incarichi', editorialWorkspace: 'Flusso editoriale', publicationEditor: 'Editor di pubblicazione dal vivo', signatures: 'Firme' },
  lt: { home: 'Pradžia', assignments: 'Užduotys', editorialWorkspace: 'Redakcinė darbo eiga', publicationEditor: 'Tiesioginis leidinio redaktorius', signatures: 'Parašai' },
  lv: { home: 'Sākums', assignments: 'Uzdevumi', editorialWorkspace: 'Redakcijas darbplūsma', publicationEditor: 'Tiešais publikācijas redaktors', signatures: 'Paraksti' },
  mt: { home: 'Paġna ewlenija', assignments: 'Assenjazzjonijiet', editorialWorkspace: 'Fluss tax-xogħol editorjali', publicationEditor: 'Editur tal-pubblikazzjoni dirett', signatures: 'Firem' },
  nl: { home: 'Start', assignments: 'Toewijzingen', editorialWorkspace: 'Redactionele workflow', publicationEditor: 'Live publicatie-editor', signatures: 'Handtekeningen' },
  pl: { home: 'Strona główna', assignments: 'Przydziały', editorialWorkspace: 'Przepływ redakcyjny', publicationEditor: 'Edytor publikacji na żywo', signatures: 'Podpisy' },
  pt: { home: 'Início', assignments: 'Atribuições', editorialWorkspace: 'Fluxo editorial', publicationEditor: 'Editor de publicação em direto', signatures: 'Assinaturas' },
  ro: { home: 'Acasă', assignments: 'Sarcini', editorialWorkspace: 'Flux editorial', publicationEditor: 'Editor de publicație live', signatures: 'Semnături' },
  sk: { home: 'Domov', assignments: 'Priradenia', editorialWorkspace: 'Redakčný pracovný postup', publicationEditor: 'Živý editor publikácie', signatures: 'Podpisy' },
  sl: { home: 'Domov', assignments: 'Dodelitve', editorialWorkspace: 'Uredniški potek dela', publicationEditor: 'Urejevalnik publikacije v živo', signatures: 'Podpisi' },
  sv: { home: 'Hem', assignments: 'Uppdrag', editorialWorkspace: 'Redaktionellt arbetsflöde', publicationEditor: 'Livepubliceringsredigerare', signatures: 'Signaturer' },
};

export function getStudioMenuSupplementalCopy(
  locale: string,
): StudioMenuSupplementalCopy {
  return studioMenuSupplementalTranslations[locale as StudioUiLocale]
    ?? studioMenuSupplementalTranslations.en;
}
