import { STUDIO_MODULE_API_VERSION, type StudioModuleManifest } from '../types';

export const moduleManifest: StudioModuleManifest = {
  id: 'org.omi.statistical-analysis',
  version: '0.1.0',
  apiVersion: STUDIO_MODULE_API_VERSION,
  titleKey: 'modules.statisticalAnalysis.title',
  descriptionKey: 'modules.statisticalAnalysis.description',
  disciplines: ['experimental-science', 'social-sciences', 'biology', 'physics', 'chemistry', 'materials-science'],
  requiredCapabilities: [],
  contributions: [{
    id: 'overview',
    slot: 'research-navigation',
    titleKey: 'modules.statisticalAnalysis.overview',
    descriptionKey: 'modules.statisticalAnalysis.description',
  }],
};
