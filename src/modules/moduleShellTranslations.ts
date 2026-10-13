import { normalizeModuleLocale } from './moduleLocale';
import { getResearchModuleCopyByLocale } from './moduleTranslationCatalog';
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
  settingsDescription: string;
  noActiveModules: string;
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

export function getModuleShellCopy(locale: string): ModuleShellCopy {
  const copies = getResearchModuleCopyByLocale<ModuleShellCopy>('shell/translations');
  return copies[normalizeModuleLocale(locale)] ?? copies.en!;
}
