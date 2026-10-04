import { historyArchivesModule } from './history-archives/index';
import { StudioModuleRegistry } from './registry';
import type { StudioModuleInstallationPolicy } from './types';

export { historyArchivesModule } from './history-archives/index';

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
