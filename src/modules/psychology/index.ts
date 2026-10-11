import { STUDIO_MODULE_API_VERSION, type StudioModuleManifest } from '../types';
export const moduleManifest: StudioModuleManifest = {
  id: 'org.omi.psychology', version: '0.1.0', apiVersion: STUDIO_MODULE_API_VERSION,
  titleKey: 'modules.psychology.title', descriptionKey: 'modules.psychology.description',
  disciplines: ["psychology", "behavioral-sciences"], requiredCapabilities: [],
  contributions: [{ id: 'overview', slot: 'research-navigation', titleKey: 'modules.psychology.overview', descriptionKey: 'modules.psychology.description' }],
};
