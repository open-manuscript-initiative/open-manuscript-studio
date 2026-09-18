import { getStudioPlatform } from '../mobile/platform/platform';
import { isNativeStudio } from './nativeManuscriptFile';

export interface ExportDeliveryResult {
  saved: boolean;
  path?: string;
}

export interface ExportWithSidecarDeliveryResult extends ExportDeliveryResult {
  sidecarSaved: boolean;
  sidecarPath?: string;
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
  const platform = getStudioPlatform();
  const selected = await save({
    defaultPath: fileName,
    filters: [dialogFilter(fileName, platform)],
  });

  if (!selected) return { saved: false };

  const bytes = new Uint8Array(await blob.arrayBuffer());
  await writeFile(selected, bytes);

  // Android content:// and iOS file:// document-provider URLs are transport
  // details. Mobile users work with the system Files/Documents surface rather
  // than filesystem paths, so do not expose those URIs in success messages.
  if (platform === 'android' || platform === 'ios') {
    return { saved: true };
  }

  return { saved: true, path: selected };
}


/**
 * Saves an exported artifact together with its provenance sidecar.
 *
 * Web builds trigger two downloads. Desktop Tauri builds ask for the artifact
 * path once and write the sidecar next to it using the final selected filename.
 * Mobile document providers do not expose a sibling filesystem path, so they
 * receive a second save dialog for the sidecar.
 */
export async function saveExportBlobWithSidecar(
  blob: Blob,
  fileName: string,
  sidecarText: string,
  sidecarFileName: string,
): Promise<ExportWithSidecarDeliveryResult> {
  const sidecarBlob = new Blob([sidecarText], {
    type: 'application/json;charset=utf-8',
  });

  if (!isNativeStudio()) {
    downloadBlobInBrowser(blob, fileName);
    downloadBlobInBrowser(sidecarBlob, sidecarFileName);
    return { saved: true, sidecarSaved: true };
  }

  const { save } = await import('@tauri-apps/plugin-dialog');
  const { writeFile } = await import('@tauri-apps/plugin-fs');
  const platform = getStudioPlatform();
  const selected = await save({
    defaultPath: fileName,
    filters: [dialogFilter(fileName, platform)],
  });

  if (!selected) return { saved: false, sidecarSaved: false };

  await writeFile(selected, new Uint8Array(await blob.arrayBuffer()));

  if (platform === 'android' || platform === 'ios') {
    const sidecarSelected = await save({
      defaultPath: sidecarFileName,
      filters: [dialogFilter(sidecarFileName, platform)],
    });
    if (!sidecarSelected) {
      return { saved: true, sidecarSaved: false };
    }
    await writeFile(
      sidecarSelected,
      new Uint8Array(await sidecarBlob.arrayBuffer()),
    );
    return { saved: true, sidecarSaved: true };
  }

  const sidecarPath = `${selected}.omi-build.json`;
  await writeFile(
    sidecarPath,
    new Uint8Array(await sidecarBlob.arrayBuffer()),
  );
  return {
    saved: true,
    path: selected,
    sidecarSaved: true,
    sidecarPath,
  };
}

export async function saveExportText(
  value: string,
  fileName: string,
  mediaType: string,
): Promise<ExportDeliveryResult> {
  return saveExportBlob(new Blob([value], { type: mediaType }), fileName);
}

function dialogFilter(
  fileName: string,
  platform: ReturnType<typeof getStudioPlatform>,
): { name: string; extensions: string[] } {
  return {
    name: 'Open Manuscript export',
    // Android's Storage Access Framework primarily filters by MIME type.
    // iOS/iPadOS Files/UIDocumentPicker supports filename extensions, like
    // desktop platforms, so keep extension filters there.
    extensions: platform === 'android'
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
  if (normalized.endsWith('.pdf')) return 'application/pdf';
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
