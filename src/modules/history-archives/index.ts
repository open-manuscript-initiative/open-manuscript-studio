import {
  STUDIO_MODULE_API_VERSION,
  type StudioModuleManifest,
} from '../types';

/** Empty module manifest; the research tools will be implemented separately. */
export const historyArchivesModule: StudioModuleManifest = {
  id: 'org.omi.history-archives',
  version: '0.1.0',
  apiVersion: STUDIO_MODULE_API_VERSION,
  titleKey: 'modules.historyArchives.title',
  descriptionKey: 'modules.historyArchives.description',
  disciplines: ['history'],
  requiredCapabilities: [],
  contributions: [
    {
      id: 'overview',
      slot: 'research-navigation',
      titleKey: 'modules.historyArchives.overview',
      descriptionKey: 'modules.historyArchives.overviewDescription',
    },
  ],
};
