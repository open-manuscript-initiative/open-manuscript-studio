import type { OmiBlock, OmiImageBlockData } from '../types/omi';
import type { OmiAsset, OmiAssetRole } from '../types/assets';

export const OMI_ASSET_MODEL_VERSION = '0.1.0-alpha.1' as const;
export const MAX_CONTAINER_ASSET_BYTES = 100 * 1024 * 1024;

export interface DecodedDataUrl {
  mediaType: string;
  bytes: Uint8Array;
}

export interface ExternalizedImageAsset {
  block: OmiBlock;
  asset: OmiAsset;
  bytes: Uint8Array;
}

export function decodeDataUrl(value: string): DecodedDataUrl | null {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/is.exec(value.trim());
  if (!match) return null;

  const mediaType = (match[1] || 'application/octet-stream').trim().toLowerCase();
  const encoded = match[3] ?? '';
  try {
    if (match[2]) {
      const binary = atob(encoded.replace(/\s+/g, ''));
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      return { mediaType, bytes };
    }

    return {
      mediaType,
      bytes: new TextEncoder().encode(decodeURIComponent(encoded)),
    };
  } catch {
    return null;
  }
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (value) =>
    value.toString(16).padStart(2, '0'),
  ).join('');
}

export async function createAssetMetadata(
  bytes: Uint8Array,
  input: {
    mediaType: string;
    fileName?: string;
    originalFileName?: string;
    role?: OmiAssetRole;
    provenance?: OmiImageBlockData['provenance'];
    id?: string;
    createdAt?: string;
  },
): Promise<OmiAsset> {
  if (bytes.byteLength > MAX_CONTAINER_ASSET_BYTES) {
    throw new Error(
      `Asset exceeds the ${Math.round(MAX_CONTAINER_ASSET_BYTES / 1024 / 1024)} MB container limit.`,
    );
  }

  const id = input.id ?? crypto.randomUUID();
  const mediaType = normalizeMediaType(input.mediaType);
  const originalFileName = input.originalFileName ?? input.fileName;
  const fileName = sanitizeAssetFileName(
    input.fileName || `asset-${id}${extensionForMediaType(mediaType)}`,
    id,
    mediaType,
  );

  return {
    id,
    modelVersion: OMI_ASSET_MODEL_VERSION,
    fileName,
    originalFileName,
    mediaType,
    size: bytes.byteLength,
    role: input.role ?? 'figure',
    checksum: {
      algorithm: 'sha256',
      value: await sha256Hex(bytes),
      scope: 'raw-bytes',
    },
    provenance: input.provenance,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}

export async function externalizeImageBlock(
  block: OmiBlock,
): Promise<ExternalizedImageAsset | null> {
  if (block.visual?.kind !== 'image' || block.visual.assetId) return null;
  const decoded = decodeDataUrl(block.visual.src);
  if (!decoded) return null;

  const asset = await createAssetMetadata(decoded.bytes, {
    mediaType: block.visual.mediaType || decoded.mediaType,
    fileName: block.visual.fileName,
    originalFileName: block.visual.fileName,
    role: 'figure',
    provenance: block.visual.provenance,
  });
  const visual: OmiImageBlockData = {
    ...block.visual,
    assetId: asset.id,
    src: '',
    mediaType: asset.mediaType,
    fileName: asset.fileName,
  };

  return {
    block: {
      ...block,
      visual,
    },
    asset,
    bytes: decoded.bytes,
  };
}

export function assetPath(asset: OmiAsset): string {
  const bucket = asset.role === 'source-data'
    ? 'datasets'
    : asset.mediaType.startsWith('image/')
      ? 'images'
      : 'assets';
  return `media/${bucket}/${asset.id}-${sanitizeAssetFileName(asset.fileName, asset.id, asset.mediaType)}`;
}

export function collectReferencedAssetIds(blocks: readonly OmiBlock[]): Set<string> {
  const ids = new Set<string>();
  for (const block of blocks) {
    if (block.visual?.kind === 'image' && block.visual.assetId) {
      ids.add(block.visual.assetId);
    }
    if (block.children?.length) {
      for (const id of collectReferencedAssetIds(block.children)) ids.add(id);
    }
  }
  return ids;
}

export function sanitizeAssetFileName(
  value: string,
  id: string,
  mediaType = 'application/octet-stream',
): string {
  const normalized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\\/]+/g, '-')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  if (normalized && normalized !== '.' && normalized !== '..') return normalized;
  return `asset-${id}${extensionForMediaType(mediaType)}`;
}

export function normalizeMediaType(value: string): string {
  const normalized = value.trim().toLowerCase();
  return /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(normalized)
    ? normalized
    : 'application/octet-stream';
}

export function extensionForMediaType(mediaType: string): string {
  switch (normalizeMediaType(mediaType)) {
    case 'image/png': return '.png';
    case 'image/jpeg': return '.jpg';
    case 'image/gif': return '.gif';
    case 'image/webp': return '.webp';
    case 'image/svg+xml': return '.svg';
    case 'text/csv': return '.csv';
    case 'application/pdf': return '.pdf';
    default: return '.bin';
  }
}
