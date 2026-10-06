import { useEffect, useMemo, useRef, useState } from 'react';
import './corpusLinguistics.css';

type AnnotationCategory = 'pos' | 'lemma' | 'morphology' | 'named-entity' | 'semantics' | 'other';
interface CorpusDocument {
  id: string;
  title: string;
  source: string;
  date: string;
  language: string;
  text: string;
}
interface TextAnnotation {
  id: string;
  documentId: string;
  start: number;
  end: number;
  surface: string;
  category: AnnotationCategory;
  label: string;
  note: string;
}
interface TextAlignment {
  id: string;
  leftDocumentId: string;
  rightDocumentId: string;
  label: string;
  leftText: string;
  rightText: string;
}
interface CorpusProject {
  version: 1;
  title: string;
  description: string;
  language: string;
  documents: CorpusDocument[];
  annotations: TextAnnotation[];
  alignments: TextAlignment[];
}
interface CorpusLinguisticsPanelProps {
  locale?: string;
  storageKey?: string;
}
interface ConcordanceHit {
  key: string;
  document: CorpusDocument;
  start: number;
  end: number;
  left: string;
  match: string;
  right: string;
}

const STORAGE_PREFIX = 'omi:corpus-linguistics:v1:';
const categories: AnnotationCategory[] = ['pos', 'lemma', 'morphology', 'named-entity', 'semantics', 'other'];

