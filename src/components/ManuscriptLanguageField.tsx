import {
  useEffect,
  useId,
  useMemo,
  useState,
} from 'react';

import { stageManuscriptLanguageChange } from '../app/manuscriptLanguageActions';
import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import type { SupportedLocale } from '../i18n';
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

const COPY: Record<SupportedLocale, ManuscriptLanguageCopy> = {
  en: {
    description:
      'Choose the language of the manuscript. The stored value is a standardized BCP 47 language tag.',
    placeholder: 'Search a language or enter a language tag',
    invalid: 'Enter a valid BCP 47 language tag.',
    current: 'Current manuscript language',
    standardHint:
      'The list includes all ISO 639-1 languages. More specific or historical BCP 47 tags such as grc, sr-Latn, zh-Hant or pt-BR are also accepted.',
  },
  hu: {
    description:
      'Válassza ki a kézirat nyelvét. A tárolt érték szabványos BCP 47 nyelvi címke.',
    placeholder: 'Nyelv keresése vagy nyelvi kód megadása',
    invalid: 'Adjon meg érvényes BCP 47 nyelvi címkét.',
    current: 'A kézirat jelenlegi nyelve',
    standardHint:
      'A lista az összes ISO 639-1 nyelvet tartalmazza. Részletesebb vagy történeti BCP 47 címkék, például grc, sr-Latn, zh-Hant vagy pt-BR is használhatók.',
  },
  de: {
    description:
      'Wählen Sie die Sprache des Manuskripts. Gespeichert wird ein standardisiertes BCP-47-Sprach-Tag.',
    placeholder: 'Sprache suchen oder Sprach-Tag eingeben',
    invalid: 'Geben Sie ein gültiges BCP-47-Sprach-Tag ein.',
    current: 'Aktuelle Manuskriptsprache',
    standardHint:
      'Die Liste enthält alle ISO-639-1-Sprachen. Genauere oder historische BCP-47-Tags wie grc, sr-Latn, zh-Hant oder pt-BR werden ebenfalls akzeptiert.',
  },
};

export function ManuscriptLanguageField() {
  const { locale: uiLocale, t } = useTranslation();
  const manuscriptLocale = useStudioStore(
    (state) => state.manuscript.locale,
  );
  const [draft, setDraft] = useState(manuscriptLocale);
  const [invalid, setInvalid] = useState(false);
  const listId = useId();
  const descriptionId = useId();
  const errorId = useId();
  const copy = COPY[uiLocale];
  const options = useMemo(
    () => getManuscriptLanguageOptions(uiLocale),
    [uiLocale],
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
