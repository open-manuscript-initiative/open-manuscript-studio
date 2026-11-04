import type { OmiLocale } from '../types/omi';

export type OmiLocalizedText = Partial<Record<OmiLocale, string>>;
export type OmiLocalizedTerms = Partial<Record<OmiLocale, string[]>>;

export type OmiPublicationVenueType = 'JOURNAL' | 'BOOK_PUBLISHER';
export type OmiPublicationVenueIntegrationProvider = 'OJS' | 'OMP';
export type OmiPublicationVenueIntegrationStatus = 'VERIFIED' | 'DISABLED';
export type OmiPublicationVenueVerificationMethod = 'OJS' | 'OMP' | 'DNS_TXT';

export interface OmiPublicationVenueAuthorityReference {
  method: OmiPublicationVenueVerificationMethod;
  status: 'VERIFIED';
  domain?: string;
  verificationId?: string;
  verifiedAt?: string;
}

export interface OmiPublicationVenueReference {
  id: string;
  type: OmiPublicationVenueType;
  name: string;
  website?: string;
  issn?: string;
  isbnPrefix?: string;
  integrationProvider?: OmiPublicationVenueIntegrationProvider;
  integrationStatus?: OmiPublicationVenueIntegrationStatus;
  authority?: OmiPublicationVenueAuthorityReference;
}

export interface OmiScholarlyMetadata {
  subjects?: OmiLocalizedTerms;
  disciplines?: OmiLocalizedTerms;
  supportingAgencies?: OmiLocalizedTerms;
  coverage?: OmiLocalizedText;
  rights?: OmiLocalizedText;
  source?: OmiLocalizedText;
  type?: OmiLocalizedText;
  dataAvailability?: OmiLocalizedText;
  languages?: OmiLocalizedText;
  publicationVenue?: OmiPublicationVenueReference;
  publisherId?: string;
  licenseUrl?: string;
  copyrightHolder?: OmiLocalizedText;
  copyrightYear?: number;
}

export interface OmiOjsOpenScienceMetadata {
  openData?: OmiLocalizedText;
  openMaterials?: OmiLocalizedText;
  preregistered?: OmiLocalizedText;
  preregisteredPlus?: OmiLocalizedText;
}

export interface OmiIntegrationExtensions {
  'https://pkp.sfu.ca/ojs/'?: {
    openScience?: OmiOjsOpenScienceMetadata;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export function normalizeLocale(locale: string): string {
  const candidate = locale.trim().replace(/_/g, '-');
  try { return Intl.getCanonicalLocales(candidate)[0] ?? candidate; }
  catch { return candidate; } // Retain unsupported tags rather than inventing a language.
}

/** Reject conflicting spelling aliases instead of overwriting a localized value. */
export function assignLocalizedValue<T>(target: Partial<Record<string, T>>, locale: string, value: T): void {
  const key = normalizeLocale(locale);
  if (Object.hasOwn(target, key) && JSON.stringify(target[key]) !== JSON.stringify(value)) {
    throw new Error('LOCALIZED_METADATA_LOCALE_COLLISION');
  }
  Object.defineProperty(target, key, { value, enumerable: true, writable: true, configurable: true });
}

export function normalizeLocalizedText(value: unknown): OmiLocalizedText {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: OmiLocalizedText = {};
  for (const [locale, item] of Object.entries(value as Record<string, unknown>)) {
    if (typeof item !== 'string') continue;
    const text = item.trim();
    if (text) assignLocalizedValue(result, locale, text);
  }
  return result;
}

export function normalizeLocalizedTerms(value: unknown): OmiLocalizedTerms {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: OmiLocalizedTerms = {};
  for (const [locale, item] of Object.entries(value as Record<string, unknown>)) {
    if (!Array.isArray(item)) continue;
    const terms = item
      .map((term) => {
        if (typeof term === 'string') return term.trim();
        if (!term || typeof term !== 'object' || Array.isArray(term)) return '';
        const name = (term as Record<string, unknown>).name;
        return typeof name === 'string' ? name.trim() : '';
      })
      .filter(Boolean);
    if (terms.length) assignLocalizedValue(result, locale, [...new Set(terms)]);
  }
  return result;
}

export function normalizePublicationVenue(
  value: unknown,
): OmiPublicationVenueReference | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const id = typeof record.id === 'string' ? record.id.trim() : '';
  const name = typeof record.name === 'string'
    ? normalizePublicationVenueName(record.name)
    : '';
  const type = record.type === 'JOURNAL' || record.type === 'BOOK_PUBLISHER'
    ? record.type
    : undefined;
  if (!id || !name || !type) return undefined;

  const website = optionalVenueString(record.website);
  const issn = optionalVenueString(record.issn);
  const isbnPrefix = optionalVenueString(record.isbnPrefix);
  const integrationProvider = record.integrationProvider === 'OJS'
    || record.integrationProvider === 'OMP'
    ? record.integrationProvider
    : undefined;
  const integrationStatus = record.integrationStatus === 'VERIFIED'
    || record.integrationStatus === 'DISABLED'
    ? record.integrationStatus
    : undefined;
  const authorityRecord = record.authority && typeof record.authority === 'object'
    && !Array.isArray(record.authority)
    ? record.authority as Record<string, unknown>
    : undefined;
  let authorityMethod: OmiPublicationVenueVerificationMethod | undefined;
  if (authorityRecord?.method === 'OJS') authorityMethod = 'OJS';
  else if (authorityRecord?.method === 'OMP') authorityMethod = 'OMP';
  else if (authorityRecord?.method === 'DNS_TXT') authorityMethod = 'DNS_TXT';
  const authorityDomain = optionalVenueString(authorityRecord?.domain);
  const authorityVerificationId = optionalVenueString(authorityRecord?.verificationId);
  const authorityVerifiedAt = optionalVenueString(authorityRecord?.verifiedAt);
  const authority: OmiPublicationVenueAuthorityReference | undefined =
    authorityMethod && authorityRecord?.status === 'VERIFIED'
      ? {
          method: authorityMethod,
          status: 'VERIFIED',
          ...(authorityDomain ? { domain: authorityDomain } : {}),
          ...(authorityVerificationId
            ? { verificationId: authorityVerificationId }
            : {}),
          ...(authorityVerifiedAt ? { verifiedAt: authorityVerifiedAt } : {}),
        }
      : undefined;

  return {
    id,
    type,
    name,
    ...(website ? { website } : {}),
    ...(issn ? { issn } : {}),
    ...(isbnPrefix ? { isbnPrefix } : {}),
    ...(integrationProvider ? { integrationProvider } : {}),
    ...(integrationStatus ? { integrationStatus } : {}),
    ...(authority ? { authority } : {}),
  };
}

export function isVerifiedPublicationVenue(
  value: OmiPublicationVenueReference | undefined,
): boolean {
  return Boolean(
    value?.authority?.status === 'VERIFIED'
      || (
        value?.integrationStatus === 'VERIFIED'
        && (value.integrationProvider === 'OJS' || value.integrationProvider === 'OMP')
      ),
  );
}

function normalizePublicationVenueName(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
}

function optionalVenueString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}
