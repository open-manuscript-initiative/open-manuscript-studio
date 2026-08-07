import { useMemo, useState } from 'react';

import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import {
  CITATION_LOCATOR_TYPES,
  formatBibliographyEntry,
} from '../model/citations';
import type {
  OmiCitationLocator,
  OmiCitationLocatorType,
} from '../types/omi';

interface CitationPickerProps {
  onInsert: (recordId: string, locator?: OmiCitationLocator) => void;
  onCancel: () => void;
}

export function CitationPicker({
  onInsert,
  onCancel,
}: CitationPickerProps) {
  const { t } = useTranslation();
  const records = useStudioStore(
    (state) => state.manuscript.bibliographicRecords ?? [],
  );
  const [query, setQuery] = useState('');
  const [selectedRecordId, setSelectedRecordId] = useState('');
  const [locatorType, setLocatorType] =
    useState<OmiCitationLocatorType>('page');
  const [locatorValue, setLocatorValue] = useState('');
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filtered = useMemo(
    () =>
      records.filter((record) => {
        if (!normalizedQuery) {
          return true;
        }

        return formatBibliographyEntry(record)
          .toLocaleLowerCase()
          .includes(normalizedQuery);
      }),
    [normalizedQuery, records],
  );

  function insert(): void {
    if (!selectedRecordId) {
      return;
    }

    const locator = locatorValue.trim()
      ? {
          type: locatorType,
          value: locatorValue.trim(),
        }
      : undefined;

    onInsert(selectedRecordId, locator);
  }

  return (
    <section
      className="omi-citation-picker"
      aria-label={t('citations.insertTitle')}
    >
      <header>
        <div>
          <strong>{t('citations.insertTitle')}</strong>
          <p>{t('citations.insertDescription')}</p>
        </div>
      </header>

      {records.length === 0 ? (
        <div className="omi-citation-empty-inline">
          <strong>{t('citations.noReferences')}</strong>
          <p>{t('citations.noReferencesHint')}</p>
        </div>
      ) : (
        <>
          <label className="omi-citation-search">
            <span>{t('citations.searchReferences')}</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('citations.searchPlaceholder')}
              autoFocus
            />
          </label>

          <div className="omi-citation-picker-results" role="listbox">
            {filtered.map((record) => (
              <button
                type="button"
                role="option"
                aria-selected={selectedRecordId === record.id}
                className={`omi-citation-picker-record${
                  selectedRecordId === record.id
                    ? ' omi-citation-picker-record--selected'
                    : ''
                }`}
                key={record.id}
                onClick={() => setSelectedRecordId(record.id)}
              >
                <strong>{record.title || t('citations.untitledReference')}</strong>
                <span>{formatBibliographyEntry(record)}</span>
              </button>
            ))}
          </div>

          <div className="omi-citation-locator-row">
            <label>
              <span>{t('citations.locatorType')}</span>
              <select
                value={locatorType}
                onChange={(event) =>
                  setLocatorType(event.target.value as OmiCitationLocatorType)
                }
              >
                {CITATION_LOCATOR_TYPES.map((type) => (
                  <option value={type} key={type}>
                    {locatorTypeLabel(type, t)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>{t('citations.locator')}</span>
              <input
                value={locatorValue}
                onChange={(event) => setLocatorValue(event.target.value)}
                placeholder={t('citations.locatorPlaceholder')}
              />
            </label>
          </div>
        </>
      )}

      <div className="omi-citation-picker-actions">
        <button
          type="button"
          className="studio-menu-secondary-action"
          onClick={onCancel}
        >
          {t('common.cancel')}
        </button>
        <button
          type="button"
          className="studio-menu-primary-action"
          disabled={!selectedRecordId}
          onClick={insert}
        >
          {t('citations.insert')}
        </button>
      </div>
    </section>
  );
}

function locatorTypeLabel(
  type: OmiCitationLocatorType,
  t: (key: any) => string,
): string {
  const key = `citations.locators.${type}`;

  try {
    return t(key);
  } catch {
    return type;
  }
}
