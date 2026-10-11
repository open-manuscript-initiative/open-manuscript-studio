export type HealthDiscipline = 'psychology' | 'medical-sciences';
export const commonFields = ["title", "question", "registration", "population", "method", "analysis", "ethics", "consent", "sharing", "publicSummary", "source"] as const;
export const disciplineFields = {
  psychology: ["instrument", "rights", "scoring", "psychometrics"],
  'medical-sciences': ["studyType", "intervention", "endpoints", "outcomes"],
} as const;
export type HealthWorkspace = { schemaVersion: 1; discipline: HealthDiscipline; fields: Record<string, string> };
export function createHealthWorkspace(discipline: HealthDiscipline): HealthWorkspace {
  return { schemaVersion: 1, discipline, fields: Object.fromEntries([...commonFields, ...disciplineFields[discipline]].map(key => [key, ''])) };
}
export function isHealthWorkspace(value: unknown, discipline: HealthDiscipline): value is HealthWorkspace {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<HealthWorkspace>;
  if (v.schemaVersion !== 1 || v.discipline !== discipline || !v.fields || typeof v.fields !== 'object' || Array.isArray(v.fields)) return false;
  return [...commonFields, ...disciplineFields[discipline]].every(key => typeof v.fields?.[key] === 'string') && Object.values(v.fields).every(field => typeof field === 'string');
}
/** Explicit allowlist: ethics records, results and instrument content never become manuscript excerpts automatically. */
export function projectHealthSummary(value: unknown, discipline: HealthDiscipline): { title: string; text: string; source: string } | null {
  if (!isHealthWorkspace(value, discipline)) return null;
  const { title, publicSummary, source } = value.fields;
  return title.trim() && publicSummary.trim() ? { title: title.trim(), text: publicSummary.trim(), source: source.trim() } : null;
}
