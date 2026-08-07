import { Plus, X } from 'lucide-react';
import {
  useState,
  type KeyboardEvent,
} from 'react';

import { stageKeywordChange } from '../app/keywordActions';
import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import {
  addKeywords,
  removeKeyword,
} from '../model/keywords';

export function KeywordEditor() {
  const { t } = useTranslation();
  const keywords = useStudioStore(
    (state) => state.manuscript.keywords,
  );
  const [draft, setDraft] = useState('');

  function addDraftKeywords(): void {
    if (!draft.trim()) {
      return;
    }

    const nextKeywords = addKeywords(keywords, draft);
    stageKeywordChange(nextKeywords);
    setDraft('');
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
  ): void {
    if (event.nativeEvent.isComposing) {
      return;
    }

    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addDraftKeywords();
    }
  }

  return (
    <div className="omi-keyword-editor">
      <span className="omi-keyword-editor-label">
        {t('manuscript.keywords')}
      </span>

      {keywords.length > 0 ? (
        <div
          className="omi-keyword-chip-list"
          aria-label={t('manuscript.keywords')}
        >
          {keywords.map((keyword) => (
            <span className="omi-keyword-chip" key={keyword}>
              <span>{keyword}</span>
              <button
                type="button"
                onClick={() =>
                  stageKeywordChange(
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
          placeholder={t('manuscript.keywords')}
          aria-label={t('manuscript.keywords')}
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
  );
}
