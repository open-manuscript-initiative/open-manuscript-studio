export interface ModuleShellCopy {
  navigation: string;
  title: string;
  description: string;
  active: string;
  activate: string;
  available: string;
  noModules: string;
  scaffoldTitle: string;
  scaffoldDescription: string;
  noFeatures: string;
  localPreferenceNote: string;
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
    description: 'Choose which available modules appear in this workspace.',
    active: 'Active in this workspace',
    activate: 'Activate',
    available: 'Available',
    noModules: 'No research modules are registered yet.',
    scaffoldTitle: 'Module shell',
    scaffoldDescription: 'This module is registered and connected to the Studio workspace.',
    noFeatures: 'Module tools and research features will be added here later.',
    localPreferenceNote: 'Workspace selections are stored in this browser for now. Module features are not implemented yet.',
    modules: {
      'org.omi.history-archives': {
        title: 'History & Archives',
        description: 'Discover historical and archival sources across institutions, and keep each result connected to its holding archive.',
        overview: 'Historical and archival sources',
      },
      'org.omi.religious-texts': {
        title: 'Religious texts and sources',
        description: 'Identify biblical and other religious passages, compare editions and translations, and connect manuscripts with interpretations.',
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
  },
  de: {
    navigation: 'Forschungsmodule',
    title: 'Forschungsmodule',
    description: 'Wählen Sie aus, welche verfügbaren Module in diesem Arbeitsbereich erscheinen.',
    active: 'In diesem Arbeitsbereich aktiv',
    activate: 'Aktivieren',
    available: 'Verfügbar',
    noModules: 'Es sind noch keine Forschungsmodule registriert.',
    scaffoldTitle: 'Modulgerüst',
    scaffoldDescription: 'Dieses Modul ist registriert und mit dem Studio-Arbeitsbereich verbunden.',
    noFeatures: 'Modulwerkzeuge und Forschungsfunktionen werden später hier ergänzt.',
    localPreferenceNote: 'Die Auswahl wird vorerst in diesem Browser gespeichert. Die Modulfunktionen sind noch nicht implementiert.',
    modules: {
      'org.omi.history-archives': {
        title: 'Geschichte und Archive',
        description: 'Historische und archivische Quellen institutionsübergreifend auffinden und jedes Ergebnis mit seinem verwahrenden Archiv verbinden.',
        overview: 'Historische und archivische Quellen',
      },
      'org.omi.religious-texts': {
        title: 'Religiöse Texte und Quellen',
        description: 'Biblische und andere religiöse Textstellen identifizieren, Ausgaben und Übersetzungen vergleichen sowie Handschriften mit Deutungen verknüpfen.',
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
  },
  hu: {
    navigation: 'Kutatási modulok',
    title: 'Kutatási modulok',
    description: 'Válassza ki, mely elérhető modulok jelenjenek meg ebben a munkatérben.',
    active: 'Aktív ebben a munkatérben',
    activate: 'Bekapcsolás',
    available: 'Elérhető',
    noModules: 'Még nincs regisztrált kutatási modul.',
    scaffoldTitle: 'Modulváz',
    scaffoldDescription: 'A modul regisztrálva van, és csatlakozik a Studio munkateréhez.',
    noFeatures: 'A modul eszközei és kutatási funkciói később kerülnek ide.',
    localPreferenceNote: 'A munkatér beállításait egyelőre ez a böngésző tárolja. A modul funkciói még nem készültek el.',
    modules: {
      'org.omi.history-archives': {
        title: 'Történelem és levéltárak',
        description: 'Történeti és levéltári források feltárása különböző intézményekből, a találatok őrző levéltárhoz kapcsolásával.',
        overview: 'Történeti és levéltári források',
      },
      'org.omi.religious-texts': {
        title: 'Vallási szöveg- és forrásmodul',
        description: 'Bibliai és más vallási szöveghelyek azonosítása, kiadások és fordítások összevetése, valamint kéziratok és értelmezések összekapcsolása.',
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
  },
};

export function getModuleShellCopy(locale: string): ModuleShellCopy {
  return translations[locale] ?? translations.en!;
}
