import { STUDIO_MODULE_API_VERSION, type StudioModuleManifest } from '../types';

export const moduleManifest: StudioModuleManifest = {
  id: 'org.omi.experimental-laboratory',
  version: '0.1.0',
  apiVersion: STUDIO_MODULE_API_VERSION,
  titleKey: 'modules.experimentalLaboratory.title',
  descriptionKey: 'modules.experimentalLaboratory.description',
  disciplines: ['physics', 'chemistry', 'biology', 'materials-science', 'experimental-science'],
  requiredCapabilities: [],
  contributions: [{
    id: 'overview',
    slot: 'research-navigation',
    titleKey: 'modules.experimentalLaboratory.overview',
    descriptionKey: 'modules.experimentalLaboratory.description',
  }],
};
