import { de as legacyDe } from './locales/de';
import { en as legacyEn } from './locales/en';
import { hu as legacyHu } from './locales/hu';
import type { SupportedLocale, TranslationDictionary } from './types';

export const DEFAULT_LOCALE: SupportedLocale = 'en';

const jsonLocaleModules = import.meta.glob(
  './locales/*/studio.json',
  {
    eager: true,
    import: 'default',
  },
) as Record<string, TranslationDictionary>;

const jsonTranslations = Object.fromEntries(
  Object.entries(jsonLocaleModules).map(([path, dictionary]) => {
    const match = path.match(/\/locales\/([^/]+)\/studio\.json$/);

    if (!match) {
      throw new Error(`Invalid locale path: ${path}`);
    }

    return [match[1], dictionary];
  }),
) as Partial<Record<SupportedLocale, TranslationDictionary>>;

/**
 * Transitional fallback while the canonical JSON locale files are being
 * committed. Once en/hu/de studio.json files are in the repository and
 * validated, the legacy TypeScript imports can be removed.
 */
const legacyTranslations: Record<SupportedLocale, TranslationDictionary> = {
  en: legacyEn,
  hu: legacyHu,
  de: legacyDe,
};

export const translations: Record<SupportedLocale, TranslationDictionary> = {
  en: jsonTranslations.en ?? legacyTranslations.en,
  hu: jsonTranslations.hu ?? legacyTranslations.hu,
  de: jsonTranslations.de ?? legacyTranslations.de,
};

export const supportedLocales: readonly SupportedLocale[] = ['en', 'hu', 'de'];

export const localeLabels: Record<SupportedLocale, string> = {
  en: 'English',
  hu: 'Magyar',
  de: 'Deutsch',
};

export function isSupportedLocale(value: string): value is SupportedLocale {
  return supportedLocales.includes(value as SupportedLocale);
}
