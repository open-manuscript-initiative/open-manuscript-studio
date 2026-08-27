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

export function getDetailedHelpLabels(locale: string): DetailedHelpLabels {
  return generatedDetailedHelpLabels[locale] ?? getBuiltInDetailedHelpLabels(locale);
}

export function getDetailedHelpTopic(locale: string, title: string): DetailedHelpTopic | null {
  const match = title.match(/^\s*(\d+)/);
  if (match) {
    const index = Number(match[1]);
    if (Number.isFinite(index)) {
      const generated = generatedDetailedHelpByLocale[locale]?.[index];
      if (generated) return generated;
    }
  }
  return getBuiltInDetailedHelpTopic(locale, title);
}
