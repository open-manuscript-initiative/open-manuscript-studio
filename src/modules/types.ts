/**
 * Provider-neutral contracts for Studio discipline modules.
 *
 * A module describes itself and the capabilities it needs. These declarations
 * are metadata; server routes must still enforce authorization independently.
 */
export const STUDIO_MODULE_API_VERSION = 'omi-studio-module/1' as const;

export type StudioModuleId = string;
export type StudioDisciplineId = string;
export type StudioCapabilityId = string;

export type StudioModuleSlot =
  | 'workspace-home'
  | 'workspace-tools'
  | 'research-navigation';

export interface StudioModuleContribution {
  /** Stable, module-local identifier used for keys and telemetry. */
  id: string;
  slot: StudioModuleSlot;
  /** Translation key resolved by the host Studio locale. */
  titleKey: string;
  descriptionKey?: string;
}

export interface StudioModuleManifest {
  /** Reverse-domain or organization-qualified identifier, stable across releases. */
  id: StudioModuleId;
  version: string;
  apiVersion: typeof STUDIO_MODULE_API_VERSION;
  /** Translation keys; modules do not provide raw UI strings. */
  titleKey: string;
  descriptionKey: string;
  /** Omit for cross-disciplinary modules. */
  disciplines?: readonly StudioDisciplineId[];
  /** Capability declarations inform setup and consent; they do not grant access. */
  requiredCapabilities: readonly StudioCapabilityId[];
  contributions: readonly StudioModuleContribution[];
}

export interface StudioModuleInstallationPolicy {
  /** Monotonically increasing server revision for safe settings updates. */
  revision: number;
  enabledModuleIds: readonly StudioModuleId[];
}

export interface StudioWorkspaceModulePreferences {
  workspaceId: string;
  /** User-selected subset of modules enabled by the installation administrator. */
  activeModuleIds: readonly StudioModuleId[];
}

export type StudioModuleActivationState =
  | 'disabled-by-installation'
  | 'available'
  | 'active';

/** Inputs are policy snapshots; authorization remains a server responsibility. */
export function resolveStudioModuleActivationState(
  moduleId: StudioModuleId,
  installation: StudioModuleInstallationPolicy,
  workspace: StudioWorkspaceModulePreferences,
): StudioModuleActivationState {
  if (!installation.enabledModuleIds.includes(moduleId)) {
    return 'disabled-by-installation';
  }
  return workspace.activeModuleIds.includes(moduleId) ? 'active' : 'available';
}
