import type { OmiAsset } from './assets';

export {};

declare module './omi' {
  interface OmiImageBlockData {
    /** Stable reference to a binary resource stored outside manuscript JSON. */
    assetId?: string;
  }

  interface OmiManuscriptState {
    /** Portable metadata for binary resources carried by an OMI container. */
    assets?: OmiAsset[];
  }
}
