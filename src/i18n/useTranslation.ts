import { translations } from './config';
import type {
  SupportedLocale,
  TranslationDictionary
} from './types';

type NestedKey<T> = {
  [K in keyof T & string]:
    T[K] extends string
      ? K
      : T[K] extends Record<string, unknown>
        ? `${K}.${NestedKey<T[K]>}`
        : never;
}[keyof T & string];

export type TranslationKey =
  NestedKey<TranslationDictionary>;

function resolveTranslation(
  dictionary: TranslationDictionary,
  key: TranslationKey
): string {
  const value = key
    .split('.')
    .reduce<unknown>((current, segment) => {
      if (
        typeof current === 'object' &&
        current !== null &&
        segment in current
      ) {
        return (
          current as Record<string, unknown>
        )[segment];
      }

      return undefined;
    }, dictionary);

  if (typeof value !== 'string') {
    return key;
  }

  return value;
}

export function createTranslator(locale: SupportedLocale) {
  const dictionary =
    translations[locale] ??
    translations.en;

  return (key: TranslationKey): string =>
    resolveTranslation(dictionary, key);
}
