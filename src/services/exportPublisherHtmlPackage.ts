import {
  assetPath,
  collectReferencedAssetIds,
  sha256Hex,
} from '../model/assets';
import { getRevisionStateDigest } from '../model/revisionIntegrity';
import {
  publisherStylesheetPackagePath,
} from '../model/publisherExportStyle';
import {
  resolvePublicationProfile,
  type OmiPublicationProfile,
} from '../model/publicationProfile';
import type { OmiAsset } from '../types/assets';
import type { OmiManuscript } from '../types/omi';
import { getAssetPayload } from './assetRepository';
import {
  htmlPackageFileName,
  renderHtmlArticle,
  type HtmlDiagnostic,
  type HtmlExportResult,
} from './exportHtml';

export const OMI_PUBLISHER_HTML_PACKAGE_VERSION = '0.2.0-alpha.1' as const;

export interface PublisherHtmlPackageManifestEntry {
  path: string;
  mediaType: string;
  role: 'article' | 'asset' | 'stylesheet';
  sha256: string;
  assetId?: string;
}

export interface PublisherHtmlPackageManifest {
  format: 'omi-semantic-html-package';
  version: typeof OMI_PUBLISHER_HTML_PACKAGE_VERSION;
  manuscriptId: string;
  headRevisionId: string;
  publicationProfile: {
    id: string;
    version: string;
  };
  publisherStylesheet?: {
    path: string;
    sourceFileName: string;
  };
  stateDigest?: {
    algorithm: 'sha256';
    value: string;
    canonicalization: string;
  };
  entries: PublisherHtmlPackageManifestEntry[];
}

export interface PublisherHtmlPackageExportResult {
  bytes: Uint8Array;
  blob: Blob;
  fileName: string;
  html: HtmlExportResult;
  manifest: PublisherHtmlPackageManifest;
  diagnostics: HtmlDiagnostic[];
  validForExport: boolean;
}

interface PackageEntry {
  path: string;
  mediaType: string;
  role: 'article' | 'asset' | 'stylesheet';
  assetId?: string;
  bytes: Uint8Array;
}

export async function buildPublisherHtmlPackage(
  manuscript: OmiManuscript,
  profile: OmiPublicationProfile = resolvePublicationProfile(manuscript),
): Promise<PublisherHtmlPackageExportResult> {
  const diagnostics: HtmlDiagnostic[] = [];
  const assetMap = new Map((manuscript.assets ?? []).map((asset) => [asset.id, asset]));
  const referencedAssetIds = collectReferencedAssetIds(
    manuscript.sections.flatMap((section) => section.blocks),
  );
  const entries: PackageEntry[] = [];

  for (const assetId of referencedAssetIds) {
    const asset = assetMap.get(assetId);
    if (!asset) {
      diagnostics.push({
        code: 'html-package-asset-metadata-missing',
        severity: 'error',
        message: `Referenced HTML asset metadata is missing: ${assetId}.`,
        targetId: assetId,
      });
      continue;
    }
    const bytes = await getAssetPayload(manuscript.id, asset.id);
    if (!bytes) {
      diagnostics.push({
        code: 'html-package-asset-payload-missing',
        severity: 'error',
        message: `Referenced HTML asset payload is unavailable: ${asset.id}.`,
        targetId: asset.id,
      });
      continue;
    }
    const digest = await sha256Hex(bytes);
    if (bytes.byteLength !== asset.size || digest.toLowerCase() !== asset.checksum.value.toLowerCase()) {
      diagnostics.push({
        code: 'html-package-asset-integrity-mismatch',
        severity: 'error',
        message: `HTML asset ${asset.id} does not match its declared size or SHA-256 digest.`,
        targetId: asset.id,
      });
      continue;
    }
    entries.push({
      path: assetPath(asset),
      mediaType: asset.mediaType,
      role: 'asset',
      assetId: asset.id,
      bytes,
    });
  }

  const stylesheetPath = publisherStylesheetPackagePath(profile);
  if (stylesheetPath && profile.exportStylesheet) {
    entries.push({
      path: stylesheetPath,
      mediaType: 'text/css;charset=utf-8',
      role: 'stylesheet',
      bytes: new TextEncoder().encode(profile.exportStylesheet.cssText),
    });
  }

  const baseHtml = renderHtmlArticle(manuscript, profile, { assetPrefix: '' });
  diagnostics.push(...baseHtml.diagnostics);
  const htmlText = stylesheetPath
    ? injectStylesheetLink(baseHtml.html, stylesheetPath)
    : baseHtml.html;
  const html: HtmlExportResult = { ...baseHtml, html: htmlText };
  entries.unshift({
    path: 'index.html',
    mediaType: 'text/html;charset=utf-8',
    role: 'article',
    bytes: new TextEncoder().encode(htmlText),
  });

  const manifestEntries: PublisherHtmlPackageManifestEntry[] = [];
  for (const entry of entries) {
    manifestEntries.push({
      path: entry.path,
      mediaType: entry.mediaType,
      role: entry.role,
      assetId: entry.assetId,
      sha256: await sha256Hex(entry.bytes),
    });
  }

  const head = manuscript.revisionHistory.revisions.find(
    (revision) => revision.id === manuscript.headRevisionId,
  );
  const stateDigest = head ? getRevisionStateDigest(head) : undefined;
  const manifest: PublisherHtmlPackageManifest = {
    format: 'omi-semantic-html-package',
    version: OMI_PUBLISHER_HTML_PACKAGE_VERSION,
    manuscriptId: manuscript.id,
    headRevisionId: manuscript.headRevisionId,
    publicationProfile: { id: profile.id, version: profile.version },
    publisherStylesheet: stylesheetPath && profile.exportStylesheet
      ? { path: stylesheetPath, sourceFileName: profile.exportStylesheet.fileName }
      : undefined,
    stateDigest: stateDigest
      ? {
          algorithm: stateDigest.algorithm,
          value: stateDigest.value,
          canonicalization: stateDigest.canonicalization,
        }
      : undefined,
    entries: manifestEntries,
  };

  entries.splice(1, 0, {
    path: 'manifest.json',
    mediaType: 'application/json',
    role: 'article',
    bytes: new TextEncoder().encode(`${JSON.stringify(manifest, null, 2)}\n`),
  });

  const bytes = createStoreZip(entries.map((entry) => ({ name: entry.path, bytes: entry.bytes })));
  const blobBytes = new Uint8Array(bytes.byteLength);
  blobBytes.set(bytes);
  return {
    bytes,
    blob: new Blob([blobBytes.buffer], { type: 'application/zip' }),
    fileName: htmlPackageFileName(manuscript),
    html,
    manifest,
    diagnostics,
    validForExport: !diagnostics.some((diagnostic) => diagnostic.severity === 'error'),
  };
}

