import { STUDIO_MODULE_API_VERSION, type StudioModuleManifest } from '../types';

export const moduleManifest: StudioModuleManifest = {
  id: 'org.omi.spatial-research',
  version: '0.1.0',
  apiVersion: STUDIO_MODULE_API_VERSION,
  titleKey: 'modules.spatialResearch.title',
  descriptionKey: 'modules.spatialResearch.description',
  disciplines: ['geography', 'gis', 'spatial-humanities'],
  requiredCapabilities: [],
  contributions: [{
    id: 'overview',
    slot: 'research-navigation',
    titleKey: 'modules.spatialResearch.overview',
    descriptionKey: 'modules.spatialResearch.description',
  }],
};
