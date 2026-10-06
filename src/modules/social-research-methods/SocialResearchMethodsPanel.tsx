import { useState } from 'react';
import { downloadWorkspaceJson, newWorkspaceId, safeWorkspaceFileName, useLocalWorkspace } from '../disciplineWorkspace';
import '../disciplineWorkspaces.css';

type Locale = 'hu' | 'en' | 'de';
type Variable = { id: string; name: string; label: string; type: string; values: string };
type Code = { id: string; start: number; end: number; text: string; label: string; note: string };
type Transcript = { id: string; title: string; participant: string; text: string; codes: Code[] };
type Project = { title: string; question: string; method: string; ethics: string; variables: Variable[]; transcripts: Transcript[] };

const copy = {
  hu: { title: 'Társadalomkutatási módszerek', subtitle: 'Kutatási terv, kódkönyv és kvalitatív adatok munkafelülete.', project: 'Kutatási terv', name: 'Projekt címe', question: 'Kutatási kérdés', method: 'Módszertan és mintavétel', ethics: 'Etikai és adatkezelési jegyzetek', variables: 'Kódkönyv', varName: 'Változónév', label: 'Leírás / kód', type: 'Mérési szint vagy típus', values: 'Értékek és kódolási szabály', addVariable: 'Változó felvétele', remove: 'Törlés', transcripts: 'Interjúk és megfigyelési jegyzetek', transcriptTitle: 'Dokumentum címe', participant: 'Résztvevő kódja', text: 'Átirat / jegyzet', addTranscript: 'Dokumentum felvétele', annotation: 'Kijelölt rész kódolása', codeLabel: 'Kód', note: 'Elemző megjegyzés', apply: 'Kód hozzárendelése', noSelection: 'Jelölj ki egy szövegrészt az átiratban, majd rendelj hozzá kódot.', coded: 'Kódolt szövegrészletek', export: 'Projekt exportálása JSON-ként', private: 'A munkapéldány ezen az eszközön tárolódik. Az érzékeny adatokat anonimizáld.' },
  en: { title: 'Social Research Methods', subtitle: 'Workspace for research design, codebooks, and qualitative data.', project: 'Research design', name: 'Project title', question: 'Research question', method: 'Methodology and sampling', ethics: 'Ethics and data handling notes', variables: 'Codebook', varName: 'Variable name', label: 'Description / code', type: 'Measurement level or type', values: 'Values and coding rules', addVariable: 'Add variable', remove: 'Remove', transcripts: 'Interviews and field notes', transcriptTitle: 'Document title', participant: 'Participant code', text: 'Transcript / notes', addTranscript: 'Add document', annotation: 'Code selected passage', codeLabel: 'Code', note: 'Analytic note', apply: 'Apply code', noSelection: 'Select text in the transcript, then assign a code.', coded: 'Coded passages', export: 'Export project as JSON', private: 'The working copy is stored on this device. Anonymize sensitive data.' },
  de: { title: 'Methoden der Sozialforschung', subtitle: 'Arbeitsbereich für Forschungsdesign, Codebuch und qualitative Daten.', project: 'Forschungsdesign', name: 'Projekttitel', question: 'Forschungsfrage', method: 'Methodik und Stichprobe', ethics: 'Ethik und Datenverarbeitung', variables: 'Codebuch', varName: 'Variablenname', label: 'Beschreibung / Code', type: 'Messniveau oder Typ', values: 'Werte und Codierregeln', addVariable: 'Variable hinzufügen', remove: 'Entfernen', transcripts: 'Interviews und Feldnotizen', transcriptTitle: 'Dokumenttitel', participant: 'Teilnehmendencode', text: 'Transkript / Notizen', addTranscript: 'Dokument hinzufügen', annotation: 'Ausgewählte Passage codieren', codeLabel: 'Code', note: 'Analytische Notiz', apply: 'Code zuweisen', noSelection: 'Text im Transkript markieren und einen Code zuweisen.', coded: 'Codierte Passagen', export: 'Projekt als JSON exportieren', private: 'Die Arbeitskopie wird auf diesem Gerät gespeichert. Sensible Daten anonymisieren.' }
} as const;

function blankProject(): Project { return { title: '', question: '', method: '', ethics: '', variables: [], transcripts: [] }; }

