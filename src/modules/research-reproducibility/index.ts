import {
  STUDIO_MODULE_API_VERSION,
  type StudioModuleManifest,
} from '../types';

/** Built-in research-reproducibility research workspace. */
export const moduleManifest: StudioModuleManifest = {
  id: 'org.omi.research-reproducibility',
  version: '0.1.0',
  apiVersion: STUDIO_MODULE_API_VERSION,
  titleKey: 'modules.researchReproducibility.title',
  descriptionKey: 'modules.researchReproducibility.description',
  disciplines: ['natural-sciences', 'engineering'],
  requiredCapabilities: [],
  contributions: [
    {
      id: 'overview',
      slot: 'research-navigation',
      titleKey: 'modules.researchReproducibility.overview',
      descriptionKey: 'modules.researchReproducibility.description',
    },
  ],
};
