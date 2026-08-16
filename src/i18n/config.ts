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
) as Record<string, TranslationDictionary>;

/**
 * Transitional fallback for the original three Studio locales. The legacy
 * imports can be removed after en/hu/de studio.json files are committed.
 */
const legacyTranslations: Record<string, TranslationDictionary> = {
  en: legacyEn,
  hu: legacyHu,
  de: legacyDe,
};

/**
 * JSON locales override the transitional TypeScript dictionaries. Any new
 * locale becomes available automatically when locales/<code>/studio.json is
 * added and passes the JSON locale validator.
 */
export const translations: Record<string, TranslationDictionary> = {
  ...legacyTranslations,
  ...jsonTranslations,
};

export const localeLabels: Record<string, string> = {
  bg: 'Български',
  cs: 'Čeština',
  da: 'Dansk',
  de: 'Deutsch',
  el: 'Ελληνικά',
  en: 'English',
  es: 'Español',
  et: 'Eesti',
  fi: 'Suomi',
  fr: 'Français',
  ga: 'Gaeilge',
  hr: 'Hrvatski',
  hu: 'Magyar',
  it: 'Italiano',
  lt: 'Lietuvių',
  lv: 'Latviešu',
  mt: 'Malti',
  nl: 'Nederlands',
  pl: 'Polski',
  pt: 'Português',
  ro: 'Română',
  sk: 'Slovenčina',
  sl: 'Slovenščina',
  sv: 'Svenska',
};

const localeOrder = Object.keys(localeLabels);

export const supportedLocales = localeOrder.filter((locale) =>
  Object.prototype.hasOwnProperty.call(translations, locale),
) as SupportedLocale[];

export function isSupportedLocale(value: string): value is SupportedLocale {
  return supportedLocales.includes(value as SupportedLocale);
}
