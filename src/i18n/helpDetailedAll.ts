import {
  getDetailedHelpLabels as getBuiltInDetailedHelpLabels,
  getDetailedHelpTopic as getBuiltInDetailedHelpTopic,
  type DetailedHelpLabels,
  type DetailedHelpTopic,
} from './helpDetailed';
import {
  generatedDetailedHelpByLocale,
  generatedDetailedHelpLabels,
} from './helpDetailed.generated';
import { applyReturnedSupplementalPathOverlay } from './returnedTranslationOverlay';

export function getDetailedHelpLabels(locale: string): DetailedHelpLabels {
  const current =
    generatedDetailedHelpLabels[locale] ?? getBuiltInDetailedHelpLabels(locale);
  const english =
    generatedDetailedHelpLabels.en ?? getBuiltInDetailedHelpLabels('en');
  return applyReturnedSupplementalPathOverlay(
    locale,
    'detailedHelp',
    'labels',
    current,
    english,
  );
}

export function getDetailedHelpTopic(locale: string, title: string): DetailedHelpTopic | null {
  const match = title.match(/^\s*(\d+)/);
  if (match) {
    const index = Number(match[1]);
    if (Number.isFinite(index)) {
      const current =
        generatedDetailedHelpByLocale[locale]?.[index]
        ?? getBuiltInDetailedHelpTopic(locale, title);
      if (!current) return null;

      const english =
        generatedDetailedHelpByLocale.en?.[index]
        ?? getBuiltInDetailedHelpTopic('en', String(index));
      if (!english) return current;

      return applyReturnedSupplementalPathOverlay(
        locale,
        'detailedHelp',
        `topics.${index}`,
        current,
        english,
      );
    }
  }
  return getBuiltInDetailedHelpTopic(locale, title);
}
