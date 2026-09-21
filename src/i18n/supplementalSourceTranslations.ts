import { resolveStudioUiLocale } from './platformLocales';

type SourceTranslationMap = Record<string, string>;

const sourceModules = import.meta.glob(
  './play-source-locales/*.json',
  {
    eager: true,
    import: 'default',
  },
) as Record<string, SourceTranslationMap>;

const sourceTranslations = Object.fromEntries(
  Object.entries(sourceModules).map(([path, dictionary]) => {
    const match = path.match(/\/play-source-locales\/([^/]+)\.json$/);
    if (!match) {
      throw new Error(`Invalid supplemental locale source path: ${path}`);
    }
    return [match[1], dictionary];
  }),
) as Record<string, SourceTranslationMap>;

function translateSource(locale: string, source: string): string {
  const canonical = resolveStudioUiLocale(locale);
  if (!canonical || canonical === 'en') return source;
  return sourceTranslations[canonical]?.[source] ?? source;
}

function localizeValue(
  locale: string,
  english: unknown,
  explicit: unknown,
): unknown {
  if (typeof english === 'string') {
    if (typeof explicit === 'string') return explicit;
    return translateSource(locale, english);
  }

  if (Array.isArray(english)) {
    const explicitArray = Array.isArray(explicit) ? explicit : [];
    return english.map((item, index) =>
      localizeValue(locale, item, explicitArray[index]),
    );
  }

  if (typeof english === 'function') {
    return typeof explicit === 'function' ? explicit : english;
  }

  if (english && typeof english === 'object') {
    const explicitObject =
      explicit && typeof explicit === 'object' && !Array.isArray(explicit)
        ? (explicit as Record<string, unknown>)
        : {};
    return Object.fromEntries(
      Object.entries(english as Record<string, unknown>).map(([key, value]) => [
        key,
        localizeValue(locale, value, explicitObject[key]),
      ]),
    );
  }

  return explicit ?? english;
}

/**
 * Completes a supplemental copy object for a locale.
 *
 * Existing locale-specific copy is authoritative, even when a reviewed term
 * intentionally matches English. Google Play source translations are used only
 * when that locale has no explicit value for the field.
 */
export function localizeSupplementalCopy<T>(
  locale: string,
  english: T,
  explicit?: T,
): T {
  return localizeValue(locale, english, explicit) as T;
}

export function getSupplementalSourceTranslation(
  locale: string,
  source: string,
): string {
  return translateSource(locale, source);
}
