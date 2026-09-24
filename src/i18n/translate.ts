import { authSupplementalTranslations } from './authSupplementalTranslations';
import { authTranslations, type AuthTranslationKey } from './authTranslations';
import { DEFAULT_LOCALE, translations } from './config';
import { getReturnedSupplementalString } from './returnedTranslationOverlay';
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

export function localizeStudioName(locale: string, value: string): string {
  return locale === 'hu' ? value.replace(/\bStudio\b/g, 'Stúdió') : value;
}

export function translate(
  locale: SupportedLocale,
  key: AppTranslationKey,
): string {
  const localizedAuth = resolveAuthTranslation(locale, key);
  const englishAuth = resolveAuthTranslation(DEFAULT_LOCALE, key);
  const returnedAuth = getReturnedSupplementalString(
    locale,
    'auth',
    key as string,
  );
  const authValue =
    returnedAuth &&
    (localizedAuth === undefined || localizedAuth === englishAuth)
      ? returnedAuth
      : localizedAuth;

  const value =
    authValue ??
    resolveTranslation(translations[locale], key as TranslationKey) ??
    englishAuth ??
    resolveTranslation(translations[DEFAULT_LOCALE], key as TranslationKey) ??
    key;

  return localizeStudioName(locale, value);
}
