export interface StudioMenuSupplementalCopy {
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
  bg: { assignments: 'Задания', publicationEditor: 'Жив редактор', signatures: 'Подписи' },
  cs: { assignments: 'Úkoly', publicationEditor: 'Živý editor', signatures: 'Podpisy' },
  da: { assignments: 'Opgaver', publicationEditor: 'Live-editor', signatures: 'Signaturer' },
  de: { assignments: 'Aufträge', publicationEditor: 'Live-Publikationseditor', signatures: 'Signaturen' },
  el: { assignments: 'Αναθέσεις', publicationEditor: 'Ζωντανός επεξεργαστής', signatures: 'Υπογραφές' },
  en: { assignments: 'Assignments', publicationEditor: 'Live publication editor', signatures: 'Signatures' },
  es: { assignments: 'Asignaciones', publicationEditor: 'Editor de publicación en vivo', signatures: 'Firmas' },
  et: { assignments: 'Ülesanded', publicationEditor: 'Reaalajatoimetaja', signatures: 'Allkirjad' },
  fi: { assignments: 'Tehtävät', publicationEditor: 'Reaaliaikainen julkaisueditori', signatures: 'Allekirjoitukset' },
  fr: { assignments: 'Attributions', publicationEditor: 'Éditeur de publication en direct', signatures: 'Signatures' },
  ga: { assignments: 'Sannacháin', publicationEditor: 'Eagarthóir beo', signatures: 'Sínithe' },
  hr: { assignments: 'Zaduženja', publicationEditor: 'Uređivač publikacije uživo', signatures: 'Potpisi' },
  hu: { assignments: 'Megbízások', publicationEditor: 'Élő kiadványszerkesztő', signatures: 'Aláírások' },
  it: { assignments: 'Incarichi', publicationEditor: 'Editor di pubblicazione dal vivo', signatures: 'Firme' },
  lt: { assignments: 'Užduotys', publicationEditor: 'Tiesioginis leidinio redaktorius', signatures: 'Parašai' },
  lv: { assignments: 'Uzdevumi', publicationEditor: 'Tiešais publikācijas redaktors', signatures: 'Paraksti' },
  mt: { assignments: 'Assenjazzjonijiet', publicationEditor: 'Editur tal-pubblikazzjoni dirett', signatures: 'Firem' },
  nl: { assignments: 'Toewijzingen', publicationEditor: 'Live publicatie-editor', signatures: 'Handtekeningen' },
  pl: { assignments: 'Przydziały', publicationEditor: 'Edytor publikacji na żywo', signatures: 'Podpisy' },
  pt: { assignments: 'Atribuições', publicationEditor: 'Editor de publicação em direto', signatures: 'Assinaturas' },
  ro: { assignments: 'Sarcini', publicationEditor: 'Editor de publicație live', signatures: 'Semnături' },
  sk: { assignments: 'Priradenia', publicationEditor: 'Živý editor publikácie', signatures: 'Podpisy' },
  sl: { assignments: 'Dodelitve', publicationEditor: 'Urejevalnik publikacije v živo', signatures: 'Podpisi' },
  sv: { assignments: 'Uppdrag', publicationEditor: 'Livepubliceringsredigerare', signatures: 'Signaturer' },
};

export function getStudioMenuSupplementalCopy(
  locale: string,
): StudioMenuSupplementalCopy {
  return studioMenuSupplementalTranslations[locale as StudioUiLocale]
    ?? studioMenuSupplementalTranslations.en;
}
