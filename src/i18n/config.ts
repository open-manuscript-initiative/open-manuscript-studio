import { de } from './locales/de';
import { en } from './locales/en';
import { hu } from './locales/hu';
import type { TranslationDictionary } from './types';

/**
 * Register every available Studio interface language here.
 *
 * Adding a future language means adding its TranslationDictionary and one
 * registry entry. SupportedLocale, the settings view, and the quick language
 * switcher derive their available values from this registry.
 */
export const translations = {
  en,
  hu,
  de,
} satisfies Record<string, TranslationDictionary>;

export type SupportedLocale = keyof typeof translations;

export const DEFAULT_LOCALE: SupportedLocale = 'en';

export const supportedLocales = Object.keys(
  translations,
) as SupportedLocale[];

export interface LocaleDefinition {
  code: SupportedLocale;
  nativeLabel: string;
}

export const localeDefinitions: readonly LocaleDefinition[] = [
  { code: 'en', nativeLabel: 'English' },
  { code: 'hu', nativeLabel: 'Magyar' },
  { code: 'de', nativeLabel: 'Deutsch' },
];

export const localeLabels = Object.fromEntries(
  localeDefinitions.map(({ code, nativeLabel }) => [code, nativeLabel]),
) as Record<SupportedLocale, string>;

export function isSupportedLocale(
  value: string,
): value is SupportedLocale {
  return Object.prototype.hasOwnProperty.call(translations, value);
}
