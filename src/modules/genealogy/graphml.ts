import { GraphError, MAX_GRAPH_EDGES, MAX_GRAPH_NODES, MAX_IMPORT_BYTES, createGraphWorkspace, newGraphEdge, newGraphNode, type GraphWorkspace } from './model';

/** Bounded GraphML import; external entities and DTDs are prohibited. */
export function parseGraphml(raw: string, fileName: string): GraphWorkspace {
  if (new TextEncoder().encode(raw).byteLength > MAX_IMPORT_BYTES) throw new GraphError('limit');
  if (/<!DOCTYPE|<!ENTITY/i.test(raw)) throw new GraphError('invalid');
  const doc = new DOMParser().parseFromString(raw, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length || doc.documentElement.localName !== 'graphml') throw new GraphError('invalid');
  const root = doc.documentElement;
  const children = (el: Element, name: string) => Array.from(el.children).filter(child => child.localName === name);
  const graph = children(root, 'graph')[0];
  if (!graph) throw new GraphError('invalid');
  const definitions = new Map<string, { name: string; type: string; scope: string }>();
  for (const el of children(root, 'key')) {
    const id = el.getAttribute('id');
    if (id) definitions.set(id, { name: el.getAttribute('attr.name') || id, type: el.getAttribute('attr.type') || 'string', scope: el.getAttribute('for') || 'all' });
  }
  const values = (el: Element, scope: string) => {
    const attributes: Record<string, string> = {}, attributeTypes: Record<string, string> = {};
    for (const data of children(el, 'data')) {
      const key = data.getAttribute('key') || '';
      const def = definitions.get(key);
      if (def && def.scope !== 'all' && def.scope !== scope) continue;
      const name = def?.name || key;
      attributes[name] = data.textContent || '';
      attributeTypes[name] = def?.type || 'string';
    }
    return { attributes, attributeTypes };
  };
  const nodes = children(graph, 'node'), edges = children(graph, 'edge');
  if (nodes.length > MAX_GRAPH_NODES || edges.length > MAX_GRAPH_EDGES) throw new GraphError('limit');
  const result = createGraphWorkspace();
  result.title = fileName.replace(/\.graphml$/i, '');
  const ids = new Set<string>(), edgeIds = new Set<string>();
  for (const el of nodes) {
    const id = el.getAttribute('id');
    if (!id || ids.has(id)) throw new GraphError('duplicate');
    ids.add(id);
    const node = newGraphNode(id, 'organization');
    node.gephi = { ...values(el, 'node'), rawId: id };
    node.label = node.gephi.attributes?.label || id;
    node.externalId = id;
    result.nodes.push(node);
  }
  for (let i = 0; i < edges.length; i++) {
    const el = edges[i]!;
    const from = el.getAttribute('source'), to = el.getAttribute('target');
    if (!from || !to || !ids.has(from) || !ids.has(to)) throw new GraphError('reference');
    const id = el.getAttribute('id') || `graphml-edge-${i}`;
    if (edgeIds.has(id)) throw new GraphError('duplicate');
    edgeIds.add(id);
    const edge = newGraphEdge(id, from, to, 'other');
    edge.directed = el.getAttribute('directed') === 'true' || (el.getAttribute('directed') !== 'false' && graph.getAttribute('edgedefault') === 'directed');
    edge.gephi = { ...values(el, 'edge'), rawId: id };
    edge.label = edge.gephi.attributes?.label || '';
    result.edges.push(edge);
  }
  result.imports.push({ id: 'graphml-source', fileName, format: 'graphml', originalText: raw });
  return result;
}
