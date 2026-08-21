import { isDesktopStudio } from '../mobile/platform/platform';

export interface SynchronizedFolderPreferenceContext {
  userId: string;
  providerId: string;
  accountType: string;
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const PREFERENCE_PREFIX = 'omi.cloud.synchronized-folder.v1';

export function synchronizedFolderPreferenceKey(
  context: SynchronizedFolderPreferenceContext,
): string {
  return [
    PREFERENCE_PREFIX,
    context.userId || 'anonymous',
    context.providerId || 'local-folder',
    context.accountType || 'personal',
  ]
    .map((value) => encodeURIComponent(value))
    .join(':');
}

export function getSynchronizedFolderPreference(
  context: SynchronizedFolderPreferenceContext,
  storage: KeyValueStorage | null = browserStorage(),
): string {
  if (!storage) return '';
  try {
    return storage.getItem(synchronizedFolderPreferenceKey(context))?.trim() ?? '';
  } catch {
    return '';
  }
}

export function setSynchronizedFolderPreference(
  context: SynchronizedFolderPreferenceContext,
  folderPath: string,
  storage: KeyValueStorage | null = browserStorage(),
): void {
  if (!storage) return;
  const value = folderPath.trim();
  if (!value) {
    clearSynchronizedFolderPreference(context, storage);
    return;
  }
  try {
    storage.setItem(synchronizedFolderPreferenceKey(context), value);
  } catch {
    // Local device preferences must never prevent the author from working.
  }
}

export function clearSynchronizedFolderPreference(
  context: SynchronizedFolderPreferenceContext,
  storage: KeyValueStorage | null = browserStorage(),
): void {
  if (!storage) return;
  try {
    storage.removeItem(synchronizedFolderPreferenceKey(context));
  } catch {
    // Ignore unavailable or blocked browser storage.
  }
}

export async function chooseSynchronizedFolder(
  defaultPath?: string,
): Promise<string | null> {
  if (!isDesktopStudio()) return null;

  const { open } = await import('@tauri-apps/plugin-dialog');
  const selected = await open({
    multiple: false,
    directory: true,
    defaultPath: defaultPath?.trim() || undefined,
  });

  if (!selected || Array.isArray(selected)) return null;
  return selected;
}

export async function writeOmiBackupToSynchronizedFolder(input: {
  folderPath: string;
  manuscriptTitle: string;
  bytes: Uint8Array;
}): Promise<string> {
  if (!isDesktopStudio()) {
    throw new Error('Synchronized-folder backup is only available in the desktop application.');
  }

  const folderPath = input.folderPath.trim();
  if (!folderPath) {
    throw new Error('No synchronized folder has been selected.');
  }

  const { join } = await import('@tauri-apps/api/path');
  const { writeFile } = await import('@tauri-apps/plugin-fs');
  const fileName = `${slugify(input.manuscriptTitle || 'manuscript')}_${timestamp()}.omi.zip`;
  const targetPath = await join(folderPath, fileName);
  const bytes = new Uint8Array(input.bytes.byteLength);
  bytes.set(input.bytes);
  await writeFile(targetPath, bytes);
  return targetPath;
}

function browserStorage(): KeyValueStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function timestamp(): string {
  return new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'manuscript';
}
