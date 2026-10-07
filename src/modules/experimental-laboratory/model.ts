export type ExperimentalProfile = 'physics' | 'chemistry' | 'biology' | 'materials';
export type LaboratoryMaterial = { id: string; name: string; category: string; identifier: string; quantity: string; unit: string; conditions: string };
export type LaboratoryProtocol = { id: string; title: string; version: string; steps: string; source: string };
export type LaboratoryInstrument = { id: string; name: string; model: string; serialNumber: string; calibrationDate: string; calibrationReference: string };
export type LaboratoryMeasurement = { id: string; name: string; value: string; unit: string; uncertainty: string; measuredAt: string; instrumentId: string };
export type LaboratoryAssay = { id: string; title: string; technology: string; method: string; materialReferences: string; measurements: LaboratoryMeasurement[] };
export type ResearchArtifact = { id: string; title: string; kind: string; format: string; uri: string; persistentId: string; checksum: string; license: string; description: string };
export type ExperimentalStudy = {
  id: string;
  title: string;
  objective: string;
  date: string;
  profileContext: string;
  materials: LaboratoryMaterial[];
  protocols: LaboratoryProtocol[];
  instruments: LaboratoryInstrument[];
  assays: LaboratoryAssay[];
  artifacts: ResearchArtifact[];
};
export type ExperimentalWorkspace = {
  schemaVersion: 1;
  profile: ExperimentalProfile;
  title: string;
  objective: string;
  principalInvestigator: string;
  collaborators: string;
  studies: ExperimentalStudy[];
};

export function newLabId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `lab-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
export function createLaboratoryStudy(): ExperimentalStudy {
  return { id: newLabId(), title: '', objective: '', date: '', profileContext: '', materials: [], protocols: [], instruments: [], assays: [], artifacts: [] };
}
export function createExperimentalWorkspace(): ExperimentalWorkspace {
  return { schemaVersion: 1, profile: 'physics', title: '', objective: '', principalInvestigator: '', collaborators: '', studies: [createLaboratoryStudy()] };
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
function strings(value: unknown, keys: string[]): boolean {
  return record(value) && keys.every((key) => typeof value[key] === 'string');
}
function isMaterial(value: unknown): value is LaboratoryMaterial {
  return strings(value, ['id', 'name', 'category', 'identifier', 'quantity', 'unit', 'conditions']);
}
function isProtocol(value: unknown): value is LaboratoryProtocol {
  return strings(value, ['id', 'title', 'version', 'steps', 'source']);
}
function isInstrument(value: unknown): value is LaboratoryInstrument {
  return strings(value, ['id', 'name', 'model', 'serialNumber', 'calibrationDate', 'calibrationReference']);
}
function isMeasurement(value: unknown): value is LaboratoryMeasurement {
  return strings(value, ['id', 'name', 'value', 'unit', 'uncertainty', 'measuredAt', 'instrumentId']);
}
function isAssay(value: unknown): value is LaboratoryAssay {
  return strings(value, ['id', 'title', 'technology', 'method', 'materialReferences'])
    && Array.isArray(value.measurements) && value.measurements.every(isMeasurement);
}
function isArtifact(value: unknown): value is ResearchArtifact {
  return strings(value, ['id', 'title', 'kind', 'format', 'uri', 'persistentId', 'checksum', 'license', 'description']);
}
function isStudy(value: unknown): value is ExperimentalStudy {
  return strings(value, ['id', 'title', 'objective', 'date', 'profileContext'])
    && Array.isArray(value.materials) && value.materials.every(isMaterial)
    && Array.isArray(value.protocols) && value.protocols.every(isProtocol)
    && Array.isArray(value.instruments) && value.instruments.every(isInstrument)
    && Array.isArray(value.assays) && value.assays.every(isAssay)
    && Array.isArray(value.artifacts) && value.artifacts.every(isArtifact);
}
export function isExperimentalWorkspace(value: unknown): value is ExperimentalWorkspace {
  return strings(value, ['title', 'objective', 'principalInvestigator', 'collaborators'])
    && value.schemaVersion === 1
    && ['physics', 'chemistry', 'biology', 'materials'].includes(String(value.profile))
    && Array.isArray(value.studies) && value.studies.every(isStudy);
}
export function parseExperimentalWorkspace(json: string): ExperimentalWorkspace | null {
  try {
    const value: unknown = JSON.parse(json);
    return isExperimentalWorkspace(value) ? value : null;
  } catch {
    return null;
  }
}
