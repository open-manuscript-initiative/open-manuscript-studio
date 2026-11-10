import { useDeferredValue, useMemo, useRef, useState } from 'react';
import { normalizeModuleLocale } from '../moduleLocale';
import { downloadWorkspaceFile, downloadWorkspaceJson, newWorkspaceId, safeWorkspaceFileName, useLocalWorkspace } from '../disciplineWorkspace';
import {
  LITERARY_ANNOTATION_KINDS, LITERARY_RELATIONS, annotationsCsv, concordance,
  createLiteraryWorkspace, extractAnnotation, isAnnotationAnchored, isLiteraryWorkspace,
  uniqueReanchor, wordFrequencies,
  type LiteraryAnnotationKind, type LiteraryRelation, type LiteraryWork,
} from './model';
import '../disciplineWorkspaces.css';

const en = {
  subtitle: 'Works, close reading, interpretive notes, intertextual relations and reproducible text exploration.',
  project: 'Research project', question: 'Research question', method: 'Methodology',
  works: 'Works and editions', addWork: 'Add work', workTitle: 'Title', creator: 'Author / creator',
  date: 'Date', language: 'Language', genre: 'Genre', edition: 'Edition / version',
  source: 'Source / citation', rights: 'Rights / license', text: 'Text / transcription',
  local: 'Research data is stored in this browser on this device. Export JSON regularly; this is not a shared database.',
  remove: 'Remove', importText: 'Import TXT', exportJson: 'Export JSON', importJson: 'Import JSON',
  exportCsv: 'Export annotation CSV', badProject: 'Invalid or incompatible literary research JSON.',
  tooLong: 'The text exceeds the 1,000,000-character limit.', selection: 'Select a passage in the text above.',
  selectionLabel: 'Selected passage', annotations: 'Interpretive annotations', kind: 'Category',
  interpretation: 'Interpretation / claim', evidence: 'Supporting evidence / reference',
  addAnnotation: 'Record annotation', unanchored: 'Source text changed; selection requires review.',
  repair: 'Reanchor unique quotation', cannotRepair: 'No unique exact occurrence; review manually.',
  relations: 'Comparisons and intertextual links', from: 'From work', to: 'To work',
  relation: 'Relation', addRelation: 'Record relation', note: 'Research note',
  frequency: 'Word frequencies', word: 'Word', count: 'Occurrences', total: 'Words',
  unique: 'Unique forms', concordance: 'Concordance', query: 'Search expression',
  noHits: 'No matches', sourceWarning: 'Add a verifiable source/citation before inserting this passage into a manuscript.',
  noWorks: 'Add a work to begin.', noAnnotations: 'No annotations for this work.',
  invalidSelected: 'Select a nonempty passage first.', fileError: 'Could not read the selected file.',
};
const translations: Record<string, typeof en> = {
  en,
  hu: {
    subtitle: 'Művek, szoros szövegolvasás, értelmező jegyzetek, intertextuális kapcsolatok és ellenőrizhető szövegvizsgálat.',
    project: 'Kutatási projekt', question: 'Kutatási kérdés', method: 'Módszertan',
    works: 'Művek és kiadások', addWork: 'Mű hozzáadása', workTitle: 'Cím', creator: 'Szerző / alkotó',
    date: 'Dátum', language: 'Nyelv', genre: 'Műfaj', edition: 'Kiadás / szövegváltozat',
    source: 'Forrás / hivatkozás', rights: 'Jogállás / licenc', text: 'Szöveg / átírás',
    local: 'A kutatási adatok ezen az eszközön, a böngészőben tárolódnak. Rendszeresen készíts JSON-mentést; ez nem közös adatbázis.',
    remove: 'Törlés', importText: 'TXT importálása', exportJson: 'JSON exportálása', importJson: 'JSON importálása',
    exportCsv: 'Annotációk CSV-exportja', badProject: 'Érvénytelen vagy nem kompatibilis irodalomtudományi JSON.',
    tooLong: 'A szöveg túllépi az 1 000 000 karakteres korlátot.', selection: 'Jelölj ki egy szövegrészt a fenti mezőben.',
    selectionLabel: 'Kijelölt szövegrész', annotations: 'Értelmező annotációk', kind: 'Kategória',
    interpretation: 'Értelmezés / állítás', evidence: 'Bizonyíték / szakirodalmi hivatkozás',
    addAnnotation: 'Annotáció rögzítése', unanchored: 'A forrásszöveg megváltozott; a szöveghelyet ellenőrizni kell.',
    repair: 'Egyedi egyezés újracsatolása', cannotRepair: 'Nincs egyértelmű pontos egyezés; kézi ellenőrzés szükséges.',
    relations: 'Összehasonlítások és intertextuális kapcsolatok', from: 'Kiinduló mű', to: 'Kapcsolódó mű',
    relation: 'Kapcsolat', addRelation: 'Kapcsolat rögzítése', note: 'Kutatási jegyzet',
    frequency: 'Szógyakoriság', word: 'Szó', count: 'Előfordulás', total: 'Szavak',
    unique: 'Különböző szóalakok', concordance: 'Konkordancia', query: 'Keresett kifejezés',
    noHits: 'Nincs találat', sourceWarning: 'A kéziratba történő beszúráshoz ellenőrizhető forrásmegjelölés szükséges.',
    noWorks: 'A kezdéshez adj hozzá egy művet.', noAnnotations: 'Ehhez a műhöz még nincs annotáció.',
    invalidSelected: 'Előbb jelölj ki egy nem üres szövegrészt.', fileError: 'A kiválasztott fájl nem olvasható.',
  },
  de: {
    subtitle: 'Werke, Close Reading, Interpretationsnotizen, intertextuelle Beziehungen und überprüfbare Textanalyse.',
    project: 'Forschungsprojekt', question: 'Forschungsfrage', method: 'Methodik',
    works: 'Werke und Ausgaben', addWork: 'Werk hinzufügen', workTitle: 'Titel', creator: 'Autor / Urheber',
    date: 'Datum', language: 'Sprache', genre: 'Gattung', edition: 'Ausgabe / Fassung',
    source: 'Quelle / Zitat', rights: 'Rechte / Lizenz', text: 'Text / Transkription',
    local: 'Die Forschungsdaten werden lokal in diesem Browser gespeichert. JSON regelmäßig exportieren; keine gemeinsame Datenbank.',
    remove: 'Entfernen', importText: 'TXT importieren', exportJson: 'JSON exportieren', importJson: 'JSON importieren',
    exportCsv: 'Annotationen als CSV', badProject: 'Ungültige oder inkompatible literaturwissenschaftliche JSON-Datei.',
    tooLong: 'Text überschreitet die Grenze von 1.000.000 Zeichen.', selection: 'Textpassage im oberen Feld markieren.',
    selectionLabel: 'Markierte Textpassage', annotations: 'Interpretierende Annotationen', kind: 'Kategorie',
    interpretation: 'Deutung / These', evidence: 'Beleg / Literaturhinweis',
    addAnnotation: 'Annotation speichern', unanchored: 'Quelltext geändert; Textstelle muss geprüft werden.',
    repair: 'Eindeutiges Zitat neu verankern', cannotRepair: 'Keine eindeutige Fundstelle; bitte manuell prüfen.',
    relations: 'Vergleiche und intertextuelle Verbindungen', from: 'Ausgangswerk', to: 'Bezugswerk',
    relation: 'Beziehung', addRelation: 'Beziehung speichern', note: 'Forschungsnotiz',
    frequency: 'Worthäufigkeit', word: 'Wort', count: 'Vorkommen', total: 'Wörter',
    unique: 'Unterschiedliche Wortformen', concordance: 'Konkordanz', query: 'Suchausdruck',
    noHits: 'Keine Treffer', sourceWarning: 'Vor Übernahme ins Manuskript muss eine überprüfbare Quelle angegeben werden.',
    noWorks: 'Zunächst ein Werk hinzufügen.', noAnnotations: 'Noch keine Annotationen für dieses Werk.',
    invalidSelected: 'Bitte zuerst eine nichtleere Textpassage markieren.', fileError: 'Datei konnte nicht gelesen werden.',
  },
};

