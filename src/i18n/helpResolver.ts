import { appendHealthResearchHelp } from './helpHealthResearch';
import { appendMathematicsHelp } from './helpMathematics';
import { applyReturnedSupplementalOverlay } from './returnedTranslationOverlay';
import { getHelpCopy, type HelpCopy } from './help';
import { getAdditionalHelpCopy } from './helpAdditional';
import { appendDirectSubmissionHelp } from './helpDirectSubmission';
import { enrichAdditionalHelp } from './helpEnrichment';
import { appendMusicImportHelp } from './helpMusicImport';
import { appendCollaborationHelp } from './helpCollaboration';
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

  return appendHealthResearchHelp(locale, appendMathematicsHelp(locale, appendMusicImportHelp(locale, appendDirectSubmissionHelp(locale, appendCollaborationHelp(locale, copy)))));
}

function consolidateModuleHelp(locale: string, copy: HelpCopy): HelpCopy {
  const moduleIndex = copy.topics.findIndex((topic) => /^21[.):-]?\s/.test(topic.title) && /module|modul|módul|moduł|модул|模块|モジュール/i.test(topic.title));
  if (moduleIndex < 0) return copy;

  const moduleTopic = copy.topics[moduleIndex];
  const sections = [...(moduleTopic.sections ?? [])];
  const kept = copy.topics.filter((topic, index) => {
    if (index === moduleIndex) return true;
    const title = topic.title;
    const isLegalSearch = /^22[.):-]?\s/.test(title);
    const isModuleDetail = /latex|musicxml|midi|psychology|medical sciences|gesundheit|psychologie|orvostudomány|pszichológia/i.test(title);
    if (!isLegalSearch && !isModuleDetail) return true;
    sections.push({
      title: title.replace(/^\s*\d+[.):-]?\s*/, '').trim(),
      body: topic.body,
      ...(topic.tips?.length ? { tips: topic.tips } : {}),
    });
    return false;
  });

  const heading = locale === 'hu' ? '21. Modulok' : locale === 'de' ? '21. Module' : '21. Modules';
  kept[moduleIndex] = { ...moduleTopic, title: heading, sections };
  return { ...copy, topics: kept };
}

export function getLocalizedHelpCopy(locale: SupportedLocale | string): HelpCopy {
  const current = buildLocalizedHelpCopy(locale);
  const english = locale === 'en' ? current : buildLocalizedHelpCopy('en');
  return consolidateModuleHelp(locale, applyReturnedSupplementalOverlay(locale, 'help', current, english));
}
