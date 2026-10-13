import { getResearchModuleCopyByLocale } from '../moduleTranslationCatalog';
import { normalizeModuleLocale } from '../moduleLocale';
import { useMemo, useState } from 'react';
import { downloadWorkspaceJson, newWorkspaceId, safeExternalUrl, useLocalWorkspace } from '../disciplineWorkspace';
import '../disciplineWorkspaces.css';

type Version = { id: string; date: string; effectiveDate: string; url: string; text: string; note: string };
type LegalSource = { id: string; jurisdiction: string; authority: string; citation: string; title: string; sourceType: string; publicationDate: string; effectiveDate: string; status: string; url: string; versions: Version[] };
type Workspace = { sources: LegalSource[] };
const blankWorkspace = (): Workspace => ({ sources: [] });
const isWorkspace = (value: unknown): value is Workspace => Boolean(
  value && typeof value === 'object' && Array.isArray((value as Workspace).sources)
    && (value as Workspace).sources.every((item) => item && typeof item === 'object'
      && typeof (item as LegalSource).id === 'string'
      && typeof (item as LegalSource).title === 'string'
      && Array.isArray((item as LegalSource).versions)
      && (item as LegalSource).versions.every((version) => version && typeof version === 'object' && typeof (version as Version).id === 'string')),
);
const emptySource = (): LegalSource => ({ id: newWorkspaceId(), jurisdiction: '', authority: '', citation: '', title: '', sourceType: '', publicationDate: '', effectiveDate: '', status: '', url: '', versions: [] });
const copy = getResearchModuleCopyByLocale('legal-sources-legal-sources-panel/copy') as const;

