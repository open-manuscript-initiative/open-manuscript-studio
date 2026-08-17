import { getHelpCopy, type HelpCopy } from './help';
import { getAdditionalHelpCopy } from './helpAdditional';
import { enrichAdditionalHelp } from './helpEnrichment';
import { italianHelp } from './helpItalian';
import type { SupportedLocale } from './types';

export function getLocalizedHelpCopy(locale: SupportedLocale | string): HelpCopy {
  if (locale === 'it') return italianHelp;

  const additional = getAdditionalHelpCopy(locale);
  if (additional) return enrichAdditionalHelp(locale, additional);

  return enrichAdditionalHelp(locale, getHelpCopy(locale as SupportedLocale));
}
