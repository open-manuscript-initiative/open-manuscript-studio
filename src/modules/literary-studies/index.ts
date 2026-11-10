import { STUDIO_MODULE_API_VERSION, type StudioModuleManifest } from '../types';

export const moduleManifest: StudioModuleManifest = {
  id: 'org.omi.literary-studies',
  version: '0.1.0',
  apiVersion: STUDIO_MODULE_API_VERSION,
  titleKey: 'modules.literaryStudies.title',
  descriptionKey: 'modules.literaryStudies.description',
  disciplines: ['literary-studies', 'comparative-literature', 'narratology', 'poetics', 'reception-studies', 'digital-humanities'],
  requiredCapabilities: [],
  contributions: [{
    id: 'overview',
    slot: 'research-navigation',
    titleKey: 'modules.literaryStudies.overview',
    descriptionKey: 'modules.literaryStudies.description',
  }],
};
