import { STUDIO_MODULE_API_VERSION, type StudioModuleManifest } from '../types';
export const moduleManifest: StudioModuleManifest = {
  id: 'org.omi.medical-sciences', version: '0.2.0', apiVersion: STUDIO_MODULE_API_VERSION,
  titleKey: 'modules.medical-sciences.title', descriptionKey: 'modules.medical-sciences.description',
  disciplines: ["medicine", "health-sciences"], requiredCapabilities: ['health-research.search'],
  contributions: [{ id: 'overview', slot: 'research-navigation', titleKey: 'modules.medical-sciences.overview', descriptionKey: 'modules.medical-sciences.description' }],
};
