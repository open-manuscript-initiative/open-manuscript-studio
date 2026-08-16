import { getHelpCopy, type HelpCopy } from './help';
import { getAdditionalHelpCopy } from './helpAdditional';
import { italianHelp } from './helpItalian';
import type { SupportedLocale } from './types';

export function getLocalizedHelpCopy(locale: SupportedLocale | string): HelpCopy {
  if (locale === 'it') return italianHelp;
  return getAdditionalHelpCopy(locale) ?? getHelpCopy(locale as SupportedLocale);
}
