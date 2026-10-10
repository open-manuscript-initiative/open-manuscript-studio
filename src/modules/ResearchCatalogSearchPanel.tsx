import { useState, type FormEvent } from 'react';
import { getResearchCatalogPreferencesKey, readVisibleResearchCatalogs, type ResearchCatalogId } from './researchCatalogPreferences';

type CatalogRecord = { id: string; title: string; description: string; url: string; meta?: string };

const catalogs: Record<ResearchCatalogId, { title: string; portalUrl: (query: string) => string; apiUrl?: (query: string) => string }> = {
  rism: { title: 'RISM', portalUrl: (query) => `https://rism.online/search/?${new URLSearchParams({ q: query, mode: 'sources' })}` },
  musicbrainz: { title: 'MusicBrainz', portalUrl: (query) => `https://musicbrainz.org/search?${new URLSearchParams({ query, type: 'recording', method: 'indexed' })}` },
  pleiades: { title: 'Pleiades', portalUrl: (query) => `https://pleiades.stoa.org/search?${new URLSearchParams({ SearchableText: query })}` },
  clarin: {
    title: 'CLARIN Virtual Language Observatory',
    portalUrl: (query) => `https://vlo.clarin.eu/search?${new URLSearchParams({ q: query })}`,
    apiUrl: (query) => `https://vlo.clarin.eu/api/records?${new URLSearchParams({ q: query, from: '0', size: '8' })}`,
  },
  eurostat: { title: 'Eurostat', portalUrl: (query) => `https://ec.europa.eu/eurostat/web/main/search?${new URLSearchParams({ query })}` },
  zenodo: {
    title: 'Zenodo',
    portalUrl: (query) => `https://zenodo.org/search?${new URLSearchParams({ q: query })}`,
    apiUrl: (query) => `https://zenodo.org/api/records?${new URLSearchParams({ q: query, size: '8' })}`,
  },
  europePmc: {
    title: 'Europe PMC',
    portalUrl: (query) => `https://europepmc.org/search?${new URLSearchParams({ query })}`,
    apiUrl: (query) => `https://www.ebi.ac.uk/europepmc/webservices/rest/search?${new URLSearchParams({ query, format: 'json', pageSize: '8' })}`,
  },
};

const copy = {
  hu: { searchLabel: 'Keresőkifejezés', placeholder: 'Név, cím vagy kulcsszó', search: 'Keresés', searching: 'Keresés…', open: 'Találatok megnyitása a szolgáltatónál', fallback: 'Keresés a szolgáltató oldalán', introApi: 'A keresés találatai itt jelennek meg.', introPortal: 'A keresés egy új lapon, a szolgáltató saját oldalán nyílik meg.', empty: 'Nincs találat.', failed: 'A keresés nem sikerült. Próbálja újra, vagy nyissa meg a szolgáltató keresőjét.', count: '{count} találat', sources: 'Kereshető adatbázisok', selectSource: 'Megjelenítés' },
  en: { searchLabel: 'Search terms', placeholder: 'Name, title, or keyword', search: 'Search', searching: 'Searching…', open: 'Open results at provider', fallback: 'Search on provider website', introApi: 'Search results appear here.', introPortal: 'The search opens on the provider website in a new tab.', empty: 'No results found.', failed: 'Search failed. Try again or open the provider search.', count: '{count} results', sources: 'Searchable databases', selectSource: 'Show' },
  de: { searchLabel: 'Suchbegriffe', placeholder: 'Name, Titel oder Stichwort', search: 'Suchen', searching: 'Suche läuft…', open: 'Treffer beim Anbieter öffnen', fallback: 'Auf der Anbieterwebsite suchen', introApi: 'Suchergebnisse erscheinen hier.', introPortal: 'Die Suche wird in einem neuen Tab auf der Website des Anbieters geöffnet.', empty: 'Keine Treffer.', failed: 'Die Suche ist fehlgeschlagen. Versuchen Sie es erneut oder öffnen Sie die Anbietersuche.', count: '{count} Treffer', sources: 'Durchsuchbare Datenbanken', selectSource: 'Anzeigen' },
} as const;

export function getResearchCatalogSearchUrl(catalog: ResearchCatalogId, query: string): string {
  return catalogs[catalog].portalUrl(query.trim());
}

