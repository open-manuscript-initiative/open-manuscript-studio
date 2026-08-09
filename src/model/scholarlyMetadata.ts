import type { OmiLocale } from '../types/omi';

export type OmiLocalizedText = Partial<Record<OmiLocale, string>>;
export type OmiLocalizedTerms = Partial<Record<OmiLocale, string[]>>;

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
  'org.pkp.ojs'?: {
    openScience?: OmiOjsOpenScienceMetadata;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export function normalizeLocale(locale: string): string {
  const normalized = locale.trim().replace(/_/g, '-').toLowerCase();
  const language = normalized.split('-')[0] ?? normalized;
  return ['hu', 'en', 'de'].includes(language) ? language : normalized;
}

export function normalizeLocalizedText(value: unknown): OmiLocalizedText {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: OmiLocalizedText = {};
  for (const [locale, item] of Object.entries(value as Record<string, unknown>)) {
    if (typeof item !== 'string') continue;
    const text = item.trim();
    if (text) result[normalizeLocale(locale)] = text;
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
    if (terms.length) result[normalizeLocale(locale)] = [...new Set(terms)];
  }
  return result;
}
