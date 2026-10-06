import {
  STUDIO_MODULE_API_VERSION,
  type StudioModuleManifest,
} from '../types';

/** Built-in legal-sources research workspace. */
export const moduleManifest: StudioModuleManifest = {
  id: 'org.omi.legal-sources',
  version: '0.1.0',
  apiVersion: STUDIO_MODULE_API_VERSION,
  titleKey: 'modules.legalSources.title',
  descriptionKey: 'modules.legalSources.description',
  disciplines: ['law'],
  requiredCapabilities: [],
  contributions: [
    {
      id: 'overview',
      slot: 'research-navigation',
      titleKey: 'modules.legalSources.overview',
      descriptionKey: 'modules.legalSources.description',
    },
  ],
};