const kindLabels: Record<LiteraryAnnotationKind, { en: string; hu: string; de: string }> = {
  motif: { en: 'Motif', hu: 'Motívum', de: 'Motiv' },
  narratology: { en: 'Narratology', hu: 'Narratológia', de: 'Narratologie' },
  poetics: { en: 'Poetics', hu: 'Poétika', de: 'Poetik' },
  rhetoric: { en: 'Rhetoric', hu: 'Retorika', de: 'Rhetorik' },
  genre: { en: 'Genre', hu: 'Műfaj', de: 'Gattung' },
  intertext: { en: 'Intertext', hu: 'Intertextus', de: 'Intertext' },
  reception: { en: 'Reception', hu: 'Recepció', de: 'Rezeption' },
  other: { en: 'Other', hu: 'Egyéb', de: 'Sonstiges' },
};
const relationLabels: Record<LiteraryRelation, { en: string; hu: string; de: string }> = {
  allusion: { en: 'Allusion', hu: 'Allúzió', de: 'Anspielung' },
  quotation: { en: 'Quotation', hu: 'Idézet', de: 'Zitat' },
  adaptation: { en: 'Adaptation', hu: 'Adaptáció', de: 'Adaption' },
  translation: { en: 'Translation', hu: 'Fordítás', de: 'Übersetzung' },
  influence: { en: 'Influence', hu: 'Hatás', de: 'Einfluss' },
  comparison: { en: 'Comparison', hu: 'Összehasonlítás', de: 'Vergleich' },
};
const blankWork = (): LiteraryWork => ({
  id: newWorkspaceId(), title: '', creator: '', date: '', language: 'hu',
  genre: '', edition: '', source: '', rights: '', text: '',
});

