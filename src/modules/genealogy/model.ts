/** Editable research graph shared by the family-tree and relationship modules. */
export const GRAPH_SCHEMA = 'omi-research-graph/1' as const;
export const MAX_GRAPH_NODES = 10000;
export const MAX_GRAPH_EDGES = 30000;
export const MAX_IMPORT_BYTES = 8 * 1024 * 1024;
export const NODE_KINDS = ['person', 'organization', 'place', 'event'] as const;
export const RELATION_KINDS = [
  'parent',
  'partner',
  'kinship',
  'godparent',
  'patronage',
  'correspondence',
  'teacher',
  'membership',
  'employment',
  'other',
] as const;
export const PEDIGREES = [
  'unspecified',
  'birth',
  'adopted',
  'foster',
  'other',
] as const;
export const CERTAINTIES = ['documented', 'probable', 'uncertain'] as const;
export type NodeKind = (typeof NODE_KINDS)[number];
export type RelationKind = (typeof RELATION_KINDS)[number];
export type Pedigree = (typeof PEDIGREES)[number];
export type Certainty = (typeof CERTAINTIES)[number];
export type GraphMode = 'tree' | 'network';
export interface Point {
  x: number;
  y: number;
}
export interface GraphNode {
  id: string;
  kind: NodeKind;
  label: string;
  givenName: string;
  familyName: string;
  sex: 'M' | 'F' | 'X' | 'U';
  birthDate: string;
  birthPlace: string;
  deathDate: string;
  deathPlace: string;
  notes: string;
  source: string;
  externalId: string;
  alternateNames: string[];
  treePosition?: Point;
  networkPosition?: Point;
}
export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  kind: RelationKind;
  label: string;
  directed: boolean;
  pedigree: Pedigree;
  certainty: Certainty;
  startDate: string;
  endDate: string;
  place: string;
  source: string;
  notes: string;
  familyId: string;
}
export interface GraphImportSource {
  id: string;
  fileName: string;
  format: string;
  originalText: string;
  originalBase64?: string;
}
export interface GraphWorkspace {
  schema: typeof GRAPH_SCHEMA;
  title: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  imports: GraphImportSource[];
}
export class GraphError extends Error {
  code:
    | 'invalid'
    | 'limit'
    | 'cycle'
    | 'duplicate'
    | 'self'
    | 'reference'
    | 'encoding'
    | 'gedcom'
    | 'version';
  line?: number;
  constructor(code: GraphError['code'], line?: number) {
    super(code);
    this.code = code;
    this.line = line;
  }
}
export function createGraphWorkspace(): GraphWorkspace {
  return { schema: GRAPH_SCHEMA, title: '', nodes: [], edges: [], imports: [] };
}
export function newGraphNode(id: string, kind: NodeKind = 'person'): GraphNode {
  return {
    id,
    kind,
    label: '',
    givenName: '',
    familyName: '',
    sex: 'U',
    birthDate: '',
    birthPlace: '',
    deathDate: '',
    deathPlace: '',
    notes: '',
    source: '',
    externalId: '',
    alternateNames: [],
  };
}
export function newGraphEdge(
  id: string,
  from: string,
  to: string,
  kind: RelationKind = 'parent',
): GraphEdge {
  return {
    id,
    from,
    to,
    kind,
    label: '',
    directed: kind !== 'partner' && kind !== 'kinship',
    pedigree: 'unspecified',
    certainty: 'documented',
    startDate: '',
    endDate: '',
    place: '',
    source: '',
    notes: '',
    familyId: '',
  };
}
const record = (v: unknown): v is Record<string, unknown> =>
  Boolean(v && typeof v === 'object' && !Array.isArray(v));
const strings = (v: Record<string, unknown>, keys: string[]) =>
  keys.every(
    (k) => typeof v[k] === 'string' && (v[k] as string).length <= 100000,
  );
const unique = (values: { id: string }[]) =>
  values.every((v) => v.id.length > 0 && v.id.length <= 256) &&
  new Set(values.map((v) => v.id)).size === values.length;
