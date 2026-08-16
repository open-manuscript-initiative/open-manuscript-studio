import {
  useEffect,
  useId,
  useMemo,
  useState,
} from 'react';

import { stageManuscriptLanguageChange } from '../app/manuscriptLanguageActions';
import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import { useContentLanguagePreferences } from '../languages/languagePreferences';
import {
  getManuscriptLanguageDisplayName,
  getManuscriptLanguageOptions,
  normalizeManuscriptLanguageTag,
} from '../model/manuscriptLanguage';

interface ManuscriptLanguageCopy {
  description: string;
  placeholder: string;
  invalid: string;
  current: string;
  standardHint: string;
}

const COPY: Record<'en' | 'hu' | 'de', ManuscriptLanguageCopy> = {
  en: {
    description:
      'Choose the language of the manuscript. The stored value is a standardized BCP 47 language tag.',
    placeholder: 'Search a language or enter a language tag',
    invalid: 'Enter a valid BCP 47 language tag.',
    current: 'Current manuscript language',
    standardHint:
      'Suggestions follow the manuscript languages enabled in Settings. Any valid BCP 47 tag can still be entered directly.',
  },
  hu: {
    description:
      'Válassza ki a kézirat nyelvét. A tárolt érték szabványos BCP 47 nyelvi címke.',
    placeholder: 'Nyelv keresése vagy nyelvi kód megadása',
    invalid: 'Adjon meg érvényes BCP 47 nyelvi címkét.',
    current: 'A kézirat jelenlegi nyelve',
    standardHint:
      'A javaslatok a Beállításokban engedélyezett kéziratnyelveket követik. Bármely érvényes BCP 47 címke közvetlenül is megadható.',
  },
  de: {
    description:
      'Wählen Sie die Sprache des Manuskripts. Gespeichert wird ein standardisiertes BCP-47-Sprach-Tag.',
    placeholder: 'Sprache suchen oder Sprach-Tag eingeben',
    invalid: 'Geben Sie ein gültiges BCP-47-Sprach-Tag ein.',
    current: 'Aktuelle Manuskriptsprache',
    standardHint:
      'Die Vorschläge folgen den in den Einstellungen aktivierten Manuskriptsprachen. Gültige BCP-47-Tags können weiterhin direkt eingegeben werden.',
  },
};

function getCopy(uiLocale: string): ManuscriptLanguageCopy {
  if (uiLocale === 'hu' || uiLocale === 'de') {
    return COPY[uiLocale];
  }

  return COPY.en;
}

export function ManuscriptLanguageField() {
  const { locale: uiLocale, t } = useTranslation();
  const { manuscriptLanguages } = useContentLanguagePreferences();
  const manuscriptLocale = useStudioStore(
    (state) => state.manuscript.locale,
  );
  const [draft, setDraft] = useState(manuscriptLocale);
  const [invalid, setInvalid] = useState(false);
  const listId = useId();
  const descriptionId = useId();
  const errorId = useId();
  const copy = getCopy(uiLocale);
  const options = useMemo(
    () =>
      getManuscriptLanguageOptions(uiLocale).filter(
        (option) =>
          manuscriptLanguages.includes(option.tag) ||
          option.tag === manuscriptLocale,
      ),
    [uiLocale, manuscriptLanguages, manuscriptLocale],
  );
  const currentDisplayName = getManuscriptLanguageDisplayName(
    manuscriptLocale,
    uiLocale,
  );

  useEffect(() => {
    setDraft(manuscriptLocale);
    setInvalid(false);
  }, [manuscriptLocale]);

  function commitDraft(): void {
    const normalized = normalizeManuscriptLanguageTag(draft);

    if (!normalized) {
      setInvalid(true);
      return;
    }

    setInvalid(false);
    setDraft(normalized);
    stageManuscriptLanguageChange(normalized);
  }

  return (
    <section className="studio-manuscript-language-field">
      <label htmlFor="studio-manuscript-language">
        <span>{t('manuscript.documentLanguage')}</span>
        <input
          id="studio-manuscript-language"
          type="text"
          list={listId}
          value={draft}
          aria-invalid={invalid}
          aria-describedby={
            invalid
              ? `${descriptionId} ${errorId}`
              : descriptionId
          }
          autoComplete="off"
          spellCheck={false}
          placeholder={copy.placeholder}
          onChange={(event) => {
            setDraft(event.target.value);
            setInvalid(false);
          }}
          onBlur={commitDraft}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commitDraft();
              event.currentTarget.blur();
            }

            if (event.key === 'Escape') {
              setDraft(manuscriptLocale);
              setInvalid(false);
              event.currentTarget.blur();
            }
          }}
        />
      </label>

      <datalist id={listId}>
        {options.map((option) => (
          <option
            key={option.tag}
            value={option.tag}
            label={`${option.label} — ${option.tag}`}
          />
        ))}
      </datalist>

      <p
        className="studio-manuscript-language-description"
        id={descriptionId}
      >
        {copy.description}
      </p>

      {invalid ? (
        <p
          className="studio-manuscript-language-error"
          id={errorId}
          role="alert"
        >
          {copy.invalid}
        </p>
      ) : null}

      <div className="studio-manuscript-language-current">
        <span>{copy.current}</span>
        <strong>{currentDisplayName}</strong>
        <code>{manuscriptLocale}</code>
      </div>

      <p className="studio-manuscript-language-hint">
        {copy.standardHint}
      </p>
    </section>
  );
}
