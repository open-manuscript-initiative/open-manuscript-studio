/**
 * Open Manuscript Studio
 * User domain model
 */

/**
 * ISO 639-1 language code.
 *
 * Examples:
 * - en
 * - hu
 * - de
 * - fr
 */
export type LanguageCode = string;

/**
 * Globally unique identifier.
 *
 * The application currently uses UUID strings, but the alias keeps
 * identifier handling consistent and allows later refinement.
 */
export type UserId = string;

/**
 * A user's general Studio account status.
 */
export type UserStatus =
  | 'pending'
  | 'active'
  | 'suspended'
  | 'deleted';

/**
 * External identity providers that may be connected to a user account.
 */
export type IdentityProvider =
  | 'password'
  | 'magic-link'
  | 'orcid'
  | 'google'
  | 'github'
  | 'institutional';

/**
 * An external identity connected to the Studio account.
 *
 * Authentication secrets, access tokens and refresh tokens must never
 * be stored in the manuscript or in the client-side user profile.
 */
export interface ExternalIdentity {
  /**
   * Authentication or identity provider.
   */
  provider: IdentityProvider;

  /**
   * User identifier issued by the external provider.
   */
  providerUserId: string;

  /**
   * Provider-specific display name or username.
   */
  displayName?: string;

  /**
   * Date when the identity was connected.
   */
  connectedAt: string;
}

/**
 * User preferences that are independent from manuscript metadata.
 */
export interface UserPreferences {
  /**
   * Preferred Studio interface language.
   */
  interfaceLanguage: LanguageCode;

  /**
   * Languages the user can work with.
   *
   * This may later be used for translator and reviewer assignment.
   */
  workingLanguages: LanguageCode[];

  /**
   * User's preferred time zone.
   *
   * Use an IANA time-zone identifier such as:
   * Europe/Budapest
   */
  timeZone?: string;
}

/**
 * Public and professional information belonging to a Studio user.
 */
export interface UserProfile {
  /**
   * Full display name.
   */
  fullName: string;

  /**
   * Primary institutional affiliation.
   */
  affiliation?: string;

  /**
   * ORCID identifier in normalized form.
   *
   * Example:
   * 0000-0002-1825-0097
   */
  orcid?: string;

  /**
   * Optional profile image URL.
   */
  avatarUrl?: string;

  /**
   * Short professional biography.
   */
  bio?: string;
}

/**
 * Primary Studio user model.
 *
 * Workspace-specific roles are intentionally not stored here.
 * They belong to WorkspaceMember because one user may be an owner
 * in one workspace and a reviewer or translator in another.
 */
export interface User {
  /**
   * Internal immutable identifier.
   */
  id: UserId;

  /**
   * Primary e-mail address.
   */
  email: string;

  /**
   * Whether the primary e-mail address has been verified.
   */
  emailVerified: boolean;

  /**
   * Current account status.
   */
  status: UserStatus;

  /**
   * Public and professional user information.
   */
  profile: UserProfile;

  /**
   * User-specific Studio preferences.
   */
  preferences: UserPreferences;

  /**
   * Authentication identities connected to the account.
   */
  identities: ExternalIdentity[];

  /**
   * ISO 8601 creation timestamp.
   */
  createdAt: string;

  /**
   * ISO 8601 last modification timestamp.
   */
  updatedAt: string;

  /**
   * ISO 8601 timestamp of the most recent successful login.
   */
  lastLoginAt?: string;
}

/**
 * Data required to create a new user.
 *
 * Server-generated fields such as id, timestamps and verification status
 * are deliberately omitted.
 */
export interface CreateUserInput {
  email: string;
  fullName: string;
  affiliation?: string;
  orcid?: string;
  interfaceLanguage?: LanguageCode;
  workingLanguages?: LanguageCode[];
}

/**
 * Fields that may be changed from the user's profile settings.
 */
export interface UpdateUserProfileInput {
  fullName?: string;
  affiliation?: string;
  orcid?: string;
  avatarUrl?: string;
  bio?: string;
  interfaceLanguage?: LanguageCode;
  workingLanguages?: LanguageCode[];
  timeZone?: string;
}

/**
 * Returns a normalized e-mail address.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Performs basic e-mail syntax validation.
 *
 * Final validation and uniqueness checks must also be performed
 * by the backend.
 */
export function isValidEmail(email: string): boolean {
  const normalizedEmail = normalizeEmail(email);

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
}

/**
 * Normalizes an ORCID identifier.
 *
 * Accepted input examples:
 * - 0000-0002-1825-0097
 * - https://orcid.org/0000-0002-1825-0097
 */
export function normalizeOrcid(orcid: string): string {
  return orcid
    .trim()
    .replace(/^https?:\/\/orcid\.org\//i, '')
    .toUpperCase();
}

/**
 * Validates an ORCID identifier using the official ISO 7064 MOD 11-2
 * checksum algorithm.
 */
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

/**
 * Creates a client-side user model.
 *
 * This helper is suitable for the current local alpha implementation.
 * In a production multi-user system, user creation, identifiers and
 * timestamps must be handled by the backend.
 */
export function createUser(
  input: CreateUserInput,
  id: UserId = crypto.randomUUID(),
): User {
  const email = normalizeEmail(input.email);
  const fullName = input.fullName.trim();
  const affiliation = input.affiliation?.trim();
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
    email,
    emailVerified: false,
    status: 'pending',
    profile: {
      fullName,
      affiliation: affiliation || undefined,
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

/**
 * Returns the name used when displaying the user in the interface.
 */
export function getUserDisplayName(user: User): string {
  return user.profile.fullName.trim() || user.email;
}
