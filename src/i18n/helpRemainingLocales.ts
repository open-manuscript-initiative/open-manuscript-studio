import type { HelpCopy } from './help';
import { getAdditionalHelpCopy } from './helpAdditional';
import { enrichAdditionalHelp } from './helpEnrichment';
import { applyMtRoSkSlHelpQuality } from './helpQualityMtRoSkSl';
const REMAINING_FULL_HELP_LOCALES=['bg','cs','el','et','fi','ga','hr','lt','lv','mt','ro','sk','sl'] as const;
export type RemainingFullHelpLocale=typeof REMAINING_FULL_HELP_LOCALES[number];
const set=new Set<string>(REMAINING_FULL_HELP_LOCALES);
export function isRemainingFullHelpLocale(locale:string):locale is RemainingFullHelpLocale{return set.has(locale)}
export function getRemainingFullHelpCopy(locale:RemainingFullHelpLocale):HelpCopy{const source=getAdditionalHelpCopy(locale);if(!source)throw new Error(`Missing localized help source for ${locale}`);const enriched=enrichAdditionalHelp(locale,source);if(locale==='mt'||locale==='ro'||locale==='sk'||locale==='sl')return applyMtRoSkSlHelpQuality(locale,enriched);return enriched;}
export const remainingFullHelpByLocale=Object.fromEntries(REMAINING_FULL_HELP_LOCALES.map(locale=>[locale,getRemainingFullHelpCopy(locale)])) as Record<RemainingFullHelpLocale,HelpCopy>;
