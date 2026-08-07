import { DEFAULT_LOCALE, translations } from './config';
import type { SupportedLocale, TranslationDictionary, TranslationKey } from './types';

function resolveTranslation(
  dictionary: TranslationDictionary,
  key: TranslationKey
): string | undefined {
  const value = key.split('.').reduce<unknown>((current, segment) => {
    if (typeof current === 'object' && current !== null && segment in current) {
      return (current as Record<string, unknown>)[segment];
    }
    return undefined;
  }, dictionary);

  return typeof value === 'string' ? value : undefined;
}

export function translate(locale: SupportedLocale, key: TranslationKey): string {
  return (
    resolveTranslation(translations[locale], key) ??
    resolveTranslation(translations[DEFAULT_LOCALE], key) ??
    key
  );
}
