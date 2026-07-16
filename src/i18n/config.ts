import { en } from './locales/en';
import { hu } from './locales/hu';
import type {
  SupportedLocale,
  TranslationDictionary
} from './types';

export const DEFAULT_LOCALE: SupportedLocale = 'en';

export const translations: Record<
  SupportedLocale,
  TranslationDictionary
> = {
  en,
  hu,
  de: en
};

export const supportedLocales: SupportedLocale[] = [
  'en',
  'hu',
  'de'
];
