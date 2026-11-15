import validateEnvelope from '../../schemas/generated/researchProject.js';
import { GraphError, GRAPH_SCHEMA, isGraphWorkspace, newResearchProjectId, type GraphWorkspace } from './model';

export const RESEARCH_PROJECT_FORMAT = 'omi-research-project' as const;
export const RESEARCH_PROJECT_VERSION = '0.1.0' as const;
export const GRAPH_RESOURCE_TYPE = 'org.omi.genealogy' as const;
export const MAX_RESEARCH_PROJECT_BYTES = 64 * 1024 * 1024;
export interface ResearchResource {
  resourceId: string; resourceType: string; schemaVersion: string; mediaType: string;
  inline?: unknown; path?: string; sizeBytes?: number; sha256?: string;
  [key: string]: unknown;
}
export interface ResearchProjectFile {
  format: typeof RESEARCH_PROJECT_FORMAT; version: typeof RESEARCH_PROJECT_VERSION;
  projectId: string; title: string; createdAt: string; updatedAt: string;
  resources: ResearchResource[];
  [key: string]: unknown;
}
const record = (v: unknown): v is Record<string, unknown> => Boolean(v && typeof v === 'object' && !Array.isArray(v));

/** A bounded single-JSON consumer. Archive/path resolution is deliberately unsupported. */
export function validateResearchProject(value: unknown): asserts value is ResearchProjectFile {
  if (!validateEnvelope(value)) throw new GraphError('invalid');
  const project = value as ResearchProjectFile;
  if (new Set(project.resources.map(r => r.resourceId)).size !== project.resources.length) throw new GraphError('duplicate');
  // Refuse unresolved members rather than dropping them or claiming verified integrity.
  if (project.resources.some(r => r.path !== undefined)) throw new GraphError('invalid');
  if (project.resources.filter(isGraphResource).length !== 1) throw new GraphError('invalid');
  const resource = project.resources.find(isGraphResource)!;
  if (resource.mediaType !== 'application/json' || !isGraphWorkspace(resource.inline)) throw new GraphError('invalid');
  if (resource.inline.projectId && resource.inline.projectId !== project.projectId) throw new GraphError('invalid');
  if (resource.inline.title !== project.title || Date.parse(project.updatedAt) < Date.parse(project.createdAt)) throw new GraphError('invalid');
  const stack: Array<[unknown, number]> = [[project, 0]];
  let members = 0;
  while (stack.length) {
    const [item, depth] = stack.pop()!;
    if (depth > 64 || ++members > 1000000) throw new GraphError('limit');
    if (item && typeof item === 'object') for (const child of Object.values(item)) stack.push([child, depth + 1]);
  }
  if (new TextEncoder().encode(JSON.stringify(project)).byteLength > MAX_RESEARCH_PROJECT_BYTES) throw new GraphError('limit');
}
function isGraphResource(r: ResearchResource) { return r.resourceType === GRAPH_RESOURCE_TYPE && r.schemaVersion === GRAPH_SCHEMA; }
export function researchProjectGraph(project: ResearchProjectFile): GraphWorkspace {
  validateResearchProject(project);
  const data = project.resources.find(isGraphResource)!.inline as GraphWorkspace;
  return { ...structuredClone(data), projectId: project.projectId, title: project.title };
}
/** Preserve unknown envelope/descriptor fields and opaque inline resources during graph edits. */
export function createResearchProjectFile(workspace: GraphWorkspace, now = new Date().toISOString(), previous?: ResearchProjectFile): ResearchProjectFile {
  const data = structuredClone({ ...workspace, projectId: workspace.projectId ?? previous?.projectId ?? newResearchProjectId() });
  const base = previous?.projectId === data.projectId ? structuredClone(previous) : undefined;
  const resources: ResearchResource[] = base ? base.resources.map(r => isGraphResource(r) ? { ...r, inline: data } : r)
    : [{ resourceId: `urn:omi:resource:${newResearchProjectId()}`, resourceType: GRAPH_RESOURCE_TYPE, schemaVersion: GRAPH_SCHEMA, mediaType: 'application/json', inline: data }];
  const result: ResearchProjectFile = { ...base, format: RESEARCH_PROJECT_FORMAT, version: RESEARCH_PROJECT_VERSION,
    projectId: data.projectId, title: data.title, createdAt: base?.createdAt ?? now, updatedAt: now, resources };
  validateResearchProject(result);
  return result;
}
/** Converts the released prototype and bare graph backup only after explicit user acceptance. */
export function parseResearchProjectFile(raw: string, now = new Date().toISOString()): ResearchProjectFile {
  if (new TextEncoder().encode(raw).byteLength > MAX_RESEARCH_PROJECT_BYTES) throw new GraphError('limit');
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new GraphError('invalid'); }
  if (isGraphWorkspace(value) && (!record(value) || value.format === undefined)) return createResearchProjectFile(value, now);
  if (record(value) && value.format === 'org.omi.research-project' && value.version === 1) {
    if (typeof value.projectId !== 'string' || !value.projectId || value.projectId.length > 256
      || typeof value.title !== 'string' || !Array.isArray(value.resources) || value.resources.length !== 1) throw new GraphError('invalid');
    const resource = value.resources[0];
    if (!record(resource) || resource.id !== 'org.omi.genealogy-graph' || resource.schema !== GRAPH_SCHEMA || !isGraphWorkspace(resource.data)) throw new GraphError('invalid');
    const result = createResearchProjectFile({ ...resource.data, projectId: value.projectId, title: value.title }, now);
    // Keep the exact source, including unsupported prototype members, for recovery.
    result.extensions = { 'https://openmanuscript.org/extensions/research-project-migration/1': { format: 'org.omi.research-project', version: 1, source: raw } };
    validateResearchProject(result);
    return result;
  }
  validateResearchProject(value);
  return structuredClone(value);
}
