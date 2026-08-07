import type { OmiImportProvenance } from './omi';

export type OmiAssetRole =
  | 'figure'
  | 'supplementary-material'
  | 'source-data'
  | 'attachment';

export interface OmiAssetChecksum {
  algorithm: 'sha256';
  value: string;
  scope: 'raw-bytes';
}

/**
 * Portable metadata for one binary or externally authored resource.
 *
 * Binary payload bytes are deliberately not embedded in manuscript JSON.
 * Studio keeps working payloads in its asset repository and packages them
 * under media/ in an OMI container.
 */
export interface OmiAsset {
  id: string;
  modelVersion: '0.1.0-alpha.1';
  fileName: string;
  originalFileName?: string;
  mediaType: string;
  size: number;
  role: OmiAssetRole;
  checksum: OmiAssetChecksum;
  provenance?: OmiImportProvenance;
  createdAt?: string;
}
