import { STUDIO_MODULE_API_VERSION, type StudioModuleManifest } from '../types';
export const genealogyModule: StudioModuleManifest = {
  id: 'org.omi.genealogy',
  version: '0.1.0',
  apiVersion: STUDIO_MODULE_API_VERSION,
  titleKey: 'modules.genealogy.title',
  descriptionKey: 'modules.genealogy.description',
  disciplines: ['history', 'genealogy', 'prosopography'],
  requiredCapabilities: [],
  contributions: [
    {
      id: 'overview',
      slot: 'research-navigation',
      titleKey: 'modules.genealogy.overview',
      descriptionKey: 'modules.genealogy.description',
    },
  ],
};
export const relationshipNetworkModule: StudioModuleManifest = {
  id: 'org.omi.relationship-networks',
  version: '0.1.0',
  apiVersion: STUDIO_MODULE_API_VERSION,
  titleKey: 'modules.relationshipNetworks.title',
  descriptionKey: 'modules.relationshipNetworks.description',
  disciplines: ['history', 'social-sciences', 'prosopography'],
  requiredCapabilities: [],
  contributions: [
    {
      id: 'overview',
      slot: 'research-navigation',
      titleKey: 'modules.relationshipNetworks.overview',
      descriptionKey: 'modules.relationshipNetworks.description',
    },
  ],
};
