import type { HelpCopy } from './help';
import { getAdditionalHelpCopy } from './helpAdditional';
import { enrichAdditionalHelp } from './helpEnrichment';
import { applyBgCsElHelpQuality } from './helpQualityBgCsEl';
import { applyEtFiGaHelpQuality } from './helpQualityEtFiGa';
import { applyHrLtLvHelpQuality } from './helpQualityHrLtLv';
import { applyMtRoSkSlHelpQuality } from './helpQualityMtRoSkSl';

const REMAINING_FULL_HELP_LOCALES = [
  'bg', 'cs', 'el',
  'et', 'fi', 'ga',
  'hr', 'lt', 'lv',
  'mt', 'ro', 'sk', 'sl',
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

  const enriched = enrichAdditionalHelp(locale, localized);

  switch (locale) {
    case 'bg':
    case 'cs':
    case 'el':
      return applyBgCsElHelpQuality(locale, enriched);

    case 'et':
    case 'fi':
    case 'ga':
      return applyEtFiGaHelpQuality(locale, enriched);

    case 'hr':
    case 'lt':
    case 'lv':
      return applyHrLtLvHelpQuality(locale, enriched);

    case 'mt':
    case 'ro':
    case 'sk':
    case 'sl':
      return applyMtRoSkSlHelpQuality(locale, enriched);
  }
}

export const remainingFullHelpByLocale: Record<RemainingFullHelpLocale, HelpCopy> =
  Object.fromEntries(
    REMAINING_FULL_HELP_LOCALES.map((locale) => [locale, getRemainingFullHelpCopy(locale)]),
  ) as Record<RemainingFullHelpLocale, HelpCopy>;