interface CorpusCopy {
  intro: string; corpus: string; corpusTitle: string; description: string; language: string;
  documents: string; addDocument: string; documentTitle: string; source: string; date: string;
  text: string; remove: string; importText: string; search: string; query: string; caseSensitive: string;
  wholeWord: string; results: string; noHits: string; hit: string; annotate: string; saveAnnotation: string;
  category: string; label: string; note: string; annotations: string; noAnnotations: string;
  alignment: string; leftDocument: string; rightDocument: string; alignmentLabel: string;
  leftPassage: string; rightPassage: string; addAlignment: string; noAlignment: string;
  export: string; exportJson: string; exportCsv: string; importJson: string; saved: string; backup: string;
  invalidProject: string; loadError: string; categoryNames: Record<AnnotationCategory, string>;
  sourcePlaceholder: string; datePlaceholder: string; queryPlaceholder: string; deleteAnnotation: string;
  chars: string; wordCount: string;
}
const copyByLocale: Record<string, CorpusCopy> = {
  hu: {
    intro: 'Építsen saját szövegkorpuszt, készítsen konkordanciát a találatok szövegkörnyezetével, jelölje nyelvi és névelem-funkciókat, és kézzel illesszen egymáshoz párhuzamos szövegrészleteket.',
    corpus: 'Korpusz beállításai', corpusTitle: 'A korpusz neve', description: 'Leírás', language: 'Alapértelmezett nyelv',
    documents: 'Szövegek', addDocument: 'Szöveg hozzáadása', documentTitle: 'Cím', source: 'Forrás / eredet', date: 'Dátum', text: 'Szöveg', remove: 'Eltávolítás',
    importText: 'TXT vagy MD importálása', search: 'Konkordancia keresése', query: 'Keresőkifejezés', caseSensitive: 'Kis- és nagybetű megkülönböztetése', wholeWord: 'Teljes szó keresése', results: 'Konkordancia találatai', noHits: 'Nincs találat a korpusz szövegeiben.', hit: 'találat', annotate: 'Annotálás', saveAnnotation: 'Annotáció mentése',
    category: 'Kategória', label: 'Címke / érték', note: 'Megjegyzés', annotations: 'Nyelvi annotációk', noAnnotations: 'Még nincs mentett annotáció.',
    alignment: 'Párhuzamos szövegek illesztése', leftDocument: 'Bal oldali szöveg', rightDocument: 'Jobb oldali szöveg', alignmentLabel: 'Illesztett egység címe', leftPassage: 'Bal oldali részlet', rightPassage: 'Jobb oldali részlet', addAlignment: 'Illesztés mentése', noAlignment: 'Még nincs mentett illesztés.',
    export: 'Exportálás', exportJson: 'Korpusz JSON letöltése', exportCsv: 'Konkordancia CSV letöltése', importJson: 'Korpusz JSON betöltése', saved: 'Automatikusan mentve ezen az eszközön.', backup: 'A JSON exporttal készíthet hordozható biztonsági másolatot.',
    invalidProject: 'A fájl nem érvényes OMI korpuszprojekt.', loadError: 'A fájl beolvasása nem sikerült.', categoryNames: { pos: 'Szófaj', lemma: 'Lemma', morphology: 'Morfológia', 'named-entity': 'Tulajdonnév / entitás', semantics: 'Szemantikai címke', other: 'Egyéb' },
    sourcePlaceholder: 'pl. kézirat, kiadás, URL', datePlaceholder: 'pl. 1670 körül', queryPlaceholder: 'Szó vagy kifejezés', deleteAnnotation: 'Annotáció törlése', chars: 'karakter', wordCount: 'szó',
  },
  en: {
    intro: 'Build a text corpus, create context-rich concordances, annotate linguistic and named-entity features, and manually align passages across texts.',
    corpus: 'Corpus settings', corpusTitle: 'Corpus name', description: 'Description', language: 'Default language',
    documents: 'Texts', addDocument: 'Add text', documentTitle: 'Title', source: 'Source / provenance', date: 'Date', text: 'Text', remove: 'Remove',
    importText: 'Import TXT or MD', search: 'Concordance search', query: 'Search term', caseSensitive: 'Match case', wholeWord: 'Whole word only', results: 'Concordance results', noHits: 'No matches in the corpus texts.', hit: 'hits', annotate: 'Annotate', saveAnnotation: 'Save annotation',
    category: 'Category', label: 'Label / value', note: 'Note', annotations: 'Linguistic annotations', noAnnotations: 'No annotations have been saved yet.',
    alignment: 'Parallel text alignment', leftDocument: 'Left text', rightDocument: 'Right text', alignmentLabel: 'Aligned unit label', leftPassage: 'Left passage', rightPassage: 'Right passage', addAlignment: 'Save alignment', noAlignment: 'No alignments have been saved yet.',
    export: 'Export', exportJson: 'Download corpus JSON', exportCsv: 'Download concordance CSV', importJson: 'Import corpus JSON', saved: 'Automatically saved on this device.', backup: 'Download JSON to create a portable backup.',
    invalidProject: 'This is not a valid OMI corpus project.', loadError: 'The file could not be read.', categoryNames: { pos: 'Part of speech', lemma: 'Lemma', morphology: 'Morphology', 'named-entity': 'Named entity', semantics: 'Semantic label', other: 'Other' },
    sourcePlaceholder: 'e.g. manuscript, edition, URL', datePlaceholder: 'e.g. c. 1670', queryPlaceholder: 'Word or phrase', deleteAnnotation: 'Delete annotation', chars: 'characters', wordCount: 'words',
  },
  de: {
    intro: 'Erstellen Sie ein Textkorpus, erzeugen Sie Konkordanzen mit Kontext, annotieren Sie sprachliche Merkmale und Eigennamen und richten Sie parallele Textstellen manuell aus.',
    corpus: 'Korpuseinstellungen', corpusTitle: 'Name des Korpus', description: 'Beschreibung', language: 'Standardsprache',
    documents: 'Texte', addDocument: 'Text hinzufügen', documentTitle: 'Titel', source: 'Quelle / Herkunft', date: 'Datum', text: 'Text', remove: 'Entfernen',
    importText: 'TXT oder MD importieren', search: 'Konkordanzsuche', query: 'Suchbegriff', caseSensitive: 'Groß- und Kleinschreibung beachten', wholeWord: 'Nur ganzes Wort', results: 'Konkordanzergebnisse', noHits: 'Keine Treffer in den Korpustexten.', hit: 'Treffer', annotate: 'Annotieren', saveAnnotation: 'Annotation speichern',
    category: 'Kategorie', label: 'Merkmal / Wert', note: 'Anmerkung', annotations: 'Sprachliche Annotationen', noAnnotations: 'Es wurden noch keine Annotationen gespeichert.',
    alignment: 'Parallele Texte ausrichten', leftDocument: 'Linker Text', rightDocument: 'Rechter Text', alignmentLabel: 'Bezeichnung der Einheit', leftPassage: 'Linke Passage', rightPassage: 'Rechte Passage', addAlignment: 'Ausrichtung speichern', noAlignment: 'Es wurden noch keine Ausrichtungen gespeichert.',
    export: 'Export', exportJson: 'Korpus-JSON herunterladen', exportCsv: 'Konkordanz-CSV herunterladen', importJson: 'Korpus-JSON importieren', saved: 'Automatisch auf diesem Gerät gespeichert.', backup: 'Laden Sie das JSON als portable Sicherung herunter.',
    invalidProject: 'Dies ist kein gültiges OMI-Korpusprojekt.', loadError: 'Die Datei konnte nicht gelesen werden.', categoryNames: { pos: 'Wortart', lemma: 'Lemma', morphology: 'Morphologie', 'named-entity': 'Eigenname / Entität', semantics: 'Semantische Kennzeichnung', other: 'Sonstiges' },
    sourcePlaceholder: 'z. B. Handschrift, Ausgabe, URL', datePlaceholder: 'z. B. um 1670', queryPlaceholder: 'Wort oder Ausdruck', deleteAnnotation: 'Annotation löschen', chars: 'Zeichen', wordCount: 'Wörter',
  },
};
function makeId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
function blankDocument(language: string): CorpusDocument {
  return { id: makeId(), title: '', source: '', date: '', language, text: '' };
}
function isProject(value: unknown): value is CorpusProject {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<CorpusProject>;
  return item.version === 1 && typeof item.title === 'string' && typeof item.description === 'string'
    && typeof item.language === 'string' && Array.isArray(item.documents) && Array.isArray(item.annotations)
    && Array.isArray(item.alignments)
    && item.documents.every((doc) => doc && typeof doc.id === 'string' && typeof doc.title === 'string' && typeof doc.text === 'string');
}
function safeName(value: string): string {
  return (value || 'corpus').normalize('NFKD').replace(/[^\w.-]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'corpus';
}
function downloadFile(name: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  URL.revokeObjectURL(url);
}
function contextAt(text: string, start: number, end: number, size = 42) {
  return {
    left: text.slice(Math.max(0, start - size), start).replace(/\s+/g, ' '),
    match: text.slice(start, end),
    right: text.slice(end, Math.min(text.length, end + size)).replace(/\s+/g, ' '),
  };
}
function wordCharacter(character: string | undefined): boolean {
  return Boolean(character && /[\p{L}\p{N}_]/u.test(character));
}
function searchCorpus(documents: CorpusDocument[], query: string, caseSensitive: boolean, wholeWord: boolean): ConcordanceHit[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const expression = new RegExp(escaped, caseSensitive ? 'gu' : 'giu');
  const hits: ConcordanceHit[] = [];
  for (const document of documents) {
    expression.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = expression.exec(document.text)) !== null) {
      const start = match.index; const end = start + match[0].length;
      if (wholeWord && (wordCharacter(document.text[start - 1]) || wordCharacter(document.text[end]))) {
        if (match[0].length === 0) expression.lastIndex += 1;
        continue;
      }
      const context = contextAt(document.text, start, end);
      hits.push({ key: `${document.id}:${start}`, document, start, end, ...context });
      if (hits.length >= 5000) return hits;
      if (match[0].length === 0) expression.lastIndex += 1;
    }
  }
  return hits;
}
function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}
function validAnnotation(item: TextAnnotation): boolean {
  return Boolean(item.label.trim());
}

