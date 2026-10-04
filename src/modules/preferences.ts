import type { StudioWorkspaceModulePreferences } from './types';

const STORAGE_PREFIX = 'omi:studio-module-preferences:v1';

export interface ModulePreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const DEFAULT_STUDIO_WORKSPACE_ID = 'default';

export function readStudioModulePreferences(
  userId: string,
  workspaceId: string = DEFAULT_STUDIO_WORKSPACE_ID,
  storage: ModulePreferenceStorage | null = getBrowserStorage(),
): StudioWorkspaceModulePreferences {
  if (!storage) return { workspaceId, activeModuleIds: [] };

  try {
    const raw = storage.getItem(getModulePreferencesStorageKey(userId, workspaceId));
    if (!raw) return { workspaceId, activeModuleIds: [] };
    const parsed = JSON.parse(raw) as unknown;
    if (!isStoredPreference(parsed)) return { workspaceId, activeModuleIds: [] };
    return {
      workspaceId,
      activeModuleIds: [...new Set(parsed.activeModuleIds.filter((id) => typeof id === 'string'))],
    };
  } catch {
    return { workspaceId, activeModuleIds: [] };
  }
}

export function writeStudioModulePreferences(
  userId: string,
  preferences: StudioWorkspaceModulePreferences,
  storage: ModulePreferenceStorage | null = getBrowserStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(
      getModulePreferencesStorageKey(userId, preferences.workspaceId),
      JSON.stringify({
        version: 1,
        activeModuleIds: [...new Set(preferences.activeModuleIds)],
      }),
    );
  } catch {
    // Module shell preferences are optional; restricted storage must not block Studio.
  }
}

export function getModulePreferencesStorageKey(
  userId: string,
  workspaceId: string,
): string {
  return `${STORAGE_PREFIX}:${encodeURIComponent(userId)}:${encodeURIComponent(workspaceId)}`;
}

function isStoredPreference(
  value: unknown,
): value is { version: 1; activeModuleIds: unknown[] } {
  return Boolean(
    value
    && typeof value === 'object'
    && 'version' in value
    && value.version === 1
    && 'activeModuleIds' in value
    && Array.isArray(value.activeModuleIds),
  );
}

function getBrowserStorage(): ModulePreferenceStorage | null {
  return typeof window === 'undefined' ? null : window.localStorage;
}
