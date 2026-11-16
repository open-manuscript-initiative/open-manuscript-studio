import { workflowRoles } from '../model/workflowRole';
import type { UpdateUserProfileInput } from '../model/user';

/**
 * Reuses ONLY profile preferences from the existing, partial account-data export.
 * Never restores identity/authorization material (account IDs, emails, ORCID trust,
 * external identities, sessions, passkeys, institutional memberships or credentials).
 */
export function profileFromAccountBackup(value: unknown): UpdateUserProfileInput {
  if (!isObject(value) || value.schema !== 'omi-account-overview/1' || !isObject(value.profile)) {
    throw new Error('Unsupported account backup. Select an exported omi-account-data.json file.');
  }
  const profile = value.profile;
  const fullName = optionalString(profile.fullName, 'fullName', 200, false);
  if (!fullName) throw new Error('The backup has no valid profile name.');

  const country = optionalString(profile.country, 'country', 2);
  if (country && !/^[A-Za-z]{2}$/.test(country)) {
    throw new Error('The country code in the backup is invalid.');
  }
  const website = optionalString(profile.website, 'website', 2048);
  if (website) {
    let parsed: URL;
    try { parsed = new URL(website); } catch { throw new Error('The website URL in the backup is invalid.'); }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
      throw new Error('The website URL in the backup must use HTTP(S) without credentials.');
    }
  }
  const workflowRole = profile.workflowRole;
  if (workflowRole !== undefined && !workflowRoles.some((role) => role === workflowRole)) {
    throw new Error('The backup has an invalid personal workflow preference.');
  }

  return {
    fullName,
    ...(optionalString(profile.affiliation, 'affiliation', 300) !== undefined
      ? { affiliation: optionalString(profile.affiliation, 'affiliation', 300) } : {}),
    ...(optionalString(profile.affiliationRorId, 'affiliationRorId', 128) !== undefined
      ? { affiliationRorId: optionalString(profile.affiliationRorId, 'affiliationRorId', 128) } : {}),
    ...(country !== undefined ? { country: country.toUpperCase() } : {}),
    ...(website !== undefined ? { website } : {}),
    ...(optionalString(profile.bio, 'bio', 2000) !== undefined
      ? { bio: optionalString(profile.bio, 'bio', 2000) } : {}),
    ...(optionalString(profile.timeZone, 'timeZone', 64) !== undefined
      ? { timeZone: optionalString(profile.timeZone, 'timeZone', 64) } : {}),
    ...(workflowRole ? { workflowRole: workflowRole as UpdateUserProfileInput['workflowRole'] } : {}),
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown, field: string, max: number, nullable = true): string | undefined {
  if (value === undefined || (nullable && value === null)) return undefined;
  if (typeof value !== 'string' || value.length > max) {
    throw new Error(`The ${field} field in the account backup is invalid.`);
  }
  return value.trim();
}
