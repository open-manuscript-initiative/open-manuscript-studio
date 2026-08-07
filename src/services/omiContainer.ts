import { assetPath, collectReferencedAssetIds, sha256Hex } from '../model/assets';
import { extractManuscriptState } from '../model/versioning';
import { resolvePublicationProfile } from '../model/publicationProfile';
import { renderJatsArticle } from './exportJats';
import { getAssetPayload } from './assetRepository';
import type { OmiAsset } from '../types/assets';
import type { OmiBlock, OmiManuscript, OmiManuscriptState } from '../types/omi';

export const OMI_CONTAINER_VERSION = '0.1.0-alpha.1' as const;
export const OMI_CONTAINER_MEDIA_TYPE = 'application/vnd.openmanuscript.omi+zip' as const;

export type OmiContainerDiagnosticSeverity = 'error' | 'warning';

export interface OmiContainerDiagnostic {
  code: string;
  severity: OmiContainerDiagnosticSeverity;
  message: string;
  targetId?: string;
}

export interface OmiContainerManifestEntry {
  path: string;
  mediaType: string;
  role: string;
  assetId?: string;
}

export interface OmiContainerManifest {
  format: 'OMI';
  containerVersion: typeof OMI_CONTAINER_VERSION;
  mediaType: typeof OMI_CONTAINER_MEDIA_TYPE;
  manuscriptId: string;
  headRevisionId: string;
  createdAt: string;
  specifications: {
    fileFormat: 'OMI-SPEC-320@0.1.0';
    containerArchitecture: 'OMI-SPEC-330@0.1.0';
  };
  entries: OmiContainerManifestEntry[];
}

export interface OmiContainerExportResult {
  bytes: Uint8Array;
  blob: Blob;
  fileName: string;
  manifest: OmiContainerManifest;
  diagnostics: OmiContainerDiagnostic[];
  validForExport: boolean;
}

interface PackageEntry extends OmiContainerManifestEntry {
  bytes: Uint8Array;
}

/**
 * Builds a portable, inspectable OMI container without a third-party ZIP
 * dependency. ZIP entries use the interoperable STORE method; semantic content
 * is independent from compression.
 */
