import { serializeOmiJson } from './exportOmi';
import type { OmiManuscript } from '../types/omi';

const OMI_FILTERS = [
  {
    name: 'Open Manuscript',
    extensions: ['omi.json', 'json'],
  },
];

let currentFilePath: string | null = null;

export function isNativeStudio(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
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

  const selected = await open({
    multiple: false,
    directory: false,
    filters: OMI_FILTERS,
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

  const selected = await save({
    defaultPath: `${slugify(manuscript.title || 'manuscript')}.omi.json`,
    filters: OMI_FILTERS,
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