export function CorpusLinguisticsPanel({ locale = 'hu', storageKey = 'default' }: CorpusLinguisticsPanelProps) {
  const copy = copyByLocale[locale] ?? copyByLocale.en;
  const key = `${STORAGE_PREFIX}${storageKey}`;
  const [project, setProject] = useState<CorpusProject>(() => {
    if (typeof window === 'undefined') return { version: 1, title: '', description: '', language: 'hu', documents: [], annotations: [], alignments: [] };
    try {
      const saved = window.localStorage.getItem(key);
      if (!saved) return { version: 1, title: '', description: '', language: ['hu', 'en', 'de'].includes(locale) ? locale : 'en', documents: [], annotations: [], alignments: [] };
      const parsed: unknown = JSON.parse(saved);
      return isProject(parsed) ? parsed : { version: 1, title: '', description: '', language: 'hu', documents: [], annotations: [], alignments: [] };
    } catch {
      return { version: 1, title: '', description: '', language: 'hu', documents: [], annotations: [], alignments: [] };
    }
  });
  const [query, setQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [annotationDraft, setAnnotationDraft] = useState<{ hitKey: string; category: AnnotationCategory; label: string; note: string } | null>(null);
  const [alignmentDraft, setAlignmentDraft] = useState({ leftDocumentId: '', rightDocumentId: '', label: '', leftText: '', rightText: '' });
  const [status, setStatus] = useState(copy.saved);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(project));
      setStatus(copy.saved);
    } catch {
      setStatus(copy.backup);
    }
  }, [copy.backup, copy.saved, key, project]);

  const hits = useMemo(() => searchCorpus(project.documents, query, caseSensitive, wholeWord), [project.documents, query, caseSensitive, wholeWord]);
  const updateDocument = (id: string, patch: Partial<CorpusDocument>) => setProject((current) => ({
    ...current, documents: current.documents.map((document) => document.id === id ? { ...document, ...patch } : document),
  }));
  const addDocument = () => setProject((current) => ({ ...current, documents: [...current.documents, blankDocument(current.language)] }));
  const removeDocument = (id: string) => setProject((current) => ({
    ...current, documents: current.documents.filter((document) => document.id !== id),
    annotations: current.annotations.filter((annotation) => annotation.documentId !== id),
    alignments: current.alignments.filter((alignment) => alignment.leftDocumentId !== id && alignment.rightDocumentId !== id),
  }));
  const addAnnotation = (hit: ConcordanceHit, draft: NonNullable<typeof annotationDraft>) => {
    const annotation: TextAnnotation = {
      id: makeId(), documentId: hit.document.id, start: hit.start, end: hit.end, surface: hit.match,
      category: draft.category, label: draft.label.trim(), note: draft.note.trim(),
    };
    if (!validAnnotation(annotation)) return;
    setProject((current) => ({ ...current, annotations: [...current.annotations, annotation] }));
    setAnnotationDraft(null);
  };
  const importFile = async (file: File | undefined, asText = false) => {
    if (!file) return;
    try {
      const raw = await file.text();
      if (asText) {
        setProject((current) => ({
          ...current,
          documents: [...current.documents, { ...blankDocument(current.language), title: file.name.replace(/\.[^.]+$/, ''), source: file.name, text: raw }],
        }));
      } else {
        const parsed: unknown = JSON.parse(raw);
        if (!isProject(parsed)) throw new Error('invalid');
        setProject(parsed);
      }
    } catch {
      setStatus(asText ? copy.loadError : copy.invalidProject);
    }
  };
  const saveAlignment = () => {
    if (!alignmentDraft.leftDocumentId || !alignmentDraft.rightDocumentId || alignmentDraft.leftDocumentId === alignmentDraft.rightDocumentId) return;
    const alignment: TextAlignment = { id: makeId(), ...alignmentDraft };
    setProject((current) => ({ ...current, alignments: [...current.alignments, alignment] }));
    setAlignmentDraft((current) => ({ ...current, label: '', leftText: '', rightText: '' }));
  };
  const exportCsv = () => {
    const rows = [['document', 'source', 'locus_start', 'locus_end', 'left_context', 'match', 'right_context']];
    for (const hit of hits) rows.push([hit.document.title, hit.document.source, String(hit.start), String(hit.end), hit.left, hit.match, hit.right]);
    downloadFile(`${safeName(project.title)}-concordance.csv`, rows.map((row) => row.map(csvCell).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
  };
  const totalWords = project.documents.reduce((total, doc) => total + (doc.text.match(/[\p{L}\p{N}]+/gu)?.length ?? 0), 0);

  return (
    <div className="corpus-linguistics">
      <p className="corpus-linguistics-intro">{copy.intro}</p>
      <section className="corpus-card">
        <header className="corpus-heading"><h5>{copy.corpus}</h5><span role="status">{status}</span></header>
        <div className="corpus-project-fields">
          <label>{copy.corpusTitle}<input value={project.title} onChange={(event) => setProject((current) => ({ ...current, title: event.target.value }))} /></label>
          <label>{copy.language}<input value={project.language} onChange={(event) => setProject((current) => ({ ...current, language: event.target.value }))} placeholder="hu" /></label>
          <label className="corpus-wide">{copy.description}<textarea rows={2} value={project.description} onChange={(event) => setProject((current) => ({ ...current, description: event.target.value }))} /></label>
        </div>
      </section>

      <section className="corpus-card">
        <header className="corpus-heading"><div><h5>{copy.documents}</h5><span>{project.documents.length} · {totalWords} {copy.wordCount}</span></div><div className="corpus-actions">
          <button type="button" onClick={addDocument}>＋ {copy.addDocument}</button>
          <button type="button" onClick={() => textInputRef.current?.click()}>{copy.importText}</button>
          <input ref={textInputRef} className="corpus-file-input" type="file" accept=".txt,.md,text/plain,text/markdown" onChange={(event) => { void importFile(event.target.files?.[0], true); event.currentTarget.value = ''; }} />
        </div></header>
        {project.documents.length === 0 ? <p className="corpus-empty">{copy.documents}: 0</p> : (
          <div className="corpus-documents">
            {project.documents.map((document) => <article className="corpus-document" key={document.id}>
              <div className="corpus-document-fields">
                <label>{copy.documentTitle}<input value={document.title} onChange={(event) => updateDocument(document.id, { title: event.target.value })} /></label>
                <label>{copy.source}<input value={document.source} placeholder={copy.sourcePlaceholder} onChange={(event) => updateDocument(document.id, { source: event.target.value })} /></label>
                <label>{copy.date}<input value={document.date} placeholder={copy.datePlaceholder} onChange={(event) => updateDocument(document.id, { date: event.target.value })} /></label>
                <label>{copy.language}<input value={document.language} onChange={(event) => updateDocument(document.id, { language: event.target.value })} /></label>
                <button type="button" className="corpus-danger" onClick={() => removeDocument(document.id)}>{copy.remove}</button>
              </div>
              <label className="corpus-document-text">{copy.text}<textarea rows={8} value={document.text} onChange={(event) => updateDocument(document.id, { text: event.target.value })} /></label>
              <small>{document.text.length} {copy.chars}</small>
            </article>)}
          </div>
        )}
      </section>

      <section className="corpus-card">
        <header className="corpus-heading"><div><h5>{copy.search}</h5><span>{hits.length} {copy.hit}</span></div></header>
        <label className="corpus-query">{copy.query}<input value={query} placeholder={copy.queryPlaceholder} onChange={(event) => setQuery(event.target.value)} /></label>
        <div className="corpus-options">
          <label><input type="checkbox" checked={caseSensitive} onChange={(event) => setCaseSensitive(event.target.checked)} />{copy.caseSensitive}</label>
          <label><input type="checkbox" checked={wholeWord} onChange={(event) => setWholeWord(event.target.checked)} />{copy.wholeWord}</label>
        </div>
        <h6>{copy.results}</h6>
        {query.trim() && hits.length === 0 ? <p className="corpus-empty">{copy.noHits}</p> : null}
        <div className="corpus-results">
          {hits.slice(0, 250).map((hit) => {
            const existing = project.annotations.filter((annotation) => annotation.documentId === hit.document.id && annotation.start === hit.start && annotation.end === hit.end);
            const draft = annotationDraft?.hitKey === hit.key ? annotationDraft : null;
            return <article className="corpus-hit" key={hit.key}>
              <div className="corpus-hit-meta"><strong>{hit.document.title || hit.document.source || copy.documents}</strong><span>{hit.start}–{hit.end}</span></div>
              <p className="corpus-kwic"><span>{hit.left}</span><mark>{hit.match}</mark><span>{hit.right}</span></p>
              {existing.length > 0 && <ul className="corpus-existing-annotations">{existing.map((annotation) => <li key={annotation.id}><b>{copy.categoryNames[annotation.category]}</b>: {annotation.label}{annotation.note && <span> — {annotation.note}</span>} <button type="button" className="corpus-link-button" onClick={() => setProject((current) => ({ ...current, annotations: current.annotations.filter((item) => item.id !== annotation.id) }))}>{copy.deleteAnnotation}</button></li>)}</ul>}
              {!draft ? <button type="button" onClick={() => setAnnotationDraft({ hitKey: hit.key, category: 'pos', label: '', note: '' })}>{copy.annotate}</button> : (
                <div className="corpus-annotation-form">
                  <label>{copy.category}<select value={draft.category} onChange={(event) => setAnnotationDraft({ ...draft, category: event.target.value as AnnotationCategory })}>{categories.map((category) => <option key={category} value={category}>{copy.categoryNames[category]}</option>)}</select></label>
                  <label>{copy.label}<input value={draft.label} onChange={(event) => setAnnotationDraft({ ...draft, label: event.target.value })} /></label>
                  <label>{copy.note}<input value={draft.note} onChange={(event) => setAnnotationDraft({ ...draft, note: event.target.value })} /></label>
                  <button type="button" disabled={!draft.label.trim()} onClick={() => addAnnotation(hit, draft)}>{copy.saveAnnotation}</button>
                </div>
              )}
            </article>;
          })}
        </div>
      </section>

      <section className="corpus-card">
        <header className="corpus-heading"><h5>{copy.annotations}</h5><span>{project.annotations.length}</span></header>
        {project.annotations.length === 0 ? <p className="corpus-empty">{copy.noAnnotations}</p> : <div className="corpus-table-wrap"><table className="corpus-table"><thead><tr><th>{copy.documentTitle}</th><th>{copy.category}</th><th>{copy.label}</th><th>{copy.note}</th><th>Text</th></tr></thead><tbody>
          {project.annotations.map((annotation) => <tr key={annotation.id}><td>{project.documents.find((doc) => doc.id === annotation.documentId)?.title ?? ''}</td><td>{copy.categoryNames[annotation.category]}</td><td>{annotation.label}</td><td>{annotation.note}</td><td>{annotation.surface} <small>({annotation.start}–{annotation.end})</small></td></tr>)}
        </tbody></table></div>}
      </section>

      <section className="corpus-card">
        <header className="corpus-heading"><div><h5>{copy.alignment}</h5><span>{project.alignments.length}</span></div></header>
        {project.documents.length < 2 ? <p className="corpus-empty">{copy.alignment}: 2</p> : <>
          <div className="corpus-alignment-fields">
            <label>{copy.leftDocument}<select value={alignmentDraft.leftDocumentId} onChange={(event) => setAlignmentDraft((current) => ({ ...current, leftDocumentId: event.target.value }))}><option value="">—</option>{project.documents.map((doc) => <option key={doc.id} value={doc.id}>{doc.title || doc.source || doc.id}</option>)}</select></label>
            <label>{copy.rightDocument}<select value={alignmentDraft.rightDocumentId} onChange={(event) => setAlignmentDraft((current) => ({ ...current, rightDocumentId: event.target.value }))}><option value="">—</option>{project.documents.map((doc) => <option key={doc.id} value={doc.id}>{doc.title || doc.source || doc.id}</option>)}</select></label>
            <label>{copy.alignmentLabel}<input value={alignmentDraft.label} onChange={(event) => setAlignmentDraft((current) => ({ ...current, label: event.target.value }))} /></label>
            <label>{copy.leftPassage}<textarea rows={3} value={alignmentDraft.leftText} onChange={(event) => setAlignmentDraft((current) => ({ ...current, leftText: event.target.value }))} /></label>
            <label>{copy.rightPassage}<textarea rows={3} value={alignmentDraft.rightText} onChange={(event) => setAlignmentDraft((current) => ({ ...current, rightText: event.target.value }))} /></label>
          </div>
          <button type="button" disabled={!alignmentDraft.leftDocumentId || !alignmentDraft.rightDocumentId || alignmentDraft.leftDocumentId === alignmentDraft.rightDocumentId} onClick={saveAlignment}>{copy.addAlignment}</button>
        </>}
        {project.alignments.length === 0 ? <p className="corpus-empty">{copy.noAlignment}</p> : <div className="corpus-alignments">{project.alignments.map((alignment) => <article key={alignment.id} className="corpus-alignment"><strong>{alignment.label}</strong><div><p>{alignment.leftText}</p><span>↔</span><p>{alignment.rightText}</p></div></article>)}</div>}
      </section>

      <section className="corpus-card corpus-export">
        <h5>{copy.export}</h5>
        <div className="corpus-actions">
          <button type="button" onClick={() => downloadFile(`${safeName(project.title)}.json`, JSON.stringify(project, null, 2), 'application/json;charset=utf-8')}>{copy.exportJson}</button>
          <button type="button" onClick={exportCsv}>{copy.exportCsv}</button>
          <button type="button" onClick={() => jsonInputRef.current?.click()}>{copy.importJson}</button>
          <input ref={jsonInputRef} className="corpus-file-input" type="file" accept="application/json,.json" onChange={(event) => { void importFile(event.target.files?.[0]); event.currentTarget.value = ''; }} />
        </div>
        <p>{copy.backup}</p>
      </section>
    </div>
  );
}
