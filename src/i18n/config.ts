import englishDictionaryJson from './locales/en/studio.json' with { type: 'json' };
import {
  localeLabels,
  STUDIO_UI_LOCALES,
  type StudioUiLocale,
} from './platformLocales';
import { applyReturnedCanonicalOverlay } from './returnedTranslationOverlay';
import type { SupportedLocale, TranslationDictionary } from './types';

export const DEFAULT_LOCALE: SupportedLocale = 'en';

type LocaleDictionaryLoader = () => Promise<TranslationDictionary>;

const jsonLocaleModules: Record<string, LocaleDictionaryLoader> = {
  './locales/af/studio.json': () =>
    import('./locales/af/studio.json', { with: { type: 'json' } }).then(
      (module) => module.default as TranslationDictionary,
    ),
  './locales/bg/studio.json': () =>
    import('./locales/bg/studio.json', { with: { type: 'json' } }).then(
      (module) => module.default as TranslationDictionary,
    ),
  './locales/ca/studio.json': () =>
    import('./locales/ca/studio.json', { with: { type: 'json' } }).then(
      (module) => module.default as TranslationDictionary,
    ),
  './locales/cs/studio.json': () =>
    import('./locales/cs/studio.json', { with: { type: 'json' } }).then(
      (module) => module.default as TranslationDictionary,
    ),
  './locales/da/studio.json': () =>
    import('./locales/da/studio.json', { with: { type: 'json' } }).then(
      (module) => module.default as TranslationDictionary,
    ),
  './locales/de/studio.json': () =>
    import('./locales/de/studio.json', { with: { type: 'json' } }).then(
      (module) => module.default as TranslationDictionary,
    ),
  './locales/el/studio.json': () =>
    import('./locales/el/studio.json', { with: { type: 'json' } }).then(
      (module) => module.default as TranslationDictionary,
    ),
  './locales/es/studio.json': () =>
    import('./locales/es/studio.json', { with: { type: 'json' } }).then(
      (module) => module.default as TranslationDictionary,
    ),
  './locales/et/studio.json': () =>
    import('./locales/et/studio.json', { with: { type: 'json' } }).then(
      (module) => module.default as TranslationDictionary,
    ),
  './locales/fi/studio.json': () =>
    import('./locales/fi/studio.json', { with: { type: 'json' } }).then(
      (module) => module.default as TranslationDictionary,
    ),
  './locales/fr/studio.json': () =>
    import('./locales/fr/studio.json', { with: { type: 'json' } }).then(
      (module) => module.default as TranslationDictionary,
    ),
  './locales/ga/studio.json': () =>
    import('./locales/ga/studio.json', { with: { type: 'json' } }).then(
      (module) => module.default as TranslationDictionary,
    ),
  './locales/hr/studio.json': () =>
    import('./locales/hr/studio.json', { with: { type: 'json' } }).then(
      (module) => module.default as TranslationDictionary,
    ),
  './locales/hu/studio.json': () =>
    import('./locales/hu/studio.json', { with: { type: 'json' } }).then(
      (module) => module.default as TranslationDictionary,
    ),
  './locales/it/studio.json': () =>
    import('./locales/it/studio.json', { with: { type: 'json' } }).then(
      (module) => module.default as TranslationDictionary,
    ),
  './locales/lt/studio.json': () =>
    import('./locales/lt/studio.json', { with: { type: 'json' } }).then(
      (module) => module.default as TranslationDictionary,
    ),
  './locales/lv/studio.json': () =>
    import('./locales/lv/studio.json', { with: { type: 'json' } }).then(
      (module) => module.default as TranslationDictionary,
    ),
  './locales/mt/studio.json': () =>
    import('./locales/mt/studio.json', { with: { type: 'json' } }).then(
      (module) => module.default as TranslationDictionary,
    ),
  './locales/nl/studio.json': () =>
    import('./locales/nl/studio.json', { with: { type: 'json' } }).then(
      (module) => module.default as TranslationDictionary,
    ),
  './locales/pl/studio.json': () =>
    import('./locales/pl/studio.json', { with: { type: 'json' } }).then(
      (module) => module.default as TranslationDictionary,
    ),
  './locales/pt/studio.json': () =>
    import('./locales/pt/studio.json', { with: { type: 'json' } }).then(
      (module) => module.default as TranslationDictionary,
    ),
  './locales/ro/studio.json': () =>
    import('./locales/ro/studio.json', { with: { type: 'json' } }).then(
      (module) => module.default as TranslationDictionary,
    ),
  './locales/sk/studio.json': () =>
    import('./locales/sk/studio.json', { with: { type: 'json' } }).then(
      (module) => module.default as TranslationDictionary,
    ),
  './locales/sl/studio.json': () =>
    import('./locales/sl/studio.json', { with: { type: 'json' } }).then(
      (module) => module.default as TranslationDictionary,
    ),
  './locales/sv/studio.json': () =>
    import('./locales/sv/studio.json', { with: { type: 'json' } }).then(
      (module) => module.default as TranslationDictionary,
    ),
};

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
