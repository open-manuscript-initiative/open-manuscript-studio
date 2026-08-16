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
const UI_LOCALE_REGISTRY_VERSION = '2';

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
 * Before the modular locale registry the Studio only exposed EN/HU/DE.
 * Browsers that used that release can still have exactly those three values
 * persisted in localStorage. Without an explicit migration that historical
 * default looks like a deliberate preference forever, hiding every locale
 * added later.
 *
 * Version 2 performs a one-time expansion to the current registry. After the
 * marker is written, subsequent user choices are preserved verbatim.
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
        parsed.length === 3 &&
        ['en', 'hu', 'de'].every((locale) => parsed.includes(locale));
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
