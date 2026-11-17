export type OjsWritableMetadataField =
  | 'title'
  | 'subtitle'
  | 'abstract'
  | 'keywords';
export type OjsPullMetadataField =
  | OjsWritableMetadataField
  | 'licenseUrl'
  | 'copyrightHolder'
  | 'copyrightYear';
export interface OjsMetadataSnapshot {
  protocol: 'omi-ojs-metadata/1';
  authority: 'OJS';
  stateToken: string;
  workflowToken: string;
  submissionId: number;
  publicationId: number;
  stage: string;
  publicationStatus: number;
  locales: string[];
  writableFields: OjsWritableMetadataField[];
  abstractRepresentation: 'plain-text';
  metadata: {
    title: Record<string, string>;
    subtitle: Record<string, string>;
    abstract: Record<string, string>;
    keywords: Record<string, string[]>;
    doi: string | null;
    references: string;
    pages: string | null;
    issueId: number | string | null;
    datePublished: string | null;
    licenseUrl: string | null;
    copyrightHolder: Record<string, string> | null;
    copyrightYear: number | string | null;
  };
  contributors: Array<{
    externalId: string;
    name: { given: string; family: string };
    preferredPublicName?: Record<string, string>;
    affiliation?: string;
    affiliations?: Array<{ name: Record<string, string>; ror: string | null }>;
    identifiers?: Array<{ scheme: string; value: string }>;
    sequence?: number;
  }>;
}
export type OjsMetadataRequest =
  | { action: 'inspect'; submissionId: number }
  | {
      action: 'apply';
      submissionId: number;
      publicationId: number;
      locale: string;
      expectedStateToken: string;
      fields: Partial<
        Record<Exclude<OjsWritableMetadataField, 'keywords'>, string>
      > & { keywords?: string[] };
      confirmed: true;
    };
export interface OjsMetadataResponse {
  snapshot: OjsMetadataSnapshot;
  receipt?: {
    protocol: 'omi-ojs-metadata/1';
    submissionId: number;
    publicationId: number;
    locale: string;
    fields: string[];
    previousStateToken: string;
    published: false;
  };
}
