import { Plus, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useTranslation } from '../i18n';
import { useContentLanguagePreferences } from '../languages/languagePreferences';
import {
  getManuscriptLanguageDisplayName,
  getManuscriptLanguageOptions,
} from '../model/manuscriptLanguage';

interface Copy {
  manuscriptTitle: string;
  manuscriptDescription: string;
  metadataTitle: string;
  metadataDescription: string;
  addLanguage: string;
  chooseLanguage: string;
  remove: string;
  minimum: string;
}

const COPY: Record<'en' | 'hu' | 'de', Copy> = {
  en: {
    manuscriptTitle: 'Manuscript languages',
    manuscriptDescription:
      'Choose the languages you normally use for manuscript documents. You can change this list at any time while writing.',
    metadataTitle: 'Metadata languages',
    metadataDescription:
      'Choose the languages available for localized abstracts, keywords and extended metadata. Existing manuscript data is never deleted when a language is removed from this preference list.',
    addLanguage: 'Add language',
    chooseLanguage: 'Choose a language',
    remove: 'Remove',
    minimum: 'At least one language must remain enabled.',
  },
  hu: {
    manuscriptTitle: 'Kézirat nyelvei',
    manuscriptDescription:
      'Válassza ki a kéziratokhoz rendszeresen használt nyelveket. A lista a kézirat írása közben is bármikor módosítható.',
    metadataTitle: 'Metaadat nyelvei',
    metadataDescription:
      'Válassza ki az absztraktokhoz, kulcsszavakhoz és kibővített metaadatokhoz használható nyelveket. Egy nyelv kikapcsolása soha nem törli a kéziratban már meglévő adatokat.',
    addLanguage: 'Nyelv hozzáadása',
    chooseLanguage: 'Válasszon nyelvet',
    remove: 'Eltávolítás',
    minimum: 'Legalább egy nyelvnek engedélyezve kell maradnia.',
  },
  de: {
    manuscriptTitle: 'Manuskriptsprachen',
    manuscriptDescription:
      'Wählen Sie die Sprachen, die Sie normalerweise für Manuskripte verwenden. Die Liste kann während des Schreibens jederzeit geändert werden.',
    metadataTitle: 'Metadatensprachen',
    metadataDescription:
      'Wählen Sie die Sprachen für lokalisierte Abstracts, Schlagwörter und erweiterte Metadaten. Bereits vorhandene Manuskriptdaten werden beim Entfernen einer Sprache niemals gelöscht.',
    addLanguage: 'Sprache hinzufügen',
    chooseLanguage: 'Sprache auswählen',
    remove: 'Entfernen',
    minimum: 'Mindestens eine Sprache muss aktiviert bleiben.',
  },
};

function getCopy(locale: string): Copy {
  if (locale === 'hu' || locale === 'de') return COPY[locale];
  return COPY.en;
}

interface LanguageListEditorProps {
  title: string;
  description: string;
  languages: string[];
  onChange: (languages: string[]) => void;
  uiLocale: string;
  copy: Copy;
}

function LanguageListEditor({
  title,
  description,
  languages,
  onChange,
  uiLocale,
  copy,
}: LanguageListEditorProps) {
  const [candidate, setCandidate] = useState('');
  const options = useMemo(
    () => getManuscriptLanguageOptions(uiLocale),
    [uiLocale],
  );
  const availableOptions = options.filter(
    (option) => !languages.includes(option.tag),
  );

  function addCandidate(): void {
    if (!candidate || languages.includes(candidate)) return;
    onChange([...languages, candidate]);
    setCandidate('');
  }

  function removeLanguage(language: string): void {
    if (languages.length <= 1) return;
    onChange(languages.filter((item) => item !== language));
  }

  return (
    <section className="studio-settings-card">
      <div className="studio-settings-card-header">
        <div>
          <h4>{title}</h4>
          <p>{description}</p>
        </div>
      </div>

      <div className="studio-language-preference-list">
        {languages.map((language) => (
          <div className="studio-language-preference" key={language}>
            <span className="studio-language-preference-copy">
              <strong>
                {getManuscriptLanguageDisplayName(language, uiLocale)}
              </strong>
              <small>{language}</small>
            </span>
            <code>{language}</code>
            <button
              type="button"
              className="studio-menu-secondary-action"
              disabled={languages.length <= 1}
              aria-label={`${copy.remove}: ${language}`}
              title={
                languages.length <= 1 ? copy.minimum : copy.remove
              }
              onClick={() => removeLanguage(language)}
            >
              <X size={14} aria-hidden="true" />
              {copy.remove}
            </button>
          </div>
        ))}
      </div>

      <div className="omi-keyword-input-row">
        <select
          value={candidate}
          aria-label={copy.chooseLanguage}
          onChange={(event) => setCandidate(event.target.value)}
        >
          <option value="">{copy.chooseLanguage}</option>
          {availableOptions.map((option) => (
            <option value={option.tag} key={option.tag}>
              {option.label} — {option.tag}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="studio-menu-secondary-action"
          disabled={!candidate}
          onClick={addCandidate}
        >
          <Plus size={15} aria-hidden="true" />
          {copy.addLanguage}
        </button>
      </div>
    </section>
  );
}

export function ContentLanguageSettings() {
  const { locale } = useTranslation();
  const copy = getCopy(locale);
  const {
    manuscriptLanguages,
    metadataLanguages,
    setManuscriptLanguages,
    setMetadataLanguages,
  } = useContentLanguagePreferences();

  return (
    <>
      <LanguageListEditor
        title={copy.manuscriptTitle}
        description={copy.manuscriptDescription}
        languages={manuscriptLanguages}
        onChange={setManuscriptLanguages}
        uiLocale={locale}
        copy={copy}
      />
      <LanguageListEditor
        title={copy.metadataTitle}
        description={copy.metadataDescription}
        languages={metadataLanguages}
        onChange={setMetadataLanguages}
        uiLocale={locale}
        copy={copy}
      />
    </>
  );
}
