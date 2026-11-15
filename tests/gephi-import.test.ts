import { readFileSync } from 'node:fs';
import { parseGexf } from '../src/modules/genealogy/gexf.ts';
import { parseGraphml } from '../src/modules/genealogy/graphml.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createGraphWorkspace, isGraphWorkspace, newGraphNode, newGraphEdge, parseGraphJson } from '../src/modules/genealogy/model.ts';
import { createResearchProjectFile, parseResearchProjectFile, researchProjectGraph } from '../src/modules/genealogy/projectFile.ts';

test('Gephi typed attributes and visual metadata survive graph JSON and portable project round-trip', () => {
  const graph = createGraphWorkspace();
  const node = newGraphNode('n1', 'organization');
  node.label = 'Árvíztűrő intézmény';
  node.networkPosition = { x: 12, y: -8 };
  node.gephi = {
    rawId: 'n1',
    attributes: { weight: '3.5', archive: 'Sárospatak' },
    attributeTypes: { weight: 'double', archive: 'string' },
    visual: { 'color.r': '120', 'color.g': '80', 'size.value': '18' },
    temporal: '<spells><spell start="1900" end="1950"/></spells>',
  };
  const edge = newGraphEdge('e1', 'n1', 'n1', 'other');
  edge.gephi = { rawId: 'e1', attributes: { weight: '2' }, attributeTypes: { weight: 'double' } };
  graph.nodes.push(node);
  graph.edges.push(edge);
  assert.equal(isGraphWorkspace(graph), true);
  assert.deepEqual(parseGraphJson(JSON.stringify(graph)), graph);
  const project = createResearchProjectFile(graph);
  const restored = researchProjectGraph(parseResearchProjectFile(JSON.stringify(project)));
  assert.deepEqual(restored.nodes, graph.nodes);
  assert.deepEqual(restored.edges, graph.edges);
});

test('legacy graph without Gephi metadata remains valid', () => {
  const graph = createGraphWorkspace();
  graph.nodes.push(newGraphNode('n1', 'person'));
  assert.equal(isGraphWorkspace(graph), true);
});

test('invalid Gephi metadata is rejected', () => {
  const graph = createGraphWorkspace();
  const node = newGraphNode('n1');
  node.gephi = { attributes: { unexpected: 12 as unknown as string } };
  graph.nodes.push(node);
  assert.equal(isGraphWorkspace(graph), false);
});

test('upstream Gephi Lite Les Misérables GEXF imports editable nodes, edges, positions and visual attributes', () => {
    const raw = readFileSync(new URL('./fixtures/gephi-les-miserables.gexf', import.meta.url), 'utf8');
    const graph = parseGexf(raw, 'Les Miserables.gexf');
    assert.ok(graph.nodes.length > 50);
    assert.ok(graph.edges.length > 100);
    assert.ok(graph.nodes.some(node => node.networkPosition));
    assert.ok(graph.nodes.some(node => Object.keys(node.gephi?.visual || {}).length > 0));
    assert.equal(isGraphWorkspace(graph), true);
    assert.deepEqual(parseGraphJson(JSON.stringify(graph)).nodes, graph.nodes);
});

test('GraphML directed edges, typed metadata and self-loops import without topology loss', () => {
  const previous = globalThis.DOMParser;
  Object.assign(globalThis, { DOMParser });
  try {
    const raw = `<?xml version="1.0"?><graphml xmlns="http://graphml.graphdrawing.org/xmlns">
      <key id="weight" for="edge" attr.name="weight" attr.type="double"/>
      <graph edgedefault="directed"><node id="a"/><node id="b"/>
      <edge id="loop" source="a" target="a"><data key="weight">2.5</data></edge>
      <edge id="other" source="a" target="b"/></graph></graphml>`;
    const graph = parseGraphml(raw, 'sample.graphml');
    assert.equal(graph.nodes.length, 2);
    assert.equal(graph.edges.length, 2);
    assert.equal(graph.edges[0]?.gephi?.attributes?.weight, '2.5');
    assert.equal(graph.edges[0]?.directed, true);
    assert.equal(isGraphWorkspace(graph), true);
  } finally {
    Object.assign(globalThis, { DOMParser: previous });
  }
});
