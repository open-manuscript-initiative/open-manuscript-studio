import { historyArchivesModule } from './history-archives/index';
import { moduleManifest as religiousTextsModule } from './religious-texts/index';
import { moduleManifest as criticalTextEditionModule } from './critical-text-edition/index';
import { moduleManifest as corpusLinguisticsModule } from './corpus-linguistics/index';
import { moduleManifest as musicologyModule } from './musicology/index';
import { moduleManifest as culturalHeritageModule } from './cultural-heritage/index';
import { moduleManifest as socialResearchMethodsModule } from './social-research-methods/index';
import { moduleManifest as legalSourcesModule } from './legal-sources/index';
import { moduleManifest as researchReproducibilityModule } from './research-reproducibility/index';
import { moduleManifest as spatialResearchModule } from './spatial-research/index';
import { moduleManifest as archaeologyModule } from './archaeology/index';
import { moduleManifest as experimentalLaboratoryModule } from './experimental-laboratory/index';
import { StudioModuleRegistry } from './registry';
import type { StudioModuleInstallationPolicy } from './types';

export {
  historyArchivesModule,
  religiousTextsModule,
  criticalTextEditionModule,
  corpusLinguisticsModule,
  musicologyModule,
  culturalHeritageModule,
  socialResearchMethodsModule,
  legalSourcesModule,
  researchReproducibilityModule,
  spatialResearchModule,
  archaeologyModule,
  experimentalLaboratoryModule,
};

export const builtinModuleManifests = [
  historyArchivesModule,
  religiousTextsModule,
  criticalTextEditionModule,
  corpusLinguisticsModule,
  musicologyModule,
  culturalHeritageModule,
  socialResearchMethodsModule,
  legalSourcesModule,
  researchReproducibilityModule,
  spatialResearchModule,
  archaeologyModule,
  experimentalLaboratoryModule,
] as const;

export const studioModules = new StudioModuleRegistry();
for (const manifest of builtinModuleManifests) {
  studioModules.register(manifest);
}

/**
 * Until server-owned module administration exists, built-in shells are
 * available by default. This policy is UI scaffolding, not an authorization
 * decision; protected features must be gated by the server.
 */
export const defaultModuleInstallationPolicy: StudioModuleInstallationPolicy = {
  revision: 1,
  enabledModuleIds: builtinModuleManifests.map(({ id }) => id),
};
