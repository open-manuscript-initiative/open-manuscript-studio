import { getResearchModuleCopyByLocale } from '../moduleTranslationCatalog';
import { normalizeModuleLocale } from '../moduleLocale';
import { useRef, useState } from 'react';
import { downloadWorkspaceJson, newWorkspaceId, safeWorkspaceFileName, useLocalWorkspace } from '../disciplineWorkspace';
import { ResearchCatalogSearchPanel } from '../ResearchCatalogSearchPanel';
import { CulturalHeritagePanel } from '../cultural-heritage/CulturalHeritagePanel';
import '../disciplineWorkspaces.css';

type Context = { id: string; locus: string; period: string; layer: string; description: string; finds: string; sampleId: string; source: string };
type Workspace = { project: string; site: string; country: string; coordinates: string; contexts: Context[] };
const blank = (): Workspace => ({ project: '', site: '', country: '', coordinates: '', contexts: [] });
const valid = (value: unknown): value is Workspace => Boolean(
  value && typeof value === 'object'
    && ['project', 'site', 'country', 'coordinates'].every((key) => typeof (value as Record<string, unknown>)[key] === 'string')
    && Array.isArray((value as Workspace).contexts)
    && (value as Workspace).contexts.every((context) => context && typeof context === 'object'
      && typeof (context as Context).id === 'string'
      && ['locus', 'period', 'layer', 'description', 'finds', 'sampleId', 'source'].every((key) => typeof (context as unknown as Record<string, unknown>)[key] === 'string')),
);
const emptyContext = (): Context => ({ id: newWorkspaceId(), locus: '', period: '', layer: '', description: '', finds: '', sampleId: '', source: '' });
const copy = getResearchModuleCopyByLocale('archaeology-archaeology-panel/copy');
export function ArchaeologyPanel({ locale = 'en', storageKey = 'archaeology', heritageStorageKey = 'cultural-heritage' }: { locale?: string; storageKey?: string; heritageStorageKey?: string }) {
  const t = copy[normalizeModuleLocale(locale)];
  const fileRef = useRef<HTMLInputElement>(null);
  const [workspace, setWorkspace] = useLocalWorkspace<Workspace>(storageKey, blank, valid);
  const [error, setError] = useState('');
  const update = (id: string, patch: Partial<Context>) => setWorkspace(current => ({ ...current, contexts: current.contexts.map(context => context.id === id ? { ...context, ...patch } : context) }));
  function importJson(file?: File) {
    if (!file) return;
    void file.text().then(content => {
      try {
        const parsed: unknown = JSON.parse(content);
        if (!valid(parsed)) throw new Error('invalid');
        setWorkspace(parsed); setError('');
      } catch { setError(normalizeModuleLocale(locale) === 'de' ? 'Ungültige Archäologie-JSON-Datei.' : normalizeModuleLocale(locale) === 'hu' ? 'Érvénytelen régészeti JSON-fájl.' : 'Invalid archaeology JSON file.'); }
    });
  }
  return <main className="discipline-workspace">
    <header className="discipline-workspace__header"><div><p className="discipline-workspace__eyebrow">OMI Studio</p><h1>{t.title}</h1><p>{t.subtitle}</p></div><div><button type="button" onClick={() => downloadWorkspaceJson(safeWorkspaceFileName(workspace.project, 'archaeology') + '.json', workspace)}>{t.export}</button> <button type="button" onClick={() => fileRef.current?.click()}>{normalizeModuleLocale(locale) === 'hu' ? 'JSON importálása' : normalizeModuleLocale(locale) === 'de' ? 'JSON importieren' : 'Import JSON'}</button><input ref={fileRef} className="discipline-file" type="file" accept=".json,application/json" onChange={e => { importJson(e.target.files?.[0]); e.currentTarget.value = ''; }}/></div></header>
    <section className="discipline-workspace__section"><div className="discipline-workspace__grid"><label>{t.project}<input value={workspace.project} onChange={e => setWorkspace(current => ({ ...current, project: e.target.value }))}/></label><label>{t.site}<input value={workspace.site} onChange={e => setWorkspace(current => ({ ...current, site: e.target.value }))}/></label><label>{t.country}<input value={workspace.country} onChange={e => setWorkspace(current => ({ ...current, country: e.target.value }))}/></label><label>{t.coordinates}<input value={workspace.coordinates} onChange={e => setWorkspace(current => ({ ...current, coordinates: e.target.value }))}/></label></div><p className="discipline-workspace__hint">{t.local}</p></section>
    {error && <p role="alert">{error}</p>}
    <section className="discipline-workspace__section"><div className="discipline-workspace__section-title"><h2>{t.contexts} ({workspace.contexts.length})</h2><button type="button" onClick={() => setWorkspace(current => ({ ...current, contexts: [...current.contexts, emptyContext()] }))}>{t.add}</button></div>
      {workspace.contexts.map(context => <article className="discipline-workspace__card" key={context.id}><div className="discipline-workspace__grid"><label>{t.locus}<input value={context.locus} onChange={e => update(context.id, { locus: e.target.value })}/></label><label>{t.period}<input value={context.period} onChange={e => update(context.id, { period: e.target.value })}/></label><label>{t.layer}<input value={context.layer} onChange={e => update(context.id, { layer: e.target.value })}/></label><label>{t.sample}<input value={context.sampleId} onChange={e => update(context.id, { sampleId: e.target.value })}/></label><label>{t.finds}<input value={context.finds} onChange={e => update(context.id, { finds: e.target.value })}/></label><label>{t.source}<input value={context.source} onChange={e => update(context.id, { source: e.target.value })}/></label></div><label>{t.description}<textarea rows={3} value={context.description} onChange={e => update(context.id, { description: e.target.value })}/></label><button className="discipline-workspace__danger" type="button" onClick={() => setWorkspace(current => ({ ...current, contexts: current.contexts.filter(item => item.id !== context.id) }))}>{t.remove}</button></article>)}
    </section>
    <ResearchCatalogSearchPanel catalogs={['pleiades', 'ariadne', 'openContext']} locale={locale} storageKey={`${storageKey}:archaeology`} />
    <section className="discipline-workspace__section"><h2>{normalizeModuleLocale(locale) === 'hu' ? 'Kulturális örökség' : normalizeModuleLocale(locale) === 'de' ? 'Kulturelles Erbe' : 'Cultural heritage'}</h2><CulturalHeritagePanel locale={locale} storageKey={heritageStorageKey} /></section>
  </main>;
}
