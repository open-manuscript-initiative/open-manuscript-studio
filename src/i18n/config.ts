import { de } from './locales/de';
import { en } from './locales/en';
import { hu } from './locales/hu';
import type { SupportedLocale, TranslationDictionary } from './types';

export const DEFAULT_LOCALE: SupportedLocale = 'en';

export const translations: Record<SupportedLocale, TranslationDictionary> = {
  en,
  hu,
  de
};

export const supportedLocales: readonly SupportedLocale[] = ['en', 'hu', 'de'];

export const localeLabels: Record<SupportedLocale, string> = {
  en: 'English',
  hu: 'Magyar',
  de: 'Deutsch'
};

export function isSupportedLocale(value: string): value is SupportedLocale {
  return supportedLocales.includes(value as SupportedLocale);
}
