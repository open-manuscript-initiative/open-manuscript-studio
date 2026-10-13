import { getResearchModuleCopyByLocale } from '../moduleTranslationCatalog';
import { normalizeModuleLocale } from '../moduleLocale';
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

const words = getResearchModuleCopyByLocale('experimental-laboratory-experimental-laboratory-panel/words');

type StudyCollectionMap = {
  materials: LaboratoryMaterial;
  protocols: LaboratoryProtocol;
  instruments: LaboratoryInstrument;
  assays: LaboratoryAssay;
  artifacts: ResearchArtifact;
};

const blankMaterial = (): LaboratoryMaterial => ({ id: newLabId(), name: '', category: '', identifier: '', quantity: '', unit: '', conditions: '' });
const blankProtocol = (): LaboratoryProtocol => ({ id: newLabId(), title: '', version: '', steps: '', source: '' });
const blankInstrument = (): LaboratoryInstrument => ({ id: newLabId(), name: '', model: '', serialNumber: '', calibrationDate: '', calibrationReference: '' });
const blankMeasurement = (): LaboratoryMeasurement => ({ id: newLabId(), name: '', value: '', unit: '', uncertainty: '', measuredAt: '', instrumentId: '' });
const blankAssay = (): LaboratoryAssay => ({ id: newLabId(), title: '', technology: '', method: '', materialReferences: '', measurements: [] });
const blankArtifact = (): ResearchArtifact => ({ id: newLabId(), title: '', kind: 'raw', format: '', uri: '', persistentId: '', checksum: '', license: '', description: '' });

