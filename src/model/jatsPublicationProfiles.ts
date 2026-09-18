export const OMI_JATS_PUBLICATION_PROFILE_MODEL =
  'omi-jats-publication-profile-0.1' as const;

export type JatsPublicationProfileId =
  | 'jats4r'
  | 'crossref'
  | 'pmc'
  | 'ojs'
  | 'custom';

export interface JatsPublicationProfileDefinition {
  id: JatsPublicationProfileId;
  label: string;
  description: string;
  implemented: boolean;
  releaseBlocking: boolean;
  source?: string;
  sourceVersion?: string;
  scope?: string;
}

export const OMI_JATS4R_PROFILE_VERSION = '1.0.0' as const;
export const OMI_JATS4R_UPSTREAM_SCHEMATRON_VERSION = '0.0.17' as const;
export const OMI_JATS4R_UPSTREAM_REPOSITORY =
  'JATS4R/jats-schematrons' as const;
export const OMI_JATS4R_PROFILE_SCOPE =
  'omi-article-authoring-baseline' as const;

export const OMI_JATS_PUBLICATION_PROFILES: readonly JatsPublicationProfileDefinition[] = [
  {
    id: 'jats4r',
    label: 'JATS4R',
    description:
      'Offline JATS4R best-practice checks implemented for the OMI Article Authoring output surface.',
    implemented: true,
    releaseBlocking: true,
    source: OMI_JATS4R_UPSTREAM_REPOSITORY,
    sourceVersion: OMI_JATS4R_UPSTREAM_SCHEMATRON_VERSION,
    scope: OMI_JATS4R_PROFILE_SCOPE,
  },
  {
    id: 'crossref',
    label: 'Crossref',
    description: 'Crossref deposit and metadata profile.',
    implemented: false,
    releaseBlocking: false,
  },
  {
    id: 'pmc',
    label: 'PubMed Central',
    description: 'PMC submission and style-checking profile.',
    implemented: false,
    releaseBlocking: false,
  },
  {
    id: 'ojs',
    label: 'OJS',
    description: 'PKP OJS publication-transfer profile.',
    implemented: false,
    releaseBlocking: false,
  },
  {
    id: 'custom',
    label: 'Custom',
    description: 'Publisher-defined JATS publication constraints.',
    implemented: false,
    releaseBlocking: false,
  },
];

export function getJatsPublicationProfile(
  id: JatsPublicationProfileId,
): JatsPublicationProfileDefinition {
  return (
    OMI_JATS_PUBLICATION_PROFILES.find((profile) => profile.id === id) ??
    OMI_JATS_PUBLICATION_PROFILES[0]!
  );
}