export function ResearchCatalogSearchPanel({ catalogs: availableCatalogs, locale = 'hu', storageKey = 'default' }: { catalogs: ResearchCatalogId[]; locale?: string; storageKey?: string }) {
  const t = copy[locale as keyof typeof copy] ?? copy.en;
  const preferenceKey = getResearchCatalogPreferencesKey(storageKey);
  const [selected, setSelected] = useState<ResearchCatalogId[]>(() => readVisibleResearchCatalogs(availableCatalogs, window.localStorage.getItem(preferenceKey)));
  function toggle(catalog: ResearchCatalogId, visible: boolean) {
    const next = visible ? [...new Set([...selected, catalog])] : selected.filter((item) => item !== catalog);
    setSelected(next);
    try { window.localStorage.setItem(preferenceKey, JSON.stringify(next)); } catch { /* Private browsing may disable storage. */ }
  }

  return <div className="discipline-workspace">
    {availableCatalogs.length > 1 ? <fieldset className="discipline-catalog-selector"><legend>{t.sources}</legend>{availableCatalogs.map((catalog) => <label key={catalog}><input type="checkbox" checked={selected.includes(catalog)} onChange={(event) => toggle(catalog, event.target.checked)} />{catalogs[catalog].title}</label>)}</fieldset> : null}
    {availableCatalogs.filter((catalog) => selected.includes(catalog)).map((catalog) => <ResearchCatalogProviderSearch key={catalog} catalog={catalog} locale={locale} />)}
  </div>;
}

