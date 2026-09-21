import {
  localeLabels,
  STUDIO_UI_LOCALES,
  type StudioUiLocale,
} from './platformLocales';
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

export { localeLabels };

export const supportedLocales = [...STUDIO_UI_LOCALES] as SupportedLocale[];

export function isSupportedLocale(value: string): value is SupportedLocale {
  return STUDIO_UI_LOCALES.includes(value as StudioUiLocale);
}