export function LiteraryStudiesPanel({ locale = 'en', storageKey = 'literary-studies' }: { locale?: string; storageKey?: string }) {
  const lang = normalizeModuleLocale(locale);
  const t = translations[lang] ?? en;
  const [workspace, setWorkspace] = useLocalWorkspace(storageKey, createLiteraryWorkspace, isLiteraryWorkspace);
  const [selectedId, setSelectedId] = useState('');
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
  const [kind, setKind] = useState<LiteraryAnnotationKind>('motif');
  const [interpretation, setInterpretation] = useState('');
  const [evidence, setEvidence] = useState('');
  const [query, setQuery] = useState('');
  const [relation, setRelation] = useState<LiteraryRelation>('comparison');
  const [relatedId, setRelatedId] = useState('');
  const [relationNote, setRelationNote] = useState('');
  const [relationEvidence, setRelationEvidence] = useState('');
  const [error, setError] = useState('');
  const projectFile = useRef<HTMLInputElement>(null);
  const textFile = useRef<HTMLInputElement>(null);
  const work = workspace.works.find(w => w.id === selectedId) ?? workspace.works[0];
  const annotations = workspace.annotations.filter(a => a.workId === work?.id);
  const analysisText = useDeferredValue(work?.text ?? '');
  const frequencies = useMemo(() => wordFrequencies(analysisText, work?.language || 'en'), [analysisText, work?.language]);
  const matches = useMemo(() => concordance(analysisText, query, work?.language || 'en'), [analysisText, work?.language, query]);

  const updateProject = (patch: Partial<typeof workspace>) => setWorkspace(current => ({ ...current, ...patch }));
  const updateWork = (patch: Partial<LiteraryWork>) => {
    if (!work) return;
    setWorkspace(current => ({ ...current, works: current.works.map(item => item.id === work.id ? { ...item, ...patch } : item) }));
  };
  const addWork = () => {
    const next = blankWork();
    setWorkspace(current => ({ ...current, works: [...current.works, next] }));
    setSelectedId(next.id);
    setSelection(null);
    setQuery('');
    setError('');
  };
  const removeWork = () => {
    if (!work) return;
    setWorkspace(current => ({
      ...current,
      works: current.works.filter(item => item.id !== work.id),
      annotations: current.annotations.filter(item => item.workId !== work.id),
      relations: current.relations.filter(item => item.fromWorkId !== work.id && item.toWorkId !== work.id),
    }));
    setSelectedId('');
    setSelection(null);
  };
  const addAnnotation = () => {
    if (!work || !selection) { setError(t.invalidSelected); return; }
    const next = extractAnnotation(work, newWorkspaceId(), selection.start, selection.end, kind, interpretation, evidence);
    if (!next) { setError(t.invalidSelected); return; }
    setWorkspace(current => ({ ...current, annotations: [...current.annotations, next] }));
    setInterpretation('');
    setEvidence('');
    setSelection(null);
    setError('');
  };
  const importProject = async (file?: File) => {
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!isLiteraryWorkspace(parsed)) { setError(t.badProject); return; }
      setWorkspace(parsed);
      setSelectedId('');
      setSelection(null);
      setError('');
    } catch { setError(t.badProject); }
  };
  const importText = async (file?: File) => {
    if (!file || !work) return;
    try {
      if (file.size > 4000000) { setError(t.tooLong); return; }
      const text = await file.text();
      if (text.length > 1000000) { setError(t.tooLong); return; }
      updateWork({ text });
      setSelection(null);
      setError('');
    } catch { setError(t.fileError); }
  };
  const addRelation = () => {
    if (!work || !relatedId || relatedId === work.id) return;
    setWorkspace(current => ({ ...current, relations: [...current.relations, {
      id: newWorkspaceId(), fromWorkId: work.id, toWorkId: relatedId,
      relation, evidence: relationEvidence, note: relationNote,
    }] }));
    setRelationNote('');
    setRelationEvidence('');
  };

  return <main className="discipline-workspace">
    <header className="discipline-workspace__header">
      <div><p className="discipline-workspace__eyebrow">OMI Studio</p><h1>{t.project}</h1><p>{t.subtitle}</p></div>
      <div>
        <button type="button" onClick={() => downloadWorkspaceJson(safeWorkspaceFileName(workspace.title, 'literary-studies') + '.json', workspace)}>{t.exportJson}</button>{' '}
        <button type="button" onClick={() => downloadWorkspaceFile('literary-annotations.csv', '\uFEFF' + annotationsCsv(workspace), 'text/csv;charset=utf-8')}>{t.exportCsv}</button>{' '}
        <button type="button" onClick={() => projectFile.current?.click()}>{t.importJson}</button>
        <input ref={projectFile} className="discipline-file" type="file" accept=".json,application/json" onChange={event => { void importProject(event.target.files?.[0]); event.currentTarget.value = ''; }} />
      </div>
    </header>
    <section className="discipline-workspace__section">
      <div className="discipline-workspace__grid">
        <label>{t.project}<input value={workspace.title} onChange={event => updateProject({ title: event.target.value })} /></label>
        <label>{t.question}<input value={workspace.researchQuestion} onChange={event => updateProject({ researchQuestion: event.target.value })} /></label>
      </div>
      <label>{t.method}<textarea rows={2} value={workspace.methodology} onChange={event => updateProject({ methodology: event.target.value })} /></label>
      <p className="discipline-workspace__hint">{t.local}</p>
      {error && <p role="alert">{error}</p>}
    </section>
    <section className="discipline-workspace__section">
      <div className="discipline-workspace__section-title"><h2>{t.works} ({workspace.works.length})</h2><button type="button" onClick={addWork}>{t.addWork}</button></div>
      {workspace.works.length === 0 ? <p>{t.noWorks}</p> : <>
        <label>{t.works}<select value={work?.id ?? ''} onChange={event => { setSelectedId(event.target.value); setSelection(null); setQuery(''); }}>
          {workspace.works.map(item => <option key={item.id} value={item.id}>{item.title || item.id}</option>)}
        </select></label>
        {work && <div className="discipline-workspace__card" key={work.id}>
          <div className="discipline-workspace__grid">
            {([
              ['title', t.workTitle], ['creator', t.creator], ['date', t.date], ['language', t.language],
              ['genre', t.genre], ['edition', t.edition], ['source', t.source], ['rights', t.rights],
            ] as const).map(([field, label]) => <label key={field}>{label}<input value={work[field]} onChange={event => updateWork({ [field]: event.target.value })} /></label>)}
          </div>
          <label>{t.text}<textarea rows={12} maxLength={1000000} value={work.text}
            onChange={event => { updateWork({ text: event.target.value }); setSelection(null); }}
            onSelect={event => { const target = event.currentTarget; setSelection(target.selectionEnd > target.selectionStart ? { start: target.selectionStart, end: target.selectionEnd } : null); }}
          /></label>
          <button type="button" onClick={() => textFile.current?.click()}>{t.importText}</button>{' '}
          <button type="button" className="discipline-workspace__danger" onClick={removeWork}>{t.remove}</button>
          <input ref={textFile} className="discipline-file" type="file" accept=".txt,.md,text/plain,text/markdown" onChange={event => { void importText(event.target.files?.[0]); event.currentTarget.value = ''; }} />
          {!work.source.trim() && <p className="discipline-workspace__hint">{t.sourceWarning}</p>}
        </div>}
      </>}
    </section>
    {work && <>
      <section className="discipline-workspace__section">
        <div className="discipline-workspace__section-title"><h2>{t.annotations} ({annotations.length})</h2></div>
        <p>{t.selectionLabel}: <strong>{selection ? work.text.slice(selection.start, selection.end).slice(0, 300) : t.selection}</strong></p>
        <div className="discipline-workspace__grid">
          <label>{t.kind}<select value={kind} onChange={event => setKind(event.target.value as LiteraryAnnotationKind)}>
            {LITERARY_ANNOTATION_KINDS.map(item => <option key={item} value={item}>{kindLabels[item][lang === 'de' || lang === 'hu' ? lang : 'en']}</option>)}
          </select></label>
          <label>{t.evidence}<input value={evidence} onChange={event => setEvidence(event.target.value)} /></label>
        </div>
        <label>{t.interpretation}<textarea rows={3} value={interpretation} onChange={event => setInterpretation(event.target.value)} /></label>
        <button type="button" onClick={addAnnotation}>{t.addAnnotation}</button>
        {annotations.length === 0 ? <p>{t.noAnnotations}</p> : annotations.map(annotation => {
          const anchored = isAnnotationAnchored(annotation, work);
          return <article className="discipline-workspace__card" key={annotation.id}>
            <p><strong>{kindLabels[annotation.kind][lang === 'de' || lang === 'hu' ? lang : 'en']}</strong> · {annotation.start}–{annotation.end}</p>
            <blockquote>{annotation.quote}</blockquote>
            {!anchored && <p role="alert">{t.unanchored}</p>}
            <p>{annotation.interpretation}</p>
            {annotation.evidence && <p>{t.evidence}: {annotation.evidence}</p>}
            {!anchored && <button type="button" onClick={() => {
              const revised = uniqueReanchor(annotation, work);
              if (!revised) { setError(t.cannotRepair); return; }
              setWorkspace(current => ({ ...current, annotations: current.annotations.map(item => item.id === annotation.id ? revised : item) }));
              setError('');
            }}>{t.repair}</button>}{' '}
            <button type="button" className="discipline-workspace__danger" onClick={() => setWorkspace(current => ({ ...current, annotations: current.annotations.filter(item => item.id !== annotation.id) }))}>{t.remove}</button>
          </article>;
        })}
      </section>
      <section className="discipline-workspace__section">
        <h2>{t.frequency}</h2><p>{t.total}: {frequencies.reduce((sum, entry) => sum + entry.count, 0)} · {t.unique}: {frequencies.length}</p>
        <p>{frequencies.slice(0, 20).map(entry => entry.word + ' (' + entry.count + ')').join(', ')}</p>
        <h2>{t.concordance}</h2>
        <label>{t.query}<input value={query} onChange={event => setQuery(event.target.value)} /></label>
        {query.trim() && (matches.length ? <ol>{matches.map(match =>
          <li key={match.offset}><span>{match.before}</span><strong>{match.hit}</strong><span>{match.after}</span></li>,
        )}</ol> : <p>{t.noHits}</p>)}
      </section>
      <section className="discipline-workspace__section">
        <h2>{t.relations} ({workspace.relations.filter(r => r.fromWorkId === work.id || r.toWorkId === work.id).length})</h2>
        {workspace.works.length > 1 && <>
          <div className="discipline-workspace__grid">
            <label>{t.to}<select value={relatedId} onChange={event => setRelatedId(event.target.value)}>
              <option value="">—</option>
              {workspace.works.filter(item => item.id !== work.id).map(item => <option key={item.id} value={item.id}>{item.title || item.id}</option>)}
            </select></label>
            <label>{t.relation}<select value={relation} onChange={event => setRelation(event.target.value as LiteraryRelation)}>
              {LITERARY_RELATIONS.map(item => <option key={item} value={item}>{relationLabels[item][lang === 'de' || lang === 'hu' ? lang : 'en']}</option>)}
            </select></label>
          </div>
          <label>{t.note}<textarea rows={2} value={relationNote} onChange={event => setRelationNote(event.target.value)} /></label>
          <label>{t.evidence}<input value={relationEvidence} onChange={event => setRelationEvidence(event.target.value)} /></label>
          <button type="button" onClick={addRelation}>{t.addRelation}</button>
        </>}
        {workspace.relations.filter(r => r.fromWorkId === work.id || r.toWorkId === work.id).map(item =>
          <article key={item.id} className="discipline-workspace__card">
            <strong>{workspace.works.find(w => w.id === item.fromWorkId)?.title} — {relationLabels[item.relation][lang === 'de' || lang === 'hu' ? lang : 'en']} — {workspace.works.find(w => w.id === item.toWorkId)?.title}</strong>
            <p>{item.note}</p>
            {item.evidence && <p>{t.evidence}: {item.evidence}</p>}
            <button type="button" className="discipline-workspace__danger" onClick={() => setWorkspace(current => ({ ...current, relations: current.relations.filter(r => r.id !== item.id) }))}>{t.remove}</button>
          </article>,
        )}
      </section>
    </>}
  </main>;
}
