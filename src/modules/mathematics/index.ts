import { STUDIO_MODULE_API_VERSION, type StudioModuleManifest } from '../types';

export const moduleManifest: StudioModuleManifest = {
  id: 'org.omi.mathematics',
  version: '0.1.0',
  apiVersion: STUDIO_MODULE_API_VERSION,
  titleKey: 'modules.mathematics.title',
  descriptionKey: 'modules.mathematics.description',
  disciplines: ['mathematics'],
  requiredCapabilities: [],
  contributions: [{
    id: 'equations', slot: 'research-navigation',
    titleKey: 'modules.mathematics.overview',
    descriptionKey: 'modules.mathematics.description',
  }],
};
