import {
  useMemo,
} from 'react';

import { stageManuscriptLanguageChange } from '../app/manuscriptLanguageActions';
import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import { useContentLanguagePreferences } from '../languages/languagePreferences';
import {
  getManuscriptLanguageDisplayName,
  getManuscriptLanguageOptions,
} from '../model/manuscriptLanguage';

interface ManuscriptLanguageCopy {
  description: string;
  current: string;
  standardHint: string;
}

const COPY: Record<'en' | 'hu' | 'de', ManuscriptLanguageCopy> = {
  en: {
    description: 'Choose the language of the manuscript from the list.',
    current: 'Current manuscript language',
    standardHint: 'The list follows the manuscript languages enabled in Settings. The stored value remains a standardized BCP 47 language tag.',
  },
  hu: {
    description: 'Válassza ki a kézirat nyelvét a listából.',
    current: 'A kézirat jelenlegi nyelve',
    standardHint: 'A lista a Beállításokban engedélyezett kéziratnyelveket követi. A tárolt érték továbbra is szabványos BCP 47 nyelvi címke.',
  },
  de: {
    description: 'Wählen Sie die Sprache des Manuskripts aus der Liste.',
    current: 'Aktuelle Manuskriptsprache',
    standardHint: 'Die Liste folgt den in den Einstellungen aktivierten Manuskriptsprachen. Gespeichert wird weiterhin ein standardisiertes BCP-47-Sprach-Tag.',
  },
};

function getCopy(uiLocale: string): ManuscriptLanguageCopy {
  if (uiLocale === 'hu' || uiLocale === 'de') return COPY[uiLocale];
  return COPY.en;
}

export function ManuscriptLanguageField() {
  const { locale: uiLocale, t } = useTranslation();
  const { manuscriptLanguages } = useContentLanguagePreferences();
  const manuscriptLocale = useStudioStore((state) => state.manuscript.locale);
  const copy = getCopy(uiLocale);
  const options = useMemo(
    () => getManuscriptLanguageOptions(uiLocale).filter(
      (option) => manuscriptLanguages.includes(option.tag) || option.tag === manuscriptLocale,
    ),
    [uiLocale, manuscriptLanguages, manuscriptLocale],
  );
  const currentDisplayName = getManuscriptLanguageDisplayName(manuscriptLocale, uiLocale);

  return (
    <section className="studio-manuscript-language-field">
      <label htmlFor="studio-manuscript-language">
        <span>{t('manuscript.documentLanguage')}</span>
        <select
          id="studio-manuscript-language"
          value={manuscriptLocale}
          onChange={(event) => stageManuscriptLanguageChange(event.target.value)}
        >
          {options.map((option) => (
            <option key={option.tag} value={option.tag}>
              {option.label} — {option.tag}
            </option>
          ))}
        </select>
      </label>

      <p className="studio-manuscript-language-description">{copy.description}</p>

      <div className="studio-manuscript-language-current">
        <span>{copy.current}</span>
        <strong>{currentDisplayName}</strong>
        <code>{manuscriptLocale}</code>
      </div>

      <p className="studio-manuscript-language-hint">{copy.standardHint}</p>
    </section>
  );
}
