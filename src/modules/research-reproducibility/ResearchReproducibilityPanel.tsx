import { getResearchModuleCopyByLocale } from '../moduleTranslationCatalog';
import { normalizeModuleLocale } from '../moduleLocale';
import { useState } from 'react';
import { downloadWorkspaceJson, newWorkspaceId, safeWorkspaceFileName, useLocalWorkspace } from '../disciplineWorkspace';
import { ResearchCatalogSearchPanel } from '../ResearchCatalogSearchPanel';
import '../disciplineWorkspaces.css';

type Output = { id: string; kind: string; title: string; version: string; persistentId: string; repository: string; releaseDate: string; license: string; checksum: string; relation: string; verified: boolean; notes: string };
type Workspace = { project: string; outputs: Output[] };
const blankWorkspace = (): Workspace => ({ project: '', outputs: [] });
const isWorkspace = (value: unknown): value is Workspace => Boolean(
  value && typeof value === 'object' && typeof (value as Workspace).project === 'string'
    && Array.isArray((value as Workspace).outputs)
    && (value as Workspace).outputs.every((item) => item && typeof item === 'object'
      && typeof (item as Output).id === 'string'
      && ['kind', 'title', 'version', 'persistentId', 'repository', 'releaseDate', 'license', 'checksum', 'relation', 'notes'].every((key) => typeof (item as unknown as Record<string, unknown>)[key] === 'string')
      && typeof (item as Output).verified === 'boolean'),
);
const newOutput = (): Output => ({ id: newWorkspaceId(), kind: 'dataset', title: '', version: '', persistentId: '', repository: '', releaseDate: '', license: '', checksum: '', relation: '', verified: false, notes: '' });
const copy = getResearchModuleCopyByLocale('research-reproducibility-research-reproducibility-panel/copy');

export function ResearchReproducibilityPanel({ locale = 'en', storageKey = 'research-reproducibility' }: { locale?: string; storageKey?: string }) {
  const t = copy[normalizeModuleLocale(locale)];
  const [workspace, setWorkspace] = useLocalWorkspace<Workspace>(storageKey, blankWorkspace, isWorkspace);
  const [busy, setBusy] = useState<string | null>(null);
  const updateOutput = (id: string, changes: Partial<Output>) => setWorkspace(current => ({ ...current, outputs: current.outputs.map(output => output.id === id ? { ...output, ...changes } : output) }));
  const hashFile = async (id: string, file?: File) => {
    if (!file) return;
    setBusy(id);
    try {
      const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
      const checksum = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
      updateOutput(id, { checksum, notes: [workspace.outputs.find(output => output.id === id)?.notes, `${file.name} (${file.size} bytes)`].filter(Boolean).join('\n') });
    } finally { setBusy(null); }
  };
  return <main className="discipline-workspace">
    <header className="discipline-workspace__header"><div><p className="discipline-workspace__eyebrow">OMI Studio</p><h1>{t.title}</h1><p>{t.subtitle}</p></div><button type="button" onClick={() => downloadWorkspaceJson(safeWorkspaceFileName(workspace.project, 'reproducibility') + '.json', workspace)}>{t.export}</button></header>
    <section className="discipline-workspace__section"><label>{t.project}<input value={workspace.project} onChange={e => setWorkspace(current => ({ ...current, project: e.target.value }))} /></label><p className="discipline-workspace__hint">{t.local}</p></section>
    <section className="discipline-workspace__section"><div className="discipline-workspace__section-title"><h2>{t.outputs}</h2><button type="button" onClick={() => setWorkspace(current => ({ ...current, outputs: [...current.outputs, newOutput()] }))}>{t.add}</button></div>
      {workspace.outputs.map(output => <article className="discipline-workspace__card" key={output.id}>
        <div className="discipline-workspace__grid"><label>{t.kind}<select value={output.kind} onChange={e => updateOutput(output.id, { kind: e.target.value })}>{Object.entries(t.kinds).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>{t.titleField}<input value={output.title} onChange={e => updateOutput(output.id, { title: e.target.value })} /></label><label>{t.version}<input value={output.version} onChange={e => updateOutput(output.id, { version: e.target.value })} /></label>
          <label>{t.pid}<input value={output.persistentId} onChange={e => updateOutput(output.id, { persistentId: e.target.value })} /></label><label>{t.repository}<input type="url" value={output.repository} onChange={e => updateOutput(output.id, { repository: e.target.value })} /></label>
          <label>{t.date}<input type="date" value={output.releaseDate} onChange={e => updateOutput(output.id, { releaseDate: e.target.value })} /></label><label>{t.license}<input value={output.license} onChange={e => updateOutput(output.id, { license: e.target.value })} /></label>
          <label>{t.checksum}<input value={output.checksum} onChange={e => updateOutput(output.id, { checksum: e.target.value })} /></label><label>{t.relation}<input value={output.relation} onChange={e => updateOutput(output.id, { relation: e.target.value })} /></label>
        </div><label>{t.notes}<textarea rows={3} value={output.notes} onChange={e => updateOutput(output.id, { notes: e.target.value })} /></label>
        <label className="discipline-workspace__check"><input type="checkbox" checked={output.verified} onChange={e => updateOutput(output.id, { verified: e.target.checked })} />{t.verified}</label>
        <label className="discipline-workspace__file">{t.file}<input type="file" onChange={e => void hashFile(output.id, e.target.files?.[0])} />{busy === output.id && <span>…</span>}</label>
        <button type="button" className="discipline-workspace__danger" onClick={() => setWorkspace(current => ({ ...current, outputs: current.outputs.filter(item => item.id !== output.id) }))}>{t.remove}</button>
      </article>)}
    </section>
    <ResearchCatalogSearchPanel catalogs={['zenodo']} locale={locale} storageKey={`${storageKey}:reproducibility`} />
  </main>;
}
