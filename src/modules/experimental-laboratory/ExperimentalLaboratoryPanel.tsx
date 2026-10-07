import { useRef, useState } from 'react';
import { downloadWorkspaceJson, safeWorkspaceFileName, useLocalWorkspace } from '../disciplineWorkspace';
import {
  createExperimentalWorkspace,
  createLaboratoryStudy,
  isExperimentalWorkspace,
  newLabId,
  parseExperimentalWorkspace,
  type ExperimentalProfile,
  type ExperimentalStudy,
  type ExperimentalWorkspace,
  type LaboratoryAssay,
  type LaboratoryInstrument,
  type LaboratoryMaterial,
  type LaboratoryMeasurement,
  type LaboratoryProtocol,
  type ResearchArtifact,
} from './model';
import '../disciplineWorkspaces.css';

type Locale = 'hu' | 'en' | 'de';
const words = {
  hu: {
    title: 'Kísérleti és laboratóriumi kutatás',
    intro: 'Kísérletek, tanulmányok, minták, protokollok, műszerek, mérések és kutatási fájlok összekapcsolása.',
    local: 'A projekt ezen az eszközön tárolódik. A JSON-export hordozható OMI-moduladat; fájlok kiválasztásakor csak a név, méret és SHA-256 kerül rögzítésre, a fájl nem töltődik fel.',
    project: 'Vizsgálat / projekt címe', profile: 'Szakterületi profil', objective: 'Kutatási cél', lead: 'Vezető kutató', collaborators: 'Közreműködők',
    physics: 'Fizika', chemistry: 'Kémia', biology: 'Biológia', materials: 'Anyagtudomány',
    studies: 'Tanulmányok / kísérleti egységek', addStudy: 'Tanulmány hozzáadása', studyTitle: 'Tanulmány címe', date: 'Dátum', context: 'Kísérleti körülmények / szakterületi részletek',
    contextLabels: { physics: 'Berendezés, mérési tartomány és körülmények', chemistry: 'Reakció, oldószer és reakciókörülmények', biology: 'Organizmus, kezelés és etikai hivatkozás', materials: 'Összetétel, előállítás és karakterizálás' },
    materials: 'Minták és anyagok', addMaterial: 'Minta / anyag hozzáadása', name: 'Megnevezés', category: 'Típus / szerep', identifier: 'Azonosító / tételszám', quantity: 'Mennyiség', unit: 'Mértékegység', conditions: 'Kezelés és tárolási körülmény',
    protocols: 'Protokollok', addProtocol: 'Protokoll hozzáadása', version: 'Verzió', steps: 'Lépések / eljárás', source: 'Forrás / DOI / URL',
    instruments: 'Műszerek', addInstrument: 'Műszer hozzáadása', model: 'Modell', serial: 'Gyári szám', calibrationDate: 'Kalibrálás dátuma', calibrationReference: 'Kalibrációs jegyzőkönyv / referencia',
    assays: 'Mérések és vizsgálatok', addAssay: 'Mérés / vizsgálat hozzáadása', technology: 'Módszer / technológia', method: 'Eljárás leírása', materialRefs: 'Kapcsolódó mintaazonosítók', measurements: 'Mért értékek', addMeasurement: 'Mért érték hozzáadása', value: 'Érték', uncertainty: 'Bizonytalanság', measuredAt: 'Mérés ideje', instrument: 'Műszer',
    artifacts: 'Nyers és feldolgozott adatok', addArtifact: 'Adatfájl / kimenet hozzáadása', kind: 'Adat szerepe', kinds: { raw: 'Nyers adat', derived: 'Feldolgozott adat', code: 'Kód / elemzés', protocol: 'Protokoll', other: 'Egyéb' }, format: 'Formátum', uri: 'Fájl URL-je / adattár', pid: 'Tartós azonosító', checksum: 'SHA-256 ellenőrzőösszeg', license: 'Licenc', description: 'Leírás / kapcsolat a méréssel', hash: 'Helyi fájl ellenőrzőösszegének kiszámítása',
    export: 'Projekt exportálása JSON-ként', import: 'OMI kísérleti JSON importálása', remove: 'Törlés', removeStudy: 'Tanulmány törlése', importError: 'A fájl nem érvényes OMI kísérleti projekt vagy nem támogatott verzió.', hashError: 'A fájl ellenőrzőösszegét nem sikerült kiszámítani.',
  },
  en: {
    title: 'Experimental and Laboratory Research',
    intro: 'Connect investigations, studies, samples, protocols, instruments, measurements, and research files.',
    local: 'The project is stored on this device. JSON export is a portable OMI module record; selecting a file records only its name, size, and SHA-256. The file is not uploaded.',
    project: 'Investigation / project title', profile: 'Discipline profile', objective: 'Research objective', lead: 'Principal investigator', collaborators: 'Collaborators',
    physics: 'Physics', chemistry: 'Chemistry', biology: 'Biology', materials: 'Materials science',
    studies: 'Studies / experimental units', addStudy: 'Add study', studyTitle: 'Study title', date: 'Date', context: 'Experimental conditions / discipline details',
    contextLabels: { physics: 'Apparatus, measurement range, and conditions', chemistry: 'Reaction, solvent, and reaction conditions', biology: 'Organism, treatment, and ethics reference', materials: 'Composition, preparation, and characterization' },
    materials: 'Samples and materials', addMaterial: 'Add sample / material', name: 'Name', category: 'Type / role', identifier: 'Identifier / lot number', quantity: 'Quantity', unit: 'Unit', conditions: 'Treatment and storage conditions',
    protocols: 'Protocols', addProtocol: 'Add protocol', version: 'Version', steps: 'Steps / procedure', source: 'Source / DOI / URL',
    instruments: 'Instruments', addInstrument: 'Add instrument', model: 'Model', serial: 'Serial number', calibrationDate: 'Calibration date', calibrationReference: 'Calibration record / reference',
    assays: 'Assays and measurements', addAssay: 'Add assay / measurement', technology: 'Method / technology', method: 'Method description', materialRefs: 'Related sample identifiers', measurements: 'Measured values', addMeasurement: 'Add measured value', value: 'Value', uncertainty: 'Uncertainty', measuredAt: 'Measured at', instrument: 'Instrument',
    artifacts: 'Raw and derived data', addArtifact: 'Add data file / output', kind: 'Data role', kinds: { raw: 'Raw data', derived: 'Derived data', code: 'Code / analysis', protocol: 'Protocol', other: 'Other' }, format: 'Format', uri: 'File URL / repository', pid: 'Persistent identifier', checksum: 'SHA-256 checksum', license: 'License', description: 'Description / relation to measurement', hash: 'Calculate checksum of a local file',
    export: 'Export project as JSON', import: 'Import OMI experimental JSON', remove: 'Remove', removeStudy: 'Remove study', importError: 'This is not a valid OMI experimental project or the version is unsupported.', hashError: 'The file checksum could not be calculated.',
  },
  de: {
    title: 'Experimentelle und Laborforschung',
    intro: 'Untersuchungen, Studien, Proben, Protokolle, Geräte, Messungen und Forschungsdateien verknüpfen.',
    local: 'Das Projekt wird auf diesem Gerät gespeichert. Der JSON-Export ist ein portabler OMI-Moduldatensatz. Bei Dateiauswahl werden nur Name, Größe und SHA-256 erfasst; die Datei wird nicht hochgeladen.',
    project: 'Untersuchung / Projekttitel', profile: 'Fachprofil', objective: 'Forschungsziel', lead: 'Projektleitung', collaborators: 'Mitwirkende',
    physics: 'Physik', chemistry: 'Chemie', biology: 'Biologie', materials: 'Materialwissenschaft',
    studies: 'Studien / experimentelle Einheiten', addStudy: 'Studie hinzufügen', studyTitle: 'Studientitel', date: 'Datum', context: 'Versuchsbedingungen / Fachdetails',
    contextLabels: { physics: 'Aufbau, Messbereich und Bedingungen', chemistry: 'Reaktion, Lösungsmittel und Reaktionsbedingungen', biology: 'Organismus, Behandlung und Ethikreferenz', materials: 'Zusammensetzung, Herstellung und Charakterisierung' },
    materials: 'Proben und Materialien', addMaterial: 'Probe / Material hinzufügen', name: 'Bezeichnung', category: 'Typ / Rolle', identifier: 'Kennung / Chargennummer', quantity: 'Menge', unit: 'Einheit', conditions: 'Behandlung und Lagerbedingungen',
    protocols: 'Protokolle', addProtocol: 'Protokoll hinzufügen', version: 'Version', steps: 'Schritte / Verfahren', source: 'Quelle / DOI / URL',
    instruments: 'Geräte', addInstrument: 'Gerät hinzufügen', model: 'Modell', serial: 'Seriennummer', calibrationDate: 'Kalibrierungsdatum', calibrationReference: 'Kalibrierungsnachweis / Referenz',
    assays: 'Assays und Messungen', addAssay: 'Assay / Messung hinzufügen', technology: 'Methode / Technologie', method: 'Methodenbeschreibung', materialRefs: 'Zugehörige Probenkennungen', measurements: 'Messwerte', addMeasurement: 'Messwert hinzufügen', value: 'Wert', uncertainty: 'Unsicherheit', measuredAt: 'Messzeitpunkt', instrument: 'Gerät',
    artifacts: 'Roh- und abgeleitete Daten', addArtifact: 'Datei / Ergebnis hinzufügen', kind: 'Datenrolle', kinds: { raw: 'Rohdaten', derived: 'Abgeleitete Daten', code: 'Code / Analyse', protocol: 'Protokoll', other: 'Sonstiges' }, format: 'Format', uri: 'Datei-URL / Repository', pid: 'Persistente Kennung', checksum: 'SHA-256-Prüfsumme', license: 'Lizenz', description: 'Beschreibung / Bezug zur Messung', hash: 'Prüfsumme einer lokalen Datei berechnen',
    export: 'Projekt als JSON exportieren', import: 'OMI-Experiment-JSON importieren', remove: 'Entfernen', removeStudy: 'Studie entfernen', importError: 'Keine gültige OMI-Experimentdatei oder nicht unterstützte Version.', hashError: 'Die Dateiprüfsumme konnte nicht berechnet werden.',
  },
} as const;

