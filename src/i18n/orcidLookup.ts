import type { SupportedLocale } from './types';

export interface OrcidLookupCopy {
  searching: string;
  noResults: string;
  unavailable: string;
  suggestions: string;
  selected: string;
  openProfile: string;
  registryMatch: string;
  notAuthenticated: string;
  manualEntry: string;
  poweredBy: string;
}

const COPY: Record<SupportedLocale, OrcidLookupCopy> = {
  en: {
    searching: 'Searching ORCID…',
    noResults: 'No matching public ORCID records found.',
    unavailable: 'ORCID search is temporarily unavailable. You can still enter an ORCID iD manually.',
    suggestions: 'ORCID suggestions',
    selected: 'ORCID iD',
    openProfile: 'Open ORCID record',
    registryMatch: 'Selected from the ORCID Registry',
    notAuthenticated: 'Registry match — not OAuth-authenticated',
    manualEntry: 'You can also enter an ORCID iD manually.',
    poweredBy: 'Search powered by the public ORCID Registry',
  },
  hu: {
    searching: 'Keresés az ORCID-ban…',
    noResults: 'Nem található egyező nyilvános ORCID-rekord.',
    unavailable: 'Az ORCID-keresés átmenetileg nem érhető el. Az ORCID iD kézzel továbbra is megadható.',
    suggestions: 'ORCID-találatok',
    selected: 'ORCID iD',
    openProfile: 'ORCID-rekord megnyitása',
    registryMatch: 'Az ORCID Registryből kiválasztva',
    notAuthenticated: 'Regisztertalálat — nem OAuth-hitelesített',
    manualEntry: 'Az ORCID iD kézzel is megadható.',
    poweredBy: 'Keresés a nyilvános ORCID Registryben',
  },
  de: {
    searching: 'ORCID wird durchsucht…',
    noResults: 'Keine passenden öffentlichen ORCID-Einträge gefunden.',
    unavailable: 'Die ORCID-Suche ist vorübergehend nicht verfügbar. Eine ORCID iD kann weiterhin manuell eingegeben werden.',
    suggestions: 'ORCID-Treffer',
    selected: 'ORCID iD',
    openProfile: 'ORCID-Eintrag öffnen',
    registryMatch: 'Aus dem ORCID-Register ausgewählt',
    notAuthenticated: 'Registertreffer — nicht per OAuth authentifiziert',
    manualEntry: 'Die ORCID iD kann auch manuell eingegeben werden.',
    poweredBy: 'Suche im öffentlichen ORCID-Register',
  },
};

export function getOrcidLookupCopy(locale: SupportedLocale): OrcidLookupCopy {
  return COPY[locale] ?? COPY.en;
}
