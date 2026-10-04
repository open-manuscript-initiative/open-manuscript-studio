import { useState, type FormEvent } from 'react';

import type { EuropeanaSearchCopy } from '../moduleShellTranslations';

import {
  searchEuropeanaRecords,
  type EuropeanaSearchRecord,
} from './europeanaApi';
import './europeanaSearch.css';

interface EuropeanaSearchPanelProps {
  copy: EuropeanaSearchCopy;
  locale: string;
}

export function EuropeanaSearchPanel({ copy, locale }: EuropeanaSearchPanelProps) {
  const [query, setQuery] = useState('');
  const [records, setRecords] = useState<EuropeanaSearchRecord[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  async function runSearch(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) {
      setError(copy.queryRequired);
      return;
    }

    setIsSearching(true);
    setError(null);
    setHasSearched(true);
    setRecords([]);
    setNextCursor(null);

    try {
      const result = await searchEuropeanaRecords(normalizedQuery);
      setRecords(result.items);
      setTotalResults(result.totalResults);
      setNextCursor(result.nextCursor);
    } catch (searchError) {
      setError(getErrorMessage(searchError, copy));
    } finally {
      setIsSearching(false);
    }
  }

  async function loadMore(): Promise<void> {
    if (!nextCursor || isLoadingMore) return;

    setIsLoadingMore(true);
    setError(null);
    try {
      const result = await searchEuropeanaRecords(query.trim(), nextCursor);
      setRecords((current) => {
        const ids = new Set(current.map(({ id }) => id));
        return [...current, ...result.items.filter(({ id }) => !ids.has(id))];
      });
      setTotalResults(result.totalResults);
      setNextCursor(result.nextCursor);
    } catch (searchError) {
      setError(getErrorMessage(searchError, copy.setupRequired));
    } finally {
      setIsLoadingMore(false);
    }
  }

  return (
    <div className="europeana-search">
      <div className="europeana-search-heading">
        <h5>{copy.provider}</h5>
        <p>{copy.sourceRecord}</p>
      </div>

      <form className="europeana-search-form" onSubmit={runSearch}>
        <label htmlFor="europeana-search-query">{copy.searchLabel}</label>
        <div className="europeana-search-controls">
          <input
            id="europeana-search-query"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={copy.searchPlaceholder}
            maxLength={300}
            minLength={2}
            required
          />
          <button type="submit" disabled={isSearching}>
            {isSearching ? copy.searching : copy.searchButton}
          </button>
        </div>
      </form>

      {error ? (
        <p className="europeana-search-error" role="alert">
          <strong>{copy.errorTitle}</strong> {error}
        </p>
      ) : null}

      {hasSearched && !error ? (
        <p className="europeana-search-count" aria-live="polite">
          {copy.resultCount.replace('{count}', new Intl.NumberFormat(locale).format(totalResults))}
        </p>
      ) : null}

      {hasSearched && !isSearching && records.length === 0 && !error ? (
        <p className="europeana-search-empty">{copy.noResults}</p>
      ) : null}

      <div className="europeana-search-results" aria-live="polite">
        {records.map((record) => (
          <article className="europeana-search-result" key={record.id}>
            {record.thumbnailUrl ? (
              <img
                className="europeana-search-thumbnail"
                src={record.thumbnailUrl}
                alt=""
                loading="lazy"
              />
            ) : null}
            <div className="europeana-search-result-content">
              <h6>
                <a href={record.recordUrl} target="_blank" rel="noopener noreferrer">
                  {record.title}
                </a>
              </h6>
              {record.creator ? <p><strong>{record.creator}</strong></p> : null}
              {record.date ? <p>{record.date}</p> : null}
              {record.description ? <p>{record.description}</p> : null}
              {record.provider ? <p>{copy.dataProvider}: {record.provider}</p> : null}
              {record.rights ? <p className="europeana-search-rights">{copy.rights}: {record.rights}</p> : null}
              {record.sourceUrl ? (
                <a className="europeana-search-source" href={record.sourceUrl} target="_blank" rel="noopener noreferrer">
                  {copy.openRecord}
                </a>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      {nextCursor && records.length < totalResults ? (
        <button
          className="europeana-search-more"
          type="button"
          onClick={loadMore}
          disabled={isLoadingMore}
        >
          {isLoadingMore ? copy.loadingMore : copy.loadMore}
        </button>
      ) : null}
    </div>
  );
}

function getErrorMessage(error: unknown, copy: EuropeanaSearchCopy): string {
  if (error instanceof Error && error.message.includes('EUROPEANA_NOT_CONFIGURED')) {
    return copy.setupRequired;
  }
  return copy.searchFailed;
}
