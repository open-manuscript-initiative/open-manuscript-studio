import { isTauri } from '@tauri-apps/api/core';

export const NATIVE_SESSION_STORAGE_KEY = 'omi_native_session_token';
const NATIVE_SERVER_STORAGE_KEY = 'omi_native_studio_api_origin';

export interface NativeServerSelectionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function isNativeStudioRuntime(): boolean {
  if (isTauri()) return true;
  const location = globalThis.location;
  return Boolean(location && (
    location.protocol === 'tauri:' ||
    location.hostname === 'tauri.localhost'
  ));
}

export function readNativeServerSelection(): string | null {
  try {
    return globalThis.localStorage?.getItem(NATIVE_SERVER_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

/**
 * Clear the previous server's bearer token before changing the origin.
 * A storage error fails closed and prevents the endpoint change.
 */
export function persistNativeServerSelection(
  origin: string | null,
  storage: NativeServerSelectionStorage | undefined = globalThis.localStorage,
): void {
  if (!storage) throw new Error('Native server selection storage is unavailable.');
  storage.removeItem(NATIVE_SESSION_STORAGE_KEY);
  if (origin === null) storage.removeItem(NATIVE_SERVER_STORAGE_KEY);
  else storage.setItem(NATIVE_SERVER_STORAGE_KEY, origin);
}

export function clearNativeServerOverride(): void {
  globalThis.localStorage?.removeItem(NATIVE_SERVER_STORAGE_KEY);
}