export function renderPublisherHtmlArticle(
  manuscript: OmiManuscript,
  profile: OmiPublicationProfile = resolvePublicationProfile(manuscript),
): HtmlExportResult {
  const result = renderHtmlArticle(manuscript, profile);
  if (!profile.exportStylesheet?.cssText.trim()) return result;
  const html = result.html.replace(
    '</head>',
    `  <style data-omi-publisher-export-style="${escapeAttribute(profile.exportStylesheet.fileName)}">\n${profile.exportStylesheet.cssText}\n  </style>\n</head>`,
  );
  return { ...result, html };
}

function injectStylesheetLink(html: string, path: string): string {
  return html.replace(
    '</head>',
    `  <link rel="stylesheet" href="${escapeAttribute(path)}" data-omi-publisher-export-style>\n</head>`,
  );
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function createStoreZip(entries: readonly { name: string; bytes: Uint8Array }[]): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  const { time, date } = dosDateTime(new Date());

  for (const entry of entries) {
    const name = new TextEncoder().encode(entry.name);
    const crc = crc32(entry.bytes);
    const local = new Uint8Array(30 + name.length + entry.bytes.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, time, true);
    localView.setUint16(12, date, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, entry.bytes.length, true);
    localView.setUint32(22, entry.bytes.length, true);
    localView.setUint16(26, name.length, true);
    localView.setUint16(28, 0, true);
    local.set(name, 30);
    local.set(entry.bytes, 30 + name.length);
    localParts.push(local);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, time, true);
    centralView.setUint16(14, date, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, entry.bytes.length, true);
    centralView.setUint32(24, entry.bytes.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    central.set(name, 46);
    centralParts.push(central);
    offset += local.length;
  }

  const centralOffset = offset;
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, centralOffset, true);
  endView.setUint16(20, 0, true);
  return concatBytes([...localParts, ...centralParts, end]);
}

function concatBytes(parts: readonly Uint8Array[]): Uint8Array {
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(value: Date): { time: number; date: number } {
  const year = Math.max(1980, value.getFullYear());
  return {
    time: (value.getHours() << 11) | (value.getMinutes() << 5) | Math.floor(value.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((value.getMonth() + 1) << 5) | value.getDate(),
  };
}

export function referencedPublisherHtmlAssets(manuscript: OmiManuscript): OmiAsset[] {
  const referenced = collectReferencedAssetIds(manuscript.sections.flatMap((section) => section.blocks));
  return (manuscript.assets ?? []).filter((asset) => referenced.has(asset.id));
}