export async function buildOmiContainer(
  manuscript: OmiManuscript,
): Promise<OmiContainerExportResult> {
  const diagnostics: OmiContainerDiagnostic[] = [];
  const profile = resolvePublicationProfile(manuscript);
  const assetMap = new Map((manuscript.assets ?? []).map((asset) => [asset.id, asset]));
  const referencedAssetIds = collectReferencedAssetIds(
    manuscript.sections.flatMap((section) => section.blocks),
  );

  const assetEntries: PackageEntry[] = [];
  for (const assetId of referencedAssetIds) {
    const asset = assetMap.get(assetId);
    if (!asset) {
      diagnostics.push({
        code: 'asset-metadata-missing',
        severity: 'error',
        message: `Asset metadata is missing for ${assetId}.`,
        targetId: assetId,
      });
      continue;
    }

    const bytes = await getAssetPayload(manuscript.id, asset.id);
    if (!bytes) {
      diagnostics.push({
        code: 'asset-payload-missing',
        severity: 'error',
        message: `Binary payload is unavailable for asset ${asset.id}.`,
        targetId: asset.id,
      });
      continue;
    }

    const digest = await sha256Hex(bytes);
    if (digest !== asset.checksum.value || bytes.byteLength !== asset.size) {
      diagnostics.push({
        code: 'asset-integrity-mismatch',
        severity: 'error',
        message: `Asset ${asset.id} does not match its declared SHA-256 digest or size.`,
        targetId: asset.id,
      });
      continue;
    }

    assetEntries.push({
      path: assetPath(asset),
      mediaType: asset.mediaType,
      role: `asset:${asset.role}`,
      assetId: asset.id,
      bytes,
    });
  }

  for (const asset of manuscript.assets ?? []) {
    if (!referencedAssetIds.has(asset.id)) {
      diagnostics.push({
        code: 'unreferenced-asset-retained',
        severity: 'warning',
        message: `Asset ${asset.id} is not referenced by the current manuscript state and is retained for preservation.`,
        targetId: asset.id,
      });
      const bytes = await getAssetPayload(manuscript.id, asset.id);
      if (bytes && !assetEntries.some((entry) => entry.assetId === asset.id)) {
        assetEntries.push({
          path: assetPath(asset),
          mediaType: asset.mediaType,
          role: `asset:${asset.role}:unreferenced`,
          assetId: asset.id,
          bytes,
        });
      }
    }
  }

  const packagedState = stripAuthoringAssetPreviews(extractManuscriptState(manuscript));
  const jatsManuscript = rewriteAssetSourcesForPublication(manuscript, assetMap);
  const jats = renderJatsArticle(jatsManuscript, profile);
  diagnostics.push(
    ...jats.diagnostics.map((diagnostic) => ({
      code: `jats:${diagnostic.code}`,
      severity: diagnostic.severity,
      message: diagnostic.message,
      targetId: diagnostic.targetId,
    })),
  );

  const entries: PackageEntry[] = [
    textEntry('META-INF/mimetype', OMI_CONTAINER_MEDIA_TYPE, 'text/plain', 'container-mimetype'),
    textEntry(
      'manuscript/document.json',
      stableJson(packagedState),
      'application/json',
      'manuscript-document',
    ),
    textEntry(
      'manuscript/history.json',
      stableJson({
        versioningModelVersion: manuscript.versioningModelVersion,
        headRevisionId: manuscript.headRevisionId,
        revisionHistory: manuscript.revisionHistory,
      }),
      'application/json',
      'manuscript-history',
    ),
    textEntry(
      'manuscript/metadata.json',
      stableJson({
        manuscriptId: manuscript.id,
        locale: manuscript.locale,
        title: manuscript.title,
        subtitle: manuscript.subtitle,
        motto: (manuscript as OmiManuscript & { motto?: string }).motto,
        abstract: manuscript.abstract,
        keywords: manuscript.keywords,
        profile: { id: profile.id, version: profile.version },
      }),
      'application/json',
      'manuscript-metadata',
    ),
    textEntry(
      'profiles/publication-profile.json',
      stableJson(profile),
      'application/json',
      'publication-profile',
    ),
    ...assetEntries,
  ];

  if (jats.validForExport) {
    entries.push(
      textEntry(
        'publication/article.jats.xml',
        jats.xml,
        'application/xml',
        'publication:jats-1.4-authoring',
      ),
    );
  } else {
    diagnostics.push({
      code: 'jats-output-omitted',
      severity: 'warning',
      message: 'JATS output was omitted from the container because publication validation reported errors.',
    });
  }

  const createdAt = new Date().toISOString();
  const manifestEntries: OmiContainerManifestEntry[] = [
    ...entries.map(({ path, mediaType, role, assetId }) => ({ path, mediaType, role, assetId })),
    {
      path: 'META-INF/manifest.json',
      mediaType: 'application/json',
      role: 'container-manifest',
    },
    {
      path: 'META-INF/checksums.json',
      mediaType: 'application/json',
      role: 'container-checksums',
    },
  ];
  const manifest: OmiContainerManifest = {
    format: 'OMI',
    containerVersion: OMI_CONTAINER_VERSION,
    mediaType: OMI_CONTAINER_MEDIA_TYPE,
    manuscriptId: manuscript.id,
    headRevisionId: manuscript.headRevisionId,
    createdAt,
    specifications: {
      fileFormat: 'OMI-SPEC-320@0.1.0',
      containerArchitecture: 'OMI-SPEC-330@0.1.0',
    },
    entries: manifestEntries,
  };
  const manifestEntry = textEntry(
    'META-INF/manifest.json',
    stableJson(manifest),
    'application/json',
    'container-manifest',
  );
  entries.splice(1, 0, manifestEntry);

  const checksumItems = [] as Array<{ path: string; algorithm: 'sha256'; value: string; scope: 'raw-bytes' }>;
  for (const entry of entries) {
    checksumItems.push({
      path: entry.path,
      algorithm: 'sha256',
      value: await sha256Hex(entry.bytes),
      scope: 'raw-bytes',
    });
  }
  entries.splice(
    2,
    0,
    textEntry(
      'META-INF/checksums.json',
      stableJson({ algorithm: 'sha256', canonicalization: 'raw-bytes', entries: checksumItems }),
      'application/json',
      'container-checksums',
    ),
  );

  diagnostics.push(...validatePackageEntries(entries, manifest));
  const bytes = createStoreZip(entries.map((entry) => ({ name: entry.path, bytes: entry.bytes })));

  return {
    bytes,
    blob: new Blob([bytes], { type: OMI_CONTAINER_MEDIA_TYPE }),
    fileName: omiContainerFileName(manuscript),
    manifest,
    diagnostics,
    validForExport: !diagnostics.some((diagnostic) => diagnostic.severity === 'error'),
  };
}

