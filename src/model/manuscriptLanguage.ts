export const ISO_639_1_LANGUAGE_CODES = [
  'aa', 'ab', 'ae', 'af', 'ak', 'am', 'an', 'ar', 'as', 'av', 'ay', 'az',
  'ba', 'be', 'bg', 'bi', 'bm', 'bn', 'bo', 'br', 'bs', 'ca', 'ce', 'ch',
  'co', 'cr', 'cs', 'cu', 'cv', 'cy', 'da', 'de', 'dv', 'dz', 'ee', 'el',
  'en', 'eo', 'es', 'et', 'eu', 'fa', 'ff', 'fi', 'fj', 'fo', 'fr', 'fy',
  'ga', 'gd', 'gl', 'gn', 'gu', 'gv', 'ha', 'he', 'hi', 'ho', 'hr', 'ht',
  'hu', 'hy', 'hz', 'ia', 'id', 'ie', 'ig', 'ii', 'ik', 'io', 'is', 'it',
  'iu', 'ja', 'jv', 'ka', 'kg', 'ki', 'kj', 'kk', 'kl', 'km', 'kn', 'ko',
  'kr', 'ks', 'ku', 'kv', 'kw', 'ky', 'la', 'lb', 'lg', 'li', 'ln', 'lo',
  'lt', 'lu', 'lv', 'mg', 'mh', 'mi', 'mk', 'ml', 'mn', 'mr', 'ms', 'mt',
  'my', 'na', 'nb', 'nd', 'ne', 'ng', 'nl', 'nn', 'no', 'nr', 'nv', 'ny',
  'oc', 'oj', 'om', 'or', 'os', 'pa', 'pi', 'pl', 'ps', 'pt', 'qu', 'rm',
  'rn', 'ro', 'ru', 'rw', 'sa', 'sc', 'sd', 'se', 'sg', 'sh', 'si', 'sk',
  'sl', 'sm', 'sn', 'so', 'sq', 'sr', 'ss', 'st', 'su', 'sv', 'sw', 'ta',
  'te', 'tg', 'th', 'ti', 'tk', 'tl', 'tn', 'to', 'tr', 'ts', 'tt', 'tw',
  'ty', 'ug', 'uk', 'ur', 'uz', 've', 'vi', 'vo', 'wa', 'wo', 'xh', 'yi',
  'yo', 'za', 'zh', 'zu',
] as const;

/**
 * EU official languages are kept as an explicit regression guard for the
 * Studio's current localization scope. This list is manuscript metadata,
 * not the interface-locale registry: every language below must remain
 * selectable even when its Studio UI translation is disabled or unavailable.
 */
export const EU_OFFICIAL_MANUSCRIPT_LANGUAGE_CODES = [
  'bg', 'cs', 'da', 'de', 'el', 'en', 'es', 'et', 'fi', 'fr', 'ga', 'hr',
  'hu', 'it', 'lt', 'lv', 'mt', 'nl', 'pl', 'pt', 'ro', 'sk', 'sl', 'sv',
] as const;

export const SPECIAL_MANUSCRIPT_LANGUAGE_TAGS = [
  'mul',
  'und',
  'zxx',
] as const;

export type Iso6391LanguageCode =
  (typeof ISO_639_1_LANGUAGE_CODES)[number];

export type SpecialManuscriptLanguageTag =
  (typeof SPECIAL_MANUSCRIPT_LANGUAGE_TAGS)[number];

export interface ManuscriptLanguageOption {
  tag: string;
  label: string;
  source: 'iso-639-1' | 'special';
}

const SPECIAL_LABELS: Record<
  'en' | 'hu' | 'de',
  Record<SpecialManuscriptLanguageTag, string>
