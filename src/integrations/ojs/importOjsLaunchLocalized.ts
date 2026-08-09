import type { OmiManuscript } from '../../types/omi';
import {
  normalizeLocalizedTerms,
  normalizeLocalizedText,
  normalizeLocale,
  type OmiIntegrationExtensions,
  type OmiScholarlyMetadata,
} from '../../model/scholarlyMetadata';
import {
  createManuscriptFromOjsLaunch as createBaseManuscriptFromOjsLaunch,
  type OjsLaunchPayload,
} from './importOjsLaunch';

type LocalizedUnknown = Record<string, unknown>;
type LocalizedKeywordValue = LocalizedUnknown | unknown[];

interface ExtendedOjsSubmission {
  primaryLocale?: string;
  abstract?: LocalizedUnknown;
  keywords?: LocalizedKeywordValue;
  metadata?: Record<string, unknown>;
  extensions?: Record<string, unknown>;
}

export function createManuscriptFromOjsLaunch(
  launch: OjsLaunchPayload,
): OmiManuscript | null {
  const manuscript = createBaseManuscriptFromOjsLaunch(launch);
  const submission = launch.submission as ExtendedOjsSubmission | null | undefined;

  if (!manuscript || !submission) return manuscript;

  const primaryLocale = normalizeLocale(
    submission.primaryLocale?.trim() || manuscript.locale,
  );
  const abstracts = normalizeLocalizedAbstracts(submission.abstract);
  const keywordsByLocale = normalizeLocalizedKeywords(
    submission.keywords,
    primaryLocale,
  );

  if (manuscript.abstract && !abstracts[primaryLocale]) {
    abstracts[primaryLocale] = manuscript.abstract;
  }
  if (manuscript.keywords.length && !keywordsByLocale[primaryLocale]) {
    keywordsByLocale[primaryLocale] = [...manuscript.keywords];
  }

  const primaryAbstract = abstracts[primaryLocale] ?? manuscript.abstract ?? '';
  const primaryKeywords = keywordsByLocale[primaryLocale] ?? manuscript.keywords;
  const metadata = normalizeScholarlyMetadata(submission.metadata);
  const extensions = normalizeExtensions(submission.extensions);

  return {
    ...manuscript,
    locale: primaryLocale,
    abstract: primaryAbstract,
    keywords: [...primaryKeywords],
    abstracts,
    keywordsByLocale,
    metadata,
    extensions,
  };
}

function normalizeScholarlyMetadata(
  value: Record<string, unknown> | undefined,
): OmiScholarlyMetadata | undefined {
  if (!value) return undefined;

  const metadata: OmiScholarlyMetadata = {
    subjects: normalizeLocalizedTerms(value.subjects),
    disciplines: normalizeLocalizedTerms(value.disciplines),
    supportingAgencies: normalizeLocalizedTerms(value.supportingAgencies),
    coverage: normalizeLocalizedText(value.coverage),
    rights: normalizeLocalizedText(value.rights),
    source: normalizeLocalizedText(value.source),
    type: normalizeLocalizedText(value.type),
    dataAvailability: normalizeLocalizedText(value.dataAvailability),
    languages: normalizeLocalizedText(value.languages),
    copyrightHolder: normalizeLocalizedText(value.copyrightHolder),
  };

  if (typeof value.publisherId === 'string' && value.publisherId.trim()) {
    metadata.publisherId = value.publisherId.trim();
  }
  if (typeof value.licenseUrl === 'string' && value.licenseUrl.trim()) {
    metadata.licenseUrl = value.licenseUrl.trim();
  }
  if (typeof value.copyrightYear === 'number' && Number.isFinite(value.copyrightYear)) {
    metadata.copyrightYear = value.copyrightYear;
  }

  return metadata;
}

function normalizeExtensions(
  value: Record<string, unknown> | undefined,
): OmiIntegrationExtensions | undefined {
  if (!value) return undefined;
  const ojs = value['org.pkp.ojs'];
  if (!ojs || typeof ojs !== 'object' || Array.isArray(ojs)) {
    return value as OmiIntegrationExtensions;
  }

  const ojsRecord = ojs as Record<string, unknown>;
  const openScienceRaw = ojsRecord.openScience;
  const openScience =
    openScienceRaw && typeof openScienceRaw === 'object' && !Array.isArray(openScienceRaw)
      ? Object.fromEntries(
          Object.entries(openScienceRaw as Record<string, unknown>).map(([key, item]) => [
            key,
            normalizeLocalizedText(item),
          ]),
        )
      : undefined;

  return {
    ...value,
    'org.pkp.ojs': {
      ...ojsRecord,
      ...(openScience ? { openScience } : {}),
    },
  } as OmiIntegrationExtensions;
}

function normalizeLocalizedAbstracts(
  value: LocalizedUnknown | undefined,
): Partial<Record<string, string>> {
  const result: Partial<Record<string, string>> = {};
  if (!value) return result;
  for (const [locale, item] of Object.entries(value)) {
    if (typeof item !== 'string') continue;
    const text = plainText(item).trim();
    if (text) result[normalizeLocale(locale)] = text;
  }
  return result;
}

function normalizeLocalizedKeywords(
  value: LocalizedKeywordValue | undefined,
  primaryLocale: string,
): Partial<Record<string, string[]>> {
  if (!value) return {};
  if (Array.isArray(value)) {
    const keywords = normalizeKeywordList(value);
    return keywords.length ? { [primaryLocale]: keywords } : {};
  }
  const result: Partial<Record<string, string[]>> = {};
  for (const [locale, item] of Object.entries(value)) {
    const keywords = normalizeKeywordList(item);
    if (keywords.length) result[normalizeLocale(locale)] = keywords;
  }
  return result;
}

function normalizeKeywordList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const text = extractKeywordText(item);
    if (!text) continue;
    const key = text.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }
  return result;
}

function extractKeywordText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const name = (value as Record<string, unknown>).name;
  return typeof name === 'string' ? name.trim() : '';
}

function plainText(value: string): string {
  if (!value.includes('<')) return value;
  const document = new DOMParser().parseFromString(value, 'text/html');
  return document.body.textContent?.trim() ?? '';
}
