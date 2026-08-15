export const OMI_IDENTITY_PROTOCOL_VERSION = '1.0-draft';

/**
 * Stable global OMI account identifier issued by the central Identity Service.
 * This identifier is deliberately independent from ORCID, e-mail addresses,
 * institutions, journals, and individual Studio installations.
 */
export type OmiUserId = string;

/**
 * Minimal OpenID Connect claims a Studio installation is allowed to consume.
 * Editorial workflow data must never be encoded in these claims.
 */
export interface OmiIdentityClaims {
  /** OIDC issuer, e.g. https://identity.openmanuscript.org */
  iss: string;
  /** Global immutable OMI account identifier. */
  sub: OmiUserId;
  /** Studio client identifier or identifiers. */
  aud: string | string[];
  exp: number;
  iat: number;
  nonce?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  preferred_username?: string;
  locale?: string;
  orcid?: string;
}

/**
 * Portable account projection that may be cached by a Studio installation.
 * It contains identity/profile data only. It must not contain manuscript,
 * assignment, review, journal-role, or anonymity-sensitive information.
 */
export interface OmiIdentityProfile {
  omiUserId: OmiUserId;
  displayName: string;
  primaryEmail?: string;
  emailVerified?: boolean;
  orcid?: string;
  affiliation?: string;
  affiliationRorId?: string;
  preferredLanguage?: string;
  updatedAt: string;
}

/**
 * Local association retained by a Studio installation after authentication.
 * Authorization remains local: the same global OMI user may have unrelated
 * roles and permissions on different Studio installations.
 */
export interface LocalOmiIdentityProjection {
  omiUserId: OmiUserId;
  localUserId: string;
  profileSnapshot?: OmiIdentityProfile;
  lastIdentitySyncAt?: string;
}

/**
 * Explicitly prohibited information at the central identity boundary.
 * These fields are documented here to make accidental protocol expansion
 * visible during code review.
 */
export const CENTRAL_IDENTITY_FORBIDDEN_DATA = [
  'manuscriptId',
  'workspaceId',
  'submissionId',
  'reviewAssignmentId',
  'reviewerRole',
  'reviewStatus',
  'recommendation',
  'annotation',
  'reviewText',
  'editorialDecision',
] as const;
