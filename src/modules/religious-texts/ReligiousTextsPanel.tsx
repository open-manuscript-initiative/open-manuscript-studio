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

const copyByLocale: Record<string, ReligiousTextsCopy> = {
  hu: {
    heading: 'Sefaria – zsidó szövegek és kommentárok',
    intro: 'Élő keresés a Sefaria könyvtárában. A találatok rövid szövegrészletet, hivatkozást és kiadásadatot mutatnak, az eredeti forrásra mutató hivatkozással.',
    searchLabel: 'Keresés szövegben',
    placeholder: 'Kifejezés, név vagy szöveghely',
    search: 'Keresés',
    searching: 'Keresés…',
    count: '{count} találat',
    empty: 'Nincs találat erre a keresésre.',
    openSource: 'Megnyitás a Sefarián',
    editions: 'Kiadás',
    loadingMore: 'Betöltés…',
    loadMore: 'További találatok',
    queryRequired: 'Legalább két karaktert adjon meg.',
    failed: 'A keresés most nem sikerült. Próbálja meg később.',
    serviceError: 'A Sefaria keresőszolgáltatása átmenetileg nem érhető el.',
    otherSources: 'Más vallási szöveggyűjtemények',
    portalNote: 'Ezek külső keresők; a keresést az adott szolgáltatás oldalán kell elindítani.',
    sourceNames: { bible: 'Biblia – Bible.com', quran: 'Korán – Quran.com', buddhist: 'Buddhista szövegek – BUDA' },
  },
  en: {
    heading: 'Sefaria – Jewish texts and commentaries',
    intro: 'Live search across the Sefaria Library. Results show a short excerpt, citation, and edition details, with a link to the original source.',
    searchLabel: 'Search text',
    placeholder: 'Phrase, name, or passage',
    search: 'Search',
    searching: 'Searching…',
    count: '{count} results',
    empty: 'No results matched this search.',
    openSource: 'Open in Sefaria',
    editions: 'Edition',
    loadingMore: 'Loading…',
    loadMore: 'Load more results',
    queryRequired: 'Enter at least two characters.',
    failed: 'The search could not be completed. Try again later.',
    serviceError: 'Sefaria search is temporarily unavailable.',
    otherSources: 'Other religious text libraries',
    portalNote: 'These are external search portals; start the search on the provider’s site.',
    sourceNames: { bible: 'Bible – Bible.com', quran: 'Qur’an – Quran.com', buddhist: 'Buddhist texts – BUDA' },
  },
  de: {
    heading: 'Sefaria – jüdische Texte und Kommentare',
    intro: 'Live-Suche in der Sefaria-Bibliothek. Die Treffer zeigen einen kurzen Auszug, einen Beleg und Angaben zur Ausgabe mit einem Link zur Originalquelle.',
    searchLabel: 'Volltextsuche',
    placeholder: 'Begriff, Name oder Textstelle',
    search: 'Suchen',
    searching: 'Suche läuft…',
    count: '{count} Ergebnisse',
    empty: 'Keine Treffer für diese Suche.',
    openSource: 'In Sefaria öffnen',
    editions: 'Ausgabe',
    loadingMore: 'Wird geladen…',
    loadMore: 'Weitere Ergebnisse laden',
    queryRequired: 'Geben Sie mindestens zwei Zeichen ein.',
    failed: 'Die Suche konnte nicht abgeschlossen werden. Bitte versuchen Sie es später erneut.',
    serviceError: 'Die Sefaria-Suche ist vorübergehend nicht verfügbar.',
    otherSources: 'Weitere religiöse Textsammlungen',
    portalNote: 'Dies sind externe Suchportale; starten Sie die Suche auf der Website des Anbieters.',
    sourceNames: { bible: 'Bibel – Bible.com', quran: 'Koran – Quran.com', buddhist: 'Buddhistische Texte – BUDA' },
  },
};

const otherSources = [
  { id: 'bible', url: 'https://www.bible.com/' },
  { id: 'quran', url: 'https://quran.com/' },
  { id: 'buddhist', url: 'https://library.bdrc.io/' },
] as const;

export function ReligiousTextsPanel({ locale }: { locale: string }) {
  const copy = copyByLocale[locale] ?? copyByLocale.en!;
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
