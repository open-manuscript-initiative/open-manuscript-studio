import type { AgentId } from './identity';

/**
 * Open Manuscript Studio
 * User account domain model
 */

export type LanguageCode = string;
export type UserId = string;

export type UserStatus =
  | 'pending'
  | 'active'
  | 'suspended'
  | 'disabled'
  | 'deleted';

export type IdentityProvider =
  | 'password'
  | 'magic-link'
  | 'orcid'
  | 'google'
  | 'github'
  | 'institutional';

export interface ExternalIdentity {
  provider: IdentityProvider;
  providerUserId: string;
  displayName?: string;
  connectedAt: string;
}

export interface UserPreferences {
  interfaceLanguage: LanguageCode;
  workingLanguages: LanguageCode[];
  timeZone?: string;
}

/** Personal scholarly profile. Legacy affiliation fields remain for compatibility only. */
export interface UserProfile {
  fullName: string;
  affiliation?: string;
  affiliationRorId?: string;
  orcid?: string;
  avatarUrl?: string;
  bio?: string;
}

export interface InstitutionalIdentityReference {
  id: string;
  provider: 'OIDC' | 'SAML';
  providerKey: string | null;
  issuer: string;
  subject: string;
  displayName: string | null;
}

export interface InstitutionalProfile {
  id: string;
  organizationName: string;
  rorId: string | null;
  department: string | null;
  positionTitle: string | null;
  institutionalEmail: string | null;
  emailVerified: boolean;
  identityId: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  identity: InstitutionalIdentityReference | null;
}

export interface InstitutionalProfileInput {
  organizationName: string;
  rorId?: string | null;
  department?: string | null;
  positionTitle?: string | null;
  institutionalEmail?: string | null;
  identityId?: string | null;
  isDefault?: boolean;
}

export interface User {
  id: UserId;
  agentId?: AgentId;
  email: string;
  emailVerified: boolean;
  status: UserStatus;
  profile: UserProfile;
  preferences: UserPreferences;
  identities: ExternalIdentity[];
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export interface CreateUserInput {
  email: string;
  fullName: string;
  affiliation?: string;
  affiliationRorId?: string;
  orcid?: string;
  agentId?: AgentId;
  interfaceLanguage?: LanguageCode;
  workingLanguages?: LanguageCode[];
}

export interface UpdateUserProfileInput {
  fullName?: string;
  affiliation?: string;
  affiliationRorId?: string;
  orcid?: string;
  avatarUrl?: string;
  bio?: string;
  interfaceLanguage?: LanguageCode;
  workingLanguages?: LanguageCode[];
  timeZone?: string;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  const normalizedEmail = normalizeEmail(email);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
}

export function normalizeOrcid(orcid: string): string {
  return orcid
    .trim()
    .replace(/^https?:\/\/orcid\.org\//i, '')
    .toUpperCase();
}

export function isValidOrcid(orcid: string): boolean {
  const normalizedOrcid = normalizeOrcid(orcid);

  if (!/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(normalizedOrcid)) {
    return false;
  }

  const characters = normalizedOrcid.replace(/-/g, '');
  const body = characters.slice(0, 15);
  const suppliedCheckDigit = characters[15];

  let total = 0;

  for (const character of body) {
    total = (total + Number(character)) * 2;
  }

  const remainder = total % 11;
  const result = (12 - remainder) % 11;
  const calculatedCheckDigit = result === 10 ? 'X' : String(result);

  return calculatedCheckDigit === suppliedCheckDigit;
}

export function createUser(
  input: CreateUserInput,
  id: UserId = crypto.randomUUID(),
): User {
  const email = normalizeEmail(input.email);
  const fullName = input.fullName.trim();
  const affiliation = input.affiliation?.trim();
  const affiliationRorId = input.affiliationRorId?.trim();
  const orcid = input.orcid
    ? normalizeOrcid(input.orcid)
    : undefined;

  if (!isValidEmail(email)) {
    throw new Error('Invalid e-mail address.');
  }

  if (!fullName) {
    throw new Error('The user name is required.');
  }

  if (orcid && !isValidOrcid(orcid)) {
    throw new Error('Invalid ORCID identifier.');
  }

  const timestamp = new Date().toISOString();

  return {
    id,
    agentId: input.agentId,
    email,
    emailVerified: false,
    status: 'pending',
    profile: {
      fullName,
      affiliation: affiliation || undefined,
      affiliationRorId: affiliationRorId || undefined,
      orcid,
    },
    preferences: {
      interfaceLanguage: input.interfaceLanguage ?? 'en',
      workingLanguages: Array.from(
        new Set(input.workingLanguages ?? []),
      ),
    },
    identities: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function linkUserToAgent(
  user: User,
  agentId: AgentId,
): User {
  if (!agentId.trim()) {
    throw new Error('The agent identifier is required.');
  }

  return {
    ...user,
    agentId,
    updatedAt: new Date().toISOString(),
  };
}

export function getUserDisplayName(user: User): string {
  return user.profile.fullName.trim() || user.email;
}
