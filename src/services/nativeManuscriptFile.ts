import { getStudioPlatform } from '../mobile/platform/platform';
import type { OmiManuscript } from '../types/omi';
import { serializeOmiJson } from './exportOmi';

const DESKTOP_OMI_FILTERS = [
  {
    name: 'Open Manuscript',
    extensions: ['omi.json', 'json'],
  },
];

const ANDROID_OMI_FILTERS = [
  {
    name: 'Open Manuscript',
    extensions: ['application/json', 'application/vnd.openmanuscript+json'],
  },
];

let currentFilePath: string | null = null;

export function isNativeStudio(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function isAndroidDocumentUri(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith('content://');
}

export function getCurrentManuscriptFilePath(): string | null {
  return currentFilePath;
}

export function clearCurrentManuscriptFilePath(): void {
  currentFilePath = null;
}

export async function openLocalManuscript(): Promise<{
  manuscript: OmiManuscript;
  path: string;
} | null> {
  return openManuscriptWithPicker(true);
}

/**
 * Opens a manuscript from removable/portable storage without making that path
 * the current working file. This is intended for shared or foreign machines:
 * the author can read from a USB drive, but Studio does not retain a local
 * working-path association afterwards.
 */
export async function openPortableManuscript(): Promise<{
  manuscript: OmiManuscript;
  path: string;
} | null> {
  return openManuscriptWithPicker(false);
}

async function openManuscriptWithPicker(
  rememberPath: boolean,
): Promise<{
  manuscript: OmiManuscript;
  path: string;
} | null> {
  if (!isNativeStudio()) {
    return null;
  }

  const { open } = await import('@tauri-apps/plugin-dialog');
  const { readTextFile } = await import('@tauri-apps/plugin-fs');
  const android = getStudioPlatform() === 'android';

  const selected = await open({
    multiple: false,
    directory: false,
    filters: android ? ANDROID_OMI_FILTERS : DESKTOP_OMI_FILTERS,
    ...(android ? { pickerMode: 'document' as const } : {}),
  });

  if (!selected || Array.isArray(selected)) {
    return null;
  }

  const raw = await readTextFile(selected);
  const manuscript = JSON.parse(raw) as OmiManuscript;
  currentFilePath = rememberPath ? selected : null;

  return { manuscript, path: selected };
}

export async function saveLocalManuscript(
  manuscript: OmiManuscript,
): Promise<string | null> {
  if (!isNativeStudio()) {
    return null;
  }

  if (!currentFilePath) {
    return saveLocalManuscriptAs(manuscript);
  }

  const { writeTextFile } = await import('@tauri-apps/plugin-fs');
  await writeTextFile(currentFilePath, serializeOmiJson(manuscript));
  return currentFilePath;
}

export async function saveLocalManuscriptAs(
  manuscript: OmiManuscript,
): Promise<string | null> {
  return saveManuscriptWithPicker(manuscript, true);
}

/**
 * Saves a one-off manuscript copy through the native picker without retaining
 * the selected path. On a shared computer the user can explicitly choose a
 * removable drive while Studio keeps cloud storage as the normal workflow.
 */
export async function savePortableManuscriptCopy(
  manuscript: OmiManuscript,
): Promise<string | null> {
  return saveManuscriptWithPicker(manuscript, false);
}

async function saveManuscriptWithPicker(
  manuscript: OmiManuscript,
  rememberPath: boolean,
): Promise<string | null> {
  if (!isNativeStudio()) {
    return null;
  }

  const { save } = await import('@tauri-apps/plugin-dialog');
  const { writeTextFile } = await import('@tauri-apps/plugin-fs');
  const android = getStudioPlatform() === 'android';

  // On Android this invokes the Storage Access Framework/Documents UI. The
  // returned content:// URI can be written directly by tauri-plugin-fs, so the
  // app never needs broad shared-storage permissions.
  const selected = await save({
    defaultPath: `${slugify(manuscript.title || 'manuscript')}.omi.json`,
    filters: android ? ANDROID_OMI_FILTERS : DESKTOP_OMI_FILTERS,
  });

  if (!selected) {
    return null;
  }

  await writeTextFile(selected, serializeOmiJson(manuscript));
  currentFilePath = rememberPath ? selected : null;
  return selected;
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
