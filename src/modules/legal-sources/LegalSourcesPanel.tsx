import { useMemo, useState } from 'react';
import { downloadWorkspaceJson, newWorkspaceId, useLocalWorkspace } from '../disciplineWorkspace';
import '../disciplineWorkspaces.css';

type Locale = 'hu' | 'en' | 'de';
type Version = { id: string; date: string; effectiveDate: string; url: string; text: string; note: string };
type LegalSource = { id: string; jurisdiction: string; authority: string; citation: string; title: string; sourceType: string; publicationDate: string; effectiveDate: string; status: string; url: string; versions: Version[] };
type Workspace = { sources: LegalSource[] };
const blankWorkspace = (): Workspace => ({ sources: [] });
const emptySource = (): LegalSource => ({ id: newWorkspaceId(), jurisdiction: '', authority: '', citation: '', title: '', sourceType: '', publicationDate: '', effectiveDate: '', status: '', url: '', versions: [] });
const copy = {
  hu: { title: 'Jogforrások', subtitle: 'Hivatkozások, hatályállapotok és forrásszöveg-változatok nyilvántartása.', search: 'Keresés cím, hivatkozás vagy joghatóság szerint', add: 'Jogforrás hozzáadása', jurisdiction: 'Joghatóság', authority: 'Kibocsátó szerv', citation: 'Hivatalos hivatkozás', titleField: 'Cím', type: 'Forrástípus', publication: 'Kihirdetés dátuma', effective: 'Hatálybalépés', status: 'Hatályállapot / státusz', url: 'Hivatalos forrás URL-je', open: 'Forrás megnyitása', versions: 'Szövegváltozatok', addVersion: 'Változat felvétele', versionDate: 'Változat dátuma', versionEffective: 'Hatályos ettől', versionUrl: 'Változat URL-je', text: 'Forrásszöveg', note: 'Megjegyzés', compare: 'Két változat összevetése', first: 'Első változat', second: 'Második változat', remove: 'Törlés', export: 'Nyilvántartás exportálása JSON-ként', noSources: 'Még nincs rögzített jogforrás.', local: 'A nyilvántartás ezen az eszközön tárolódik. Ellenőrizd a hivatkozásokat és a hatályállapotot az elsődleges forrásnál.' },
  en: { title: 'Legal Sources', subtitle: 'Register citations, validity status, and source text versions.', search: 'Search title, citation, or jurisdiction', add: 'Add legal source', jurisdiction: 'Jurisdiction', authority: 'Issuing authority', citation: 'Official citation', titleField: 'Title', type: 'Source type', publication: 'Publication date', effective: 'Effective date', status: 'Validity / status', url: 'Official source URL', open: 'Open source', versions: 'Text versions', addVersion: 'Add version', versionDate: 'Version date', versionEffective: 'Effective from', versionUrl: 'Version URL', text: 'Source text', note: 'Note', compare: 'Compare two versions', first: 'First version', second: 'Second version', remove: 'Remove', export: 'Export register as JSON', noSources: 'No legal sources recorded yet.', local: 'The register is stored on this device. Verify citations and validity against the primary source.' },
  de: { title: 'Rechtsquellen', subtitle: 'Verzeichnis von Zitaten, Gültigkeitsstatus und Textfassungen.', search: 'Suche nach Titel, Zitat oder Rechtsordnung', add: 'Rechtsquelle hinzufügen', jurisdiction: 'Rechtsordnung', authority: 'Erlassende Stelle', citation: 'Amtliche Fundstelle', titleField: 'Titel', type: 'Quellentyp', publication: 'Veröffentlichungsdatum', effective: 'Inkrafttreten', status: 'Gültigkeit / Status', url: 'URL der amtlichen Quelle', open: 'Quelle öffnen', versions: 'Textfassungen', addVersion: 'Fassung hinzufügen', versionDate: 'Fassungsdatum', versionEffective: 'Gültig ab', versionUrl: 'URL der Fassung', text: 'Quellentext', note: 'Anmerkung', compare: 'Zwei Fassungen vergleichen', first: 'Erste Fassung', second: 'Zweite Fassung', remove: 'Entfernen', export: 'Verzeichnis als JSON exportieren', noSources: 'Noch keine Rechtsquellen erfasst.', local: 'Das Verzeichnis wird auf diesem Gerät gespeichert. Zitate und Gültigkeit anhand der Primärquelle prüfen.' }
} as const;

