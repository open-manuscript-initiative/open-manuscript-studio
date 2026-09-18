export const OMI_PUBLICATION_BUILD_MODEL = 'omi-publication-build' as const;
export const OMI_PUBLICATION_BUILD_VERSION = '0.1.0' as const;
export const OMI_PUBLICATION_PROFILE_DIGEST_CANONICALIZATION =
  'omi-publication-profile-json-v1' as const;

export type OmiPublicationBuildFormat =
  | 'omi'
  | 'omi-json'
  | 'jats'
  | 'html'
  | 'docx'
  | 'idml'
  | 'xtg'
  | 'mif'
  | 'sla'
  | 'latex'
  | 'epub'
  | 'pdf-print'
  | 'pdf-interactive'
  | 'custom';

export interface OmiPublicationBuildDigest {
  algorithm: 'sha256';
  value: string;
}

export interface OmiPublicationBuildStateDigest
  extends OmiPublicationBuildDigest {
  canonicalization: string;
}

export interface OmiPublicationBuildProfileDigest
  extends OmiPublicationBuildDigest {
  canonicalization: typeof OMI_PUBLICATION_PROFILE_DIGEST_CANONICALIZATION;
}

export interface OmiPublicationBuildRendererInput {
  mediaType: string;
  byteLength: number;
  digest: OmiPublicationBuildDigest;
}

export interface OmiPublicationBuild {
  model: typeof OMI_PUBLICATION_BUILD_MODEL;
  version: typeof OMI_PUBLICATION_BUILD_VERSION;
  id: string;
  createdAt: string;
  manuscript: {
    id: string;
    revisionId: string;
    stateDigest: OmiPublicationBuildStateDigest;
  };
  profile: {
    id: string;
    version: string;
    digest: OmiPublicationBuildProfileDigest;
  };
  output: {
    format: OmiPublicationBuildFormat;
    mediaType: string;
    fileName: string;
    byteLength: number;
    digest: OmiPublicationBuildDigest;
  };
  rendererInput?: OmiPublicationBuildRendererInput;
  generator: {
    application: 'open-manuscript-studio';
    applicationVersion: string;
    applicationBuild?: string;
    applicationCommit?: string;
    renderer: string;
    rendererVersion: string;
  };
}
