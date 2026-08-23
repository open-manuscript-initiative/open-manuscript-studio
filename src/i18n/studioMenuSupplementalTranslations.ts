import type { SupportedLocale } from './types';

export interface StudioMenuSupplementalCopy {
  assignments: string;
  signatures: string;
}

const studioMenuSupplementalTranslations: Record<SupportedLocale, StudioMenuSupplementalCopy> = {
  bg: { assignments: 'Задания', signatures: 'Подписи' },
  cs: { assignments: 'Úkoly', signatures: 'Podpisy' },
  da: { assignments: 'Opgaver', signatures: 'Signaturer' },
  de: { assignments: 'Aufträge', signatures: 'Signaturen' },
  el: { assignments: 'Αναθέσεις', signatures: 'Υπογραφές' },
  en: { assignments: 'Assignments', signatures: 'Signatures' },
  es: { assignments: 'Asignaciones', signatures: 'Firmas' },
  et: { assignments: 'Ülesanded', signatures: 'Allkirjad' },
  fi: { assignments: 'Tehtävät', signatures: 'Allekirjoitukset' },
  fr: { assignments: 'Attributions', signatures: 'Signatures' },
  ga: { assignments: 'Sannacháin', signatures: 'Sínithe' },
  hr: { assignments: 'Zaduženja', signatures: 'Potpisi' },
  hu: { assignments: 'Megbízások', signatures: 'Aláírások' },
  it: { assignments: 'Incarichi', signatures: 'Firme' },
  lt: { assignments: 'Užduotys', signatures: 'Parašai' },
  lv: { assignments: 'Uzdevumi', signatures: 'Paraksti' },
  mt: { assignments: 'Assenjazzjonijiet', signatures: 'Firem' },
  nl: { assignments: 'Toewijzingen', signatures: 'Handtekeningen' },
  pl: { assignments: 'Przydziały', signatures: 'Podpisy' },
  pt: { assignments: 'Atribuições', signatures: 'Assinaturas' },
  ro: { assignments: 'Sarcini', signatures: 'Semnături' },
  sk: { assignments: 'Priradenia', signatures: 'Podpisy' },
  sl: { assignments: 'Dodelitve', signatures: 'Podpisi' },
  sv: { assignments: 'Uppdrag', signatures: 'Signaturer' },
};

export function getStudioMenuSupplementalCopy(
  locale: SupportedLocale,
): StudioMenuSupplementalCopy {
  return studioMenuSupplementalTranslations[locale];
}