export function LegalSourcesPanel({ locale = 'hu', storageKey = 'legal-sources' }: { locale?: string; storageKey?: string }) {
  const t = copy[locale as Locale] ?? copy.hu;
  const [workspace, setWorkspace] = useLocalWorkspace<Workspace>(storageKey, blankWorkspace);
  const [query, setQuery] = useState('');
  const [compare, setCompare] = useState<Record<string, [string, string]>>({});
  const addSource = () => setWorkspace(current => ({ sources: [...current.sources, emptySource()] }));
  const updateSource = (id: string, changes: Partial<LegalSource>) => setWorkspace(current => ({ sources: current.sources.map(source => source.id === id ? { ...source, ...changes } : source) }));
  const visible = useMemo(() => workspace.sources.filter(source => [source.title, source.citation, source.jurisdiction].join(' ').toLocaleLowerCase().includes(query.toLocaleLowerCase())), [workspace.sources, query]);
  const updateVersion = (source: LegalSource, versionId: string, changes: Partial<Version>) => updateSource(source.id, { versions: source.versions.map(version => version.id === versionId ? { ...version, ...changes } : version) });
  const options = (sourceId: string): [string, string] => compare[sourceId] ?? ['', ''];
  return <main className="discipline-workspace">
    <header className="discipline-workspace__header"><div><p className="discipline-workspace__eyebrow">OMI Studio</p><h1>{t.title}</h1><p>{t.subtitle}</p></div><button type="button" onClick={() => downloadWorkspaceJson('legal-sources.json', workspace)}>{t.export}</button></header>
    <section className="discipline-workspace__section"><div className="discipline-workspace__section-title"><label>{t.search}<input value={query} onChange={e => setQuery(e.target.value)} /></label><button type="button" onClick={addSource}>{t.add}</button></div><p className="discipline-workspace__hint">{t.local}</p>
      {visible.length === 0 && <p>{t.noSources}</p>}
      {visible.map(source => <article className="discipline-workspace__card" key={source.id}>
        <div className="discipline-workspace__grid">
          <label>{t.jurisdiction}<input value={source.jurisdiction} onChange={e => updateSource(source.id, { jurisdiction: e.target.value })} /></label><label>{t.authority}<input value={source.authority} onChange={e => updateSource(source.id, { authority: e.target.value })} /></label>
          <label>{t.citation}<input value={source.citation} onChange={e => updateSource(source.id, { citation: e.target.value })} /></label><label>{t.titleField}<input value={source.title} onChange={e => updateSource(source.id, { title: e.target.value })} /></label>
          <label>{t.type}<input value={source.sourceType} onChange={e => updateSource(source.id, { sourceType: e.target.value })} /></label><label>{t.status}<input value={source.status} onChange={e => updateSource(source.id, { status: e.target.value })} /></label>
          <label>{t.publication}<input type="date" value={source.publicationDate} onChange={e => updateSource(source.id, { publicationDate: e.target.value })} /></label><label>{t.effective}<input type="date" value={source.effectiveDate} onChange={e => updateSource(source.id, { effectiveDate: e.target.value })} /></label>
          <label>{t.url}<input type="url" value={source.url} onChange={e => updateSource(source.id, { url: e.target.value })} /></label>
        </div>
        {source.url && <p><a href={source.url} target="_blank" rel="noopener noreferrer">{t.open} ↗</a></p>}
        <div className="discipline-workspace__section-title"><h3>{t.versions}</h3><button type="button" onClick={() => updateSource(source.id, { versions: [...source.versions, { id: newWorkspaceId(), date: '', effectiveDate: '', url: '', text: '', note: '' }] })}>{t.addVersion}</button></div>
        {source.versions.map(version => <div className="discipline-workspace__version" key={version.id}><div className="discipline-workspace__grid">
          <label>{t.versionDate}<input type="date" value={version.date} onChange={e => updateVersion(source, version.id, { date: e.target.value })} /></label><label>{t.versionEffective}<input type="date" value={version.effectiveDate} onChange={e => updateVersion(source, version.id, { effectiveDate: e.target.value })} /></label><label>{t.versionUrl}<input type="url" value={version.url} onChange={e => updateVersion(source, version.id, { url: e.target.value })} /></label>
        </div><label>{t.text}<textarea rows={5} value={version.text} onChange={e => updateVersion(source, version.id, { text: e.target.value })} /></label><label>{t.note}<input value={version.note} onChange={e => updateVersion(source, version.id, { note: e.target.value })} /></label>
          <button type="button" className="discipline-workspace__danger" onClick={() => updateSource(source.id, { versions: source.versions.filter(item => item.id !== version.id) })}>{t.remove}</button>
        </div>)}
        {source.versions.length > 1 && <div className="discipline-workspace__compare"><h3>{t.compare}</h3><div className="discipline-workspace__grid">{([0, 1] as const).map(index => <label key={index}>{index === 0 ? t.first : t.second}<select value={options(source.id)[index]} onChange={e => setCompare(current => ({ ...current, [source.id]: index === 0 ? [e.target.value, options(source.id)[1]] : [options(source.id)[0], e.target.value] }))}><option value="">—</option>{source.versions.map(version => <option key={version.id} value={version.id}>{version.date || version.effectiveDate || version.id.slice(0, 8)}</option>)}</select></label>)}</div>
          <div className="discipline-workspace__comparison">{options(source.id).map((id, index) => { const version = source.versions.find(item => item.id === id); return <section key={index}><h4>{index === 0 ? t.first : t.second}</h4><pre>{version?.text ?? ''}</pre></section>; })}</div>
        </div>}
        <button type="button" className="discipline-workspace__danger" onClick={() => setWorkspace(current => ({ sources: current.sources.filter(item => item.id !== source.id) }))}>{t.remove}</button>
      </article>)}
    </section>
  </main>;
}
