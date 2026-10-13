import { translations } from '../i18n/config';
import type { TranslationDictionary } from '../i18n/types';

const CATALOG_LOCALES = ['en', 'de', 'hu'] as const;

type CatalogLocale = (typeof CATALOG_LOCALES)[number];

function getAtPointer(dictionary: TranslationDictionary, pointer: string): unknown {
  const tokens = pointer
    .split('/')
    .slice(1)
    .map((token) => token.replace(/~1/g, '/').replace(/~0/g, '~'));
  let current: unknown = dictionary;

  for (const token of tokens) {
    if (!current || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[token];
  }

  return current;
}

export function getResearchModuleCopyByLocale<T = Record<string, any>>(
  catalogPath: string,
): Record<string, T> {
  const pointer = `/researchModules/${catalogPath}`;
  const english = getAtPointer(translations.en!, pointer);
  const result = {} as Record<string, T>;

  for (const locale of CATALOG_LOCALES) {
    const localized = getAtPointer(translations[locale] ?? translations.en!, pointer);
    result[locale] = (localized ?? english) as T;
  }

  return result;
}