> = {
  en: {
    mul: 'Multiple languages',
    und: 'Undetermined language',
    zxx: 'No linguistic content',
  },
  hu: {
    mul: 'Több nyelv',
    und: 'Meghatározatlan nyelv',
    zxx: 'Nincs nyelvi tartalom',
  },
  de: {
    mul: 'Mehrere Sprachen',
    und: 'Unbestimmte Sprache',
    zxx: 'Kein sprachlicher Inhalt',
  },
};

/**
 * Normalizes a manuscript language value as an IETF BCP 47 language tag.
 *
 * ISO 639-1 values such as `hu`, `en`, and `de` are valid BCP 47 primary
 * language subtags, while more specific tags such as `sr-Latn`, `zh-Hant`,
 * and `pt-BR` remain available when the manuscript needs them.
 */
export function normalizeManuscriptLanguageTag(
  value: string,
): string | null {
  const candidate = value.trim().replaceAll('_', '-');

  if (candidate.length === 0 || candidate.length > 100) {
    return null;
  }

  try {
    return Intl.getCanonicalLocales(candidate)[0] ?? null;
  } catch {
    return null;
  }
}

export function isValidManuscriptLanguageTag(
  value: string,
): boolean {
  return normalizeManuscriptLanguageTag(value) !== null;
}

export function isIso6391LanguageCode(
  value: string,
): value is Iso6391LanguageCode {
  return (ISO_639_1_LANGUAGE_CODES as readonly string[]).includes(value);
}

/**
 * Returns the complete ISO 639-1 language list plus the standard special
 * language tags used by bibliographic and scholarly metadata systems.
 *
 * This registry is deliberately independent from the Studio UI locale
 * registry. Adding, disabling or removing an interface translation must not
 * change which languages a scholarly manuscript can declare.
 *
 * Labels are generated in the current Studio UI language through the
 * platform's Intl.DisplayNames implementation. The stored value is always
 * the standardized language tag, never the localized display name.
 */
export function getManuscriptLanguageOptions(
  displayLocale: string,
): ManuscriptLanguageOption[] {
  const specialLocale =
    displayLocale === 'hu' || displayLocale === 'de'
      ? displayLocale
      : 'en';
  const displayNames = createLanguageDisplayNames(displayLocale);
  const standardOptions = ISO_639_1_LANGUAGE_CODES.map((tag) => ({
    tag,
    label: displayNames?.of(tag) ?? tag,
    source: 'iso-639-1' as const,
  }));
  const collator = new Intl.Collator(displayLocale, {
    sensitivity: 'base',
    usage: 'sort',
  });

  standardOptions.sort((left, right) =>
    collator.compare(left.label, right.label),
  );

  return [
    ...SPECIAL_MANUSCRIPT_LANGUAGE_TAGS.map((tag) => ({
      tag,
      label: SPECIAL_LABELS[specialLocale][tag],
      source: 'special' as const,
    })),
    ...standardOptions,
  ];
}

export function getManuscriptLanguageDisplayName(
  languageTag: string,
  displayLocale: string,
): string {
  const normalized = normalizeManuscriptLanguageTag(languageTag);

  if (!normalized) {
    return languageTag;
  }

  if (
    SPECIAL_MANUSCRIPT_LANGUAGE_TAGS.includes(
      normalized as SpecialManuscriptLanguageTag,
    )
  ) {
    const specialLocale =
      displayLocale === 'hu' || displayLocale === 'de'
        ? displayLocale
        : 'en';

    return SPECIAL_LABELS[specialLocale][
      normalized as SpecialManuscriptLanguageTag
    ];
  }

  return createLanguageDisplayNames(displayLocale)?.of(normalized) ?? normalized;
}

function createLanguageDisplayNames(
  displayLocale: string,
): Intl.DisplayNames | null {
  try {
    return new Intl.DisplayNames([displayLocale], {
      type: 'language',
      fallback: 'code',
    });
  } catch {
    try {
      return new Intl.DisplayNames(['en'], {
        type: 'language',
        fallback: 'code',
      });
    } catch {
      return null;
    }
  }
}