export function omiContainerFileName(manuscript: Pick<OmiManuscript, 'title' | 'id'>): string {
  const stem = manuscript.title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
  return `${stem || manuscript.id || 'manuscript'}.omi`;
}

function stripAuthoringAssetPreviews(state: OmiManuscriptState): OmiManuscriptState {
  return {
    ...state,
    sections: state.sections.map((section) => ({
      ...section,
      blocks: stripBlockPreviews(section.blocks),
    })),
  };
}

function stripBlockPreviews(blocks: readonly OmiBlock[]): OmiBlock[] {
  return blocks.map((block) => ({
    ...block,
    visual:
      block.visual?.kind === 'image' && block.visual.assetId
        ? { ...block.visual, src: '' }
        : block.visual,
    children: block.children ? stripBlockPreviews(block.children) : block.children,
  }));
}

function rewriteAssetSourcesForPublication(
  manuscript: OmiManuscript,
  assetMap: ReadonlyMap<string, OmiAsset>,
): OmiManuscript {
  return {
    ...manuscript,
    sections: manuscript.sections.map((section) => ({
      ...section,
      blocks: rewriteBlockSources(section.blocks, assetMap),
    })),
  };
}

function rewriteBlockSources(
  blocks: readonly OmiBlock[],
  assetMap: ReadonlyMap<string, OmiAsset>,
): OmiBlock[] {
  return blocks.map((block) => {
    const asset = block.visual?.kind === 'image' && block.visual.assetId
      ? assetMap.get(block.visual.assetId)
      : undefined;
    return {
      ...block,
      visual: asset && block.visual?.kind === 'image'
        ? { ...block.visual, src: assetPath(asset) }
        : block.visual,
      children: block.children ? rewriteBlockSources(block.children, assetMap) : block.children,
    };
  });
}

function textEntry(
  path: string,
  value: string,
  mediaType: string,
  role: string,
): PackageEntry {
  return {
    path,
    mediaType,
    role,
    bytes: new TextEncoder().encode(value),
  };
}

function validatePackageEntries(
  entries: readonly PackageEntry[],
  manifest: OmiContainerManifest,
): OmiContainerDiagnostic[] {
  const diagnostics: OmiContainerDiagnostic[] = [];
  const paths = new Set<string>();
  for (const entry of entries) {
    if (!isSafeContainerPath(entry.path)) {
      diagnostics.push({
        code: 'unsafe-container-path',
        severity: 'error',
        message: `Unsafe container path: ${entry.path}`,
      });
    }
    if (paths.has(entry.path)) {
      diagnostics.push({
        code: 'duplicate-container-path',
        severity: 'error',
        message: `Duplicate container path: ${entry.path}`,
      });
    }
    paths.add(entry.path);
  }

  for (const required of [
    'META-INF/mimetype',
    'META-INF/manifest.json',
    'META-INF/checksums.json',
    'manuscript/document.json',
    'manuscript/history.json',
  ]) {
    if (!paths.has(required)) {
      diagnostics.push({
        code: 'required-container-member-missing',
        severity: 'error',
        message: `Required OMI container member is missing: ${required}`,
      });
    }
  }

  for (const declared of manifest.entries) {
    if (!paths.has(declared.path)) {
      diagnostics.push({
        code: 'manifest-member-missing',
        severity: 'error',
        message: `Manifest declares a missing member: ${declared.path}`,
      });
    }
  }

  return diagnostics;
}

export function isSafeContainerPath(path: string): boolean {
  return Boolean(
    path &&
    !path.startsWith('/') &&
    !path.includes('\\') &&
    !path.split('/').some((part) => part === '..' || part === '.' || part === ''),
  );
}

function stableJson(value: unknown): string {
  return `${JSON.stringify(sortJson(value), null, 2)}\n`;
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([first], [second]) => first.localeCompare(second))
      .map(([key, item]) => [key, sortJson(item)]),
  );
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
