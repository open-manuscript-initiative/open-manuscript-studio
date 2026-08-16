import { getHelpCopy, type HelpCopy } from './help';
import { getAdditionalHelpCopy } from './helpAdditional';
import type { SupportedLocale } from './types';

export function getLocalizedHelpCopy(locale: SupportedLocale | string): HelpCopy {
  return getAdditionalHelpCopy(locale) ?? getHelpCopy(locale as SupportedLocale);
}
