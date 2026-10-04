import {
  STUDIO_MODULE_API_VERSION,
  type StudioModuleManifest,
} from '../types';

/** Empty disciplinary module shell. */
export const moduleManifest: StudioModuleManifest = {
  id: 'org.omi.religious-texts',
  version: '0.1.0',
  apiVersion: STUDIO_MODULE_API_VERSION,
  titleKey: 'modules.religiousTexts.title',
  descriptionKey: 'modules.religiousTexts.description',
  disciplines: ['theology', 'religious-studies'],
  requiredCapabilities: [],
  contributions: [
    {
      id: 'overview',
      slot: 'research-navigation',
      titleKey: 'modules.religiousTexts.overview',
      descriptionKey: 'modules.religiousTexts.description',
    },
  ],
};