function ResearchCatalogProviderSearch({ catalog, locale = 'hu' }: { catalog: ResearchCatalogId; locale?: string }) {
  const t = copy[locale as keyof typeof copy] ?? copy.en;
  const provider = catalogs[catalog];
  const [query, setQuery] = useState('');
  const [records, setRecords] = useState<CatalogRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);
  const [failed, setFailed] = useState(false);
  const [portalReady, setPortalReady] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = query.trim();
    if (!normalized) return;
    if (!provider.apiUrl) {
      setPortalReady(true);
      return;
    }
    setBusy(true); setFailed(false); setSearched(true); setRecords([]);
    try {
      const response = await fetch(provider.apiUrl(normalized), { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload: unknown = await response.json();
      const normalizedPage = normalizeRecords(catalog, payload);
      setRecords(normalizedPage.records); setTotal(normalizedPage.total);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return <section className="discipline-workspace__section" data-catalog-search={catalog}>
    <div><h2>{provider.title}</h2><p className="discipline-workspace__hint">{provider.apiUrl ? t.introApi : t.introPortal}</p></div>
    <form className="discipline-workspace__grid" onSubmit={(event) => { void submit(event); }}>
      <label>{t.searchLabel}<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.placeholder} maxLength={240} required /></label>
      <div className="discipline-catalog-actions"><button type="submit" disabled={busy || !query.trim()}>{busy ? t.searching : t.search}</button>
        {provider.apiUrl ? <a href={getResearchCatalogSearchUrl(catalog, query)} target="_blank" rel="noopener noreferrer">{t.fallback}</a> : null}
        {!provider.apiUrl && portalReady ? <a href={getResearchCatalogSearchUrl(catalog, query)} target="_blank" rel="noopener noreferrer">{t.open}</a> : null}
      </div>
    </form>
    {failed ? <p role="alert">{t.failed}</p> : null}
    {searched && !failed ? <p aria-live="polite">{t.count.replace('{count}', new Intl.NumberFormat(locale).format(total))}</p> : null}
    {searched && !busy && !failed && records.length === 0 ? <p>{t.empty}</p> : null}
    {records.map((record) => <article className="discipline-workspace__card" key={record.id}>
      <h3><a href={record.url} target="_blank" rel="noopener noreferrer">{record.title}</a></h3>
      {record.meta ? <p className="discipline-muted">{record.meta}</p> : null}
      {record.description ? <p>{record.description}</p> : null}
      <a href={record.url} target="_blank" rel="noopener noreferrer">{t.open}</a>
    </article>)}
  </section>;
}

function normalizeRecords(catalog: ResearchCatalogId, payload: unknown): { records: CatalogRecord[]; total: number } {
  const root = asObject(payload);
  if (catalog === 'zenodo') {
    const hits = asObject(root.hits);
    const values = asArray(hits.hits);
    return { records: values.map((value, index) => {
      const item = asObject(value); const metadata = asObject(item.metadata);
      const creators = asArray(metadata.creators).map((creator) => asObject(creator).name).filter(isString).join(', ');
      const doi = isString(metadata.doi) ? metadata.doi : '';
      return { id: stringOr(item.id, `zenodo-${index}`), title: stringOr(metadata.title, 'Untitled record'), description: stripHtml(stringOr(metadata.description, '')), url: stringOr(asObject(item.links).html, doi ? `https://doi.org/${doi}` : 'https://zenodo.org'), meta: [creators, stringOr(metadata.publication_date, '')].filter(Boolean).join(' · ') };
    }), total: numberOr(hits.total, 0) };
  }
  if (catalog === 'europePmc') {
    const resultList = asObject(root.resultList); const values = asArray(resultList.result);
    return { records: values.map((value, index) => {
      const item = asObject(value); const doi = stringOr(item.doi, ''); const pmid = stringOr(item.pmid, '');
      const url = doi ? `https://doi.org/${encodeURIComponent(doi)}` : pmid ? `https://europepmc.org/article/MED/${encodeURIComponent(pmid)}` : `https://europepmc.org/search?query=${encodeURIComponent(stringOr(item.title, ''))}`;
      return { id: stringOr(item.id, `europepmc-${index}`), title: stringOr(item.title, 'Untitled publication'), description: stringOr(item.authorString, ''), url, meta: [stringOr(item.journalTitle, ''), stringOr(item.pubYear, '')].filter(Boolean).join(' · ') };
    }), total: numberOr(root.hitCount, 0) };
  }
  if (catalog === 'clarin') {
    if (!Array.isArray(root.records)) throw new Error('Unexpected CLARIN VLO API response');
    const values = root.records;
    const records = values.map((value, index) => {
      const item = asObject(value);
      const fields = asObject(item.fields);
      const id = stringOr(item.id, `clarin-${index}`);
      const title = fieldText(fields, 'name') || fieldText(fields, 'title') || id;
      const description = stripHtml(fieldText(fields, 'description'));
      const meta = [
        fieldText(fields, 'creator'),
        fieldText(fields, 'collection'),
        fieldText(fields, 'resourceClass'),
        fieldText(fields, 'languageCode'),
      ].filter(Boolean).join(' · ');
      return {
        id,
        title,
        description,
        url: `https://vlo.clarin.eu/record/#${encodeURIComponent(id)}`,
        meta,
      };
    });
    return { records, total: numberOr(root.numFound, values.length) };
  }
  const values = firstArray(root, ['records', 'items', 'results', 'hits']);
  const records = values.map((value, index) => {
    const item = asObject(value); const title = stringOr(item.title, stringOr(item.name, stringOr(item.id, 'Untitled resource')));
    const id = stringOr(item.id, `clarin-${index}`);
    const url = stringOr(item.url, stringOr(item.resourceUrl, `https://vlo.clarin.eu/api/records/${encodeURIComponent(id)}`));
    return { id, title, description: stringOr(item.description, stringOr(item.resourceType, '')), url, meta: stringOr(item.language, '') };
  });
  return { records, total: numberOr(root.totalElements, numberOr(root.total, numberOr(root.numberOfResults, records.length))) };
}

function fieldText(fields: Record<string, unknown>, key: string): string {
  const value = fields[key];
  const values = Array.isArray(value) ? value : [value];
  return values.filter(isString).map((item) => item.trim()).filter(Boolean).join(', ');
}
function asObject(value: unknown): Record<string, unknown> { return value && typeof value === 'object' ? value as Record<string, unknown> : {}; }
function asArray(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function firstArray(value: Record<string, unknown>, keys: string[]): unknown[] { for (const key of keys) { const found = asArray(value[key]); if (found.length) return found; } return []; }
function isString(value: unknown): value is string { return typeof value === 'string'; }
function stringOr(value: unknown, fallback: string): string { return typeof value === 'string' && value.trim() ? value : fallback; }
function numberOr(value: unknown, fallback: number): number { return typeof value === 'number' ? value : fallback; }
function stripHtml(value: string): string { return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(); }
