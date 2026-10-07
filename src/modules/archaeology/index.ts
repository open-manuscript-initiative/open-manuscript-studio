import { STUDIO_MODULE_API_VERSION, type StudioModuleManifest } from '../types';

export const moduleManifest: StudioModuleManifest = {
  id: 'org.omi.archaeology',
  version: '0.1.0',
  apiVersion: STUDIO_MODULE_API_VERSION,
  titleKey: 'modules.archaeology.title',
  descriptionKey: 'modules.archaeology.description',
  disciplines: ['archaeology', 'archaeometry', 'material-culture'],
  requiredCapabilities: [],
  contributions: [{
    id: 'overview',
    slot: 'research-navigation',
    titleKey: 'modules.archaeology.overview',
    descriptionKey: 'modules.archaeology.description',
  }],
};
