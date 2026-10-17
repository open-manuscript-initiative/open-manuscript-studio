import {
  STUDIO_MODULE_API_VERSION,
  type StudioModuleManifest,
} from '../types';

/** Empty disciplinary module shell. */
export const moduleManifest: StudioModuleManifest = {
  id: 'org.omi.critical-text-edition',
  version: '0.1.0',
  apiVersion: STUDIO_MODULE_API_VERSION,
  titleKey: 'modules.criticalTextEdition.title',
  descriptionKey: 'modules.criticalTextEdition.description',
  disciplines: ['philology', 'classical-philology', 'literary-studies', 'philosophy', 'history-of-philosophy'],
  requiredCapabilities: ['research-databases.search', 'transkribus.recognize'],
  contributions: [
    {
      id: 'overview',
      slot: 'research-navigation',
      titleKey: 'modules.criticalTextEdition.overview',
      descriptionKey: 'modules.criticalTextEdition.description',
    },
  ],
};
