import { Edit3, ExternalLink, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import { stageSetCitationStyle } from '../app/citationActions';
import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import { getCslRenderingCopy } from '../i18n/cslRendering';
import {
  countCitationsForRecord,
  formatBibliographyEntry,
  getBibliographicIdentifier,
} from '../model/citations';
import {
  CITATION_STYLE_IDS,
  DEFAULT_CITATION_STYLE,
  renderBibliography,
} from '../model/cslRendering';
import type { OmiCitationStyleId } from '../types/omi';
import { BibliographicRecordEditor } from './BibliographicRecordEditor';
import { ReferenceLookupPanel } from './ReferenceLookupPanel';

export function ReferencesPanel() {
  const { t, locale } = useTranslation();
  const copy = getCslRenderingCopy(locale);
  const manuscript = useStudioStore((state) => state.manuscript);
  const records = manuscript.bibliographicRecords ?? [];
  const citationStyle = manuscript.citationStyle ?? DEFAULT_CITATION_STYLE;
  const [query, setQuery] = useState('');
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
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
  const citedRecordIds = useMemo(
    () => new Set(manuscript.citations.map((citation) => citation.target)),
    [manuscript.citations],
  );
  const bibliography = useMemo(
    () =>
      renderBibliography(
        records.filter((record) => citedRecordIds.has(record.id)),
        citationStyle,
        manuscript.locale,
      ),
    [citationStyle, citedRecordIds, manuscript.locale, records],
  );

  if (creating || editingRecordId) {
    return (
      <section className="studio-menu-view">
        <BibliographicRecordEditor
          recordId={editingRecordId ?? undefined}
          onDone={() => {
            setCreating(false);
            setEditingRecordId(null);
          }}
        />
      </section>
    );
  }

  return (
    <section className="studio-menu-view omi-references-panel">
      <div className="studio-menu-view-header">
        <div>
          <h3>{t('citations.referencesTitle')}</h3>
          <p>{t('citations.referencesDescription')}</p>
        </div>

        <button
          type="button"
          className="studio-menu-primary-action"
          onClick={() => setCreating(true)}
        >
          <Plus size={16} aria-hidden="true" />
          {t('citations.addReference')}
        </button>
      </div>

      <section className="omi-csl-style-panel">
        <div>
          <h4>{copy.styleTitle}</h4>
          <p>{copy.styleDescription}</p>
        </div>
        <label>
          <span>{copy.styleTitle}</span>
          <select
            value={citationStyle}
            onChange={(event) =>
              stageSetCitationStyle(event.target.value as OmiCitationStyleId)
            }
          >
            {CITATION_STYLE_IDS.map((style) => (
              <option value={style} key={style}>
                {copy.styleNames[style]}
              </option>
            ))}
          </select>
        </label>
        <small>{copy.styleProfileNote}</small>
      </section>

      <ReferenceLookupPanel />

      {records.length > 0 ? (
        <label className="omi-reference-search">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">{t('citations.searchReferences')}</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('citations.searchPlaceholder')}
          />
        </label>
      ) : null}

      {records.length === 0 ? (
        <div className="omi-reference-empty">
          <strong>{t('citations.emptyLibrary')}</strong>
          <p>{t('citations.emptyLibraryHint')}</p>
        </div>
      ) : (
        <ol className="omi-reference-list">
          {filtered.map((record) => {
            const citationCount = countCitationsForRecord(
              manuscript.citations,
              record.id,
            );
            const doi = getBibliographicIdentifier(record, 'doi');
            const onlineUrl = record.url || (doi ? `https://doi.org/${doi}` : undefined);

            return (
              <li className="omi-reference-item" key={record.id}>
                <div className="omi-reference-item-main">
                  <div className="omi-reference-item-heading">
                    <strong>
                      {record.title || t('citations.untitledReference')}
                    </strong>
                    <span className="omi-reference-status">
                      {citationCount} {t('citations.occurrences')}
                    </span>
                  </div>
                  <p>{formatBibliographyEntry(record)}</p>
                  <div className="omi-reference-item-meta">
                    <code>{record.id}</code>
                    <span>{record.type}</span>
                    <span>{record.status}</span>
                  </div>
                </div>

                <div className="omi-reference-item-actions">
                  {onlineUrl ? (
                    <a
                      className="omi-reference-icon-action"
                      href={onlineUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={t('citations.openSource')}
                      title={t('citations.openSource')}
                    >
                      <ExternalLink size={16} aria-hidden="true" />
                    </a>
                  ) : null}
                  <button
                    type="button"
                    className="omi-reference-icon-action"
                    onClick={() => setEditingRecordId(record.id)}
                    aria-label={t('citations.editReference')}
                    title={t('citations.editReference')}
                  >
                    <Edit3 size={16} aria-hidden="true" />
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {bibliography.length > 0 ? (
        <section className="omi-bibliography-preview omi-bibliography-preview--csl">
          <h4>{copy.bibliographyTitle}</h4>
          <p>{copy.bibliographyDescription}</p>
          <ol>
            {bibliography.map((entry) => (
              <li key={entry.recordId}>{entry.text}</li>
            ))}
          </ol>
        </section>
      ) : null}
    </section>
  );
}
