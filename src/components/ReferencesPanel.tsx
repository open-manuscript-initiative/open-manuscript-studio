import { Edit3, ExternalLink, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import {
  countCitationsForRecord,
  formatBibliographyEntry,
  getBibliographicIdentifier,
} from '../model/citations';
import { BibliographicRecordEditor } from './BibliographicRecordEditor';
import { ReferenceLookupPanel } from './ReferenceLookupPanel';

export function ReferencesPanel() {
  const { t } = useTranslation();
  const manuscript = useStudioStore((state) => state.manuscript);
  const records = manuscript.bibliographicRecords ?? [];
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

      {records.length > 0 ? (
        <section className="omi-bibliography-preview">
          <h4>{t('manuscript.bibliography')}</h4>
          <p>{t('citations.bibliographyPreviewDescription')}</p>
          <ol>
            {records
              .filter((record) =>
                manuscript.citations.some(
                  (citation) => citation.target === record.id,
                ),
              )
              .sort((a, b) =>
                formatBibliographyEntry(a).localeCompare(
                  formatBibliographyEntry(b),
                ),
              )
              .map((record) => (
                <li key={record.id}>{formatBibliographyEntry(record)}</li>
              ))}
          </ol>
        </section>
      ) : null}
    </section>
  );
}
