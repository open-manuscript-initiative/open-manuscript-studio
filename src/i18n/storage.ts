import { DEFAULT_LOCALE, isSupportedLocale } from './config';
import type { SupportedLocale } from './types';

const UI_LOCALE_STORAGE_KEY = 'omi-studio-ui-locale';

export function loadUiLocale(): SupportedLocale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;

  const stored = window.localStorage.getItem(UI_LOCALE_STORAGE_KEY);
  if (stored && isSupportedLocale(stored)) return stored;

  const browserLocale = window.navigator.language.split('-')[0];
  return isSupportedLocale(browserLocale) ? browserLocale : DEFAULT_LOCALE;
}

export function saveUiLocale(locale: SupportedLocale): void {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(UI_LOCALE_STORAGE_KEY, locale);
  }
}
