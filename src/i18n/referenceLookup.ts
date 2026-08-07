import type { SupportedLocale } from './types';

export interface ReferenceLookupCopy {
  title: string;
  description: string;
  queryLabel: string;
  queryPlaceholder: string;
  search: string;
  searching: string;
  providers: string;
  apiKeyRequired: string;
  serviceSettings: string;
  crossrefEmail: string;
  crossrefEmailHint: string;
  openAlexApiKey: string;
  openAlexApiKeyHint: string;
  privacyNote: string;
  missingApiKey: string;
  providerUnavailable: string;
  noResults: string;
  addToLibrary: string;
  alreadyAdded: string;
}

const COPY: Record<SupportedLocale, ReferenceLookupCopy> = {
  en: {
    title: 'Search external bibliographic services',
    description:
      'Search Crossref, DataCite, OpenAlex and MTMT, then add a normalized record to this manuscript’s reference library.',
    queryLabel: 'Bibliographic query',
    queryPlaceholder: 'DOI, title, author or keywords…',
    search: 'Search',
    searching: 'Searching…',
    providers: 'Bibliographic providers',
    apiKeyRequired: 'API key required',
    serviceSettings: 'Service settings',
    crossrefEmail: 'Crossref contact email (optional)',
    crossrefEmailHint:
      'When provided, Crossref receives it through the recommended mailto parameter for polite API access.',
    openAlexApiKey: 'OpenAlex API key',
    openAlexApiKeyHint:
      'OpenAlex currently requires an API key. The key is stored only in this browser and is never written to the manuscript.',
    privacyNote:
      'Queries are sent only to the providers you enable. Service credentials and contact settings are local interface preferences and are not exported in .omi.json.',
    missingApiKey: 'This provider was skipped because its required API key is not configured.',
    providerUnavailable: 'The provider could not be queried. Other provider results are still shown.',
    noResults: 'No matching bibliographic records were returned by the selected providers.',
    addToLibrary: 'Add to library',
    alreadyAdded: 'Already added',
  },
  hu: {
    title: 'Keresés külső bibliográfiai szolgáltatásokban',
    description:
      'Keresés a Crossref, DataCite, OpenAlex és MTMT adatbázisában, majd a kiválasztott rekord normalizált felvétele a kézirat hivatkozásjegyzékébe.',
    queryLabel: 'Bibliográfiai keresés',
    queryPlaceholder: 'DOI, cím, szerző vagy kulcsszavak…',
    search: 'Keresés',
    searching: 'Keresés…',
    providers: 'Bibliográfiai szolgáltatók',
    apiKeyRequired: 'API-kulcs szükséges',
    serviceSettings: 'Szolgáltatási beállítások',
    crossrefEmail: 'Crossref kapcsolattartó e-mail (opcionális)',
    crossrefEmailHint:
      'Megadásakor a Crossref a javasolt mailto paraméterben kapja meg a címet a kíméletes API-használathoz.',
    openAlexApiKey: 'OpenAlex API-kulcs',
    openAlexApiKeyHint:
      'Az OpenAlex jelenleg API-kulcsot kér. A kulcs csak ebben a böngészőben tárolódik, és nem kerül a kéziratba.',
    privacyNote:
      'A keresés csak az engedélyezett szolgáltatókhoz küld kérést. A szolgáltatási hitelesítési és kapcsolattartási adatok helyi felületi beállítások, és nem kerülnek a .omi.json exportba.',
    missingApiKey: 'A szolgáltató lekérdezése kimaradt, mert nincs beállítva a szükséges API-kulcs.',
    providerUnavailable: 'A szolgáltató jelenleg nem volt lekérdezhető. A többi szolgáltató találatai ettől még megjelennek.',
    noResults: 'A kiválasztott szolgáltatók nem adtak vissza megfelelő bibliográfiai rekordot.',
    addToLibrary: 'Felvétel a hivatkozásjegyzékbe',
    alreadyAdded: 'Már felvéve',
  },
  de: {
    title: 'Externe bibliografische Dienste durchsuchen',
    description:
      'Crossref, DataCite, OpenAlex und MTMT durchsuchen und einen normalisierten Datensatz in die Referenzbibliothek des Manuskripts übernehmen.',
    queryLabel: 'Bibliografische Suche',
    queryPlaceholder: 'DOI, Titel, Autor oder Stichwörter…',
    search: 'Suchen',
    searching: 'Suche…',
    providers: 'Bibliografische Anbieter',
    apiKeyRequired: 'API-Schlüssel erforderlich',
    serviceSettings: 'Diensteinstellungen',
    crossrefEmail: 'Crossref-Kontakt-E-Mail (optional)',
    crossrefEmailHint:
      'Wenn angegeben, erhält Crossref die Adresse über den empfohlenen mailto-Parameter für den höflichen API-Zugang.',
    openAlexApiKey: 'OpenAlex-API-Schlüssel',
    openAlexApiKeyHint:
      'OpenAlex erfordert derzeit einen API-Schlüssel. Der Schlüssel wird nur in diesem Browser gespeichert und nie in das Manuskript geschrieben.',
    privacyNote:
      'Suchanfragen werden nur an aktivierte Anbieter gesendet. Zugangsdaten und Kontakteinstellungen bleiben lokale Oberflächenpräferenzen und werden nicht in .omi.json exportiert.',
    missingApiKey: 'Dieser Anbieter wurde übersprungen, weil der erforderliche API-Schlüssel nicht konfiguriert ist.',
    providerUnavailable: 'Der Anbieter konnte nicht abgefragt werden. Ergebnisse anderer Anbieter werden weiterhin angezeigt.',
    noResults: 'Die ausgewählten Anbieter lieferten keine passenden bibliografischen Datensätze.',
    addToLibrary: 'Zur Bibliothek hinzufügen',
    alreadyAdded: 'Bereits hinzugefügt',
  },
};

export function getReferenceLookupCopy(locale: SupportedLocale): ReferenceLookupCopy {
  return COPY[locale] ?? COPY.en;
}
