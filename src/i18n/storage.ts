import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  supportedLocales,
  type SupportedLocale,
} from './config';

const UI_LOCALE_STORAGE_KEY = 'omi-studio-ui-locale';
const UI_ENABLED_LOCALES_STORAGE_KEY =
  'omi-studio-ui-enabled-locales';

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
      ? enabled
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
}
