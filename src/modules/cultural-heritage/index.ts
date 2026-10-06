import {
  STUDIO_MODULE_API_VERSION,
  type StudioModuleManifest,
} from '../types';

/** Built-in cultural-heritage research workspace. */
export const moduleManifest: StudioModuleManifest = {
  id: 'org.omi.cultural-heritage',
  version: '0.1.0',
  apiVersion: STUDIO_MODULE_API_VERSION,
  titleKey: 'modules.culturalHeritage.title',
  descriptionKey: 'modules.culturalHeritage.description',
  disciplines: ['archaeology', 'art-history', 'museum-studies'],
  requiredCapabilities: [],
  contributions: [
    {
      id: 'overview',
      slot: 'research-navigation',
      titleKey: 'modules.culturalHeritage.overview',
      descriptionKey: 'modules.culturalHeritage.description',
    },
  ],
};