const point = (v: unknown) =>
  v === undefined ||
  (record(v) &&
    typeof v.x === 'number' &&
    typeof v.y === 'number' &&
    Number.isFinite(v.x) &&
    Number.isFinite(v.y) &&
    Math.abs(v.x) <= 1000000 &&
    Math.abs(v.y) <= 1000000);
export function isGraphWorkspace(value: unknown): value is GraphWorkspace {
  if (
    !record(value) ||
    value.schema !== GRAPH_SCHEMA ||
    typeof value.title !== 'string' ||
    value.title.length > 1000 ||
    !Array.isArray(value.nodes) ||
    !Array.isArray(value.edges) ||
    !Array.isArray(value.imports) ||
    value.nodes.length > MAX_GRAPH_NODES ||
    value.edges.length > MAX_GRAPH_EDGES ||
    value.imports.length > 50
  )
    return false;
  const nodes = value.nodes as GraphNode[],
    edges = value.edges as GraphEdge[];
  if (
    !nodes.every(
      (n) =>
        record(n) &&
        strings(n, [
          'id',
          'label',
          'givenName',
          'familyName',
          'birthDate',
          'birthPlace',
          'deathDate',
          'deathPlace',
          'source',
          'notes',
          'externalId',
        ]) &&
        NODE_KINDS.includes(n.kind) &&
        ['M', 'F', 'X', 'U'].includes(n.sex) &&
        Array.isArray(n.alternateNames) &&
        n.alternateNames.length <= 100 &&
        n.alternateNames.every(
          (s) => typeof s === 'string' && s.length <= 10000,
        ) &&
        point(n.treePosition) &&
        point(n.networkPosition),
    ) ||
    !unique(nodes)
  )
    return false;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  if (
    !edges.every(
      (e) =>
        record(e) &&
        strings(e, [
          'id',
          'from',
          'to',
          'label',
          'startDate',
          'endDate',
          'place',
          'source',
          'notes',
          'familyId',
        ]) &&
        RELATION_KINDS.includes(e.kind) &&
        PEDIGREES.includes(e.pedigree) &&
        CERTAINTIES.includes(e.certainty) &&
        typeof e.directed === 'boolean' &&
        byId.has(e.from) &&
        byId.has(e.to) &&
        e.from !== e.to &&
        (!['parent', 'partner'].includes(e.kind) ||
          (byId.get(e.from)?.kind === 'person' &&
            byId.get(e.to)?.kind === 'person')) &&
        (e.kind !== 'parent' || e.directed),
    ) ||
    !unique(edges)
  )
    return false;
  if (
    !value.imports.every(
      (i) =>
        record(i) &&
        strings(i, ['id', 'fileName', 'format']) &&
        typeof i.originalText === 'string' &&
        i.originalText.length <= MAX_IMPORT_BYTES &&
        (i.originalBase64 === undefined ||
          (typeof i.originalBase64 === 'string' &&
            i.originalBase64.length <= MAX_IMPORT_BYTES * 1.4 &&
            i.originalBase64.length % 4 === 0 &&
            /^[A-Za-z0-9+/]*={0,2}$/.test(i.originalBase64))),
    ) ||
    !unique(value.imports as GraphImportSource[]) ||
    value.imports.reduce((sum, i) => sum + i.originalText.length, 0) >
      MAX_IMPORT_BYTES * 2
  )
    return false;
  return !hasParentCycle(nodes, edges);
}
export function parseGraphJson(raw: string): GraphWorkspace {
  if (raw.length > MAX_IMPORT_BYTES * 8) throw new GraphError('limit');
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new GraphError('invalid');
  }
  if (!isGraphWorkspace(value)) throw new GraphError('invalid');
  return value;
}
export function hasParentCycle(
  nodes: Pick<GraphNode, 'id'>[],
  edges: Pick<GraphEdge, 'from' | 'to' | 'kind'>[],
): boolean {
  const degree = new Map(nodes.map((n) => [n.id, 0]));
  const children = new Map<string, string[]>();
  for (const e of edges)
    if (e.kind === 'parent') {
      degree.set(e.to, (degree.get(e.to) ?? 0) + 1);
      const list = children.get(e.from) ?? [];
      list.push(e.to);
      children.set(e.from, list);
    }
  const queue = [...degree].filter(([, d]) => d === 0).map(([id]) => id);
  for (let i = 0; i < queue.length; i++)
    for (const id of children.get(queue[i]!) ?? []) {
      const d = degree.get(id)! - 1;
      degree.set(id, d);
      if (!d) queue.push(id);
    }
  return queue.length !== nodes.length;
}
export function putEdge(
  workspace: GraphWorkspace,
  edge: GraphEdge,
): GraphWorkspace {
  if (edge.from === edge.to) throw new GraphError('self');
  if (
    !workspace.nodes.some((n) => n.id === edge.from) ||
    !workspace.nodes.some((n) => n.id === edge.to)
  )
    throw new GraphError('reference');
  if (
    workspace.edges.some(
      (e) =>
        e.id !== edge.id &&
        e.kind === edge.kind &&
        e.pedigree === edge.pedigree &&
        e.label === edge.label &&
        e.familyId === edge.familyId &&
        ((e.from === edge.from && e.to === edge.to) ||
          (!e.directed &&
            !edge.directed &&
            e.from === edge.to &&
            e.to === edge.from)),
    )
  )
    throw new GraphError('duplicate');
  const edges = workspace.edges.some((e) => e.id === edge.id)
    ? workspace.edges.map((e) => (e.id === edge.id ? edge : e))
    : [...workspace.edges, edge];
  if (edges.length > MAX_GRAPH_EDGES) throw new GraphError('limit');
  if (hasParentCycle(workspace.nodes, edges)) throw new GraphError('cycle');
  const next = { ...workspace, edges };
  if (!isGraphWorkspace(next)) throw new GraphError('invalid');
  return next;
}
export function removeNode(
  workspace: GraphWorkspace,
  id: string,
): GraphWorkspace {
  return {
    ...workspace,
    nodes: workspace.nodes.filter((n) => n.id !== id),
    edges: workspace.edges.filter((e) => e.from !== id && e.to !== id),
  };
}
/** Imports never silently identify two people by name or by a program-local ID. */
export function mergeGraphs(
  current: GraphWorkspace,
  incoming: GraphWorkspace,
  id: () => string,
): GraphWorkspace {
  const ids = new Map(incoming.nodes.map((n) => [n.id, id()]));
  const families = new Map<string, string>();
  const edges = incoming.edges.map((e) => {
    if (e.familyId && !families.has(e.familyId)) families.set(e.familyId, id());
    return {
      ...e,
      id: id(),
      from: ids.get(e.from)!,
      to: ids.get(e.to)!,
      familyId: families.get(e.familyId) ?? '',
    };
  });
  const next: GraphWorkspace = {
    ...current,
    title: current.title || incoming.title,
    nodes: [
      ...current.nodes,
      ...incoming.nodes.map((n) => ({ ...n, id: ids.get(n.id)! })),
    ],
    edges: [...current.edges, ...edges],
    imports: [
      ...current.imports,
      ...incoming.imports.map((i) => ({ ...i, id: id() })),
    ],
  };
  if (!isGraphWorkspace(next)) throw new GraphError('limit');
  return next;
}
export function relationshipCsv(workspace: GraphWorkspace): string {
  const names = new Map(workspace.nodes.map((n) => [n.id, n.label]));
  const rows = [
    [
      'id',
      'from_id',
      'from_name',
      'to_id',
      'to_name',
      'relation',
      'label',
      'directed',
      'pedigree',
      'certainty',
      'start_date',
      'end_date',
      'place',
      'source',
      'notes',
    ],
    ...workspace.edges.map((e) => [
      e.id,
      e.from,
      names.get(e.from) ?? '',
      e.to,
      names.get(e.to) ?? '',
      e.kind,
      e.label,
      String(e.directed),
      e.pedigree,
      e.certainty,
      e.startDate,
      e.endDate,
      e.place,
      e.source,
      e.notes,
    ]),
  ];
  return (
    '\uFEFF' +
    rows
      .map((row) =>
        row
          .map(
            (v) =>
              '"' +
              (/^[=+\-@\t\r]/.test(v) ? "'" + v : v).replace(/"/g, '""') +
              '"',
          )
          .join(','),
      )
      .join('\r\n')
  );
}
