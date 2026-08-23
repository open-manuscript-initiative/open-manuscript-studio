import { getStudioPlatform } from '../mobile/platform/platform';
import { isNativeStudio } from './nativeManuscriptFile';

export interface ExportDeliveryResult {
  saved: boolean;
  path?: string;
}

/**
 * Delivers an exported file using the platform-native save dialog in Tauri
 * builds and a normal browser download on the web. Export generation stays
 * independent from the delivery mechanism, so the same exporters work in the
 * hosted Studio and in desktop/mobile application builds.
 */
export async function saveExportBlob(
  blob: Blob,
  fileName: string,
): Promise<ExportDeliveryResult> {
  if (!isNativeStudio()) {
    downloadBlobInBrowser(blob, fileName);
    return { saved: true };
  }

  const { save } = await import('@tauri-apps/plugin-dialog');
  const { writeFile } = await import('@tauri-apps/plugin-fs');
  const selected = await save({
    defaultPath: fileName,
    filters: [dialogFilter(fileName)],
  });

  if (!selected) return { saved: false };

  const bytes = new Uint8Array(await blob.arrayBuffer());
  await writeFile(selected, bytes);
  return { saved: true, path: selected };
}

export async function saveExportText(
  value: string,
  fileName: string,
  mediaType: string,
): Promise<ExportDeliveryResult> {
  return saveExportBlob(new Blob([value], { type: mediaType }), fileName);
}

function dialogFilter(fileName: string): { name: string; extensions: string[] } {
  return {
    name: 'Open Manuscript export',
    extensions: getStudioPlatform() === 'android'
      ? [mimeTypeForFileName(fileName)]
      : [extensionForFileName(fileName)],
  };
}

function mimeTypeForFileName(fileName: string): string {
  const normalized = fileName.trim().toLowerCase();
  if (normalized.endsWith('.omi.zip') || normalized.endsWith('.html.zip')) return 'application/zip';
  if (normalized.endsWith('.omi.json') || normalized.endsWith('.json')) return 'application/json';
  if (normalized.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (normalized.endsWith('.epub')) return 'application/epub+zip';
  if (normalized.endsWith('.xml')) return 'application/xml';
  if (normalized.endsWith('.tex')) return 'text/plain';
  return 'application/octet-stream';
}

function extensionForFileName(fileName: string): string {
  const normalized = fileName.trim().toLowerCase();
  if (normalized.endsWith('.omi.zip') || normalized.endsWith('.html.zip')) return 'zip';
  if (normalized.endsWith('.omi.json')) return 'json';

  const lastDot = normalized.lastIndexOf('.');
  if (lastDot >= 0 && lastDot < normalized.length - 1) {
    return normalized.slice(lastDot + 1);
  }
  return '*';
}

function downloadBlobInBrowser(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
