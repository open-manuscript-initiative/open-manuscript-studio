import type { SupportedLocale, TranslationDictionary } from './types';

export const DEFAULT_LOCALE: SupportedLocale = 'en';

const jsonLocaleModules = import.meta.glob(
  './locales/*/studio.json',
  {
    eager: true,
    import: 'default',
  },
) as Record<string, TranslationDictionary>;

export const translations = Object.fromEntries(
  Object.entries(jsonLocaleModules).map(([path, dictionary]) => {
    const match = path.match(/\/locales\/([^/]+)\/studio\.json$/);

    if (!match) {
      throw new Error(`Invalid locale path: ${path}`);
    }

    return [match[1], dictionary];
  }),
) as Record<string, TranslationDictionary>;

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
