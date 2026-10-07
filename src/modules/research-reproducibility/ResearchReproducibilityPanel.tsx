import { useState } from 'react';
import { downloadWorkspaceJson, newWorkspaceId, safeWorkspaceFileName, useLocalWorkspace } from '../disciplineWorkspace';
import '../disciplineWorkspaces.css';

type Locale = 'hu' | 'en' | 'de';
type Output = { id: string; kind: string; title: string; version: string; persistentId: string; repository: string; releaseDate: string; license: string; checksum: string; relation: string; verified: boolean; notes: string };
type Workspace = { project: string; outputs: Output[] };
const blankWorkspace = (): Workspace => ({ project: '', outputs: [] });
const isWorkspace = (value: unknown): value is Workspace => Boolean(
  value && typeof value === 'object' && typeof (value as Workspace).project === 'string'
    && Array.isArray((value as Workspace).outputs)
    && (value as Workspace).outputs.every((item) => item && typeof item === 'object' && typeof (item as Output).id === 'string' && typeof (item as Output).title === 'string'),
);
const newOutput = (): Output => ({ id: newWorkspaceId(), kind: 'dataset', title: '', version: '', persistentId: '', repository: '', releaseDate: '', license: '', checksum: '', relation: '', verified: false, notes: '' });
const copy = {
  hu: { title: 'Kutatási reprodukálhatóság', subtitle: 'A közleményekhez kapcsolódó adatok, kódok, módszerek és verziók nyilvántartása.', project: 'Kutatás / közlemény címe', outputs: 'Kapcsolódó kutatási kimenetek', add: 'Kimenet hozzáadása', kind: 'Típus', kinds: { dataset: 'Adatkészlet', code: 'Kód', method: 'Módszer', supplement: 'Kiegészítő anyag', software: 'Szoftver', other: 'Egyéb' }, titleField: 'Megnevezés', version: 'Verzió', pid: 'Tartós azonosító (DOI, Handle stb.)', repository: 'Adattár URL-je', date: 'Közzététel dátuma', license: 'Licenc', checksum: 'SHA-256 ellenőrzőösszeg', relation: 'Kapcsolat a közleménnyel', notes: 'Megjegyzések és újrafuttatási útmutató', verified: 'A hivatkozást és verziót ellenőriztem', file: 'Fájl ellenőrzőösszegének kiszámítása', remove: 'Törlés', export: 'Reprodukálhatósági jegyzék exportálása JSON-ként', local: 'A jegyzék ezen az eszközön tárolódik. Fájlfeltöltéskor csak a fájlnév, méret és SHA-256 kerül bejegyzésre; a fájl tartalma nem.' },
  en: { title: 'Research Reproducibility', subtitle: 'Register data, code, methods, and versions linked to publications.', project: 'Research / publication title', outputs: 'Related research outputs', add: 'Add output', kind: 'Type', kinds: { dataset: 'Dataset', code: 'Code', method: 'Method', supplement: 'Supplement', software: 'Software', other: 'Other' }, titleField: 'Name', version: 'Version', pid: 'Persistent identifier (DOI, Handle, etc.)', repository: 'Repository URL', date: 'Release date', license: 'License', checksum: 'SHA-256 checksum', relation: 'Relationship to publication', notes: 'Notes and rerun instructions', verified: 'I verified the link and version', file: 'Calculate file checksum', remove: 'Remove', export: 'Export reproducibility register as JSON', local: 'The register is stored on this device. File selection records only its name, size, and SHA-256; file contents are not stored.' },
  de: { title: 'Reproduzierbarkeit der Forschung', subtitle: 'Verzeichnis von Daten, Code, Methoden und Versionen zu Publikationen.', project: 'Titel der Forschung / Publikation', outputs: 'Zugehörige Forschungsergebnisse', add: 'Ergebnis hinzufügen', kind: 'Typ', kinds: { dataset: 'Datensatz', code: 'Code', method: 'Methode', supplement: 'Zusatzmaterial', software: 'Software', other: 'Sonstiges' }, titleField: 'Bezeichnung', version: 'Version', pid: 'Persistente Kennung (DOI, Handle usw.)', repository: 'Repository-URL', date: 'Veröffentlichungsdatum', license: 'Lizenz', checksum: 'SHA-256-Prüfsumme', relation: 'Bezug zur Publikation', notes: 'Anmerkungen und Hinweise zur Wiederholung', verified: 'Link und Version geprüft', file: 'Datei-Prüfsumme berechnen', remove: 'Entfernen', export: 'Reproduzierbarkeitsverzeichnis als JSON exportieren', local: 'Das Verzeichnis wird auf diesem Gerät gespeichert. Bei Dateiauswahl werden nur Name, Größe und SHA-256 erfasst; der Dateiinhalt wird nicht gespeichert.' }
} as const;

export function ResearchReproducibilityPanel({ locale = 'hu', storageKey = 'research-reproducibility' }: { locale?: string; storageKey?: string }) {
  const t = copy[locale as Locale] ?? copy.hu;
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
  </main>;
}
