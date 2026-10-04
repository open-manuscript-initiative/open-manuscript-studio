import {
  STUDIO_MODULE_API_VERSION,
  type StudioModuleManifest,
} from '../types';

/** Empty disciplinary module shell. */
export const moduleManifest: StudioModuleManifest = {
  id: 'org.omi.social-research-methods',
  version: '0.1.0',
  apiVersion: STUDIO_MODULE_API_VERSION,
  titleKey: 'modules.socialResearchMethods.title',
  descriptionKey: 'modules.socialResearchMethods.description',
  disciplines: ['social-sciences', 'behavioral-sciences', 'economics'],
  requiredCapabilities: [],
  contributions: [
    {
      id: 'overview',
      slot: 'research-navigation',
      titleKey: 'modules.socialResearchMethods.overview',
      descriptionKey: 'modules.socialResearchMethods.description',
    },
  ],
};
