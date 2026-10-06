import { useEffect, useMemo, useRef, useState } from 'react';
import './criticalTextEdition.css';

type ReadingKind = 'substitution' | 'omission' | 'addition' | 'orthography' | 'transposition';
interface Witness {
  id: string;
  siglum: string;
  description: string;
  repository: string;
  shelfmark: string;
  date: string;
}
interface Reading {
  text: string;
  kind: ReadingKind;
  note: string;
}
interface EditionSegment {
  id: string;
  locus: string;
  lemma: string;
  readings: Record<string, Reading>;
}
interface EditionProject {
  version: 1;
  title: string;
  language: string;
  editorialPrinciple: string;
  witnesses: Witness[];
  segments: EditionSegment[];
}
interface CriticalTextEditionPanelProps {
  locale?: string;
  storageKey?: string;
}

const STORAGE_PREFIX = 'omi:critical-edition:v1:';
const EMPTY_PROJECT: EditionProject = {
  version: 1,
  title: '',
  language: 'hu',
  editorialPrinciple: '',
  witnesses: [],
  segments: [],
};
const kinds: ReadingKind[] = ['substitution', 'omission', 'addition', 'orthography', 'transposition'];

const copyByLocale: Record<string, Record<string, string>> = {
  hu: {
    intro: 'Hozza létre a kiadási projektet, írja le a kézirati tanúkat, majd szöveghelyenként rögzítse a főszöveget és az eltéréseket. A változatok a kritikai apparátusban is megjelennek.',
    project: 'Kiadási projekt', title: 'A kiadás címe', language: 'A szöveg nyelve', principle: 'Szerkesztési alapelvek',
    witnesses: 'Kézirati tanúk', addWitness: 'Tanú hozzáadása', siglum: 'Jelzet', witnessDesc: 'Leírás', repository: 'Őrzőhely', shelfmark: 'Raktári jelzet', date: 'Dátum / datálás', remove: 'Eltávolítás',
    segments: 'Szöveghelyek és kolláció', addSegment: 'Szöveghely hozzáadása', locus: 'Hely (pl. 1. levél, 2r)', lemma: 'Főszöveg / lemma', reading: 'Tanú olvasata',
    kind: 'Eltérés típusa', note: 'Szerkesztői megjegyzés', apparatus: 'Kritikai apparátus', noVariants: 'Ezen a helyen még nincs rögzített eltérés.',
    kinds: { substitution: 'szövegváltozat', omission: 'kihagyás', addition: 'betoldás', orthography: 'helyesírási eltérés', transposition: 'szórend / áthelyezés' },
    export: 'Export', exportTei: 'TEI XML letöltése', exportJson: 'Projekt JSON letöltése', importJson: 'Projekt JSON betöltése', importText: 'Szövegfájl betöltése a főszövegbe', import: 'Betöltés', saved: 'Automatikusan mentve ezen az eszközön.', backup: 'A JSON exporttal készíthet hordozható biztonsági másolatot.', deleteSegment: 'Szöveghely törlése',
    noWitness: 'Adjon hozzá legalább egy kézirati tanút a kolláció megkezdéséhez.', noSegment: 'Adjon hozzá szöveghelyet a szerkesztés megkezdéséhez.', invalidProject: 'A fájl nem érvényes OMI kritikai kiadási projekt.', loadError: 'A fájl beolvasása nem sikerült.', untitled: 'Névtelen kritikai szövegkiadás', ready: 'A kiadás váza elkészült. A tanúkhoz tartozó mezők és szöveghelyek szerkeszthetők.',
  },
  en: {
    intro: 'Set up an edition, describe its manuscript witnesses, then record the edited text and differences locus by locus. Witness readings feed the critical apparatus.',
    project: 'Edition project', title: 'Edition title', language: 'Text language', principle: 'Editorial principles',
    witnesses: 'Manuscript witnesses', addWitness: 'Add witness', siglum: 'Siglum', witnessDesc: 'Description', repository: 'Holding institution', shelfmark: 'Shelfmark', date: 'Date / dating', remove: 'Remove',
    segments: 'Text loci and collation', addSegment: 'Add text locus', locus: 'Locus (e.g. fol. 1, 2r)', lemma: 'Edited text / lemma', reading: 'Witness reading',
    kind: 'Variant type', note: 'Editorial note', apparatus: 'Critical apparatus', noVariants: 'No variants have been recorded at this locus.',
    kinds: { substitution: 'substitution', omission: 'omission', addition: 'addition', orthography: 'orthographic variant', transposition: 'transposition' },
    export: 'Export', exportTei: 'Download TEI XML', exportJson: 'Download project JSON', importJson: 'Import project JSON', importText: 'Load a text file into the edited text', import: 'Import', saved: 'Automatically saved on this device.', backup: 'Download project JSON to create a portable backup.', deleteSegment: 'Delete locus',
    noWitness: 'Add at least one manuscript witness to begin collation.', noSegment: 'Add a text locus to begin editing.', invalidProject: 'This is not a valid OMI critical edition project.', loadError: 'The file could not be read.', untitled: 'Untitled critical edition', ready: 'The edition workspace is ready. Witness fields and text loci can be edited.',
  },
  de: {
    intro: 'Legen Sie eine Edition an, beschreiben Sie die Handschriftenzeugen und erfassen Sie edierten Text und Abweichungen Abschnitt für Abschnitt. Die Lesarten der Zeugen fließen in den kritischen Apparat ein.',
    project: 'Editionsprojekt', title: 'Titel der Edition', language: 'Sprache des Textes', principle: 'Editionsrichtlinien',
    witnesses: 'Handschriftenzeugen', addWitness: 'Zeugen hinzufügen', siglum: 'Sigle', witnessDesc: 'Beschreibung', repository: 'Aufbewahrende Institution', shelfmark: 'Signatur', date: 'Datum / Datierung', remove: 'Entfernen',
    segments: 'Textstellen und Kollation', addSegment: 'Textstelle hinzufügen', locus: 'Stelle (z. B. Bl. 1, 2r)', lemma: 'Edierter Text / Lemma', reading: 'Lesart des Zeugen',
    kind: 'Variantenart', note: 'Editorische Anmerkung', apparatus: 'Kritischer Apparat', noVariants: 'Für diese Stelle sind noch keine Varianten erfasst.',
    kinds: { substitution: 'Substitution', omission: 'Auslassung', addition: 'Zusatz', orthography: 'orthografische Variante', transposition: 'Umstellung' },
    export: 'Export', exportTei: 'TEI-XML herunterladen', exportJson: 'Projekt-JSON herunterladen', importJson: 'Projekt-JSON importieren', importText: 'Textdatei in den edierten Text laden', import: 'Importieren', saved: 'Automatisch auf diesem Gerät gespeichert.', backup: 'Laden Sie das Projekt-JSON als portable Sicherung herunter.', deleteSegment: 'Textstelle löschen',
    noWitness: 'Fügen Sie mindestens einen Handschriftenzeugen hinzu, um mit der Kollation zu beginnen.', noSegment: 'Fügen Sie eine Textstelle hinzu, um mit der Bearbeitung zu beginnen.', invalidProject: 'Dies ist kein gültiges OMI-Kritische-Edition-Projekt.', loadError: 'Die Datei konnte nicht gelesen werden.', untitled: 'Unbetitelte kritische Edition', ready: 'Der Editionsarbeitsbereich ist bereit. Zeugenfelder und Textstellen können bearbeitet werden.',
  },
};

