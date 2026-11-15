import { GraphError, MAX_GRAPH_EDGES, MAX_GRAPH_NODES, MAX_IMPORT_BYTES, createGraphWorkspace, newGraphEdge, newGraphNode, type GraphWorkspace } from './model';

/** Strict, bounded GEXF reader. No network fetches or external XML entities. */
export function parseGexf(raw: string, fileName: string): GraphWorkspace {
  if (new TextEncoder().encode(raw).byteLength > MAX_IMPORT_BYTES) throw new GraphError('limit');
  if (/<!DOCTYPE|<!ENTITY/i.test(raw)) throw new GraphError('invalid');
  const doc = new DOMParser().parseFromString(raw, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new GraphError('invalid');
  const root = doc.documentElement;
  if (root.localName !== 'gexf' || !['1.2', '1.3'].includes(root.getAttribute('version') ?? '')) throw new GraphError('version');
  const graph = Array.from(root.children).find(el => el.localName === 'graph');
  if (!graph) throw new GraphError('invalid');
  const workspace = createGraphWorkspace();
  workspace.title = fileName.replace(/\.gexf$/i, '');
  const declarations = (kind: string) => {
    const result = new Map<string, { title: string; type: string }>();
    for (const block of Array.from(graph.children).filter(el => el.localName === 'attributes' && el.getAttribute('class') === kind))
      for (const attr of Array.from(block.children).filter(el => el.localName === 'attribute')) {
        const id = attr.getAttribute('id');
        if (id) result.set(id, { title: attr.getAttribute('title') || id, type: attr.getAttribute('type') || 'string' });
      }
    return result;
  };
  const nodeAttrs = declarations('node'), edgeAttrs = declarations('edge');
  const children = (parent: Element, name: string) => Array.from(parent.children).filter(el => el.localName === name);
  const records = (name: string, singular: string) => children(graph, name).flatMap(container => children(container, singular));
  const nodes = records('nodes', 'node'), edges = records('edges', 'edge');
  if (nodes.length > MAX_GRAPH_NODES || edges.length > MAX_GRAPH_EDGES) throw new GraphError('limit');
  const nodeIds = new Set<string>(), edgeIds = new Set<string>();
  const attrValues = (el: Element, definitions: Map<string, { title: string; type: string }>) => {
    const data: Record<string, string> = {}, types: Record<string, string> = {};
    for (const block of children(el, 'attvalues'))
      for (const item of children(block, 'attvalue')) {
        const key = item.getAttribute('for') ?? '';
        const def = definitions.get(key);
        data[def?.title ?? key] = item.getAttribute('value') ?? '';
        types[def?.title ?? key] = def?.type ?? 'string';
      }
    return { data, types };
  };
  for (const el of nodes) {
    const id = el.getAttribute('id');
    if (!id || nodeIds.has(id)) throw new GraphError('duplicate');
    nodeIds.add(id);
    const node = newGraphNode(id, 'organization');
    node.label = el.getAttribute('label') || id;
    node.externalId = id;
    const { data, types } = attrValues(el, nodeAttrs);
    node.gephi = { attributes: data, attributeTypes: types, visual: {} };
    const position = Array.from(el.children).find(child => child.localName === 'position');
    for (const child of Array.from(el.children).filter(child => ['position', 'color', 'size', 'shape'].includes(child.localName))) {
      for (const attr of Array.from(child.attributes)) node.gephi!.visual![`${child.localName}.${attr.localName}`] = attr.value;
    }
    if (position) {
      const x = Number(position.getAttribute('x')), y = Number(position.getAttribute('y'));
      if (Number.isFinite(x) && Number.isFinite(y) && Math.abs(x) <= 1000000 && Math.abs(y) <= 1000000)
        node.networkPosition = { x, y };
    }
    workspace.nodes.push(node);
  }
  const directed = graph.getAttribute('defaultedgetype') === 'directed';
  for (let index = 0; index < edges.length; index++) {
    const el = edges[index]!;
    const from = el.getAttribute('source'), to = el.getAttribute('target');
    if (!from || !to || !nodeIds.has(from) || !nodeIds.has(to)) throw new GraphError('reference');
    // The current research-graph schema rejects self-loops. Refuse rather than silently lose topology.
    // Gephi self-loops are supported as generic network relationships.
    const id = el.getAttribute('id') || `gexf-edge-${index}`;
    if (edgeIds.has(id)) throw new GraphError('duplicate');
    edgeIds.add(id);
    const edge = newGraphEdge(id, from, to, 'other');
    edge.directed = el.getAttribute('type') === 'directed' || (el.getAttribute('type') !== 'undirected' && directed);
    edge.label = el.getAttribute('label') || '';
    const { data, types } = attrValues(el, edgeAttrs);
    const weight = el.getAttribute('weight');
    if (weight !== null) data.weight = weight;
    if (el.hasAttribute('kind')) data.kind = el.getAttribute('kind')!;
    edge.gephi = { attributes: data, attributeTypes: types, visual: {} };
    for (const child of Array.from(el.children).filter(child => ['color', 'thickness', 'shape'].includes(child.localName)))
      for (const attr of Array.from(child.attributes)) edge.gephi.visual![`${child.localName}.${attr.localName}`] = attr.value;
    workspace.edges.push(edge);
  }
  workspace.imports.push({ id: 'gexf-source', fileName, format: 'gexf', originalText: raw });
  return workspace;
}
