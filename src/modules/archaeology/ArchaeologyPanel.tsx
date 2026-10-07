import { useRef, useState } from 'react';
import { downloadWorkspaceJson, newWorkspaceId, safeWorkspaceFileName, useLocalWorkspace } from '../disciplineWorkspace';
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
const copy = {
  hu: { title: 'Régészeti kutatótér', subtitle: 'Lelőhelyek, rétegek, kontextusok és leletek dokumentálása, forráskapcsolatokkal.', project: 'Kutatási projekt', site: 'Lelőhely neve / azonosítója', country: 'Ország / régió', coordinates: 'Koordináták vagy térinformatikai rekord', contexts: 'Régészeti kontextusok', add: 'Kontextus hozzáadása', locus: 'Locus / kontextusazonosító', period: 'Korszak / datálás', layer: 'Réteg / stratigráfiai egység', description: 'Leírás és megfigyelések', finds: 'Leletek és tárgyazonosítók', sample: 'Mintaazonosító', source: 'Dokumentáció / forrás URL', remove: 'Törlés', export: 'Régészeti jegyzék exportálása JSON-ként', local: 'Az adatok ezen az eszközön tárolódnak. Rendszeres JSON-exporttal készítsen hordozható másolatot.' },
  en: { title: 'Archaeology workspace', subtitle: 'Document sites, layers, contexts, and finds with links to their sources.', project: 'Research project', site: 'Site name / identifier', country: 'Country / region', coordinates: 'Coordinates or spatial record', contexts: 'Archaeological contexts', add: 'Add context', locus: 'Locus / context identifier', period: 'Period / dating', layer: 'Layer / stratigraphic unit', description: 'Description and observations', finds: 'Finds and object identifiers', sample: 'Sample identifier', source: 'Documentation / source URL', remove: 'Remove', export: 'Export archaeology register as JSON', local: 'Data is stored on this device. Export JSON regularly to keep a portable copy.' },
  de: { title: 'Arbeitsbereich Archäologie', subtitle: 'Fundorte, Schichten, Kontexte und Funde mit ihren Quellen dokumentieren.', project: 'Forschungsprojekt', site: 'Fundort / Kennung', country: 'Land / Region', coordinates: 'Koordinaten oder Raumdatensatz', contexts: 'Archäologische Kontexte', add: 'Kontext hinzufügen', locus: 'Locus / Kontextkennung', period: 'Epoche / Datierung', layer: 'Schicht / stratigraphische Einheit', description: 'Beschreibung und Beobachtungen', finds: 'Funde und Objektkennungen', sample: 'Probenkennung', source: 'Dokumentation / Quellen-URL', remove: 'Entfernen', export: 'Archäologisches Verzeichnis als JSON exportieren', local: 'Die Daten werden auf diesem Gerät gespeichert. Exportieren Sie regelmäßig JSON als portable Kopie.' },
} as const;
export function ArchaeologyPanel({ locale = 'hu', storageKey = 'archaeology' }: { locale?: string; storageKey?: string }) {
  const t = copy[locale as keyof typeof copy] ?? copy.hu;
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
      } catch { setError(locale === 'en' ? 'Invalid archaeology JSON file.' : locale === 'de' ? 'Ungültige Archäologie-JSON-Datei.' : 'Érvénytelen régészeti JSON-fájl.'); }
    });
  }
  return <main className="discipline-workspace">
    <header className="discipline-workspace__header"><div><p className="discipline-workspace__eyebrow">OMI Studio</p><h1>{t.title}</h1><p>{t.subtitle}</p></div><div><button type="button" onClick={() => downloadWorkspaceJson(safeWorkspaceFileName(workspace.project, 'archaeology') + '.json', workspace)}>{t.export}</button> <button type="button" onClick={() => fileRef.current?.click()}>{locale === 'en' ? 'Import JSON' : locale === 'de' ? 'JSON importieren' : 'JSON importálása'}</button><input ref={fileRef} className="discipline-file" type="file" accept=".json,application/json" onChange={e => { importJson(e.target.files?.[0]); e.currentTarget.value = ''; }}/></div></header>
    <section className="discipline-workspace__section"><div className="discipline-workspace__grid"><label>{t.project}<input value={workspace.project} onChange={e => setWorkspace(current => ({ ...current, project: e.target.value }))}/></label><label>{t.site}<input value={workspace.site} onChange={e => setWorkspace(current => ({ ...current, site: e.target.value }))}/></label><label>{t.country}<input value={workspace.country} onChange={e => setWorkspace(current => ({ ...current, country: e.target.value }))}/></label><label>{t.coordinates}<input value={workspace.coordinates} onChange={e => setWorkspace(current => ({ ...current, coordinates: e.target.value }))}/></label></div><p className="discipline-workspace__hint">{t.local}</p></section>
    <section className="discipline-workspace__section"><div className="discipline-workspace__section-title"><h2>{t.contexts} ({workspace.contexts.length})</h2><button type="button" onClick={() => setWorkspace(current => ({ ...current, contexts: [...current.contexts, emptyContext()] }))}>{t.add}</button></div>
      {workspace.contexts.map(context => <article className="discipline-workspace__card" key={context.id}><div className="discipline-workspace__grid"><label>{t.locus}<input value={context.locus} onChange={e => update(context.id, { locus: e.target.value })}/></label><label>{t.period}<input value={context.period} onChange={e => update(context.id, { period: e.target.value })}/></label><label>{t.layer}<input value={context.layer} onChange={e => update(context.id, { layer: e.target.value })}/></label><label>{t.sample}<input value={context.sampleId} onChange={e => update(context.id, { sampleId: e.target.value })}/></label><label>{t.finds}<input value={context.finds} onChange={e => update(context.id, { finds: e.target.value })}/></label><label>{t.source}<input value={context.source} onChange={e => update(context.id, { source: e.target.value })}/></label></div><label>{t.description}<textarea rows={3} value={context.description} onChange={e => update(context.id, { description: e.target.value })}/></label><button className="discipline-workspace__danger" type="button" onClick={() => setWorkspace(current => ({ ...current, contexts: current.contexts.filter(item => item.id !== context.id) }))}>{t.remove}</button></article>)}
    </section>
  </main>;
}
