import type { SupportedLocale } from './types';

export interface RorAffiliationCopy {
  searching: string;
  suggestions: string;
  noResults: string;
  searchUnavailable: string;
  selected: string;
  removeLink: string;
  openRor: string;
  locationUnknown: string;
  poweredBy: string;
}

const COPY: Record<SupportedLocale, RorAffiliationCopy> = {
  en: {
    searching: 'Searching ROR…',
    suggestions: 'ROR organization suggestions',
    noResults: 'No ROR organization found. You can keep the affiliation as free text.',
    searchUnavailable: 'ROR search is temporarily unavailable. You can keep editing the affiliation manually.',
    selected: 'Linked to ROR',
    removeLink: 'Remove ROR link',
    openRor: 'Open ROR record',
    locationUnknown: 'Location not specified',
    poweredBy: 'Organization data from ROR',
  },
  hu: {
    searching: 'Keresés a ROR-ban…',
    suggestions: 'ROR intézményi találatok',
    noResults: 'Nem található megfelelő ROR-intézmény. Az affiliáció szabad szövegként is megtartható.',
    searchUnavailable: 'A ROR keresése átmenetileg nem érhető el. Az affiliáció továbbra is kézzel szerkeszthető.',
    selected: 'ROR-hoz kapcsolva',
    removeLink: 'ROR-kapcsolat eltávolítása',
    openRor: 'ROR-rekord megnyitása',
    locationUnknown: 'Nincs megadott hely',
    poweredBy: 'Intézményi adatok: ROR',
  },
  de: {
    searching: 'ROR wird durchsucht…',
    suggestions: 'ROR-Organisationsvorschläge',
    noResults: 'Keine passende ROR-Organisation gefunden. Die Affiliation kann als Freitext beibehalten werden.',
    searchUnavailable: 'Die ROR-Suche ist vorübergehend nicht verfügbar. Die Affiliation kann weiterhin manuell bearbeitet werden.',
    selected: 'Mit ROR verknüpft',
    removeLink: 'ROR-Verknüpfung entfernen',
    openRor: 'ROR-Datensatz öffnen',
    locationUnknown: 'Kein Ort angegeben',
    poweredBy: 'Organisationsdaten von ROR',
  },
};

export function getRorAffiliationCopy(locale: string): RorAffiliationCopy {
  return COPY[isSupportedCopyLocale(locale) ? locale : 'en'];
}

function isSupportedCopyLocale(locale: string): locale is SupportedLocale {
  return locale === 'en' || locale === 'hu' || locale === 'de';
}
