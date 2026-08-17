import { getHelpCopy, type HelpCopy } from './help';
import { getAdditionalHelpCopy } from './helpAdditional';
import { enrichAdditionalHelp } from './helpEnrichment';
import { italianHelp } from './helpItalian';
import {
  dutchHelp,
  frenchHelp,
  polishHelp,
  portugueseHelp,
  spanishHelp,
} from './helpWesternEurope';
import { danishHelp, swedishHelp } from './helpNorthernEurope';
import type { SupportedLocale } from './types';

const fullHelpByLocale: Partial<Record<string, HelpCopy>> = {
  fr: frenchHelp,
  es: spanishHelp,
  pt: portugueseHelp,
  nl: dutchHelp,
  pl: polishHelp,
  da: danishHelp,
  sv: swedishHelp,
};

export function getLocalizedHelpCopy(locale: SupportedLocale | string): HelpCopy {
  if (locale === 'it') return italianHelp;

  const full = fullHelpByLocale[locale];
  if (full) return full;

  const additional = getAdditionalHelpCopy(locale);
  if (additional) return enrichAdditionalHelp(locale, additional);

  return enrichAdditionalHelp(locale, getHelpCopy(locale as SupportedLocale));
}
