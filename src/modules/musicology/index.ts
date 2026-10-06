import {
  STUDIO_MODULE_API_VERSION,
  type StudioModuleManifest,
} from '../types';

/** Built-in musicology research workspace. */
export const moduleManifest: StudioModuleManifest = {
  id: 'org.omi.musicology',
  version: '0.1.0',
  apiVersion: STUDIO_MODULE_API_VERSION,
  titleKey: 'modules.musicology.title',
  descriptionKey: 'modules.musicology.description',
  disciplines: ['musicology'],
  requiredCapabilities: [],
  contributions: [
    {
      id: 'overview',
      slot: 'research-navigation',
      titleKey: 'modules.musicology.overview',
      descriptionKey: 'modules.musicology.description',
    },
  ],
};
