import { useMemo, useState } from 'react';

import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import { getCslRenderingCopy } from '../i18n/cslRendering';
import {
  CITATION_LOCATOR_TYPES,
  formatBibliographyEntry,
} from '../model/citations';
import type {
  OmiCitationLocator,
  OmiCitationLocatorType,
} from '../types/omi';

export interface CitationPickerSelection {
  recordId: string;
  locator?: OmiCitationLocator;
}

interface SelectedRecordState {
  recordId: string;
  locatorType: OmiCitationLocatorType;
  locatorValue: string;
}

interface CitationPickerProps {
  onInsert: (items: CitationPickerSelection[]) => void;
  onCancel: () => void;
}

export function CitationPicker({
  onInsert,
  onCancel,
}: CitationPickerProps) {
  const { t, locale } = useTranslation();
  const copy = getCslRenderingCopy(locale);
  const records = useStudioStore(
    (state) => state.manuscript.bibliographicRecords ?? [],
  );
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<SelectedRecordState[]>([]);
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
  const recordMap = useMemo(
    () => new Map(records.map((record) => [record.id, record])),
    [records],
  );

  function toggleRecord(recordId: string): void {
    setSelected((current) => {
      if (current.some((item) => item.recordId === recordId)) {
        return current.filter((item) => item.recordId !== recordId);
      }

      return [
        ...current,
        {
          recordId,
          locatorType: 'page',
          locatorValue: '',
        },
      ];
    });
  }

  function updateSelected(
    recordId: string,
    input: Partial<Pick<SelectedRecordState, 'locatorType' | 'locatorValue'>>,
  ): void {
    setSelected((current) =>
      current.map((item) =>
        item.recordId === recordId
          ? {
              ...item,
              ...input,
            }
          : item,
      ),
    );
  }

  function insert(): void {
    if (selected.length === 0) {
      return;
    }

    onInsert(
      selected.map((item) => ({
        recordId: item.recordId,
        locator: item.locatorValue.trim()
          ? {
              type: item.locatorType,
              value: item.locatorValue.trim(),
            }
          : undefined,
      })),
    );
  }

  return (
    <section
      className="omi-citation-picker"
      aria-label={t('citations.insertTitle')}
    >
      <header>
        <div>
          <strong>{t('citations.insertTitle')}</strong>
          <p>{copy.clusterHint}</p>
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

          <div className="omi-citation-picker-results" role="listbox" aria-multiselectable="true">
            {filtered.map((record) => {
              const isSelected = selected.some((item) => item.recordId === record.id);

              return (
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`omi-citation-picker-record${
                    isSelected
                      ? ' omi-citation-picker-record--selected'
                      : ''
                  }`}
                  key={record.id}
                  onClick={() => toggleRecord(record.id)}
                >
                  <strong>{record.title || t('citations.untitledReference')}</strong>
                  <span>{formatBibliographyEntry(record)}</span>
                  <small>
                    {isSelected ? copy.removeFromCluster : copy.addToCluster}
                  </small>
                </button>
              );
            })}
          </div>

          {selected.length > 0 ? (
            <section className="omi-citation-cluster-selection">
              <div className="omi-citation-cluster-selection-heading">
                <strong>{copy.selectedSources}</strong>
                <span>{selected.length}</span>
              </div>

              {selected.map((item, index) => {
                const record = recordMap.get(item.recordId);

                return (
                  <div className="omi-citation-selected-source" key={item.recordId}>
                    <div className="omi-citation-selected-source-title">
                      <span>{index + 1}.</span>
                      <strong>
                        {record?.title || t('citations.untitledReference')}
                      </strong>
                    </div>

                    <div className="omi-citation-locator-row">
                      <label>
                        <span>{t('citations.locatorType')}</span>
                        <select
                          value={item.locatorType}
                          onChange={(event) =>
                            updateSelected(item.recordId, {
                              locatorType: event.target.value as OmiCitationLocatorType,
                            })
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
                          value={item.locatorValue}
                          onChange={(event) =>
                            updateSelected(item.recordId, {
                              locatorValue: event.target.value,
                            })
                          }
                          placeholder={t('citations.locatorPlaceholder')}
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </section>
          ) : null}
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
          disabled={selected.length === 0}
          onClick={insert}
        >
          {selected.length > 1
            ? `${t('citations.insert')} (${selected.length})`
            : t('citations.insert')}
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
