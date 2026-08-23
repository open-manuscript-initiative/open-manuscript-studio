export type DeviceStorageMode = 'own-device' | 'shared-device';

const STORAGE_PREFIX = 'omi.device-storage-mode.v1';
const STORAGE_EVENT = 'omi:device-storage-mode-changed';

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}:${encodeURIComponent(userId || 'anonymous')}`;
}

export function getDeviceStorageMode(userId: string): DeviceStorageMode {
  try {
    const value = globalThis.localStorage?.getItem(storageKey(userId));
    return value === 'own-device' ? 'own-device' : 'shared-device';
  } catch {
    return 'shared-device';
  }
}

export function isOwnDevice(userId: string): boolean {
  return getDeviceStorageMode(userId) === 'own-device';
}

export function setDeviceStorageMode(
  userId: string,
  mode: DeviceStorageMode,
): void {
  try {
    globalThis.localStorage?.setItem(storageKey(userId), mode);
  } catch {
    // A blocked local preference must not prevent the author from working.
  }

  globalThis.dispatchEvent?.(
    new CustomEvent(STORAGE_EVENT, { detail: { userId, mode } }),
  );
}

export function subscribeDeviceStorageMode(
  listener: () => void,
): () => void {
  const handler = () => listener();
  globalThis.addEventListener?.(STORAGE_EVENT, handler);
  return () => globalThis.removeEventListener?.(STORAGE_EVENT, handler);
}
