import { StudioModuleRegistry } from './registry';
import {
  STUDIO_MODULE_API_VERSION,
  type StudioModuleInstallationPolicy,
  type StudioModuleManifest,
} from './types';

/**
 * First registered module shell. Research features will be added in a later
 * change; this registration exists to exercise the host and contribution slots.
 */
export const historyArchivesModule: StudioModuleManifest = {
  id: 'org.omi.history-archives',
  version: '0.1.0',
  apiVersion: STUDIO_MODULE_API_VERSION,
  titleKey: 'modules.historyArchives.title',
  descriptionKey: 'modules.historyArchives.description',
  disciplines: ['history'],
  requiredCapabilities: [],
  contributions: [
    {
      id: 'overview',
      slot: 'research-navigation',
      titleKey: 'modules.historyArchives.overview',
      descriptionKey: 'modules.historyArchives.overviewDescription',
    },
  ],
};

export const studioModules = new StudioModuleRegistry();
studioModules.register(historyArchivesModule);

/**
 * Until server-owned module administration exists, built-in shells are
 * available by default. This policy is UI scaffolding, not an authorization
 * decision; protected features must be gated by the server.
 */
export const defaultModuleInstallationPolicy: StudioModuleInstallationPolicy = {
  revision: 1,
  enabledModuleIds: [historyArchivesModule.id],
};
