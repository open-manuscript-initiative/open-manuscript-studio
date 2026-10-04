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
  },
};

export function getModuleShellCopy(locale: string): ModuleShellCopy {
  return translations[locale] ?? translations.en!;
}
