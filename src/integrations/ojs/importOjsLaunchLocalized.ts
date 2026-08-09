import type { OmiManuscript } from '../../types/omi';
import {
  createManuscriptFromOjsLaunch as createBaseManuscriptFromOjsLaunch,
  type OjsLaunchPayload,
} from './importOjsLaunch';

type LocalizedUnknown = Record<string, unknown>;

type LocalizedKeywordValue = LocalizedUnknown | unknown[];

export function createManuscriptFromOjsLaunch(
  launch: OjsLaunchPayload,
): OmiManuscript | null {
  const manuscript = createBaseManuscriptFromOjsLaunch(launch);
  const submission = launch.submission;

  if (!manuscript || !submission) {
    return manuscript;
  }

  const primaryLocale = submission.primaryLocale?.trim() || manuscript.locale;
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

  return {
    ...manuscript,
    abstract: primaryAbstract,
    keywords: [...primaryKeywords],
    abstracts,
    keywordsByLocale,
  };
}

function normalizeLocalizedAbstracts(
  value: LocalizedUnknown | undefined,
): Partial<Record<string, string>> {
  const result: Partial<Record<string, string>> = {};
  if (!value) return result;

  for (const [locale, item] of Object.entries(value)) {
    if (typeof item !== 'string') continue;
    const text = plainText(item).trim();
    if (text) result[locale] = text;
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
    if (keywords.length) result[locale] = keywords;
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
