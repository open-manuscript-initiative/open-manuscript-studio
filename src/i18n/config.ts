import englishDictionaryJson from './locales/en/studio.json';
import {
  localeLabels,
  STUDIO_UI_LOCALES,
  type StudioUiLocale,
} from './platformLocales';
import { applyReturnedCanonicalOverlay } from './returnedTranslationOverlay';
import type { SupportedLocale, TranslationDictionary } from './types';

export const DEFAULT_LOCALE: SupportedLocale = 'en';

type LocaleDictionaryLoader = () => Promise<TranslationDictionary>;

const jsonLocaleModules = import.meta.glob(
  [
    './locales/*/studio.json',
    '!./locales/en/studio.json',
  ],
  {
    import: 'default',
  },
) as Record<string, LocaleDictionaryLoader>;

const englishDictionary = englishDictionaryJson as TranslationDictionary;

export const translations: Partial<
  Record<string, TranslationDictionary>
> = {
  [DEFAULT_LOCALE]: applyReturnedCanonicalOverlay(
    DEFAULT_LOCALE,
    englishDictionary,
    englishDictionary,
  ),
};

const localeLoadPromises = new Map<
  string,
  Promise<TranslationDictionary>
>();

function localeModulePath(locale: string): string {
  return `./locales/${locale}/studio.json`;
}

export function isTranslationDictionaryLoaded(
  locale: SupportedLocale,
): boolean {
  return translations[locale] !== undefined;
}

export async function loadTranslationDictionary(
  locale: SupportedLocale,
): Promise<TranslationDictionary> {
  const cached = translations[locale];
  if (cached) {
    return cached;
  }

  const pending = localeLoadPromises.get(locale);
  if (pending) {
    return pending;
  }

  const loadPromise = (async () => {
    const loader = jsonLocaleModules[localeModulePath(locale)];
    const dictionary = loader
      ? await loader()
      : englishDictionary;
    const localized = applyReturnedCanonicalOverlay(
      locale,
      dictionary,
      englishDictionary,
    );
    translations[locale] = localized;
    return localized;
  })().finally(() => {
    localeLoadPromises.delete(locale);
  });

  localeLoadPromises.set(locale, loadPromise);
  return loadPromise;
}

export { localeLabels };

export const supportedLocales = [...STUDIO_UI_LOCALES] as SupportedLocale[];

export function isSupportedLocale(value: string): value is SupportedLocale {
  return STUDIO_UI_LOCALES.includes(value as StudioUiLocale);
}
