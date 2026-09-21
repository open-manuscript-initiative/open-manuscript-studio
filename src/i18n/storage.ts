import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  supportedLocales,
} from './config';
import { resolveStudioUiLocale } from './platformLocales';
import type { SupportedLocale } from './types';

const UI_LOCALE_STORAGE_KEY = 'omi-studio-ui-locale';
const UI_ENABLED_LOCALES_STORAGE_KEY =
  'omi-studio-ui-enabled-locales';
const UI_LOCALE_REGISTRY_VERSION_KEY =
  'omi-studio-ui-locale-registry-version';
const UI_LOCALE_REGISTRY_VERSION = '4';
const LEGACY_UI_LOCALES = new Set(['en', 'hu', 'de']);
const PREVIOUS_UI_LOCALES = new Set([
  'bg', 'cs', 'da', 'de', 'el', 'en', 'es', 'et', 'fi', 'fr', 'ga', 'hr',
  'hu', 'it', 'lt', 'lv', 'mt', 'nl', 'pl', 'pt', 'ro', 'sk', 'sl', 'sv',
]);

export function loadUiLocale(): SupportedLocale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;

  const stored = window.localStorage.getItem(UI_LOCALE_STORAGE_KEY);
  if (stored && isSupportedLocale(stored)) return stored;

  const browserLocale = resolveStudioUiLocale(window.navigator.language);
  return browserLocale && isSupportedLocale(browserLocale)
    ? (browserLocale as SupportedLocale)
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
 * Locale-registry migration.
 *
 * Early releases exposed EN/HU/DE, then the 24 EU interface locales. Version 4
 * adds the Google Play parity matrix. Existing users who still have either the
 * original three-language default or the complete previous 24-language default
 * are upgraded to the new full registry. Explicit user customizations remain
 * untouched.
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
      if (Array.isArray(parsed) && parsed.length > 0) {
        const localeValues = parsed.filter(
          (locale): locale is string => typeof locale === 'string',
        );
        const localeSet = new Set(localeValues);
        const legacyDefault =
          localeValues.length === parsed.length &&
          localeValues.every((locale) => LEGACY_UI_LOCALES.has(locale));
        const previousFullDefault =
          localeValues.length === PREVIOUS_UI_LOCALES.size &&
          localeValues.every((locale) => PREVIOUS_UI_LOCALES.has(locale)) &&
          [...PREVIOUS_UI_LOCALES].every((locale) => localeSet.has(locale));
        shouldExpand = legacyDefault || previousFullDefault;
      } else {
        shouldExpand = true;
      }
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