export function LegalSourcesPanel({ locale = 'en', storageKey = 'legal-sources' }: { locale?: string; storageKey?: string }) {
  const t = copy[normalizeModuleLocale(locale)];
  const [workspace, setWorkspace] = useLocalWorkspace<Workspace>(storageKey, blankWorkspace, isWorkspace);
  const [providerQuery, setProviderQuery] = useState('');
  const providers: Array<{ id: 'eurlex'; title: string; detail: string; portal: string; searchUrl: (value: string) => string } | { id: 'curia' | 'unts' | 'roman' | 'canon'; title: string; detail: string; portal: string; domain: string }> = [
    { id: 'eurlex', title: 'EUR-Lex', detail: normalizeModuleLocale(locale) === 'hu' ? 'Az Európai Unió joganyaga, nemzetközi megállapodásai és kapcsolódó nemzeti hivatkozások.' : normalizeModuleLocale(locale) === 'de' ? 'EU-Recht, internationale Übereinkünfte und zugehörige nationale Verweise.' : 'EU law, international agreements, and related national references.', portal: 'https://eur-lex.europa.eu/', searchUrl: (value: string) => 'https://eur-lex.europa.eu/search.html?scope=EURLEX&text=' + encodeURIComponent(value) },
    { id: 'curia', title: 'InfoCuria', detail: normalizeModuleLocale(locale) === 'hu' ? 'Az Európai Unió Bíróságának ítélkezési gyakorlata.' : normalizeModuleLocale(locale) === 'de' ? 'Rechtsprechung des Gerichtshofs der Europäischen Union.' : 'Case law of the Court of Justice of the European Union.', portal: 'https://infocuria.curia.europa.eu/', domain: 'infocuria.curia.europa.eu' },
    { id: 'unts', title: 'United Nations Treaty Collection', detail: normalizeModuleLocale(locale) === 'hu' ? 'Az ENSZ-nél nyilvántartott vagy letétbe helyezett szerződések.' : normalizeModuleLocale(locale) === 'de' ? 'Bei den Vereinten Nationen registrierte oder hinterlegte Verträge.' : 'Treaties registered with or filed at the United Nations.', portal: 'https://treaties.un.org/pages/AdvanceSearch.aspx?clang=_en&tab=UNTS', domain: 'treaties.un.org' },
    { id: 'roman', title: 'Roman Law Library · Université Grenoble Alpes', detail: normalizeModuleLocale(locale) === 'hu' ? 'Római jogi szövegek és történeti jogforrások egyetemi gyűjteménye.' : normalizeModuleLocale(locale) === 'de' ? 'Universitäre Sammlung römisch-rechtlicher Texte und historischer Rechtsquellen.' : 'University collection of Roman law texts and historical legal sources.', portal: 'https://droitromain.univ-grenoble-alpes.fr/welcome.htm', domain: 'droitromain.univ-grenoble-alpes.fr' },
    { id: 'canon', title: normalizeModuleLocale(locale) === 'hu' ? 'Vatikáni kánonjogi források' : normalizeModuleLocale(locale) === 'de' ? 'Kanonische Quellen des Vatikans' : 'Vatican canon law sources', detail: normalizeModuleLocale(locale) === 'hu' ? 'Az 1983-as latin egyházi törvénykönyv, a keleti egyházak kódexe és a jogszövegekért felelős dikasztérium.' : normalizeModuleLocale(locale) === 'de' ? 'Codex von 1983, Kodex der Ostkirchen und Texte des Dikasteriums für die Gesetzestexte.' : 'The 1983 Code, the Eastern Churches’ Code, and the Dicastery for Legislative Texts.', portal: 'https://www.vatican.va/archive/cod-iuris-canonici/', domain: 'vatican.va/archive/cod-iuris-canonici OR site:delegumtextibus.va/content/testilegislativi' },
  ];
  const providerSearchUrl = (provider: typeof providers[number]) => provider.id === 'eurlex'
    ? provider.searchUrl(providerQuery.trim())
    : 'https://www.google.com/search?q=' + encodeURIComponent('site:' + provider.domain + ' ' + providerQuery.trim());
  const [query, setQuery] = useState('');
  const [compare, setCompare] = useState<Record<string, [string, string]>>({});
  const addSource = () => setWorkspace(current => ({ sources: [...current.sources, emptySource()] }));
  const updateSource = (id: string, changes: Partial<LegalSource>) => setWorkspace(current => ({ sources: current.sources.map(source => source.id === id ? { ...source, ...changes } : source) }));
  const visible = useMemo(() => workspace.sources.filter(source => [source.title, source.citation, source.jurisdiction].join(' ').toLocaleLowerCase().includes(query.toLocaleLowerCase())), [workspace.sources, query]);
  const updateVersion = (source: LegalSource, versionId: string, changes: Partial<Version>) => updateSource(source.id, { versions: source.versions.map(version => version.id === versionId ? { ...version, ...changes } : version) });
  const options = (sourceId: string): [string, string] => compare[sourceId] ?? ['', ''];
  return <main className="discipline-workspace">
    <header className="discipline-workspace__header"><div><p className="discipline-workspace__eyebrow">OMI Studio</p><h1>{t.title}</h1><p>{t.subtitle}</p></div><button type="button" onClick={() => downloadWorkspaceJson('legal-sources.json', workspace)}>{t.export}</button></header>
    <section className="discipline-workspace__section">
      <h2>{t.databases}</h2><p className="discipline-workspace__hint">{t.databasesHelp}</p>
      <label>{t.databaseQuery}<input value={providerQuery} onChange={e => setProviderQuery(e.target.value)} /></label>
      <div className="discipline-workspace__list">{providers.map(provider => <article className="discipline-workspace__card" key={provider.id}>
        <h3>{provider.title}</h3><p>{provider.detail}</p><div className="discipline-workspace__section-title">
          <a href={providerSearchUrl(provider)} target="_blank" rel="noopener noreferrer" aria-disabled={!providerQuery.trim()} onClick={event => { if (!providerQuery.trim()) event.preventDefault(); }}>{t.searchDatabase} ↗</a>
          <a href={provider.portal} target="_blank" rel="noopener noreferrer">{t.openPortal} ↗</a>
        </div>
      </article>)}</div>
    </section>
    <section className="discipline-workspace__section"><div className="discipline-workspace__section-title"><label>{t.search}<input value={query} onChange={e => setQuery(e.target.value)} /></label><button type="button" onClick={addSource}>{t.add}</button></div><p className="discipline-workspace__hint">{t.local}</p>
      {visible.length === 0 && <p>{t.noSources}</p>}
      {visible.map(source => { const officialUrl = safeExternalUrl(source.url); return <article className="discipline-workspace__card" key={source.id}>
        <div className="discipline-workspace__grid">
          <label>{t.jurisdiction}<input value={source.jurisdiction} onChange={e => updateSource(source.id, { jurisdiction: e.target.value })} /></label><label>{t.authority}<input value={source.authority} onChange={e => updateSource(source.id, { authority: e.target.value })} /></label>
          <label>{t.citation}<input value={source.citation} onChange={e => updateSource(source.id, { citation: e.target.value })} /></label><label>{t.titleField}<input value={source.title} onChange={e => updateSource(source.id, { title: e.target.value })} /></label>
          <label>{t.type}<input value={source.sourceType} onChange={e => updateSource(source.id, { sourceType: e.target.value })} /></label><label>{t.status}<input value={source.status} onChange={e => updateSource(source.id, { status: e.target.value })} /></label>
          <label>{t.publication}<input type="date" value={source.publicationDate} onChange={e => updateSource(source.id, { publicationDate: e.target.value })} /></label><label>{t.effective}<input type="date" value={source.effectiveDate} onChange={e => updateSource(source.id, { effectiveDate: e.target.value })} /></label>
          <label>{t.url}<input type="url" value={source.url} onChange={e => updateSource(source.id, { url: e.target.value })} /></label>
        </div>
        {officialUrl && <p><a href={officialUrl} target="_blank" rel="noopener noreferrer">{t.open} ↗</a></p>}
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
      </article>; })}
    </section>
  </main>;
}
