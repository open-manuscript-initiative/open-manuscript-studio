import { applyReturnedSupplementalOverlay } from './returnedTranslationOverlay';
import { getHelpCopy, type HelpCopy } from './help';
import { getAdditionalHelpCopy } from './helpAdditional';
import { appendDirectSubmissionHelp } from './helpDirectSubmission';
import { enrichAdditionalHelp } from './helpEnrichment';
import { appendMusicImportHelp } from './helpMusicImport';
import { italianHelp } from './helpItalian';
import {
  dutchHelp,
  frenchHelp,
  polishHelp,
  portugueseHelp,
  spanishHelp,
} from './helpWesternEurope';
import { danishHelp, swedishHelp } from './helpNorthernEurope';
import { remainingFullHelpByLocale } from './helpRemainingLocales';
import type { SupportedLocale } from './types';

const fullHelpByLocale: Partial<Record<string, HelpCopy>> = {
  fr: frenchHelp,
  es: spanishHelp,
  pt: portugueseHelp,
  nl: dutchHelp,
  pl: polishHelp,
  da: danishHelp,
  sv: swedishHelp,
  ...remainingFullHelpByLocale,
};

function buildLocalizedHelpCopy(locale: SupportedLocale | string): HelpCopy {
  let copy: HelpCopy;

  if (locale === 'it') {
    copy = italianHelp;
  } else {
    const full = fullHelpByLocale[locale];
    if (full) {
      copy = full;
    } else {
      // Compatibility path for any locale source introduced before it is promoted
      // into the explicit full-help map above.
      const additional = getAdditionalHelpCopy(locale);
      copy = additional
        ? enrichAdditionalHelp(locale, additional)
        : enrichAdditionalHelp(locale, getHelpCopy(locale as SupportedLocale));
    }
  }

  return appendMusicImportHelp(locale, appendDirectSubmissionHelp(locale, copy));
}

export function getLocalizedHelpCopy(locale: SupportedLocale | string): HelpCopy {
  const current = buildLocalizedHelpCopy(locale);
  const english = locale === 'en' ? current : buildLocalizedHelpCopy('en');
  return applyReturnedSupplementalOverlay(locale, 'help', current, english);
}