export function SocialResearchMethodsPanel({ locale = 'hu', storageKey = 'social-research-methods' }: { locale?: string; storageKey?: string }) {
  const t = copy[locale as Locale] ?? copy.hu;
  const [project, setProject] = useLocalWorkspace<Project>(storageKey, blankProject);
  const [selected, setSelected] = useState<{ id: string; start: number; end: number } | null>(null);
  const [pendingCode, setPendingCode] = useState('');
  const [pendingNote, setPendingNote] = useState('');
  const patch = (values: Partial<Project>) => setProject(current => ({ ...current, ...values }));
  const addVariable = () => patch({ variables: [...project.variables, { id: newWorkspaceId(), name: '', label: '', type: '', values: '' }] });
  const addTranscript = () => patch({ transcripts: [...project.transcripts, { id: newWorkspaceId(), title: '', participant: '', text: '', codes: [] }] });
  const updateVariable = (id: string, values: Partial<Variable>) => patch({ variables: project.variables.map(variable => variable.id === id ? { ...variable, ...values } : variable) });
  const updateTranscript = (id: string, values: Partial<Transcript>) => patch({ transcripts: project.transcripts.map(item => item.id === id ? { ...item, ...values } : item) });
  const applyCode = () => {
    const transcript = project.transcripts.find(item => item.id === selected?.id);
    if (!transcript || !selected || !pendingCode.trim()) return;
    const code: Code = { id: newWorkspaceId(), start: selected.start, end: selected.end, text: transcript.text.slice(selected.start, selected.end), label: pendingCode.trim(), note: pendingNote.trim() };
    updateTranscript(transcript.id, { codes: [...transcript.codes, code] });
    setPendingCode(''); setPendingNote(''); setSelected(null);
  };
  return <main className="discipline-workspace">
    <header className="discipline-workspace__header"><div><p className="discipline-workspace__eyebrow">OMI Studio</p><h1>{t.title}</h1><p>{t.subtitle}</p></div><button type="button" onClick={() => downloadWorkspaceJson(safeWorkspaceFileName(project.title, 'social-research-project') + '.json', project)}>{t.export}</button></header>
    <section className="discipline-workspace__section"><h2>{t.project}</h2><div className="discipline-workspace__grid">
      <label>{t.name}<input value={project.title} onChange={e => patch({ title: e.target.value })} /></label>
      <label>{t.question}<textarea value={project.question} onChange={e => patch({ question: e.target.value })} rows={3} /></label>
      <label>{t.method}<textarea value={project.method} onChange={e => patch({ method: e.target.value })} rows={4} /></label>
      <label>{t.ethics}<textarea value={project.ethics} onChange={e => patch({ ethics: e.target.value })} rows={4} /></label>
    </div><p className="discipline-workspace__hint">{t.private}</p></section>
    <section className="discipline-workspace__section"><div className="discipline-workspace__section-title"><h2>{t.variables}</h2><button type="button" onClick={addVariable}>{t.addVariable}</button></div>
      {project.variables.map(variable => <div className="discipline-workspace__card" key={variable.id}><div className="discipline-workspace__grid">
        <label>{t.varName}<input value={variable.name} onChange={e => updateVariable(variable.id, { name: e.target.value })} /></label><label>{t.label}<input value={variable.label} onChange={e => updateVariable(variable.id, { label: e.target.value })} /></label>
        <label>{t.type}<input value={variable.type} onChange={e => updateVariable(variable.id, { type: e.target.value })} /></label><label>{t.values}<textarea value={variable.values} onChange={e => updateVariable(variable.id, { values: e.target.value })} rows={2} /></label>
      </div><button className="discipline-workspace__danger" type="button" onClick={() => patch({ variables: project.variables.filter(v => v.id !== variable.id) })}>{t.remove}</button></div>)}
    </section>
    <section className="discipline-workspace__section"><div className="discipline-workspace__section-title"><h2>{t.transcripts}</h2><button type="button" onClick={addTranscript}>{t.addTranscript}</button></div>
      {project.transcripts.map(item => <article className="discipline-workspace__card" key={item.id}><div className="discipline-workspace__grid"><label>{t.transcriptTitle}<input value={item.title} onChange={e => updateTranscript(item.id, { title: e.target.value })} /></label><label>{t.participant}<input value={item.participant} onChange={e => updateTranscript(item.id, { participant: e.target.value })} /></label></div>
        <label>{t.text}<textarea rows={8} value={item.text} onChange={e => { updateTranscript(item.id, { text: e.target.value }); setSelected(null); }} onSelect={e => { const start = e.currentTarget.selectionStart; const end = e.currentTarget.selectionEnd; setSelected(start < end ? { id: item.id, start, end } : null); }} /></label>
        <div className="discipline-workspace__annotation"><h3>{t.annotation}</h3><p>{selected?.id === item.id ? item.text.slice(selected.start, selected.end) : t.noSelection}</p><div className="discipline-workspace__grid"><label>{t.codeLabel}<input value={pendingCode} onChange={e => setPendingCode(e.target.value)} /></label><label>{t.note}<input value={pendingNote} onChange={e => setPendingNote(e.target.value)} /></label></div><button type="button" disabled={selected?.id !== item.id || !pendingCode.trim()} onClick={applyCode}>{t.apply}</button></div>
        {item.codes.length > 0 && <div><h3>{t.coded}</h3><ul className="discipline-workspace__list">{item.codes.map(code => <li key={code.id}><strong>{code.label}</strong> [{code.start}–{code.end}]: “{code.text}” {code.note && <span>— {code.note}</span>} <button type="button" className="discipline-workspace__danger" onClick={() => updateTranscript(item.id, { codes: item.codes.filter(c => c.id !== code.id) })}>{t.remove}</button></li>)}</ul></div>}
      </article>)}
    </section>
  </main>;
}
