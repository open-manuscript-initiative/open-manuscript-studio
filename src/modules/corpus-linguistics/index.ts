import {
  STUDIO_MODULE_API_VERSION,
  type StudioModuleManifest,
} from '../types';

/** Empty disciplinary module shell. */
export const moduleManifest: StudioModuleManifest = {
  id: 'org.omi.corpus-linguistics',
  version: '0.1.0',
  apiVersion: STUDIO_MODULE_API_VERSION,
  titleKey: 'modules.corpusLinguistics.title',
  descriptionKey: 'modules.corpusLinguistics.description',
  disciplines: ['linguistics'],
  requiredCapabilities: [],
  contributions: [
    {
      id: 'overview',
      slot: 'research-navigation',
      titleKey: 'modules.corpusLinguistics.overview',
      descriptionKey: 'modules.corpusLinguistics.description',
    },
  ],
};
