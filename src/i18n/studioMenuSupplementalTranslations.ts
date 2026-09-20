export interface StudioMenuSupplementalCopy {
  home: string;
  assignments: string;
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
  bg: { home: 'Начало', assignments: 'Задания', publicationEditor: 'Жив редактор', signatures: 'Подписи' },
  cs: { home: 'Domů', assignments: 'Úkoly', publicationEditor: 'Živý editor', signatures: 'Podpisy' },
  da: { home: 'Hjem', assignments: 'Opgaver', publicationEditor: 'Live-editor', signatures: 'Signaturer' },
  de: { home: 'Startseite', assignments: 'Aufträge', publicationEditor: 'Live-Publikationseditor', signatures: 'Signaturen' },
  el: { home: 'Αρχική', assignments: 'Αναθέσεις', publicationEditor: 'Ζωντανός επεξεργαστής', signatures: 'Υπογραφές' },
  en: { home: 'Home', assignments: 'Assignments', publicationEditor: 'Live publication editor', signatures: 'Signatures' },
  es: { home: 'Inicio', assignments: 'Asignaciones', publicationEditor: 'Editor de publicación en vivo', signatures: 'Firmas' },
  et: { home: 'Avaleht', assignments: 'Ülesanded', publicationEditor: 'Reaalajatoimetaja', signatures: 'Allkirjad' },
  fi: { home: 'Etusivu', assignments: 'Tehtävät', publicationEditor: 'Reaaliaikainen julkaisueditori', signatures: 'Allekirjoitukset' },
  fr: { home: 'Accueil', assignments: 'Attributions', publicationEditor: 'Éditeur de publication en direct', signatures: 'Signatures' },
  ga: { home: 'Baile', assignments: 'Sannacháin', publicationEditor: 'Eagarthóir beo', signatures: 'Sínithe' },
  hr: { home: 'Početna', assignments: 'Zaduženja', publicationEditor: 'Uređivač publikacije uživo', signatures: 'Potpisi' },
  hu: { home: 'Főoldal', assignments: 'Megbízások', publicationEditor: 'Élő kiadványszerkesztő', signatures: 'Aláírások' },
  it: { home: 'Pagina iniziale', assignments: 'Incarichi', publicationEditor: 'Editor di pubblicazione dal vivo', signatures: 'Firme' },
  lt: { home: 'Pradžia', assignments: 'Užduotys', publicationEditor: 'Tiesioginis leidinio redaktorius', signatures: 'Parašai' },
  lv: { home: 'Sākums', assignments: 'Uzdevumi', publicationEditor: 'Tiešais publikācijas redaktors', signatures: 'Paraksti' },
  mt: { home: 'Paġna ewlenija', assignments: 'Assenjazzjonijiet', publicationEditor: 'Editur tal-pubblikazzjoni dirett', signatures: 'Firem' },
  nl: { home: 'Start', assignments: 'Toewijzingen', publicationEditor: 'Live publicatie-editor', signatures: 'Handtekeningen' },
  pl: { home: 'Strona główna', assignments: 'Przydziały', publicationEditor: 'Edytor publikacji na żywo', signatures: 'Podpisy' },
  pt: { home: 'Início', assignments: 'Atribuições', publicationEditor: 'Editor de publicação em direto', signatures: 'Assinaturas' },
  ro: { home: 'Acasă', assignments: 'Sarcini', publicationEditor: 'Editor de publicație live', signatures: 'Semnături' },
  sk: { home: 'Domov', assignments: 'Priradenia', publicationEditor: 'Živý editor publikácie', signatures: 'Podpisy' },
  sl: { home: 'Domov', assignments: 'Dodelitve', publicationEditor: 'Urejevalnik publikacije v živo', signatures: 'Podpisi' },
  sv: { home: 'Hem', assignments: 'Uppdrag', publicationEditor: 'Livepubliceringsredigerare', signatures: 'Signaturer' },
};

export function getStudioMenuSupplementalCopy(
  locale: string,
): StudioMenuSupplementalCopy {
  return studioMenuSupplementalTranslations[locale as StudioUiLocale]
    ?? studioMenuSupplementalTranslations.en;
}
