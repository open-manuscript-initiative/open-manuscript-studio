import { getResearchModuleCopyByLocale } from '../moduleTranslationCatalog';
import { normalizeModuleLocale } from '../moduleLocale';
import { useState, type FormEvent } from 'react';

import {
  SefariaSearchError,
  searchSefariaTexts,
  type SefariaSearchRecord,
} from './sefariaApi';
import './religiousTexts.css';

interface ReligiousTextsCopy {
  heading: string;
  intro: string;
  searchLabel: string;
  placeholder: string;
  search: string;
  searching: string;
  count: string;
  empty: string;
  openSource: string;
  editions: string;
  loadingMore: string;
  loadMore: string;
  queryRequired: string;
  failed: string;
  serviceError: string;
  otherSources: string;
  portalNote: string;
  sourceNames: { bible: string; quran: string; buddhist: string };
}

const copyByLocale: Record<string, ReligiousTextsCopy> = getResearchModuleCopyByLocale('religious-texts-religious-texts-panel/copyByLocale');

const otherSources = [
  { id: 'bible', url: 'https://www.bible.com/' },
  { id: 'quran', url: 'https://quran.com/' },
  { id: 'buddhist', url: 'https://library.bdrc.io/' },
] as const;

export function ReligiousTextsPanel({ locale }: { locale: string }) {
  const copy = copyByLocale[normalizeModuleLocale(locale)] ?? copyByLocale.en!;
  const [query, setQuery] = useState('');
  const [records, setRecords] = useState<SefariaSearchRecord[]>([]);
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
      const result = await searchSefariaTexts(normalizedQuery);
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
      const result = await searchSefariaTexts(query.trim(), nextCursor);
      setRecords((current) => {
        const ids = new Set(current.map(({ id }) => id));
        return [...current, ...result.items.filter(({ id }) => !ids.has(id))];
      });
      setTotalResults(result.totalResults);
      setNextCursor(result.nextCursor);
    } catch (searchError) {
      setError(getErrorMessage(searchError, copy));
    } finally {
      setIsLoadingMore(false);
    }
  }

  return (
    <div className="religious-texts-panel">
      <section className="religious-texts-provider">
        <header className="religious-texts-heading">
          <h5>{copy.heading}</h5>
          <p>{copy.intro}</p>
        </header>
        <form className="religious-texts-form" onSubmit={runSearch}>
          <label htmlFor="religious-texts-query">{copy.searchLabel}</label>
          <div className="religious-texts-controls">
            <input
              id="religious-texts-query"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={copy.placeholder}
              minLength={2}
              maxLength={240}
              required
            />
            <button type="submit" disabled={isSearching}>
              {isSearching ? copy.searching : copy.search}
            </button>
          </div>
        </form>

        {error ? <p className="religious-texts-error" role="alert">{error}</p> : null}
        {hasSearched && !error ? (
          <p className="religious-texts-count" aria-live="polite">
            {copy.count.replace('{count}', new Intl.NumberFormat(locale).format(totalResults))}
          </p>
        ) : null}
        {hasSearched && !isSearching && records.length === 0 && !error ? (
          <p className="religious-texts-empty">{copy.empty}</p>
        ) : null}

        <div className="religious-texts-results" aria-live="polite">
          {records.map((record) => (
            <article className="religious-texts-result" key={record.id}>
              <div className="religious-texts-result-header">
                <h6>{record.reference}</h6>
                {record.language ? <span lang={record.language}>{record.language}</span> : null}
              </div>
              <p>{record.excerpt}</p>
              {record.edition ? <p><strong>{copy.editions}:</strong> {record.edition}</p> : null}
              {record.categories.length ? <p>{record.categories.join(' › ')}</p> : null}
              <a href={record.sourceUrl} target="_blank" rel="noopener noreferrer">
                {copy.openSource}
              </a>
            </article>
          ))}
        </div>

        {nextCursor ? (
          <button
            className="religious-texts-more"
            type="button"
            onClick={loadMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? copy.loadingMore : copy.loadMore}
          </button>
        ) : null}
      </section>

      <section className="religious-texts-external">
        <h5>{copy.otherSources}</h5>
        <p>{copy.portalNote}</p>
        <ul>
          {otherSources.map(({ id, url }) => (
            <li key={id}>
              <a href={url} target="_blank" rel="noopener noreferrer">
                {copy.sourceNames[id]}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function getErrorMessage(error: unknown, copy: ReligiousTextsCopy): string {
  if (error instanceof SefariaSearchError && error.code === 'SEFARIA_SEARCH_FAILED') {
    return copy.serviceError;
  }
  return copy.failed;
}
