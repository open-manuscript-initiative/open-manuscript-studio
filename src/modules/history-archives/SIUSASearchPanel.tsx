import { getResearchModuleCopyByLocale } from '../moduleTranslationCatalog';
import { useState, type FormEvent } from 'react';
import { normalizeModuleLocale } from '../moduleLocale';

import { buildSiusaSearchUrl } from './siusaSearch';
import './europeanaSearch.css';

interface SIUSASearchPanelProps {
  locale: string;
}

const copyByLocale: Record<string, {
  title: string;
  description: string;
  label: string;
  placeholder: string;
  search: string;
}> = getResearchModuleCopyByLocale('history-archives-siusa-search-panel/copyByLocale');

export function SIUSASearchPanel({ locale }: SIUSASearchPanelProps) {
  const copy = copyByLocale[normalizeModuleLocale(locale)] ?? copyByLocale.en!;
  const [query, setQuery] = useState('');

  function runSearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) return;
    window.open(buildSiusaSearchUrl(normalizedQuery), '_blank', 'noopener,noreferrer');
  }

  return (
    <section className="europeana-search siusa-search" aria-labelledby="siusa-search-title">
      <div className="europeana-search-heading">
        <h5 id="siusa-search-title">{copy.title}</h5>
        <p>{copy.description}</p>
      </div>
      <form className="europeana-search-form" onSubmit={runSearch}>
        <label htmlFor="siusa-search-query">{copy.label}</label>
        <div className="europeana-search-controls">
          <input
            id="siusa-search-query"
            name="RicFrmRicSemplice"
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
