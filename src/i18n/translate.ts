import { authSupplementalTranslations } from './authSupplementalTranslations';
import { authTranslations } from './authTranslations';
import type { AuthTranslationKey } from './authTranslations';
import { DEFAULT_LOCALE, translations } from './config';
import type {
  SupportedLocale,
  TranslationDictionary,
  TranslationKey,
} from './types';

export type AppTranslationKey = TranslationKey | AuthTranslationKey;

function resolveTranslation(
  dictionary: TranslationDictionary | undefined,
  key: TranslationKey,
): string | undefined {
  if (!dictionary) {
    return undefined;
  }

  const value = key.split('.').reduce<unknown>((current, segment) => {
    if (typeof current === 'object' && current !== null && segment in current) {
      return (current as Record<string, unknown>)[segment];
    }
    return undefined;
  }, dictionary);

  return typeof value === 'string' ? value : undefined;
}

function resolveAuthTranslation(
  locale: string,
  key: AppTranslationKey,
): string | undefined {
  return (
    authSupplementalTranslations[locale]?.[key as AuthTranslationKey] ??
    authTranslations[locale as SupportedLocale]?.[key as AuthTranslationKey]
  );
}

export function translate(
  locale: SupportedLocale,
  key: AppTranslationKey,
): string {
  return (
    resolveAuthTranslation(locale, key) ??
    resolveTranslation(translations[locale], key as TranslationKey) ??
    resolveAuthTranslation(DEFAULT_LOCALE, key) ??
    resolveTranslation(translations[DEFAULT_LOCALE], key as TranslationKey) ??
    key
  );
}
