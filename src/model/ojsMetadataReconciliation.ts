import { normalizeLocale } from './scholarlyMetadata';
import type { OmiManuscriptState } from '../types/omi';
import type {
  OjsMetadataSnapshot,
  OjsPullMetadataField,
  OjsWritableMetadataField,
} from '../services/ojsMetadataTypes';

export const OJS_RECONCILIATION_FIELDS: OjsPullMetadataField[] = [
  'title',
  'subtitle',
  'abstract',
  'keywords',
  'licenseUrl',
  'copyrightHolder',
  'copyrightYear',
];
export type MetadataValue = string | string[] | number | undefined;
export function localizedValue<T>(
  map: Partial<Record<string, T>> | null | undefined,
  locale: string,
): T | undefined {
  const matches = Object.entries(map ?? {}).filter(
    ([key]) => normalizeLocale(key) === normalizeLocale(locale),
  );
  if (
    matches.some(
      ([, value]) => JSON.stringify(value) !== JSON.stringify(matches[0]?.[1]),
    )
  )
    throw new Error('Conflicting localized metadata aliases.');
  return matches[0]?.[1];
}
export function canRepresentMetadataField(
  field: OjsPullMetadataField,
  manuscript: OmiManuscriptState,
  locale: string,
): boolean {
  return (
    !['title', 'subtitle'].includes(field) ||
    normalizeLocale(locale) === normalizeLocale(manuscript.locale)
  );
}
export function localMetadataValue(
  manuscript: OmiManuscriptState,
  locale: string,
  field: OjsPullMetadataField,
): MetadataValue {
  if (!canRepresentMetadataField(field, manuscript, locale)) return undefined;
  switch (field) {
    case 'title':
      return manuscript.title;
    case 'subtitle':
      return manuscript.subtitle ?? '';
    case 'abstract':
      return (
        localizedValue(manuscript.abstracts, locale) ??
        (normalizeLocale(locale) === normalizeLocale(manuscript.locale)
          ? (manuscript.abstract ?? '')
          : '')
      );
    case 'keywords':
      return (
        localizedValue(manuscript.keywordsByLocale, locale) ??
        (normalizeLocale(locale) === normalizeLocale(manuscript.locale)
          ? manuscript.keywords
          : [])
      );
    case 'copyrightHolder':
      return localizedValue(manuscript.metadata?.copyrightHolder, locale) ?? '';
    case 'licenseUrl':
      return manuscript.metadata?.licenseUrl ?? '';
    case 'copyrightYear':
      return manuscript.metadata?.copyrightYear;
  }
}
export function remoteMetadataValue(
  snapshot: OjsMetadataSnapshot,
  locale: string,
  field: OjsPullMetadataField,
): MetadataValue {
  const metadata = snapshot.metadata;
  if (field === 'licenseUrl') return metadata.licenseUrl ?? undefined;
  if (field === 'copyrightYear')
    return metadata.copyrightYear === null
      ? undefined
      : Number(metadata.copyrightYear);
  return localizedValue<string | string[]>(metadata[field], locale);
}
export function metadataEqual(a: MetadataValue, b: MetadataValue): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function mergeLocale<T>(
  map: Partial<Record<string, T>> | undefined,
  locale: string,
  value: T,
): Partial<Record<string, T>> {
  const result = { ...map };
  for (const key of Object.keys(result))
    if (normalizeLocale(key) === normalizeLocale(locale)) delete result[key];
  return { ...result, [normalizeLocale(locale)]: value };
}
/** Pure selective import. Never replace contributors, identifiers, content or unrelated locale values. */
export function importOjsMetadata(
  state: OmiManuscriptState,
  snapshot: OjsMetadataSnapshot,
  locale: string,
  fields: OjsPullMetadataField[],
): OmiManuscriptState {
  if (!snapshot.locales.includes(locale))
    throw new Error('Select an exact OJS metadata locale.');
  if (!fields.length) throw new Error('Select at least one metadata field.');
  const next = { ...state };
  const language = normalizeLocale(locale);
  const primary = language === normalizeLocale(state.locale);
  for (const field of new Set(fields)) {
    if (
      !OJS_RECONCILIATION_FIELDS.includes(field) ||
      !canRepresentMetadataField(field, state, locale)
    )
      throw new Error(
        'This metadata field cannot be imported in the selected language.',
      );
    const value = remoteMetadataValue(snapshot, locale, field);
    if (value === undefined)
      throw new Error('OJS has no value for the selected field and language.');
    if (field === 'keywords') {
      if (!Array.isArray(value)) throw new Error('Invalid OJS keywords.');
      next.keywordsByLocale = mergeLocale(
        {
          [normalizeLocale(state.locale)]: [...state.keywords],
          ...(state.keywordsByLocale ?? {}),
        },
        language,
        [...value],
      );
      if (primary) next.keywords = [...value];
    } else if (field === 'abstract') {
      if (typeof value !== 'string') throw new Error('Invalid OJS abstract.');
      next.abstracts = mergeLocale(
        {
          [normalizeLocale(state.locale)]: state.abstract ?? '',
          ...(state.abstracts ?? {}),
        },
        language,
        value,
      );
      if (primary) next.abstract = value;
    } else if (field === 'title' || field === 'subtitle') {
      if (typeof value !== 'string') throw new Error('Invalid OJS title.');
      next[field] = value;
    } else if (field === 'copyrightYear') {
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 1)
        throw new Error('Invalid copyright year.');
      next.metadata = { ...(next.metadata ?? {}), copyrightYear: value };
    } else if (field === 'copyrightHolder') {
      if (typeof value !== 'string')
        throw new Error('Invalid copyright holder.');
      next.metadata = {
        ...(next.metadata ?? {}),
        copyrightHolder: mergeLocale(
          state.metadata?.copyrightHolder,
          language,
          value,
        ),
      };
    } else if (typeof value === 'string') {
      if (value && !['https:', 'http:'].includes(new URL(value).protocol))
        throw new Error('Invalid license URL.');
      next.metadata = { ...(next.metadata ?? {}), licenseUrl: value };
    }
  }
  return next;
}
export function exportOjsMetadata(
  state: OmiManuscriptState,
  snapshot: OjsMetadataSnapshot,
  locale: string,
  fields: OjsWritableMetadataField[],
): Partial<Record<'title' | 'subtitle' | 'abstract', string>> & {
  keywords?: string[];
} {
  if (!snapshot.locales.includes(locale) || !fields.length)
    throw new Error('Choose a supported OJS locale and metadata fields.');
  const result: Partial<Record<'title' | 'subtitle' | 'abstract', string>> & {
    keywords?: string[];
  } = {};
  for (const field of new Set(fields)) {
    if (
      !snapshot.writableFields.includes(field) ||
      !canRepresentMetadataField(field, state, locale)
    )
      throw new Error('OJS does not permit this metadata change.');
    const value = localMetadataValue(state, locale, field);
    if (field === 'keywords' && Array.isArray(value))
      result.keywords = [...value];
    else if (field !== 'keywords' && typeof value === 'string')
      result[field] = value;
    else throw new Error('Invalid local metadata value.');
  }
  return result;
}
