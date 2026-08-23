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
  currentFilePath = selected;

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
  currentFilePath = selected;
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
