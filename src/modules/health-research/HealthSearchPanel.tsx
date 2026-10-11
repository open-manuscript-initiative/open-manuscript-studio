import { useEffect, useRef, useState, type FormEvent } from 'react';
import { stageAddBibliographicRecord } from '../../app/citationActions';
import { useStudioStore } from '../../app/useStudioStore';
import type { HealthDiscipline } from './model';
import { HEALTH_PROVIDERS, HEALTH_PROVIDER_NAMES, searchHealthDatabase, type HealthProvider, type HealthSearchPage } from './searchApi';
import { healthResultToReference, hasHealthReference, psychArchivesSearchUrl } from './searchReferences';
import { healthSearchCopy } from './searchCopy';

export function HealthSearchPanel({ discipline, locale, storageKey, workspaceId }: { discipline: HealthDiscipline; locale: string; storageKey: string; workspaceId: string }) {
  const t = healthSearchCopy[locale === 'hu' || locale === 'de' ? locale : 'en'];
  const records = useStudioStore(state => state.manuscript.bibliographicRecords ?? []);
  const key = `omi:health-search-providers:v1:${storageKey}`;
  const [providers, setProviders] = useState<HealthProvider[]>(() => {
    try { const raw: unknown = JSON.parse(localStorage.getItem(key) ?? 'null'); return Array.isArray(raw) ? HEALTH_PROVIDERS.filter(p => raw.includes(p)) : [...HEALTH_PROVIDERS]; } catch { return [...HEALTH_PROVIDERS]; }
  });
  const [query, setQuery] = useState('');
  const [pages, setPages] = useState<Partial<Record<HealthProvider, HealthSearchPage>>>({});
  const [errors, setErrors] = useState<HealthProvider[]>([]);
  const [busy, setBusy] = useState(false);
  const [searchedQuery, setSearchedQuery] = useState('');
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; controller.current?.abort(); }, []);
  function changeProviders(next: HealthProvider[]) {
    generation.current++; controller.current?.abort(); setBusy(false); setPages({}); setErrors([]); setSearchedQuery('');
    setProviders(next); try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* Preferences remain usable in memory. */ }
  }
  async function search(event: FormEvent) {
    event.preventDefault(); if (busy || query.trim().length < 2 || !providers.length) return;
    const current = ++generation.current; controller.current?.abort(); const abort = new AbortController(); controller.current = abort;
    setBusy(true); setPages({}); setErrors([]); setSearchedQuery(query.trim());
    const results = await Promise.allSettled(providers.map(provider => searchHealthDatabase(discipline, workspaceId, provider, query.trim(), undefined, abort.signal)));
    if (current !== generation.current) return;
    const next: Partial<Record<HealthProvider, HealthSearchPage>> = {}; const failed: HealthProvider[] = [];
    results.forEach((result, i) => { if (result.status === 'fulfilled') next[providers[i]] = result.value; else failed.push(providers[i]); });
    setPages(next); setErrors(failed); setBusy(false);
  }
  async function more(provider: HealthProvider) {
    const previous = pages[provider]; if (!previous?.nextCursor || busy) return;
    const current = generation.current; setBusy(true); setErrors(previousErrors => previousErrors.filter(p => p !== provider));
    try {
      const result = await searchHealthDatabase(discipline, workspaceId, provider, searchedQuery, previous.nextCursor, controller.current?.signal);
      if (current === generation.current) setPages(currentPages => ({ ...currentPages, [provider]: { ...result, items: [...previous.items, ...result.items.filter(item => !previous.items.some(old => old.id === item.id))] } }));
    } catch { if (current === generation.current) setErrors(previousErrors => [...previousErrors, provider]); }
    finally { if (current === generation.current) setBusy(false); }
  }
  const canSearch = !busy && providers.length > 0 && query.trim().length >= 2 && query.length <= 240;
  return <section className="discipline-workspace__section health-research-search">
    <h2>{t.title}</h2><p>{t.consent}</p>
    <fieldset><legend>{t.providers}</legend>{HEALTH_PROVIDERS.map(provider => <label key={provider}>
      <input type="checkbox" checked={providers.includes(provider)} onChange={event => changeProviders(event.target.checked ? [...providers, provider] : providers.filter(p => p !== provider))} /> {HEALTH_PROVIDER_NAMES[provider]}
    </label>)}</fieldset>
    <form onSubmit={event => void search(event)}><label>{t.query}<input value={query} maxLength={240} onChange={event => setQuery(event.target.value)} /></label>
      <button type="submit" disabled={!canSearch}>{busy ? t.searching : t.search}</button>
    </form>
    {!providers.length && <p>{t.none}</p>}
    <div aria-live="polite">{errors.map(provider => <p role="alert" key={provider}>{HEALTH_PROVIDER_NAMES[provider]}: {t.failed}</p>)}</div>
    {HEALTH_PROVIDERS.map(provider => {
      const page = pages[provider]; if (!page) return null;
      return <section key={provider} aria-label={HEALTH_PROVIDER_NAMES[provider]}>
        <h3>{HEALTH_PROVIDER_NAMES[provider]} — {page.totalResults} {t.results}</h3>
        {!page.items.length && <p>{t.empty}</p>}
        {page.items.map(item => <article className="discipline-workspace__card" key={item.id}>
          <h4>{item.title}</h4><p>{item.authors.join('; ')} {item.journal} {item.year}</p>
          <p>{item.kind === 'trial' ? `NCT: ${item.id} · ${item.status}` : [item.pmid && `PMID: ${item.pmid}`, item.doi && `DOI: ${item.doi}`, item.kind === 'preprint' && 'Preprint'].filter(Boolean).join(' · ')}</p>
          <p>{t.rights}: {item.rights || t.unknown}</p>
          <a href={item.url} target="_blank" rel="noopener noreferrer">{t.open}</a>{' '}
          <button type="button" disabled={hasHealthReference(records, item)} onClick={() => stageAddBibliographicRecord(healthResultToReference(item))}>{hasHealthReference(records, item) ? t.added : t.add}</button>
        </article>)}
        {page.nextCursor && <button type="button" disabled={busy} onClick={() => void more(provider)}>{t.more} — {HEALTH_PROVIDER_NAMES[provider]}</button>}
      </section>;
    })}
    <p>{t.distinction}</p>
    <a href="https://www.ncbi.nlm.nih.gov/About/disclaimer.html" target="_blank" rel="noopener noreferrer">{t.disclaimer}</a>
    <h3>{t.external}</h3>
    {discipline === 'psychology' && <p>
      <a href={psychArchivesSearchUrl(query)} target="_blank" rel="noopener noreferrer">{t.psych}</a><br />
      <a href="https://psycinfo.apa.org/" target="_blank" rel="noopener noreferrer">{t.psyc}</a>
    </p>}
    {discipline === 'medical-sciences' && <a href="https://trialsearch.who.int/" target="_blank" rel="noopener noreferrer">{t.who}</a>}
  </section>;
}