const blankMaterial = (): LaboratoryMaterial => ({ id: newLabId(), name: '', category: '', identifier: '', quantity: '', unit: '', conditions: '' });
const blankProtocol = (): LaboratoryProtocol => ({ id: newLabId(), title: '', version: '', steps: '', source: '' });
const blankInstrument = (): LaboratoryInstrument => ({ id: newLabId(), name: '', model: '', serialNumber: '', calibrationDate: '', calibrationReference: '' });
const blankMeasurement = (): LaboratoryMeasurement => ({ id: newLabId(), name: '', value: '', unit: '', uncertainty: '', measuredAt: '', instrumentId: '' });
const blankAssay = (): LaboratoryAssay => ({ id: newLabId(), title: '', technology: '', method: '', materialReferences: '', measurements: [] });
const blankArtifact = (): ResearchArtifact => ({ id: newLabId(), title: '', kind: 'raw', format: '', uri: '', persistentId: '', checksum: '', license: '', description: '' });

export function ExperimentalLaboratoryPanel({ locale = 'hu', storageKey = 'experimental-laboratory' }: { locale?: string; storageKey?: string }) {
  const t = words[locale as Locale] ?? words.en;
  const [workspace, setWorkspace] = useLocalWorkspace<ExperimentalWorkspace>(storageKey, createExperimentalWorkspace, isExperimentalWorkspace);
  const [error, setError] = useState('');
  const [busyArtifact, setBusyArtifact] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const updateWorkspace = (patch: Partial<ExperimentalWorkspace>) => setWorkspace(current => ({ ...current, ...patch }));
  const updateStudy = (studyId: string, patch: Partial<ExperimentalStudy>) => setWorkspace(current => ({ ...current, studies: current.studies.map(study => study.id === studyId ? { ...study, ...patch } : study) }));
  const updateItem = <T extends { id: string }>(studyId: string, key: 'materials' | 'protocols' | 'instruments' | 'assays' | 'artifacts', itemId: string, patch: Partial<T>) => setWorkspace(current => ({ ...current, studies: current.studies.map(study => study.id !== studyId ? study : { ...study, [key]: study[key].map(item => item.id === itemId ? { ...item, ...patch } : item) }) }));
  const addItem = (studyId: string, key: 'materials' | 'protocols' | 'instruments' | 'assays' | 'artifacts', item: LaboratoryMaterial | LaboratoryProtocol | LaboratoryInstrument | LaboratoryAssay | ResearchArtifact) => setWorkspace(current => ({ ...current, studies: current.studies.map(study => study.id === studyId ? { ...study, [key]: [...study[key], item] } : study) }));
  async function importWorkspace(file?: File) {
    if (!file) return;
    const parsed = parseExperimentalWorkspace(await file.text());
    if (!parsed) { setError(t.importError); return; }
    setWorkspace(parsed);
    setError('');
  }
  async function hashFile(studyId: string, artifactId: string, file?: File) {
    if (!file) return;
    setBusyArtifact(artifactId);
    try {
      const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
      const checksum = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
      updateItem<ResearchArtifact>(studyId, 'artifacts', artifactId, { title: workspace.studies.find(study => study.id === studyId)?.artifacts.find(item => item.id === artifactId)?.title || file.name, checksum, description: [workspace.studies.find(study => study.id === studyId)?.artifacts.find(item => item.id === artifactId)?.description, `${file.name} (${file.size} bytes)`].filter(Boolean).join('\n') });
    } catch { setError(t.hashError); }
    finally { setBusyArtifact(null); }
  }
  const profileNames: Record<ExperimentalProfile, string> = { physics: t.physics, chemistry: t.chemistry, biology: t.biology, materials: t.materials };
  const input = (label: string, value: string, onChange: (value: string) => void, type = 'text') => <label>{label}<input type={type} value={value} onChange={event => onChange(event.target.value)}/></label>;

  return <main className="discipline-workspace">
    <header className="discipline-workspace__header"><div><p className="discipline-workspace__eyebrow">OMI Studio</p><h1>{t.title}</h1><p>{t.intro}</p></div><div><button type="button" onClick={() => downloadWorkspaceJson(safeWorkspaceFileName(workspace.title, 'experimental-research') + '.json', workspace)}>{t.export}</button> <button type="button" onClick={() => fileRef.current?.click()}>{t.import}</button><input ref={fileRef} className="discipline-file" type="file" accept=".json,application/json" onChange={event => { void importWorkspace(event.target.files?.[0]); event.currentTarget.value = ''; }}/></div></header>
    <section className="discipline-workspace__section"><div className="discipline-workspace__grid">
      {input(t.project, workspace.title, value => updateWorkspace({ title: value }))}
      <label>{t.profile}<select value={workspace.profile} onChange={event => updateWorkspace({ profile: event.target.value as ExperimentalProfile })}>{Object.entries(profileNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {input(t.lead, workspace.principalInvestigator, value => updateWorkspace({ principalInvestigator: value }))}
      {input(t.collaborators, workspace.collaborators, value => updateWorkspace({ collaborators: value }))}
    </div>{input(t.objective, workspace.objective, value => updateWorkspace({ objective: value }))}<p className="discipline-workspace__hint">{t.local}</p>{error && <p role="alert">{error}</p>}</section>

    <section className="discipline-workspace__section"><div className="discipline-workspace__section-title"><h2>{t.studies} ({workspace.studies.length})</h2><button type="button" onClick={() => setWorkspace(current => ({ ...current, studies: [...current.studies, createLaboratoryStudy()] }))}>{t.addStudy}</button></div>
      {workspace.studies.map(study => <article className="discipline-workspace__card" key={study.id}>
        <div className="discipline-workspace__section-title"><h3>{study.title || t.studyTitle}</h3><button type="button" className="discipline-workspace__danger" disabled={workspace.studies.length <= 1} onClick={() => setWorkspace(current => ({ ...current, studies: current.studies.filter(item => item.id !== study.id) }))}>{t.removeStudy}</button></div>
        <div className="discipline-workspace__grid">{input(t.studyTitle, study.title, value => updateStudy(study.id, { title: value }))}{input(t.date, study.date, value => updateStudy(study.id, { date: value }), 'date')}</div>
        {input(t.objective, study.objective, value => updateStudy(study.id, { objective: value }))}
        {input(t.contextLabels[workspace.profile], study.profileContext, value => updateStudy(study.id, { profileContext: value }))}
        <div className="discipline-workspace__section-title"><h4>{t.materials} ({study.materials.length})</h4><button type="button" onClick={() => addItem(study.id, 'materials', blankMaterial())}>{t.addMaterial}</button></div>
        {study.materials.map(material => <div className="discipline-row" key={material.id}>{input(t.name, material.name, value => updateItem<LaboratoryMaterial>(study.id, 'materials', material.id, { name: value }))}{input(t.category, material.category, value => updateItem<LaboratoryMaterial>(study.id, 'materials', material.id, { category: value }))}{input(t.identifier, material.identifier, value => updateItem<LaboratoryMaterial>(study.id, 'materials', material.id, { identifier: value }))}{input(t.quantity, material.quantity, value => updateItem<LaboratoryMaterial>(study.id, 'materials', material.id, { quantity: value }))}{input(t.unit, material.unit, value => updateItem<LaboratoryMaterial>(study.id, 'materials', material.id, { unit: value }))}{input(t.conditions, material.conditions, value => updateItem<LaboratoryMaterial>(study.id, 'materials', material.id, { conditions: value }))}<button type="button" className="discipline-danger" onClick={() => updateStudy(study.id, { materials: study.materials.filter(item => item.id !== material.id) })}>{t.remove}</button></div>)}

        <div className="discipline-workspace__section-title"><h4>{t.protocols} ({study.protocols.length})</h4><button type="button" onClick={() => addItem(study.id, 'protocols', blankProtocol())}>{t.addProtocol}</button></div>
        {study.protocols.map(protocol => <article className="discipline-workspace__version" key={protocol.id}><div className="discipline-workspace__grid">{input(t.name, protocol.title, value => updateItem<LaboratoryProtocol>(study.id, 'protocols', protocol.id, { title: value }))}{input(t.version, protocol.version, value => updateItem<LaboratoryProtocol>(study.id, 'protocols', protocol.id, { version: value }))}{input(t.source, protocol.source, value => updateItem<LaboratoryProtocol>(study.id, 'protocols', protocol.id, { source: value }))}</div><label>{t.steps}<textarea rows={3} value={protocol.steps} onChange={event => updateItem<LaboratoryProtocol>(study.id, 'protocols', protocol.id, { steps: event.target.value })}/></label><button type="button" className="discipline-danger" onClick={() => updateStudy(study.id, { protocols: study.protocols.filter(item => item.id !== protocol.id) })}>{t.remove}</button></article>)}

        <div className="discipline-workspace__section-title"><h4>{t.instruments} ({study.instruments.length})</h4><button type="button" onClick={() => addItem(study.id, 'instruments', blankInstrument())}>{t.addInstrument}</button></div>
        {study.instruments.map(instrument => <div className="discipline-row" key={instrument.id}>{input(t.name, instrument.name, value => updateItem<LaboratoryInstrument>(study.id, 'instruments', instrument.id, { name: value }))}{input(t.model, instrument.model, value => updateItem<LaboratoryInstrument>(study.id, 'instruments', instrument.id, { model: value }))}{input(t.serial, instrument.serialNumber, value => updateItem<LaboratoryInstrument>(study.id, 'instruments', instrument.id, { serialNumber: value }))}{input(t.calibrationDate, instrument.calibrationDate, value => updateItem<LaboratoryInstrument>(study.id, 'instruments', instrument.id, { calibrationDate: value }), 'date')}{input(t.calibrationReference, instrument.calibrationReference, value => updateItem<LaboratoryInstrument>(study.id, 'instruments', instrument.id, { calibrationReference: value }))}<button type="button" className="discipline-danger" onClick={() => updateStudy(study.id, { instruments: study.instruments.filter(item => item.id !== instrument.id) })}>{t.remove}</button></div>)}

        <div className="discipline-workspace__section-title"><h4>{t.assays} ({study.assays.length})</h4><button type="button" onClick={() => addItem(study.id, 'assays', blankAssay())}>{t.addAssay}</button></div>
        {study.assays.map(assay => <article className="discipline-workspace__version" key={assay.id}><div className="discipline-workspace__grid">{input(t.name, assay.title, value => updateItem<LaboratoryAssay>(study.id, 'assays', assay.id, { title: value }))}{input(t.technology, assay.technology, value => updateItem<LaboratoryAssay>(study.id, 'assays', assay.id, { technology: value }))}{input(t.materialRefs, assay.materialReferences, value => updateItem<LaboratoryAssay>(study.id, 'assays', assay.id, { materialReferences: value }))}</div><label>{t.method}<textarea rows={2} value={assay.method} onChange={event => updateItem<LaboratoryAssay>(study.id, 'assays', assay.id, { method: event.target.value })}/></label>
          <div className="discipline-workspace__section-title"><h5>{t.measurements}</h5><button type="button" onClick={() => updateItem<LaboratoryAssay>(study.id, 'assays', assay.id, { measurements: [...assay.measurements, blankMeasurement()] })}>{t.addMeasurement}</button></div>
          {assay.measurements.map(measurement => <div className="discipline-row" key={measurement.id}>{input(t.name, measurement.name, value => updateItem<LaboratoryAssay>(study.id, 'assays', assay.id, { measurements: assay.measurements.map(item => item.id === measurement.id ? { ...item, name: value } : item) }))}{input(t.value, measurement.value, value => updateItem<LaboratoryAssay>(study.id, 'assays', assay.id, { measurements: assay.measurements.map(item => item.id === measurement.id ? { ...item, value } : item) }))}{input(t.unit, measurement.unit, value => updateItem<LaboratoryAssay>(study.id, 'assays', assay.id, { measurements: assay.measurements.map(item => item.id === measurement.id ? { ...item, unit: value } : item) }))}{input(t.uncertainty, measurement.uncertainty, value => updateItem<LaboratoryAssay>(study.id, 'assays', assay.id, { measurements: assay.measurements.map(item => item.id === measurement.id ? { ...item, uncertainty: value } : item) }))}{input(t.measuredAt, measurement.measuredAt, value => updateItem<LaboratoryAssay>(study.id, 'assays', assay.id, { measurements: assay.measurements.map(item => item.id === measurement.id ? { ...item, measuredAt: value } : item) }), 'datetime-local')}<label>{t.instrument}<select value={measurement.instrumentId} onChange={event => updateItem<LaboratoryAssay>(study.id, 'assays', assay.id, { measurements: assay.measurements.map(item => item.id === measurement.id ? { ...item, instrumentId: event.target.value } : item) })}><option value="">—</option>{study.instruments.map(item => <option key={item.id} value={item.id}>{item.name || item.model || item.id}</option>)}</select></label><button type="button" className="discipline-danger" onClick={() => updateItem<LaboratoryAssay>(study.id, 'assays', assay.id, { measurements: assay.measurements.filter(item => item.id !== measurement.id) })}>{t.remove}</button></div>)}
          <button type="button" className="discipline-danger" onClick={() => updateStudy(study.id, { assays: study.assays.filter(item => item.id !== assay.id) })}>{t.remove}</button>
        </article>)}

        <div className="discipline-workspace__section-title"><h4>{t.artifacts} ({study.artifacts.length})</h4><button type="button" onClick={() => addItem(study.id, 'artifacts', blankArtifact())}>{t.addArtifact}</button></div>
        {study.artifacts.map(artifact => <article className="discipline-workspace__version" key={artifact.id}><div className="discipline-workspace__grid"><label>{t.kind}<select value={artifact.kind} onChange={event => updateItem<ResearchArtifact>(study.id, 'artifacts', artifact.id, { kind: event.target.value })}>{Object.entries(t.kinds).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{input(t.name, artifact.title, value => updateItem<ResearchArtifact>(study.id, 'artifacts', artifact.id, { title: value }))}{input(t.format, artifact.format, value => updateItem<ResearchArtifact>(study.id, 'artifacts', artifact.id, { format: value }))}{input(t.uri, artifact.uri, value => updateItem<ResearchArtifact>(study.id, 'artifacts', artifact.id, { uri: value }, 'url'))}{input(t.pid, artifact.persistentId, value => updateItem<ResearchArtifact>(study.id, 'artifacts', artifact.id, { persistentId: value }))}{input(t.license, artifact.license, value => updateItem<ResearchArtifact>(study.id, 'artifacts', artifact.id, { license: value }))}</div><label>{t.description}<textarea rows={2} value={artifact.description} onChange={event => updateItem<ResearchArtifact>(study.id, 'artifacts', artifact.id, { description: event.target.value })}/></label><div className="discipline-workspace__grid">{input(t.checksum, artifact.checksum, value => updateItem<ResearchArtifact>(study.id, 'artifacts', artifact.id, { checksum: value }))}<label>{t.hash}<input type="file" onChange={event => { void hashFile(study.id, artifact.id, event.target.files?.[0]); event.currentTarget.value = ''; }}/>{busyArtifact === artifact.id && <span>…</span>}</label></div><button type="button" className="discipline-danger" onClick={() => updateStudy(study.id, { artifacts: study.artifacts.filter(item => item.id !== artifact.id) })}>{t.remove}</button></article>)}
      </article>)}
    </section>
  </main>;
}
