import {
  GraphError,
  isGraphWorkspace,
  newResearchProjectId,
  type GraphWorkspace,
} from './model';

export const RESEARCH_PROJECT_FORMAT = 'org.omi.research-project' as const;
export const RESEARCH_PROJECT_VERSION = 1 as const;
export const GRAPH_RESOURCE_ID = 'org.omi.genealogy-graph' as const;
export const MAX_RESEARCH_PROJECT_BYTES = 64 * 1024 * 1024;

export interface ResearchProjectFile {
  format: typeof RESEARCH_PROJECT_FORMAT;
  version: typeof RESEARCH_PROJECT_VERSION;
  projectId: string;
  title: string;
  modifiedAt: string;
  resources: [{
    id: typeof GRAPH_RESOURCE_ID;
    schema: GraphWorkspace['schema'];
    data: GraphWorkspace;
  }];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

/** Wrap the shared graph in a portable, module-independent project envelope. */
export function createResearchProjectFile(
  workspace: GraphWorkspace,
  now = new Date().toISOString(),
): ResearchProjectFile {
  const data = workspace.projectId
    ? workspace
    : { ...workspace, projectId: newResearchProjectId() };
  return {
    format: RESEARCH_PROJECT_FORMAT,
    version: RESEARCH_PROJECT_VERSION,
    projectId: data.projectId!,
    title: data.title,
    modifiedAt: now,
    resources: [{ id: GRAPH_RESOURCE_ID, schema: data.schema, data }],
  };
}

/** Read both the new portable project envelope and legacy graph JSON exports. */
export function parseResearchProjectFile(raw: string): GraphWorkspace {
  if (new TextEncoder().encode(raw).byteLength > MAX_RESEARCH_PROJECT_BYTES)
    throw new GraphError('limit');

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new GraphError('invalid');
  }

  if (isGraphWorkspace(value)) {
    return value.projectId ? value : { ...value, projectId: newResearchProjectId() };
  }

  if (
    !isRecord(value) ||
    value.format !== RESEARCH_PROJECT_FORMAT ||
    value.version !== RESEARCH_PROJECT_VERSION ||
    typeof value.projectId !== 'string' ||
    value.projectId.length < 1 ||
    value.projectId.length > 256 ||
    typeof value.title !== 'string' ||
    value.title.length > 1000 ||
    !Array.isArray(value.resources) ||
    value.resources.length !== 1
  )
    throw new GraphError('invalid');

  const resource = value.resources[0];
  if (
    !isRecord(resource) ||
    resource.id !== GRAPH_RESOURCE_ID ||
    !isGraphWorkspace(resource.data) ||
    resource.schema !== resource.data.schema
  )
    throw new GraphError('invalid');

  // The envelope identity is authoritative, keeping identity stable when a
  // project file is opened on another device or by the other graph view.
  return {
    ...resource.data,
    projectId: value.projectId,
    title: value.title,
  };
}
