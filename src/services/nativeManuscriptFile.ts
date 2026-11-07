import { DocumentFileLocations } from './documentFileLocations';
import { getStudioPlatform } from '../mobile/platform/platform';
import type { OmiManuscript } from '../types/omi';
import { serializeOmiJson } from './exportOmi';
import { readLocalManuscriptBytes } from './localManuscriptImport';

const DESKTOP_OMI_FILTERS = [
  {
    name: 'Open Manuscript',
    extensions: ['omi', 'omi.json', 'json'],
  },
];

// Providers often classify downloaded .omi packages as application/octet-stream.
// Content validation, rather than Android MIME metadata, decides what can open.
const ANDROID_OPEN_FILTERS = [{ name: 'Open Manuscript', extensions: ['*/*'] }];
const ANDROID_SAVE_FILTERS = [{ name: 'Open Manuscript', extensions: ['application/json'] }];

const fileLocations = new DocumentFileLocations();

export function isNativeStudio(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Compatibility helper retained for existing UI call sites. Android document
 * providers return content:// and iOS/iPadOS Files returns file://. Both are
 * native document-provider transport identifiers and should be hidden from
 * user-facing location labels.
 */
export function isAndroidDocumentUri(value: string | null | undefined): boolean {
  return typeof value === 'string'
    && (value.startsWith('content://') || value.startsWith('file://'));
}



export function getCurrentManuscriptFilePath(manuscriptId: string): string | null {
  return fileLocations.get(manuscriptId);
}

export function clearCurrentManuscriptFilePath(): void {
  fileLocations.clear();
}

export function forgetManuscriptFilePath(manuscriptId: string): void {
  fileLocations.set(manuscriptId, null);
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
 * the author can read from a USB drive or mobile Files provider, but Studio
 * does not retain a local working-path association afterwards.
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
  const { readFile } = await import('@tauri-apps/plugin-fs');
  const platform = getStudioPlatform();
  const android = platform === 'android';
  const ios = platform === 'ios';
  const mobile = android || ios;

  const selected = await open({
    multiple: false,
    directory: false,
    filters: android ? ANDROID_OPEN_FILTERS : DESKTOP_OMI_FILTERS,
    ...(mobile ? { pickerMode: 'document' as const } : {}),
    ...(ios ? { fileAccess: 'scoped' as const } : {}),
  });

  if (!selected || Array.isArray(selected)) {
    return null;
  }

  const bytes = await readFile(selected);
  const { manuscript, isContainer } = await readLocalManuscriptBytes(bytes);
  // Container archives must never be overwritten by JSON Save operations.
  fileLocations.set(manuscript.id, rememberPath && !isContainer ? selected : null);

  return { manuscript, path: selected };
}

export async function saveLocalManuscript(
  manuscript: OmiManuscript,
): Promise<string | null> {
  if (!isNativeStudio()) {
    return null;
  }

  const currentFilePath = fileLocations.get(manuscript.id);
  if (!currentFilePath) {
    return saveLocalManuscriptAs(manuscript);
  }

  const { writeTextFile, readFile } = await import('@tauri-apps/plugin-fs');
  const serialized = serializeOmiJson(manuscript);
  await writeTextFile(currentFilePath, serialized);
  if (getStudioPlatform() === 'android') await verifySavedJson(currentFilePath, serialized, readFile);
  return currentFilePath;
}

export async function saveLocalManuscriptAs(
  manuscript: OmiManuscript,
): Promise<string | null> {
  return saveManuscriptWithPicker(manuscript, true);
}

/**
 * Saves a one-off manuscript copy through the native picker without retaining
 * the selected path. On a shared computer or mobile device the user can
 * explicitly choose portable/external storage while Studio keeps cloud
 * storage as the normal workflow.
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
  const { writeTextFile, readFile } = await import('@tauri-apps/plugin-fs');
  const platform = getStudioPlatform();
  const android = platform === 'android';

  // Android invokes the Storage Access Framework/Documents UI and returns a
  // content:// URI. iOS/iPadOS invokes the Files/UIDocumentPicker surface and
  // returns a file:// URI. tauri-plugin-fs can write both directly, so Studio
  // does not request broad shared-storage access on either mobile platform.
  const selected = await save({
    defaultPath: `${slugify(manuscript.title || 'manuscript')}.omi.json`,
    filters: android ? ANDROID_SAVE_FILTERS : DESKTOP_OMI_FILTERS,
  });

  if (!selected) {
    return null;
  }

  const serialized = serializeOmiJson(manuscript);
  await writeTextFile(selected, serialized);
  if (android) await verifySavedJson(selected, serialized, readFile);
  fileLocations.set(manuscript.id, rememberPath ? selected : null);
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

async function verifySavedJson(
  uri: string,
  expected: string,
  readFile: (path: string) => Promise<Uint8Array>,
): Promise<void> {
  const actual = await readFile(uri).catch(() => {
    throw new Error('Android manuscript save could not be verified by reading the document back.');
  });
  if (new TextDecoder('utf-8', { fatal: true }).decode(actual) !== expected) {
    throw new Error(`Android manuscript save failed verification (${actual.byteLength} bytes read).`);
  }
}