export function ExperimentalLaboratoryPanel({ locale = 'en', storageKey = 'experimental-laboratory' }: { locale?: string; storageKey?: string }) {
  const t = words[normalizeModuleLocale(locale)];
  const [workspace, setWorkspace] = useLocalWorkspace<ExperimentalWorkspace>(storageKey, createExperimentalWorkspace, isExperimentalWorkspace);
  const [error, setError] = useState('');
  const [busyArtifact, setBusyArtifact] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const updateWorkspace = (patch: Partial<ExperimentalWorkspace>) => setWorkspace(current => ({ ...current, ...patch }));
  const updateStudy = (studyId: string, patch: Partial<ExperimentalStudy>) => setWorkspace(current => ({ ...current, studies: current.studies.map(study => study.id === studyId ? { ...study, ...patch } : study) }));
  const updateItem = <K extends keyof StudyCollectionMap>(studyId: string, key: K, itemId: string, patch: Partial<StudyCollectionMap[K]>) => setWorkspace(current => ({ ...current, studies: current.studies.map(study => { if (study.id !== studyId) return study; const items = study[key] as StudyCollectionMap[K][]; return { ...study, [key]: items.map(item => item.id === itemId ? { ...item, ...patch } : item) }; }) }));
  const addItem = <K extends keyof StudyCollectionMap>(studyId: string, key: K, item: StudyCollectionMap[K]) => setWorkspace(current => ({ ...current, studies: current.studies.map(study => { if (study.id !== studyId) return study; const items = study[key] as StudyCollectionMap[K][]; return { ...study, [key]: [...items, item] }; }) }));
  async function importWorkspace(file?: File) {
    if (!file) return;
    try {
      const parsed = parseExperimentalWorkspace(await file.text());
      if (!parsed) { setError(t.importError); return; }
      setWorkspace(parsed);
      setError('');
    } catch { setError(t.importError); }
  }
  async function hashFile(studyId: string, artifactId: string, file?: File) {
    if (!file) return;
    setBusyArtifact(artifactId);
    try {
      const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
      const checksum = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
      updateItem<'artifacts'>(studyId, 'artifacts', artifactId, { title: workspace.studies.find(study => study.id === studyId)?.artifacts.find(item => item.id === artifactId)?.title || file.name, checksum, description: [workspace.studies.find(study => study.id === studyId)?.artifacts.find(item => item.id === artifactId)?.description, `${file.name} (${file.size} bytes)`].filter(Boolean).join('\n') });
    } catch { setError(t.hashError); }
    finally { setBusyArtifact(null); }
  }
  const profileNames: Record<ExperimentalProfile, string> = { physics: t.physics, chemistry: t.chemistry, biology: t.biology, materials: t.materialsProfile, agriculture: t.agriculture, engineering: t.engineering, geosciences: t.geosciences };
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
        {study.materials.map(material => <div className="discipline-row" key={material.id}>{input(t.name, material.name, value => updateItem<'materials'>(study.id, 'materials', material.id, { name: value }))}{input(t.category, material.category, value => updateItem<'materials'>(study.id, 'materials', material.id, { category: value }))}{input(t.identifier, material.identifier, value => updateItem<'materials'>(study.id, 'materials', material.id, { identifier: value }))}{input(t.quantity, material.quantity, value => updateItem<'materials'>(study.id, 'materials', material.id, { quantity: value }))}{input(t.unit, material.unit, value => updateItem<'materials'>(study.id, 'materials', material.id, { unit: value }))}{input(t.conditions, material.conditions, value => updateItem<'materials'>(study.id, 'materials', material.id, { conditions: value }))}<button type="button" className="discipline-danger" onClick={() => updateStudy(study.id, { materials: study.materials.filter(item => item.id !== material.id) })}>{t.remove}</button></div>)}

        <div className="discipline-workspace__section-title"><h4>{t.protocols} ({study.protocols.length})</h4><button type="button" onClick={() => addItem(study.id, 'protocols', blankProtocol())}>{t.addProtocol}</button></div>
        {study.protocols.map(protocol => <article className="discipline-workspace__version" key={protocol.id}><div className="discipline-workspace__grid">{input(t.name, protocol.title, value => updateItem<'protocols'>(study.id, 'protocols', protocol.id, { title: value }))}{input(t.version, protocol.version, value => updateItem<'protocols'>(study.id, 'protocols', protocol.id, { version: value }))}{input(t.source, protocol.source, value => updateItem<'protocols'>(study.id, 'protocols', protocol.id, { source: value }))}</div><label>{t.steps}<textarea rows={3} value={protocol.steps} onChange={event => updateItem<'protocols'>(study.id, 'protocols', protocol.id, { steps: event.target.value })}/></label><button type="button" className="discipline-danger" onClick={() => updateStudy(study.id, { protocols: study.protocols.filter(item => item.id !== protocol.id) })}>{t.remove}</button></article>)}

        <div className="discipline-workspace__section-title"><h4>{t.instruments} ({study.instruments.length})</h4><button type="button" onClick={() => addItem(study.id, 'instruments', blankInstrument())}>{t.addInstrument}</button></div>
        {study.instruments.map(instrument => <div className="discipline-row" key={instrument.id}>{input(t.name, instrument.name, value => updateItem<'instruments'>(study.id, 'instruments', instrument.id, { name: value }))}{input(t.model, instrument.model, value => updateItem<'instruments'>(study.id, 'instruments', instrument.id, { model: value }))}{input(t.serial, instrument.serialNumber, value => updateItem<'instruments'>(study.id, 'instruments', instrument.id, { serialNumber: value }))}{input(t.calibrationDate, instrument.calibrationDate, value => updateItem<'instruments'>(study.id, 'instruments', instrument.id, { calibrationDate: value }), 'date')}{input(t.calibrationReference, instrument.calibrationReference, value => updateItem<'instruments'>(study.id, 'instruments', instrument.id, { calibrationReference: value }))}<button type="button" className="discipline-danger" onClick={() => updateStudy(study.id, { instruments: study.instruments.filter(item => item.id !== instrument.id) })}>{t.remove}</button></div>)}

        <div className="discipline-workspace__section-title"><h4>{t.assays} ({study.assays.length})</h4><button type="button" onClick={() => addItem(study.id, 'assays', blankAssay())}>{t.addAssay}</button></div>
        {study.assays.map(assay => <article className="discipline-workspace__version" key={assay.id}><div className="discipline-workspace__grid">{input(t.name, assay.title, value => updateItem<'assays'>(study.id, 'assays', assay.id, { title: value }))}{input(t.technology, assay.technology, value => updateItem<'assays'>(study.id, 'assays', assay.id, { technology: value }))}{input(t.materialRefs, assay.materialReferences, value => updateItem<'assays'>(study.id, 'assays', assay.id, { materialReferences: value }))}</div><label>{t.method}<textarea rows={2} value={assay.method} onChange={event => updateItem<'assays'>(study.id, 'assays', assay.id, { method: event.target.value })}/></label>
          <div className="discipline-workspace__section-title"><h5>{t.measurements}</h5><button type="button" onClick={() => updateItem<'assays'>(study.id, 'assays', assay.id, { measurements: [...assay.measurements, blankMeasurement()] })}>{t.addMeasurement}</button></div>
          {assay.measurements.map(measurement => <div className="discipline-row" key={measurement.id}>{input(t.name, measurement.name, value => updateItem<'assays'>(study.id, 'assays', assay.id, { measurements: assay.measurements.map(item => item.id === measurement.id ? { ...item, name: value } : item) }))}{input(t.value, measurement.value, value => updateItem<'assays'>(study.id, 'assays', assay.id, { measurements: assay.measurements.map(item => item.id === measurement.id ? { ...item, value } : item) }))}{input(t.unit, measurement.unit, value => updateItem<'assays'>(study.id, 'assays', assay.id, { measurements: assay.measurements.map(item => item.id === measurement.id ? { ...item, unit: value } : item) }))}{input(t.uncertainty, measurement.uncertainty, value => updateItem<'assays'>(study.id, 'assays', assay.id, { measurements: assay.measurements.map(item => item.id === measurement.id ? { ...item, uncertainty: value } : item) }))}{input(t.measuredAt, measurement.measuredAt, value => updateItem<'assays'>(study.id, 'assays', assay.id, { measurements: assay.measurements.map(item => item.id === measurement.id ? { ...item, measuredAt: value } : item) }), 'datetime-local')}<label>{t.instrument}<select value={measurement.instrumentId} onChange={event => updateItem<'assays'>(study.id, 'assays', assay.id, { measurements: assay.measurements.map(item => item.id === measurement.id ? { ...item, instrumentId: event.target.value } : item) })}><option value="">—</option>{study.instruments.map(item => <option key={item.id} value={item.id}>{item.name || item.model || item.id}</option>)}</select></label><button type="button" className="discipline-danger" onClick={() => updateItem<'assays'>(study.id, 'assays', assay.id, { measurements: assay.measurements.filter(item => item.id !== measurement.id) })}>{t.remove}</button></div>)}
          <button type="button" className="discipline-danger" onClick={() => updateStudy(study.id, { assays: study.assays.filter(item => item.id !== assay.id) })}>{t.remove}</button>
        </article>)}

        <div className="discipline-workspace__section-title"><h4>{t.artifacts} ({study.artifacts.length})</h4><button type="button" onClick={() => addItem(study.id, 'artifacts', blankArtifact())}>{t.addArtifact}</button></div>
        {study.artifacts.map(artifact => <article className="discipline-workspace__version" key={artifact.id}><div className="discipline-workspace__grid"><label>{t.kind}<select value={artifact.kind} onChange={event => updateItem<'artifacts'>(study.id, 'artifacts', artifact.id, { kind: event.target.value })}>{Object.entries(t.kinds as Record<string, string>).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{input(t.name, artifact.title, value => updateItem<'artifacts'>(study.id, 'artifacts', artifact.id, { title: value }))}{input(t.format, artifact.format, value => updateItem<'artifacts'>(study.id, 'artifacts', artifact.id, { format: value }))}{input(t.uri, artifact.uri, value => updateItem<'artifacts'>(study.id, 'artifacts', artifact.id, { uri: value }), 'url')}{input(t.pid, artifact.persistentId, value => updateItem<'artifacts'>(study.id, 'artifacts', artifact.id, { persistentId: value }))}{input(t.license, artifact.license, value => updateItem<'artifacts'>(study.id, 'artifacts', artifact.id, { license: value }))}</div><label>{t.description}<textarea rows={2} value={artifact.description} onChange={event => updateItem<'artifacts'>(study.id, 'artifacts', artifact.id, { description: event.target.value })}/></label><div className="discipline-workspace__grid">{input(t.checksum, artifact.checksum, value => updateItem<'artifacts'>(study.id, 'artifacts', artifact.id, { checksum: value }))}<label>{t.hash}<input type="file" onChange={event => { void hashFile(study.id, artifact.id, event.target.files?.[0]); event.currentTarget.value = ''; }}/>{busyArtifact === artifact.id && <span>…</span>}</label></div><button type="button" className="discipline-danger" onClick={() => updateStudy(study.id, { artifacts: study.artifacts.filter(item => item.id !== artifact.id) })}>{t.remove}</button></article>)}
      </article>)}
    </section>
  </main>;
}
