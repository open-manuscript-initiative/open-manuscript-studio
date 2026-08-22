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
  webProvidersTitle: string;
  webProvidersDescription: string;
  addAcademia: string;
  addCustomProvider: string;
  providerName: string;
  loginUrl: string;
  searchUrlTemplate: string;
  searchUrlTemplateHint: string;
  logoutUrl: string;
  logoutUrlHint: string;
  addProvider: string;
  cancel: string;
  signIn: string;
  signOut: string;
  searchProvider: string;
  removeProvider: string;
  webSessionPrivacyNote: string;
  webProviderInvalid: string;
  webProviderAdded: string;
  webProviderRemoved: string;
  webLoginOpened: string;
  webSearchOpened: string;
  webProviderOpenFailed: string;
  webSessionCleared: string;
  browserLogoutOpened: string;
}

const COPY: Record<SupportedLocale, ReferenceLookupCopy> = {
  en: {
    title: 'Search external bibliographic services',
    description:
      'Search normalized bibliographic APIs and, when configured, signed-in scholarly web services from the same workspace.',
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
      'OpenAlex currently requires an API key. The key is kept only in memory for the current Studio session and is never written to local settings or the manuscript.',
    privacyNote:
      'Queries are sent only to the API providers you enable. Local interface preferences are not exported in .omi.json.',
    missingApiKey: 'This provider was skipped because its required API key is not configured.',
    providerUnavailable: 'The provider could not be queried. Other provider results are still shown.',
    noResults: 'No matching bibliographic records were returned by the selected API providers.',
    addToLibrary: 'Add to library',
    alreadyAdded: 'Already added',
    webProvidersTitle: 'Signed-in web services',
    webProvidersDescription:
      'Add services that provide their own website login. Enabled services open the current query in their normal signed-in web session.',
    addAcademia: 'Add Academia.edu',
    addCustomProvider: 'Add another service',
    providerName: 'Service name',
    loginUrl: 'Login URL',
    searchUrlTemplate: 'Search URL template',
    searchUrlTemplateHint:
      'Use {query} where the encoded search text should be inserted, for example https://example.org/search?q={query}.',
    logoutUrl: 'Logout URL (optional)',
    logoutUrlHint:
      'Used by the browser version to ask the service itself to end the session.',
    addProvider: 'Add service',
    cancel: 'Cancel',
    signIn: 'Sign in',
    signOut: 'Sign out and clear session',
    searchProvider: 'Search this service',
    removeProvider: 'Remove service',
    webSessionPrivacyNote:
      'OMI Studio never asks for, reads or stores the service password. Sign-in happens on the provider’s own page. In the installed app, the provider WebView keeps its normal browser session between launches; “Sign out and clear session” deletes that local WebView browsing data. In the web version, cookie deletion remains under the browser and provider’s control.',
    webProviderInvalid:
      'The service could not be added. Use HTTPS URLs and include {query} in the search URL template.',
    webProviderAdded: 'The web service was added.',
    webProviderRemoved: 'The web service and its local Studio session were removed.',
    webLoginOpened: 'The service login page was opened.',
    webSearchOpened: 'Signed-in web-service searches opened in their own windows.',
    webProviderOpenFailed: 'One or more signed-in web services could not be opened.',
    webSessionCleared: 'The local signed-in web session was cleared.',
    browserLogoutOpened:
      'The service logout page was opened. In the web version, the browser controls the service cookies.',
  },
  hu: {
    title: 'Keresés külső bibliográfiai szolgáltatásokban',
    description:
      'Keresés normalizált bibliográfiai API-kban és – beállítás esetén – bejelentkezést igénylő tudományos webes szolgáltatásokban ugyanarról a felületről.',
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
      'Az OpenAlex jelenleg API-kulcsot kér. A kulcs csak az aktuális Studio-munkamenet memóriájában marad, nem kerül sem a helyi beállításokba, sem a kéziratba.',
    privacyNote:
      'A keresés csak az engedélyezett API-szolgáltatókhoz küld kérést. A helyi felületi beállítások nem kerülnek a .omi.json exportba.',
    missingApiKey: 'A szolgáltató lekérdezése kimaradt, mert nincs beállítva a szükséges API-kulcs.',
    providerUnavailable: 'A szolgáltató jelenleg nem volt lekérdezhető. A többi szolgáltató találatai ettől még megjelennek.',
    noResults: 'A kiválasztott API-szolgáltatók nem adtak vissza megfelelő bibliográfiai rekordot.',
    addToLibrary: 'Felvétel a hivatkozásjegyzékbe',
    alreadyAdded: 'Már felvéve',
    webProvidersTitle: 'Bejelentkezést igénylő webes szolgáltatások',
    webProvidersDescription:
      'Olyan szolgáltatók vehetők fel, amelyek a saját weboldalukon kezelik a bejelentkezést. Az engedélyezett szolgáltatások a jelenlegi keresést a saját, bejelentkezett webes munkamenetükben nyitják meg.',
    addAcademia: 'Academia.edu hozzáadása',
    addCustomProvider: 'Másik szolgáltató hozzáadása',
    providerName: 'Szolgáltatás neve',
    loginUrl: 'Bejelentkezési URL',
    searchUrlTemplate: 'Keresési URL-sablon',
    searchUrlTemplateHint:
      'A {query} helyére kerül a kódolt keresőkifejezés, például: https://pelda.hu/search?q={query}.',
    logoutUrl: 'Kijelentkezési URL (opcionális)',
    logoutUrlHint:
      'A webes változat ezt használja arra, hogy maga a szolgáltató zárja le a munkamenetet.',
    addProvider: 'Szolgáltatás hozzáadása',
    cancel: 'Mégse',
    signIn: 'Bejelentkezés',
    signOut: 'Kijelentkezés és munkamenet törlése',
    searchProvider: 'Keresés ebben a szolgáltatásban',
    removeProvider: 'Szolgáltatás eltávolítása',
    webSessionPrivacyNote:
      'Az OMI Studio nem kéri, nem olvassa és nem tárolja a szolgáltató jelszavát. A bejelentkezés a szolgáltató saját oldalán történik. A telepített alkalmazásban a szolgáltató WebView-ja a normál böngészőhöz hasonlóan megőrzi a munkamenetet az újraindítások között; a „Kijelentkezés és munkamenet törlése” törli ennek helyi böngészési adatait. A webes változatban a sütik törlését a böngésző és a szolgáltató kezeli.',
    webProviderInvalid:
      'A szolgáltatás nem vehető fel. HTTPS URL-eket használj, és a keresési URL-sablon tartalmazza a {query} jelölőt.',
    webProviderAdded: 'A webes szolgáltatás hozzáadva.',
    webProviderRemoved: 'A webes szolgáltatás és helyi Studio-munkamenete eltávolítva.',
    webLoginOpened: 'A szolgáltató bejelentkezési oldala megnyílt.',
    webSearchOpened: 'A bejelentkezett webes szolgáltatások keresése külön ablakokban megnyílt.',
    webProviderOpenFailed: 'Egy vagy több bejelentkezett webes szolgáltatást nem sikerült megnyitni.',
    webSessionCleared: 'A helyi bejelentkezett webes munkamenet törölve.',
    browserLogoutOpened:
      'A szolgáltató kijelentkezési oldala megnyílt. A webes változatban a szolgáltatás sütijeit a böngésző kezeli.',
  },
  de: {
    title: 'Externe bibliografische Dienste durchsuchen',
    description:
      'Normalisierte bibliografische APIs und – falls eingerichtet – angemeldete wissenschaftliche Webdienste aus demselben Arbeitsbereich durchsuchen.',
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
      'OpenAlex erfordert derzeit einen API-Schlüssel. Der Schlüssel bleibt nur im Arbeitsspeicher der aktuellen Studio-Sitzung und wird weder in lokalen Einstellungen noch im Manuskript gespeichert.',
    privacyNote:
      'Suchanfragen werden nur an aktivierte API-Anbieter gesendet. Lokale Oberflächeneinstellungen werden nicht in .omi.json exportiert.',
    missingApiKey: 'Dieser Anbieter wurde übersprungen, weil der erforderliche API-Schlüssel nicht konfiguriert ist.',
    providerUnavailable: 'Der Anbieter konnte nicht abgefragt werden. Ergebnisse anderer Anbieter werden weiterhin angezeigt.',
    noResults: 'Die ausgewählten API-Anbieter lieferten keine passenden bibliografischen Datensätze.',
    addToLibrary: 'Zur Bibliothek hinzufügen',
    alreadyAdded: 'Bereits hinzugefügt',
    webProvidersTitle: 'Webdienste mit Anmeldung',
    webProvidersDescription:
      'Hier können Dienste hinzugefügt werden, die die Anmeldung auf ihrer eigenen Website verwalten. Aktivierte Dienste öffnen die aktuelle Suche in ihrer normalen angemeldeten Websitzung.',
    addAcademia: 'Academia.edu hinzufügen',
    addCustomProvider: 'Weiteren Dienst hinzufügen',
    providerName: 'Name des Dienstes',
    loginUrl: 'Anmelde-URL',
    searchUrlTemplate: 'Such-URL-Vorlage',
    searchUrlTemplateHint:
      'Verwenden Sie {query} an der Stelle des codierten Suchtexts, zum Beispiel https://example.org/search?q={query}.',
    logoutUrl: 'Abmelde-URL (optional)',
    logoutUrlHint:
      'Die Webversion verwendet diese URL, damit der Dienst selbst die Sitzung beendet.',
    addProvider: 'Dienst hinzufügen',
    cancel: 'Abbrechen',
    signIn: 'Anmelden',
    signOut: 'Abmelden und Sitzung löschen',
    searchProvider: 'Diesen Dienst durchsuchen',
    removeProvider: 'Dienst entfernen',
    webSessionPrivacyNote:
      'OMI Studio fragt das Kennwort des Dienstes niemals ab, liest es nicht und speichert es nicht. Die Anmeldung erfolgt auf der Seite des Anbieters. In der installierten App behält die Anbieter-WebView ihre normale Browsersitzung zwischen Neustarts; „Abmelden und Sitzung löschen“ entfernt diese lokalen Browserdaten. In der Webversion bleiben Cookies unter der Kontrolle des Browsers und des Anbieters.',
    webProviderInvalid:
      'Der Dienst konnte nicht hinzugefügt werden. Verwenden Sie HTTPS-URLs und fügen Sie {query} in die Such-URL-Vorlage ein.',
    webProviderAdded: 'Der Webdienst wurde hinzugefügt.',
    webProviderRemoved: 'Der Webdienst und seine lokale Studio-Sitzung wurden entfernt.',
    webLoginOpened: 'Die Anmeldeseite des Dienstes wurde geöffnet.',
    webSearchOpened: 'Die Suche in angemeldeten Webdiensten wurde in eigenen Fenstern geöffnet.',
    webProviderOpenFailed: 'Ein oder mehrere angemeldete Webdienste konnten nicht geöffnet werden.',
    webSessionCleared: 'Die lokale angemeldete Websitzung wurde gelöscht.',
    browserLogoutOpened:
      'Die Abmeldeseite des Dienstes wurde geöffnet. In der Webversion verwaltet der Browser die Cookies des Dienstes.',
  },
};

export function getReferenceLookupCopy(locale: SupportedLocale): ReferenceLookupCopy {
  return COPY[locale] ?? COPY.en;
}
