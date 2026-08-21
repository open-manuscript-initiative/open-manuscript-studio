import { Plus, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import {
  localeLabels,
  supportedLocales,
  useTranslation,
} from '../i18n';
import { useContentLanguagePreferences } from '../languages/languagePreferences';
import {
  getManuscriptLanguageDisplayName,
  getManuscriptLanguageOptions,
} from '../model/manuscriptLanguage';
import { CloudStorageSettings } from './CloudStorageSettings';

interface Copy {
  title: string;
  description: string;
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
    title: 'Language preferences',
    description: 'Interface, manuscript and metadata languages in one compact overview.',
    manuscriptTitle: 'Manuscript languages',
    manuscriptDescription: 'Languages normally used for manuscript documents.',
    metadataTitle: 'Metadata languages',
    metadataDescription: 'Languages available for abstracts, keywords and localized metadata.',
    addLanguage: 'Add language',
    chooseLanguage: 'Choose a language',
    remove: 'Remove',
    minimum: 'At least one language must remain enabled.',
  },
  hu: {
    title: 'Nyelvi beállítások',
    description: 'A felület, a kéziratok és a metaadatok nyelvei egyetlen áttekinthető nézetben.',
    manuscriptTitle: 'Kézirat nyelvei',
    manuscriptDescription: 'A kéziratokhoz rendszeresen használt nyelvek.',
    metadataTitle: 'Metaadat nyelvei',
    metadataDescription: 'Az absztraktokhoz, kulcsszavakhoz és lokalizált metaadatokhoz használható nyelvek.',
    addLanguage: 'Nyelv hozzáadása',
    chooseLanguage: 'Válasszon nyelvet',
    remove: 'Eltávolítás',
    minimum: 'Legalább egy nyelvnek engedélyezve kell maradnia.',
  },
  de: {
    title: 'Spracheinstellungen',
    description: 'Oberflächen-, Manuskript- und Metadatensprachen in einer kompakten Übersicht.',
    manuscriptTitle: 'Manuskriptsprachen',
    manuscriptDescription: 'Sprachen, die regelmäßig für Manuskripte verwendet werden.',
    metadataTitle: 'Metadatensprachen',
    metadataDescription: 'Sprachen für Abstracts, Schlagwörter und lokalisierte Metadaten.',
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
    <section className="studio-language-setting-row">
      <div className="studio-language-setting-heading">
        <div>
          <h5>{title}</h5>
          <p>{description}</p>
        </div>
      </div>

      <div className="studio-language-chip-list">
        {languages.map((language) => (
          <span className="studio-language-chip" key={language}>
            <strong>{getManuscriptLanguageDisplayName(language, uiLocale)}</strong>
            <code>{language}</code>
            <button
              type="button"
              className="studio-language-chip-remove"
              disabled={languages.length <= 1}
              aria-label={`${copy.remove}: ${language}`}
              title={languages.length <= 1 ? copy.minimum : copy.remove}
              onClick={() => removeLanguage(language)}
            >
              <X size={12} aria-hidden="true" />
            </button>
          </span>
        ))}
      </div>

      <div className="studio-language-compact-add">
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
          <Plus size={14} aria-hidden="true" />
          <span>{copy.addLanguage}</span>
        </button>
      </div>
    </section>
  );
}

export function ContentLanguageSettings() {
  const {
    locale,
    enabledLocales,
    setLocaleEnabled,
    t,
  } = useTranslation();
  const copy = getCopy(locale);
  const {
    manuscriptLanguages,
    metadataLanguages,
    setManuscriptLanguages,
    setMetadataLanguages,
  } = useContentLanguagePreferences();

  return (
    <>
      <section className="studio-settings-card studio-language-settings-card">
        <div className="studio-settings-card-header">
          <div>
            <h4>{copy.title}</h4>
            <p>{copy.description}</p>
          </div>
        </div>

        <div className="studio-language-settings-grid">
          <section className="studio-language-setting-row">
            <div className="studio-language-setting-heading">
              <div>
                <h5>{t('studio.settings.interfaceLanguages')}</h5>
                <p>{t('studio.settings.interfaceLanguagesDescription')}</p>
              </div>
            </div>
            <div className="studio-language-chip-list">
              {supportedLocales.map((supportedLocale) => {
                const enabled = enabledLocales.includes(supportedLocale);
                const current = supportedLocale === locale;
                return (
                  <label
                    className={`studio-language-chip studio-language-chip--toggle${current ? ' studio-language-chip--current' : ''}`}
                    key={supportedLocale}
                    title={current ? t('studio.settings.currentLanguage') : undefined}
                  >
                    <input
                      type="checkbox"
                      checked={enabled}
                      disabled={current}
                      onChange={(event) =>
                        setLocaleEnabled(supportedLocale, event.target.checked)
                      }
                    />
                    <strong>{localeLabels[supportedLocale]}</strong>
                    <code>{supportedLocale}</code>
                  </label>
                );
              })}
            </div>
            <small className="studio-language-inline-hint">
              {t('studio.settings.currentLanguageHint')}
            </small>
          </section>

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
        </div>
      </section>
      <CloudStorageSettings />
    </>
  );
}
