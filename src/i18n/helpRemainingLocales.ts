import type { HelpCopy } from './help';
import { getAdditionalHelpCopy } from './helpAdditional';
import { enrichAdditionalHelp } from './helpEnrichment';

/**
 * Full-help bridge for the remaining locales.
 *
 * The legacy locale files contain the twenty localized core chapters. The
 * enrichment layer adds the current author-signature chapter and localized
 * practical guidance. Keeping this mapping explicit means every supported
 * locale is resolved as a first-class full help locale rather than silently
 * falling through to a generic fallback.
 */
const REMAINING_FULL_HELP_LOCALES = [
  'bg', 'cs', 'el', 'et', 'fi', 'ga', 'hr', 'lt', 'lv', 'mt', 'ro', 'sk', 'sl',
] as const;

export type RemainingFullHelpLocale = typeof REMAINING_FULL_HELP_LOCALES[number];

const remainingLocaleSet = new Set<string>(REMAINING_FULL_HELP_LOCALES);

export function isRemainingFullHelpLocale(locale: string): locale is RemainingFullHelpLocale {
  return remainingLocaleSet.has(locale);
}

export function getRemainingFullHelpCopy(locale: RemainingFullHelpLocale): HelpCopy {
  const localized = getAdditionalHelpCopy(locale);
  if (!localized) {
    throw new Error(`Missing localized help source for ${locale}`);
  }
  return enrichAdditionalHelp(locale, localized);
}

export const remainingFullHelpByLocale: Record<RemainingFullHelpLocale, HelpCopy> =
  Object.fromEntries(
    REMAINING_FULL_HELP_LOCALES.map((locale) => [locale, getRemainingFullHelpCopy(locale)]),
  ) as Record<RemainingFullHelpLocale, HelpCopy>;
