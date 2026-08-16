import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  supportedLocales,
} from './config';
import type { SupportedLocale } from './types';

const UI_LOCALE_STORAGE_KEY = 'omi-studio-ui-locale';
const UI_ENABLED_LOCALES_STORAGE_KEY =
  'omi-studio-ui-enabled-locales';
const UI_LOCALE_REGISTRY_VERSION_KEY =
  'omi-studio-ui-locale-registry-version';
const UI_LOCALE_REGISTRY_VERSION = '3';
const LEGACY_UI_LOCALES = new Set(['en', 'hu', 'de']);

export function loadUiLocale(): SupportedLocale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;

  const stored = window.localStorage.getItem(UI_LOCALE_STORAGE_KEY);
  if (stored && isSupportedLocale(stored)) return stored;

  const browserLocale = window.navigator.language.split('-')[0];
  return isSupportedLocale(browserLocale)
    ? browserLocale
    : DEFAULT_LOCALE;
}

export function saveUiLocale(locale: SupportedLocale): void {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(UI_LOCALE_STORAGE_KEY, locale);
  }
}

export function loadEnabledUiLocales(): SupportedLocale[] {
  if (typeof window === 'undefined') {
    return [...supportedLocales];
  }

  migrateLegacyEnabledUiLocales();

  const stored = window.localStorage.getItem(
    UI_ENABLED_LOCALES_STORAGE_KEY,
  );

  if (!stored) {
    return [...supportedLocales];
  }

  try {
    const parsed = JSON.parse(stored) as unknown;

    if (!Array.isArray(parsed)) {
      return [...supportedLocales];
    }

    const enabled = supportedLocales.filter((locale) =>
      parsed.includes(locale),
    );

    return enabled.length > 0
      ? [...enabled]
      : [...supportedLocales];
  } catch {
    return [...supportedLocales];
  }
}

export function saveEnabledUiLocales(
  locales: readonly SupportedLocale[],
): void {
  if (typeof window === 'undefined') {
    return;
  }

  const normalized = supportedLocales.filter((locale) =>
    locales.includes(locale),
  );

  window.localStorage.setItem(
    UI_ENABLED_LOCALES_STORAGE_KEY,
    JSON.stringify(
      normalized.length > 0 ? normalized : [DEFAULT_LOCALE],
    ),
  );
  window.localStorage.setItem(
    UI_LOCALE_REGISTRY_VERSION_KEY,
    UI_LOCALE_REGISTRY_VERSION,
  );
}

/**
 * Early Studio releases exposed only EN/HU/DE. A browser can therefore have
 * a persisted enabled-locale list containing only that legacy set. Version 2
 * was intentionally conservative and could miss such browsers if its marker
 * had already been written. Version 3 performs one final migration: while the
 * stored list contains no locale outside the legacy set, expand it to the
 * complete current registry. Once the v3 marker exists, later user choices are
 * preserved exactly.
 */
function migrateLegacyEnabledUiLocales(): void {
  const version = window.localStorage.getItem(
    UI_LOCALE_REGISTRY_VERSION_KEY,
  );

  if (version === UI_LOCALE_REGISTRY_VERSION) {
    return;
  }

  const stored = window.localStorage.getItem(
    UI_ENABLED_LOCALES_STORAGE_KEY,
  );

  let shouldExpand = stored === null;

  if (stored !== null) {
    try {
      const parsed = JSON.parse(stored) as unknown;
      shouldExpand =
        Array.isArray(parsed) &&
        parsed.length > 0 &&
        parsed.every(
          (locale) =>
            typeof locale === 'string' &&
            LEGACY_UI_LOCALES.has(locale),
        );
    } catch {
      shouldExpand = true;
    }
  }

  if (shouldExpand) {
    window.localStorage.setItem(
      UI_ENABLED_LOCALES_STORAGE_KEY,
      JSON.stringify(supportedLocales),
    );
  }

  window.localStorage.setItem(
    UI_LOCALE_REGISTRY_VERSION_KEY,
    UI_LOCALE_REGISTRY_VERSION,
  );
}