function makeId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
function emptyReading(): Reading {
  return { text: '', kind: 'substitution', note: '' };
}
function emptySegment(): EditionSegment {
  return { id: makeId(), locus: '', lemma: '', readings: {} };
}
function isProject(value: unknown): value is EditionProject {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<EditionProject>;
  return candidate.version === 1
    && typeof candidate.title === 'string'
    && typeof candidate.language === 'string'
    && typeof candidate.editorialPrinciple === 'string'
    && Array.isArray(candidate.witnesses)
    && Array.isArray(candidate.segments)
    && candidate.witnesses.every((w) => w && typeof w.id === 'string' && typeof w.siglum === 'string')
    && candidate.segments.every((s) => s && typeof s.id === 'string' && typeof s.lemma === 'string' && s.readings && typeof s.readings === 'object');
}
function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[character] ?? character);
}
function downloadFile(name: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
function safeFileName(title: string): string {
  return (title || 'critical-edition').normalize('NFKD').replace(/[^\w.-]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'critical-edition';
}
function hasVariant(reading: Reading | undefined): reading is Reading {
  return Boolean(reading && (reading.text.trim() || reading.kind === 'omission'));
}
function toTei(project: EditionProject): string {
  const witnessXmlId = (value: string) => `wit-${value.replace(/[^A-Za-z0-9_.-]/g, '')}`;
  const title = escapeXml(project.title || 'Untitled critical edition');
  const witnessList = project.witnesses.map((witness) =>
    `      <witness xml:id="${escapeXml(witnessXmlId(witness.id))}">${escapeXml(witness.siglum)}</witness>`,
  ).join('\\n');
  const manuscriptDescriptions = project.witnesses.map((witness) => {
    const id = escapeXml(witnessXmlId(witness.id));
    return `      <msDesc xml:id="ms-${id}"><msIdentifier><repository>${escapeXml(witness.repository)}</repository><idno>${escapeXml(witness.shelfmark)}</idno></msIdentifier><msContents><summary>${escapeXml(witness.description)}</summary></msContents><history><origin><origDate>${escapeXml(witness.date)}</origDate></origin></history></msDesc>`;
  }).join('\\n');
  const body = project.segments.map((segment) => {
    const readings = project.witnesses.map((witness) => {
      const reading = segment.readings[witness.id];
      if (!hasVariant(reading)) return '';
      const kind = reading.kind === 'omission' ? 'omission' : reading.kind;
      return `          <rdg type="${kind}" wit="#${escapeXml(witnessXmlId(witness.id))}">${escapeXml(reading.text)}${reading.note.trim() ? ` <note>${escapeXml(reading.note)}</note>` : ''}</rdg>`;
    }).filter(Boolean).join('\\n');
    const locus = segment.locus.trim() ? ` n="${escapeXml(segment.locus)}"` : '';
    const lemma = `          <lem>${escapeXml(segment.lemma)}</lem>`;
    return `        <p${locus}><app xml:id="app-${escapeXml(segment.id)}">\\n${lemma}${readings ? `\\n${readings}` : ''}\\n        </app></p>`;
  }).join('\\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\\n<TEI xmlns="http://www.tei-c.org/ns/1.0" xml:lang="${escapeXml(project.language)}">\\n  <teiHeader>\\n    <fileDesc>\\n      <titleStmt><title>${title}</title><editor>OMI Studio</editor></titleStmt>\\n      <publicationStmt><p>Digital critical edition project.</p></publicationStmt>\\n      <sourceDesc><listWit>\\n${witnessList}\\n      </listWit>\\n${manuscriptDescriptions}\\n      </sourceDesc>\\n    </fileDesc>\\n    <encodingDesc><projectDesc><p>${escapeXml(project.editorialPrinciple)}</p></projectDesc></encodingDesc>\\n  </teiHeader>\\n  <text><body>\\n${body || '        <p/>'}\\n  </body></text>\\n</TEI>\\n`;
}
export function CriticalTextEditionPanel({
  locale = 'hu',
  storageKey = 'default',
}: CriticalTextEditionPanelProps) {
  const copy = copyByLocale[locale] ?? copyByLocale.en;
  const key = `${STORAGE_PREFIX}${storageKey}`;
  const [project, setProject] = useState<EditionProject>(() => {
    if (typeof window === 'undefined') return EMPTY_PROJECT;
    try {
      const stored = window.localStorage.getItem(key);
      if (!stored) return EMPTY_PROJECT;
      const parsed: unknown = JSON.parse(stored);
      return isProject(parsed) ? parsed : EMPTY_PROJECT;
    } catch {
      return EMPTY_PROJECT;
    }
  });
  const importRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState(copy.saved);

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(project));
      setStatus(copy.saved);
    } catch {
      setStatus(copy.backup);
    }
  }, [copy.backup, copy.saved, key, project]);

  const variantCount = useMemo(() => project.segments.reduce((count, segment) =>
    count + project.witnesses.filter((witness) => hasVariant(segment.readings[witness.id])).length, 0), [project]);
  const update = (patch: Partial<EditionProject>) => setProject((current) => ({ ...current, ...patch }));
  const updateWitness = (witnessId: string, patch: Partial<Witness>) => setProject((current) => ({
    ...current,
    witnesses: current.witnesses.map((witness) => witness.id === witnessId ? { ...witness, ...patch } : witness),
  }));
  const addWitness = () => {
    const witness: Witness = { id: makeId(), siglum: `W${project.witnesses.length + 1}`, description: '', repository: '', shelfmark: '', date: '' };
    setProject((current) => ({
      ...current,
      witnesses: [...current.witnesses, witness],
      segments: current.segments.map((segment) => ({ ...segment, readings: { ...segment.readings, [witness.id]: emptyReading() } })),
    }));
  };
  const removeWitness = (witnessId: string) => setProject((current) => ({
    ...current,
    witnesses: current.witnesses.filter((witness) => witness.id !== witnessId),
    segments: current.segments.map((segment) => {
      const readings = { ...segment.readings };
      delete readings[witnessId];
      return { ...segment, readings };
    }),
  }));
  const updateSegment = (segmentId: string, patch: Partial<EditionSegment>) => setProject((current) => ({
    ...current,
    segments: current.segments.map((segment) => segment.id === segmentId ? { ...segment, ...patch } : segment),
  }));
  const updateReading = (segmentId: string, witnessId: string, patch: Partial<Reading>) => setProject((current) => ({
    ...current,
    segments: current.segments.map((segment) => segment.id === segmentId ? {
      ...segment,
      readings: { ...segment.readings, [witnessId]: { ...emptyReading(), ...segment.readings[witnessId], ...patch } },
    } : segment),
  }));
  const addSegment = () => setProject((current) => ({ ...current, segments: [...current.segments, emptySegment()] }));
  const importFile = async (file: File | undefined, asText = false) => {
    if (!file) return;
    try {
      const raw = await file.text();
      if (asText) {
        setProject((current) => {
          const segment = current.segments[0] ?? emptySegment();
          return { ...current, title: current.title || file.name.replace(/\.[^.]+$/, ''), segments: [{ ...segment, lemma: raw }, ...current.segments.slice(1)] };
        });
        setStatus(copy.saved);
      } else {
        const parsed: unknown = JSON.parse(raw);
        if (!isProject(parsed)) throw new Error('invalid');
        setProject(parsed);
        setStatus(copy.saved);
      }
    } catch {
      setStatus(asText ? copy.loadError : copy.invalidProject);
    }
  };

  return (
    <div className="critical-edition" aria-label={copy.project}>
      <p className="critical-edition-intro">{copy.intro}</p>
      <section className="critical-edition-card">
        <header className="critical-edition-section-heading"><div><h5>{copy.project}</h5><p>{copy.ready}</p></div><span className="critical-edition-save-status" role="status">{status}</span></header>
        <div className="critical-edition-project-fields">
          <label>{copy.title}<input value={project.title} onChange={(event) => update({ title: event.target.value })} /></label>
          <label>{copy.language}<input value={project.language} onChange={(event) => update({ language: event.target.value })} placeholder="hu" /></label>
          <label className="critical-edition-wide">{copy.principle}<textarea rows={2} value={project.editorialPrinciple} onChange={(event) => update({ editorialPrinciple: event.target.value })} /></label>
        </div>
      </section>

      <section className="critical-edition-card">
        <header className="critical-edition-section-heading"><div><h5>{copy.witnesses}</h5><p>{project.witnesses.length} · {copy.siglum}</p></div><button type="button" onClick={addWitness}>＋ {copy.addWitness}</button></header>
        {project.witnesses.length === 0 ? <p className="critical-edition-empty">{copy.noWitness}</p> : (
          <div className="critical-edition-witness-list">
            {project.witnesses.map((witness) => (
              <fieldset className="critical-edition-witness" key={witness.id}>
                <legend>{witness.siglum || copy.witnessDesc}</legend>
                <label>{copy.siglum}<input value={witness.siglum} onChange={(event) => updateWitness(witness.id, { siglum: event.target.value })} /></label>
                <label>{copy.witnessDesc}<input value={witness.description} onChange={(event) => updateWitness(witness.id, { description: event.target.value })} /></label>
                <label>{copy.repository}<input value={witness.repository} onChange={(event) => updateWitness(witness.id, { repository: event.target.value })} /></label>
                <label>{copy.shelfmark}<input value={witness.shelfmark} onChange={(event) => updateWitness(witness.id, { shelfmark: event.target.value })} /></label>
                <label>{copy.date}<input value={witness.date} onChange={(event) => updateWitness(witness.id, { date: event.target.value })} /></label>
                <button className="critical-edition-danger" type="button" onClick={() => removeWitness(witness.id)}>{copy.remove}</button>
              </fieldset>
            ))}
          </div>
        )}
      </section>

      <section className="critical-edition-card">
        <header className="critical-edition-section-heading"><div><h5>{copy.segments}</h5><p>{project.segments.length} · {copy.apparatus} ({variantCount})</p></div><button type="button" onClick={addSegment}>＋ {copy.addSegment}</button></header>
        {project.segments.length === 0 ? <p className="critical-edition-empty">{copy.noSegment}</p> : (
          <div className="critical-edition-segments">
            {project.segments.map((segment, index) => (
              <article className="critical-edition-segment" key={segment.id}>
                <div className="critical-edition-segment-heading"><strong>{copy.segments} {index + 1}</strong><label>{copy.locus}<input value={segment.locus} onChange={(event) => updateSegment(segment.id, { locus: event.target.value })} /></label><button className="critical-edition-danger" type="button" onClick={() => setProject((current) => ({ ...current, segments: current.segments.filter((entry) => entry.id !== segment.id) }))}>{copy.deleteSegment}</button></div>
                <label className="critical-edition-reading">{copy.lemma}<textarea rows={3} value={segment.lemma} onChange={(event) => updateSegment(segment.id, { lemma: event.target.value })} /></label>
                {project.witnesses.length > 0 && <div className="critical-edition-collation">
                  {project.witnesses.map((witness) => {
                    const reading = segment.readings[witness.id] ?? emptyReading();
                    return <fieldset className="critical-edition-reading-card" key={witness.id}>
                      <legend>{witness.siglum || copy.witnessDesc}</legend>
                      <label>{copy.reading}<textarea rows={3} value={reading.text} onChange={(event) => updateReading(segment.id, witness.id, { text: event.target.value })} /></label>
                      <div className="critical-edition-reading-meta">
                        <label>{copy.kind}<select value={reading.kind} onChange={(event) => updateReading(segment.id, witness.id, { kind: event.target.value as ReadingKind })}>{kinds.map((kind) => <option key={kind} value={kind}>{copy.kinds[kind]}</option>)}</select></label>
                        <label>{copy.note}<input value={reading.note} onChange={(event) => updateReading(segment.id, witness.id, { note: event.target.value })} /></label>
                      </div>
                    </fieldset>;
                  })}
                </div>}
                <div className="critical-edition-apparatus"><strong>{copy.apparatus}</strong>
                  {project.witnesses.filter((witness) => hasVariant(segment.readings[witness.id])).length === 0
                    ? <p>{copy.noVariants}</p>
                    : <ol>{project.witnesses.filter((witness) => hasVariant(segment.readings[witness.id])).map((witness) => {
                      const reading = segment.readings[witness.id];
                      return <li key={witness.id}><span className="critical-edition-siglum">{witness.siglum}</span> <span>{reading.text}</span> <small>({copy.kinds[reading.kind]})</small>{reading.note && <em> — {reading.note}</em>}</li>;
                    })}</ol>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="critical-edition-card critical-edition-export">
        <h5>{copy.export}</h5>
        <div className="critical-edition-actions">
          <button type="button" onClick={() => downloadFile(`${safeFileName(project.title)}.xml`, toTei(project), 'application/tei+xml;charset=utf-8')}>{copy.exportTei}</button>
          <button type="button" onClick={() => downloadFile(`${safeFileName(project.title)}.json`, JSON.stringify(project, null, 2), 'application/json;charset=utf-8')}>{copy.exportJson}</button>
          <button type="button" onClick={() => importRef.current?.click()}>{copy.importJson}</button>
          <button type="button" onClick={() => textRef.current?.click()}>{copy.importText}</button>
          <input ref={importRef} className="critical-edition-file-input" type="file" accept="application/json,.json" onChange={(event) => { void importFile(event.target.files?.[0]); event.currentTarget.value = ''; }} />
          <input ref={textRef} className="critical-edition-file-input" type="file" accept=".txt,.md,text/plain,text/markdown" onChange={(event) => { void importFile(event.target.files?.[0], true); event.currentTarget.value = ''; }} />
        </div>
        <p className="critical-edition-save-status">{copy.backup}</p>
      </section>
    </div>
  );
}
