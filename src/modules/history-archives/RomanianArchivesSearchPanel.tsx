import { getResearchModuleCopyByLocale } from '../moduleTranslationCatalog';
import { useState, type FormEvent } from 'react';
import { normalizeModuleLocale } from '../moduleLocale';

import { buildRomanianArchivesSearchUrl } from './romanianArchives';
import './europeanaSearch.css';

interface RomanianArchivesSearchPanelProps {
  locale: string;
}

const copyByLocale: Record<string, {
  title: string;
  description: string;
  label: string;
  placeholder: string;
  search: string;
}> = getResearchModuleCopyByLocale('history-archives-romanian-archives-search-panel/copyByLocale');

export function RomanianArchivesSearchPanel({ locale }: RomanianArchivesSearchPanelProps) {
  const copy = copyByLocale[normalizeModuleLocale(locale)] ?? copyByLocale.en!;
  const [query, setQuery] = useState('');

  function runSearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) return;
    window.open(buildRomanianArchivesSearchUrl(normalizedQuery), '_blank', 'noopener,noreferrer');
  }

  return (
    <section className="europeana-search romanian-archives-search" aria-labelledby="romanian-archives-search-title">
      <div className="europeana-search-heading">
        <h5 id="romanian-archives-search-title">{copy.title}</h5>
        <p>{copy.description}</p>
      </div>
      <form className="europeana-search-form" onSubmit={runSearch}>
        <label htmlFor="romanian-archives-search-query">{copy.label}</label>
        <div className="europeana-search-controls">
          <input
            id="romanian-archives-search-query"
            name="ts"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={copy.placeholder}
            maxLength={300}
            minLength={2}
            required
          />
          <button type="submit">{copy.search}</button>
        </div>
      </form>
    </section>
  );
}
