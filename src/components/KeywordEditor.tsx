import { Plus, X } from 'lucide-react';
import {
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent,
} from 'react';

import {
  setLocalizedAbstract,
  setLocalizedKeywords,
} from '../app/localizedMetadataActions';
import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import { useContentLanguagePreferences } from '../languages/languagePreferences';
import {
  addKeywords,
  removeKeyword,
} from '../model/keywords';
import '../styles/scholarly-metadata.css';
import type { OmiLocale } from '../types/omi';
import { ScholarlyMetadataPanel } from './ScholarlyMetadataPanel';

export function KeywordEditor() {
  const { t } = useTranslation();
  const { metadataLanguages } = useContentLanguagePreferences();
  const manuscript = useStudioStore((state) => state.manuscript);
  const [metadataLocale, setMetadataLocale] = useState<OmiLocale>(
    manuscript.locale,
  );
  const [draft, setDraft] = useState('');

  useEffect(() => {
    const primaryAbstract = manuscript.abstract ?? '';
    const localizedPrimary = manuscript.abstracts?.[manuscript.locale] ?? '';
    if (primaryAbstract !== localizedPrimary) {
      setLocalizedAbstract(manuscript.locale, primaryAbstract);
    }
  }, [manuscript.abstract, manuscript.abstracts, manuscript.locale]);

  const locales = useMemo(() => {
    const values = new Set<string>([
      manuscript.locale,
      ...metadataLanguages,
      ...Object.keys(manuscript.abstracts ?? {}),
      ...Object.keys(manuscript.keywordsByLocale ?? {}),
    ]);
    return [...values];
  }, [
    manuscript.locale,
    metadataLanguages,
    manuscript.abstracts,
    manuscript.keywordsByLocale,
  ]);

  useEffect(() => {
    if (!locales.includes(metadataLocale)) {
      setMetadataLocale(locales[0] ?? manuscript.locale);
      setDraft('');
    }
  }, [locales, metadataLocale, manuscript.locale]);

  const keywords =
    manuscript.keywordsByLocale?.[metadataLocale] ??
    (metadataLocale === manuscript.locale ? manuscript.keywords : []);
  const localizedAbstract =
    manuscript.abstracts?.[metadataLocale] ??
    (metadataLocale === manuscript.locale ? manuscript.abstract ?? '' : '');
  const isPrimaryLocale = metadataLocale === manuscript.locale;

  function addDraftKeywords(): void {
    if (!draft.trim()) return;
    const nextKeywords = addKeywords(keywords, draft);
    setLocalizedKeywords(metadataLocale, nextKeywords);
    setDraft('');
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
  ): void {
    if (event.nativeEvent.isComposing) return;

    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addDraftKeywords();
    }
  }

  return (
    <>
      <div className="omi-keyword-editor">
        <label>
          <span>{t('common.language')}</span>
          <select
            value={metadataLocale}
            onChange={(event) => {
              setMetadataLocale(event.target.value);
              setDraft('');
            }}
          >
            {locales.map((locale) => (
              <option value={locale} key={locale}>
                {locale.toUpperCase()}
                {locale === manuscript.locale ? ' •' : ''}
              </option>
            ))}
          </select>
        </label>

        {!isPrimaryLocale ? (
          <label>
            <span>{t('manuscript.abstract')}</span>
            <textarea
              value={localizedAbstract}
              onChange={(event) =>
                setLocalizedAbstract(metadataLocale, event.target.value)
              }
            />
          </label>
        ) : null}

        <span className="omi-keyword-editor-label">
          {t('manuscript.keywords')} ({metadataLocale.toUpperCase()})
        </span>

        {keywords.length > 0 ? (
          <div
            className="omi-keyword-chip-list"
            aria-label={`${t('manuscript.keywords')} ${metadataLocale}`}
          >
            {keywords.map((keyword) => (
              <span className="omi-keyword-chip" key={keyword}>
                <span>{keyword}</span>
                <button
                  type="button"
                  onClick={() =>
                    setLocalizedKeywords(
                      metadataLocale,
                      removeKeyword(keywords, keyword),
                    )
                  }
                  aria-label={`${t('common.delete')}: ${keyword}`}
                  title={`${t('common.delete')}: ${keyword}`}
                >
                  <X size={13} aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        ) : null}

        <div className="omi-keyword-input-row">
          <input
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`${t('manuscript.keywords')} (${metadataLocale.toUpperCase()})`}
            aria-label={`${t('manuscript.keywords')} ${metadataLocale}`}
          />
          <button
            type="button"
            className="studio-menu-secondary-action"
            disabled={!draft.trim()}
            onClick={addDraftKeywords}
          >
            <Plus size={15} aria-hidden="true" />
            {t('common.add')}
          </button>
        </div>
      </div>

      <ScholarlyMetadataPanel />
    </>
  );
}
