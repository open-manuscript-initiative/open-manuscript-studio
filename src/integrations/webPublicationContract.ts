import type { OmiPublicationBuild } from '../model/publicationBuild';

/**
 * Web publication is an artifact-delivery profile, not a peer-review system.
 * Review assurance is supplied by an explicit authority and is bound to the
 * exact committed source revision carried by the publication build.
 */
export const OMI_WEB_PUBLICATION_PROTOCOL = 'omi-web-publication/1' as const;
export const OMI_WEB_PUBLICATION_ASSURANCE_MODEL =
  'omi-publication-assurance' as const;
export const OMI_WEB_PUBLICATION_ASSURANCE_VERSION = '1' as const;
export const OMI_WEB_PUBLICATION_APPROVAL_STATEMENT =
  'account-holder-approves-exact-web-publication-v1' as const;
export const OMI_EDITORIAL_ACCEPTANCE_CONFIRMATION =
  'editor-accepts-exact-revision-for-web-publication-v1' as const;

export const WEB_PUBLICATION_INTENTS = [
  'public-interest',
  'popular-science',
  'newsletter',
  'scholarly-article',
  'book-chapter',
] as const;

export type WebPublicationIntent = (typeof WEB_PUBLICATION_INTENTS)[number];
export type WebPublicationTargetStatus = 'draft' | 'publish';

interface WebPublicationAssuranceBase {
  model: typeof OMI_WEB_PUBLICATION_ASSURANCE_MODEL;
  version: typeof OMI_WEB_PUBLICATION_ASSURANCE_VERSION;
  intent: WebPublicationIntent;
  disclosure: 'visible-and-machine-readable';
}

export interface UnreviewedWebPublicationAssurance
  extends WebPublicationAssuranceBase {
  reviewStatus: 'not-peer-reviewed';
  approvalAuthority: 'authenticated-account-holder';
}

export interface VerifiedPublicationVenueAuthority {
  type: 'verified-publication-venue';
  venueId: string;
  venueName: string;
  venueType: 'JOURNAL' | 'BOOK_PUBLISHER';
  domain: string;
  verificationMethod: 'DNS_TXT';
  verificationId: string;
  verifiedAt: string;
  editorRole: 'EDITOR' | 'EDITOR_IN_CHIEF';
}

export interface EditorialDecisionEvidence {
  type: 'studio-editorial-decision';
  decisionId: string;
  evidenceDigest: string;
  publicationContentDigest: string;
  authority?: VerifiedPublicationVenueAuthority;
  reviewRound: number;
  decidedAt: string;
}

export interface EligibleEditorialReviewRound {
  workspaceId: string;
  reviewRound: number;
  basisAssignmentIds: string[];
  completedScientificReviews: number;
}

export interface WebPublicationAssuranceEvidence {
  decisions: EditorialDecisionEvidence[];
  eligibleReviewRounds: EligibleEditorialReviewRound[];
}

export interface EditorialAcceptanceRequest {
  manuscriptId: string;
  revisionId: string;
  stateDigest: string;
  publicationContentDigest: string;
  publicationVenueId?: string;
  reviewRound: number;
  basisAssignmentIds: string[];
  confirmation: typeof OMI_EDITORIAL_ACCEPTANCE_CONFIRMATION;
}

export interface StudioReviewedWebPublicationAssurance
  extends WebPublicationAssuranceBase {
  reviewStatus: 'peer-reviewed';
  approvalAuthority: 'studio-editorial-decision';
  evidence: EditorialDecisionEvidence;
}

export type WebPublicationAssurance =
  | UnreviewedWebPublicationAssurance
  | StudioReviewedWebPublicationAssurance;

export interface PreparedWebPublicationArtifact {
  html: string;
  publicationContentDigest: string;
  build: OmiPublicationBuild;
  assurance: WebPublicationAssurance;
}

export interface WebPublicationApprovalRequest {
  connectionId: string;
  connectionVersion: string;
  manuscriptId: string;
  title: string;
  status: WebPublicationTargetStatus;
  assurance: WebPublicationAssurance;
  artifact: {
    html: string;
    build: OmiPublicationBuild;
  };
  idempotencyKey: string;
  confirmation: typeof OMI_WEB_PUBLICATION_APPROVAL_STATEMENT;
}

export interface WebPublicationExecutionGrant {
  grantId: string;
  deliveryId: string;
  executionToken: string;
  expiresAt: string;
}

export interface WebPublicationReceipt {
  deliveryId: string;
  connectionId: string;
  connectionVersion: string;
  providerId: 'wordpress' | 'web-publishing';
  manuscriptId: string;
  revisionId: string;
  buildId: string;
  externalId: string | null;
  externalUrl: string | null;
  contentDigest: string;
  deliveredContentDigest: string;
  status: WebPublicationTargetStatus;
  assurance: WebPublicationAssurance;
  deliveryState: 'succeeded';
  updatedAt: string;
}

export type WebPublicationApprovalResult =
  | { grant: WebPublicationExecutionGrant; receipt?: never }
  | { grant?: never; receipt: WebPublicationReceipt };

export function createAccountHolderApprovedAssurance(
  intent: WebPublicationIntent,
): WebPublicationAssurance {
  return {
    model: OMI_WEB_PUBLICATION_ASSURANCE_MODEL,
    version: OMI_WEB_PUBLICATION_ASSURANCE_VERSION,
    intent,
    reviewStatus: 'not-peer-reviewed',
    approvalAuthority: 'authenticated-account-holder',
    disclosure: 'visible-and-machine-readable',
  };
}

export function createStudioReviewedAssurance(
  intent: WebPublicationIntent,
  evidence: EditorialDecisionEvidence,
): StudioReviewedWebPublicationAssurance {
  return {
    model: OMI_WEB_PUBLICATION_ASSURANCE_MODEL,
    version: OMI_WEB_PUBLICATION_ASSURANCE_VERSION,
    intent,
    reviewStatus: 'peer-reviewed',
    approvalAuthority: 'studio-editorial-decision',
    disclosure: 'visible-and-machine-readable',
    evidence,
  };
}

export function webPublicationIdempotencyKey(input: {
  connectionId: string;
  connectionVersion: string;
  buildId: string;
  status: WebPublicationTargetStatus;
  assurance: WebPublicationAssurance;
}): string {
  const buildDigest = input.buildId.split(':').at(-1) ?? input.buildId;
  const assuranceKey = input.assurance.reviewStatus === 'peer-reviewed'
    ? `peer-reviewed:${input.assurance.evidence.evidenceDigest}`
    : 'not-peer-reviewed';
  return [
    'web-publication-v1',
    buildDigest,
    input.connectionId,
    input.connectionVersion,
    input.status,
    input.assurance.intent,
    assuranceKey,
  ].join(':');
}
