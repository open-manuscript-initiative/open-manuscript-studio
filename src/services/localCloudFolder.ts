import { isDesktopStudio } from '../mobile/platform/platform';

export async function chooseSynchronizedFolder(): Promise<string | null> {
  if (!isDesktopStudio()) return null;

  const { open } = await import('@tauri-apps/plugin-dialog');
  const selected = await open({
    multiple: false,
    directory: true,
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

  const { join } = await import('@tauri-apps/api/path');
  const { writeFile } = await import('@tauri-apps/plugin-fs');
  const fileName = `${slugify(input.manuscriptTitle || 'manuscript')}_${timestamp()}.omi.zip`;
  const targetPath = await join(input.folderPath, fileName);
  const bytes = new Uint8Array(input.bytes.byteLength);
  bytes.set(input.bytes);
  await writeFile(targetPath, bytes);
  return targetPath;
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
