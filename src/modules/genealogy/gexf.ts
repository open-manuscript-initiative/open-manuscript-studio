import { XMLSerializer } from '@xmldom/xmldom';
import { parseGraphXml } from './parseGraphXml';
import { GraphError, MAX_GRAPH_EDGES, MAX_GRAPH_NODES, MAX_IMPORT_BYTES, createGraphWorkspace, newGraphEdge, newGraphNode, type GraphWorkspace } from './model';

/** Strict, bounded GEXF reader. No network fetches or external XML entities. */
export function parseGexf(raw: string, fileName: string): GraphWorkspace {
  if (new TextEncoder().encode(raw).byteLength > MAX_IMPORT_BYTES) throw new GraphError('limit');
  const doc = parseGraphXml(raw);
  const root = doc.documentElement;
  if (!root) throw new GraphError('invalid');
  if (root.localName !== 'gexf' || !['1.2', '1.3'].includes(root.getAttribute('version') ?? '')) throw new GraphError('version');
  const graph = Array.from(root.childNodes).filter((n): n is Element => n.nodeType === 1).find(el => el.localName === 'graph');
  if (!graph) throw new GraphError('invalid');
  const workspace = createGraphWorkspace();
  const serializer = new XMLSerializer();
  workspace.title = fileName.replace(/\.gexf$/i, '');
  const declarations = (kind: string) => {
    const result = new Map<string, { title: string; type: string }>();
    for (const block of Array.from(graph.childNodes).filter((n): n is Element => n.nodeType === 1).filter(el => el.localName === 'attributes' && el.getAttribute('class') === kind))
      for (const attr of Array.from(block.childNodes).filter((n): n is Element => n.nodeType === 1).filter(el => el.localName === 'attribute')) {
        const id = attr.getAttribute('id');
        if (id) result.set(id, { title: attr.getAttribute('title') || id, type: attr.getAttribute('type') || 'string' });
      }
    return result;
  };
  const nodeAttrs = declarations('node'), edgeAttrs = declarations('edge');
  const children = (parent: Element, name: string) => Array.from(parent.childNodes).filter((n): n is Element => n.nodeType === 1).filter(el => el.localName === name);
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
    node.gephi = { attributes: data, attributeTypes: types, visual: {}, rawId: id };
    const temporal = Array.from(el.childNodes).filter((n): n is Element => n.nodeType === 1).filter(child => ['spells', 'slices'].includes(child.localName));
    if (temporal.length) node.gephi.temporal = temporal.map(child => serializer.serializeToString(child)).join('');
    const position = Array.from(el.childNodes).filter((n): n is Element => n.nodeType === 1).find(child => child.localName === 'position');
    for (const child of Array.from(el.childNodes).filter((n): n is Element => n.nodeType === 1).filter(child => ['position', 'color', 'size', 'shape'].includes(child.localName))) {
      for (const attr of Array.from({ length: child.attributes.length }, (_, i) => child.attributes.item(i)!).filter(Boolean)) node.gephi!.visual![`${child.localName}.${attr.localName}`] = attr.value;
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
    edge.gephi = { attributes: data, attributeTypes: types, visual: {}, rawId: id };
    const temporal = Array.from(el.childNodes).filter((n): n is Element => n.nodeType === 1).filter(child => ['spells', 'slices'].includes(child.localName));
    if (temporal.length) edge.gephi.temporal = temporal.map(child => serializer.serializeToString(child)).join('');
    for (const child of Array.from(el.childNodes).filter((n): n is Element => n.nodeType === 1).filter(child => ['color', 'thickness', 'shape'].includes(child.localName)))
      for (const attr of Array.from({ length: child.attributes.length }, (_, i) => child.attributes.item(i)!).filter(Boolean)) edge.gephi.visual![`${child.localName}.${attr.localName}`] = attr.value;
    workspace.edges.push(edge);
  }
  // Preserve the original source for unsupported dynamic features and round-trip recovery.
  workspace.imports.push({ id: 'gexf-source', fileName, format: 'gexf', originalText: raw });
  return workspace;
}
