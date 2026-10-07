export interface EuropeanaSearchCopy {
  searchLabel: string;
  searchPlaceholder: string;
  searchButton: string;
  searching: string;
  resultCount: string;
  noResults: string;
  openRecord: string;
  provider: string;
  dataProvider: string;
  sourceRecord: string;
  attribution?: string;
  rights: string;
  loadMore: string;
  loadingMore: string;
  errorTitle: string;
  searchFailed: string;
  setupRequired: string;
  queryRequired: string;
}

export interface ModuleShellCopy {
  europeana: EuropeanaSearchCopy;
  nara: EuropeanaSearchCopy;
  navigation: string;
  title: string;
  description: string;
  active: string;
  activate: string;
  available: string;
  disabledByInstallation: string;
  noModules: string;
  noFeatures: string;
  localPreferenceNote: string;
  policyError: string;
  modules: Record<string, ModuleCatalogCopy>;
}

export interface ModuleCatalogCopy {
  title: string;
  description: string;
  overview: string;
}

const translations: Record<string, ModuleShellCopy> = {
  en: {
    navigation: 'Research modules',
    title: 'Research modules',
    description: 'Research workspaces for the modules enabled in Settings.',
    settingsDescription: 'Choose which research modules are available in the Modules view.',
    noActiveModules: 'No research modules are enabled. Turn modules on in Settings to show them here.',
    active: 'Active in this workspace',
    activate: 'Activate',
    available: 'Available',
    disabledByInstallation: 'Disabled by this installation',
    noModules: 'No research modules are registered yet.',
    noFeatures: 'Research tools for this discipline appear here.',
    localPreferenceNote: 'Workspace selections are saved to your Studio account and enforced by the server.',
    policyError: 'Module settings could not be loaded or saved. Check your connection and try again.',
    modules: {
      'org.omi.history-archives': {
        title: 'History & Archives',
        description: 'Discover historical and archival sources across institutions, and keep each result connected to its holding archive.',
        overview: 'Historical and archival sources',
      },
      'org.omi.religious-texts': {
        title: 'Religious texts and sources',
        description: 'Search Jewish texts and commentaries in Sefaria, follow source links, and open external Bible, Qur’an, and Buddhist text libraries.',
        overview: 'Religious text sources',
      },
      'org.omi.critical-text-edition': {
        title: 'Critical text edition',
        description: 'Connect transcriptions and textual variants with manuscript witnesses, critical apparatus, and digital editions.',
        overview: 'Critical edition workspace',
      },
      'org.omi.corpus-linguistics': {
        title: 'Corpus and linguistic annotation',
        description: 'Search corpora, inspect concordances, align texts, and annotate linguistic features.',
        overview: 'Corpus workspace',
      },
      'org.omi.musicology': {
        title: 'Musicology',
        description: 'Work with notation and musical events, align scores with recordings, annotate passages, and compare versions.',
        overview: 'Music research workspace',
      },
      'org.omi.cultural-heritage': {
        title: 'Cultural heritage objects and images',
        description: 'Connect objects, sites, people, and events with time and place, and annotate regions within images.',
        overview: 'Cultural heritage workspace',
      },
      'org.omi.spatial-research': {
        title: 'Spatial research and GIS',
        description: 'Register georeferenced research objects, import and export GeoJSON, and retain coordinate reference information.',
        overview: 'Spatial research workspace',
      },
      'org.omi.archaeology': {
        title: 'Archaeology',
        description: 'Document archaeological sites, contexts, stratigraphic units, finds, samples, and source records.',
        overview: 'Archaeology workspace',
      },
      'org.omi.experimental-laboratory': {
        title: 'Experimental and laboratory research',
        description: 'Structure investigations, studies, samples, protocols, instruments, assays, measurements, and raw or derived research data.',
        overview: 'Experimental research workspace',
      },
      'org.omi.statistical-analysis': {
        title: 'Statistical Analysis and Data',
        description: 'Import CSV/TSV datasets and run descriptive statistics, Welch tests, one-way ANOVA, and linear regression with reproducible JSON reports.',
        overview: 'Statistical analysis workspace',
      },

      'org.omi.social-research-methods': {
        title: 'Social research data and methods',
        description: 'Describe surveys, variables, and codebooks; code interviews; and connect datasets with research methods.',
        overview: 'Social research workspace',
      },
      'org.omi.legal-sources': {
        title: 'Legal sources and citations',
        description: 'Search legislation and court decisions by jurisdiction and effective date, cite provisions and cases, compare versions, and connect national sources.',
        overview: 'Legal research workspace',
      },
      'org.omi.research-reproducibility': {
        title: 'Research data and reproducibility',
        description: 'Link datasets, code, methods, and supplements to versioned sources and repositories, and record how publications relate to research outputs.',
        overview: 'Research outputs and reproducibility',
      },
    },
    europeana: {
      searchLabel: 'Search Europeana',
      searchPlaceholder: 'Name, place, date, or keyword',
      searchButton: 'Search',
      searching: 'Searching…',
      resultCount: '{count} results',
      noResults: 'No records matched this search.',
      openRecord: 'Open source institution record',
      provider: 'Europeana Search',
      dataProvider: 'Data provider',
      sourceRecord: 'Search Europeana’s cultural heritage catalogue. Each result links back to Europeana or its source institution.',
      rights: 'Rights',
      loadMore: 'Load more results',
      loadingMore: 'Loading…',
      errorTitle: 'Search unavailable.',
      searchFailed: 'Europeana could not complete the search. Try again later.',
      setupRequired: 'The Studio administrator must configure a Europeana API key on the server.',
      queryRequired: 'Enter at least two characters to search.',
    },
    nara: {
      searchLabel: 'Search the U.S. National Archives',
      searchPlaceholder: 'Name, place, date, or keyword',
      searchButton: 'Search',
      searching: 'Searching…',
      resultCount: '{count} results',
      noResults: 'No records matched this search.',
      openRecord: 'Open record in the National Archives Catalog',
      provider: 'U.S. National Archives Catalog',
      dataProvider: 'Record group',
      sourceRecord: 'Search archival descriptions in the U.S. National Archives Catalog. Results link to the original NARA record.',
      attribution: 'This product uses the National Archives Catalog API but is not endorsed or certified by the National Archives and Records Administration.',
      rights: 'Use restriction',
      loadMore: 'Load more results',
      loadingMore: 'Loading…',
      errorTitle: 'Search unavailable.',
      searchFailed: 'The National Archives Catalog could not complete the search. Try again later.',
      setupRequired: 'The Studio administrator must configure a read-only NARA Catalog API key on the server.',
      queryRequired: 'Enter at least two characters to search.',
    },
  },
  de: {
    navigation: 'Forschungsmodule',
    title: 'Forschungsmodule',
    description: 'Forschungsarbeitsbereiche für die in den Einstellungen aktivierten Module.',
    settingsDescription: 'Wählen Sie aus, welche Forschungsmodule in der Modulansicht erscheinen.',
    noActiveModules: 'Es sind keine Forschungsmodule aktiviert. Aktivieren Sie Module in den Einstellungen, damit sie hier erscheinen.',
    active: 'In diesem Arbeitsbereich aktiv',
    activate: 'Aktivieren',
    available: 'Verfügbar',
    disabledByInstallation: 'In dieser Installation deaktiviert',
    noModules: 'Es sind noch keine Forschungsmodule registriert.',
    noFeatures: 'Die Forschungswerkzeuge dieses Fachgebiets erscheinen hier.',
    localPreferenceNote: 'Die Auswahl wird im Studio-Konto gespeichert und vom Server geprüft.',
    policyError: 'Moduleinstellungen konnten nicht geladen oder gespeichert werden. Prüfen Sie die Verbindung und versuchen Sie es erneut.',
    modules: {
      'org.omi.history-archives': {
        title: 'Geschichte und Archive',
        description: 'Historische und archivische Quellen institutionsübergreifend auffinden und jedes Ergebnis mit seinem verwahrenden Archiv verbinden.',
        overview: 'Historische und archivische Quellen',
      },
      'org.omi.religious-texts': {
        title: 'Religiöse Texte und Quellen',
        description: 'Jüdische Texte und Kommentare in Sefaria durchsuchen, Quellen verknüpfen und externe Bibel-, Koran- und buddhistische Textsammlungen öffnen.',
        overview: 'Religiöse Textquellen',
      },
      'org.omi.critical-text-edition': {
        title: 'Kritische Textedition',
        description: 'Transkriptionen und Textvarianten mit Handschriftenzeugen, kritischem Apparat und digitalen Editionen verbinden.',
        overview: 'Arbeitsbereich für kritische Editionen',
      },
      'org.omi.corpus-linguistics': {
        title: 'Korpus und linguistische Annotation',
        description: 'Korpora durchsuchen, Konkordanzen untersuchen, Texte ausrichten und sprachliche Merkmale annotieren.',
        overview: 'Korpusarbeitsbereich',
      },
      'org.omi.musicology': {
        title: 'Musikwissenschaft',
        description: 'Mit Notation und musikalischen Ereignissen arbeiten, Partituren und Aufnahmen abgleichen, Abschnitte annotieren und Fassungen vergleichen.',
        overview: 'Arbeitsbereich Musikwissenschaft',
      },
      'org.omi.cultural-heritage': {
        title: 'Kulturerbeobjekte und Bilder',
        description: 'Objekte, Fundorte, Personen und Ereignisse mit Zeit und Ort verknüpfen sowie Bildbereiche annotieren.',
        overview: 'Arbeitsbereich Kulturerbe',
      },
      'org.omi.spatial-research': {
        title: 'Raumbezogene Forschung und GIS',
        description: 'Georeferenzierte Forschungsobjekte erfassen, GeoJSON importieren und exportieren sowie Koordinatenreferenzangaben dokumentieren.',
        overview: 'Arbeitsbereich Raumforschung',
      },
      'org.omi.archaeology': {
        title: 'Archäologie',
        description: 'Fundorte, Kontexte, stratigraphische Einheiten, Funde, Proben und Quellen dokumentieren.',
        overview: 'Arbeitsbereich Archäologie',
      },
      'org.omi.experimental-laboratory': {
        title: 'Experimentelle und Laborforschung',
        description: 'Untersuchungen, Studien, Proben, Protokolle, Geräte, Assays, Messungen und Roh- oder abgeleitete Forschungsdaten strukturieren.',
        overview: 'Arbeitsbereich Experimentalforschung',
      },
      'org.omi.statistical-analysis': {
        title: 'Statistik und Datenanalyse',
        description: 'CSV/TSV-Datensätze importieren und deskriptive Statistik, Welch-Tests, einfaktorielle ANOVA sowie lineare Regression mit reproduzierbaren JSON-Berichten durchführen.',
        overview: 'Arbeitsbereich Statistik',
      },

      'org.omi.social-research-methods': {
        title: 'Sozialwissenschaftliche Daten und Methoden',
        description: 'Erhebungen, Variablen und Codebücher beschreiben, Interviews codieren und Datensätze mit Forschungsmethoden verknüpfen.',
        overview: 'Arbeitsbereich Sozialforschung',
      },
      'org.omi.legal-sources': {
        title: 'Rechtsquellen und Zitate',
        description: 'Gesetze und Gerichtsentscheidungen nach Rechtsordnung und Geltungszeit suchen, Vorschriften und Fälle zitieren, Fassungen vergleichen und nationale Quellen verbinden.',
        overview: 'Arbeitsbereich Rechtswissenschaft',
      },
      'org.omi.research-reproducibility': {
        title: 'Forschungsdaten und Reproduzierbarkeit',
        description: 'Datensätze, Code, Methoden und Ergänzungsmaterialien mit versionierten Quellen und Repositorien verknüpfen und Publikationen den Forschungsergebnissen zuordnen.',
        overview: 'Forschungsergebnisse und Reproduzierbarkeit',
      },
    },
    europeana: {
      searchLabel: 'Suche in Europeana',
      searchPlaceholder: 'Name, Ort, Datum oder Stichwort',
      searchButton: 'Suchen',
      searching: 'Suche läuft…',
      resultCount: '{count} Ergebnisse',
      noResults: 'Für diese Suche wurden keine Einträge gefunden.',
      openRecord: 'Eintrag bei der verwahrenden Einrichtung öffnen',
      provider: 'Europeana-Suche',
      dataProvider: 'Datenlieferant',
      sourceRecord: 'Durchsuchen Sie den Kulturerbe-Katalog von Europeana. Jeder Treffer führt zurück zu Europeana oder zur liefernden Einrichtung.',
      rights: 'Rechte',
      loadMore: 'Weitere Ergebnisse laden',
      loadingMore: 'Wird geladen…',
      errorTitle: 'Suche nicht verfügbar.',
      searchFailed: 'Europeana konnte die Suche nicht ausführen. Bitte versuchen Sie es später erneut.',
      setupRequired: 'Die Studio-Administration muss einen Europeana-API-Schlüssel auf dem Server konfigurieren.',
      queryRequired: 'Geben Sie mindestens zwei Zeichen für die Suche ein.',
    },
    nara: {
      searchLabel: 'Suche im Katalog des US-Nationalarchivs',
      searchPlaceholder: 'Name, Ort, Datum oder Stichwort',
      searchButton: 'Suchen',
      searching: 'Suche läuft…',
      resultCount: '{count} Ergebnisse',
      noResults: 'Für diese Suche wurden keine Einträge gefunden.',
      openRecord: 'Eintrag im Katalog des Nationalarchivs öffnen',
      provider: 'Katalog des US-Nationalarchivs',
      dataProvider: 'Bestandsgruppe',
      sourceRecord: 'Durchsuchen Sie die archivischen Beschreibungen im Katalog des US-Nationalarchivs. Die Treffer verweisen auf den ursprünglichen NARA-Eintrag.',
      attribution: 'This product uses the National Archives Catalog API but is not endorsed or certified by the National Archives and Records Administration.',
      rights: 'Nutzungsbeschränkung',
      loadMore: 'Weitere Ergebnisse laden',
      loadingMore: 'Wird geladen…',
      errorTitle: 'Suche nicht verfügbar.',
      searchFailed: 'Der Katalog des Nationalarchivs konnte die Suche nicht ausführen. Bitte versuchen Sie es später erneut.',
      setupRequired: 'Die Studio-Administration muss einen schreibgeschützten NARA-API-Schlüssel auf dem Server konfigurieren.',
      queryRequired: 'Geben Sie mindestens zwei Zeichen für die Suche ein.',
    },
  },
  hu: {
    navigation: 'Kutatási modulok',
    title: 'Kutatási modulok',
    description: 'Munkafelületek a Beállításokban bekapcsolt kutatási modulokhoz.',
    settingsDescription: 'Válassza ki, mely kutatási modulok jelenjenek meg a Modulok nézetben.',
    noActiveModules: 'Nincs bekapcsolt kutatási modul. A megjelenítéshez kapcsoljon be modulokat a Beállításokban.',
    active: 'Aktív ebben a munkatérben',
    activate: 'Bekapcsolás',
    available: 'Elérhető',
    disabledByInstallation: 'Ezen a telepítésen letiltva',
    noModules: 'Még nincs regisztrált kutatási modul.',
    noFeatures: 'A tudományterület kutatási eszközei itt jelennek meg.',
    localPreferenceNote: 'A munkatér beállításait a Studio-fiók menti, a szerver pedig ellenőrzi.',
    policyError: 'A modulbeállításokat nem sikerült betölteni vagy menteni. Ellenőrizze a kapcsolatot, majd próbálja újra.',
    modules: {
      'org.omi.history-archives': {
        title: 'Történelem és levéltárak',
        description: 'Történeti és levéltári források feltárása különböző intézményekből, a találatok őrző levéltárhoz kapcsolásával.',
        overview: 'Történeti és levéltári források',
      },
      'org.omi.religious-texts': {
        title: 'Vallási szöveg- és forrásmodul',
        description: 'Zsidó szövegek és kommentárok keresése a Sefaria könyvtárában, forráshelyek megnyitása, valamint külső bibliai, koráni és buddhista szöveggyűjtemények elérése.',
        overview: 'Vallási szövegforrások',
      },
      'org.omi.critical-text-edition': {
        title: 'Kritikai szövegkiadási modul',
        description: 'Átiratok és szövegváltozatok összekapcsolása kézirati tanúkkal, kritikai apparátussal és digitális kiadásokkal.',
        overview: 'Kritikai kiadási munkatér',
      },
      'org.omi.corpus-linguistics': {
        title: 'Korpusz- és nyelvi annotációs modul',
        description: 'Korpuszok keresése, konkordanciák vizsgálata, szövegek illesztése és nyelvi jellemzők annotálása.',
        overview: 'Korpusz-munkatér',
      },
      'org.omi.musicology': {
        title: 'Zenetudományi modul',
        description: 'Kotta és zenei események kezelése, partitúrák és hangfelvételek illesztése, szakaszok annotálása, változatok összevetése.',
        overview: 'Zenetudományi munkatér',
      },
      'org.omi.cultural-heritage': {
        title: 'Kulturális örökségi tárgy- és képelemző modul',
        description: 'Tárgyak, lelőhelyek, szereplők és események összekapcsolása térbeli és időbeli adatokkal, képrészletek annotálása.',
        overview: 'Kulturálisörökség-munkatér',
      },
      'org.omi.spatial-research': {
        title: 'Térinformatikai kutatási modul',
        description: 'Georeferált kutatási objektumok nyilvántartása, GeoJSON importja és exportja, valamint a koordinátarendszer rögzítése.',
        overview: 'Térinformatikai kutatótér',
      },
      'org.omi.archaeology': {
        title: 'Régészeti kutatási modul',
        description: 'Lelőhelyek, kontextusok, rétegtani egységek, leletek, minták és forrásrekordok dokumentálása.',
        overview: 'Régészeti kutatótér',
      },
      'org.omi.experimental-laboratory': {
        title: 'Kísérleti és laboratóriumi kutatási modul',
        description: 'Vizsgálatok, tanulmányok, minták, protokollok, műszerek, vizsgálatok, mérések, valamint nyers és feldolgozott kutatási adatok strukturált kezelése.',
        overview: 'Kísérleti kutatómunkatér',
      },
      'org.omi.statistical-analysis': {
        title: 'Statisztikai és adatelemzési modul',
        description: 'CSV/TSV-adatok importálása, leíró statisztika, Welch-próba, egyszempontos ANOVA és lineáris regresszió, megismételhető JSON-jelentéssel.',
        overview: 'Statisztikai elemzési munkatér',
      },

      'org.omi.social-research-methods': {
        title: 'Kutatási adat- és módszertani modul',
        description: 'Kérdőívek, változók és kódkönyvek leírása, interjúk kódolása, adathalmazok és kutatási módszerek összekapcsolása.',
        overview: 'Társadalomtudományi munkatér',
      },
      'org.omi.legal-sources': {
        title: 'Jogi forrás- és hivatkozási modul',
        description: 'Jogszabályok és bírósági döntések keresése joghatóság és időbeli hatály szerint; bekezdések és ügyek hivatkozása, változatok összevetése, országonkénti forráskapcsolatok.',
        overview: 'Jogtudományi munkatér',
      },
      'org.omi.research-reproducibility': {
        title: 'Kutatási adat és reprodukálhatóság modul',
        description: 'Adatállományok, kód, módszerek és kiegészítő anyagok összekapcsolása; verziózott forrásokra és adattárakra mutató hivatkozások, a publikációk és kutatási eredmények kapcsolatának rögzítése.',
        overview: 'Kutatási eredmények és reprodukálhatóság',
      },
    },
    europeana: {
      searchLabel: 'Keresés az Europeanában',
      searchPlaceholder: 'Név, hely, dátum vagy kulcsszó',
      searchButton: 'Keresés',
      searching: 'Keresés…',
      resultCount: '{count} találat',
      noResults: 'Nincs találat erre a keresésre.',
      openRecord: 'Megnyitás az őrző intézménynél',
      provider: 'Europeana-kereső',
      dataProvider: 'Adatszolgáltató',
      sourceRecord: 'Keresés az Europeana kulturálisörökség-katalógusában. Minden találat visszavezet az Europeanához vagy az adatszolgáltató intézményhez.',
      rights: 'Felhasználási jogok',
      loadMore: 'További találatok',
      loadingMore: 'Betöltés…',
      errorTitle: 'A keresés nem érhető el.',
      searchFailed: 'Az Europeana most nem tudta végrehajtani a keresést. Próbálja meg később.',
      setupRequired: 'A Stúdió rendszergazdájának Europeana API-kulcsot kell beállítania a szerveren.',
      queryRequired: 'A kereséshez legalább két karaktert adjon meg.',
    },
    nara: {
      searchLabel: 'Keresés az USA Nemzeti Levéltárának katalógusában',
      searchPlaceholder: 'Név, hely, dátum vagy kulcsszó',
      searchButton: 'Keresés',
      searching: 'Keresés…',
      resultCount: '{count} találat',
      noResults: 'Nincs találat erre a keresésre.',
      openRecord: 'Rekord megnyitása a NARA katalógusában',
      provider: 'USA Nemzeti Levéltárának katalógusa',
      dataProvider: 'Fond vagy állag',
      sourceRecord: 'Keresés az USA Nemzeti Levéltárának levéltári leírásai között. A találatok az eredeti NARA-rekordra mutatnak.',
      attribution: 'This product uses the National Archives Catalog API but is not endorsed or certified by the National Archives and Records Administration.',
      rights: 'Felhasználási korlátozás',
      loadMore: 'További találatok',
      loadingMore: 'Betöltés…',
      errorTitle: 'A keresés nem érhető el.',
      searchFailed: 'A National Archives katalógusa most nem tudta végrehajtani a keresést. Próbálja meg később.',
      setupRequired: 'A Stúdió rendszergazdájának egy csak olvasásra jogosító NARA API-kulcsot kell beállítania a szerveren.',
      queryRequired: 'A kereséshez legalább két karaktert adjon meg.',
    },
  },
};

export function getModuleShellCopy(locale: string): ModuleShellCopy {
  return translations[locale] ?? translations.en!;
}
