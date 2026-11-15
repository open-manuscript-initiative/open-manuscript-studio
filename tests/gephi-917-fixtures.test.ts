import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseGexf } from '../src/modules/genealogy/gexf.ts';
import { parseGraphml } from '../src/modules/genealogy/graphml.ts';
import { GraphError, MAX_IMPORT_BYTES, isGraphWorkspace, mergeGraphs, parseGraphJson } from '../src/modules/genealogy/model.ts';
import { createResearchProjectFile, parseResearchProjectFile, researchProjectGraph } from '../src/modules/genealogy/projectFile.ts';

const fixture = (name: string) => readFileSync(new URL('./fixtures/' + name, import.meta.url), 'utf8');
const gexf12 = () => fixture('gephi-les-miserables.gexf');
const gexf13 = () => fixture('gephi-917-dynamic-1.3.gexf');
const graphml = () => fixture('gephi-917-mixed.graphml');
const graphError = (code: GraphError['code']) => (error: unknown) =>
  error instanceof GraphError && error.code === code;

test('#917 real Gephi Lite Les Misérables GEXF 1.2 fixture imports topology, visuals and source', () => {
  const original = gexf12();
  const graph = parseGexf(original, 'gephi-les-miserables.gexf');
  assert.ok(graph.nodes.length >= 70, 'expected upstream example nodes');
  assert.ok(graph.edges.length >= 200, 'expected upstream example edges');
  assert.equal(new Set(graph.nodes.map(node => node.id)).size, graph.nodes.length);
  assert.equal(new Set(graph.edges.map(edge => edge.id)).size, graph.edges.length);
  assert.ok(graph.nodes.some(node => node.label === 'Valjean'));
  assert.ok(graph.nodes.some(node => node.networkPosition));
  assert.ok(graph.nodes.some(node => node.gephi?.visual?.['color.r']));
  assert.ok(graph.nodes.some(node => node.gephi?.attributeTypes?.modularity_class === 'integer'));
  assert.ok(graph.edges.every(edge => graph.nodes.some(n => n.id === edge.from) && graph.nodes.some(n => n.id === edge.to)));
  assert.ok(graph.edges.every(edge => edge.directed === false));
  assert.equal(graph.imports[0]?.originalText, original);
  assert.ok(isGraphWorkspace(graph));
});

test('#917 GEXF 1.3 dynamic fixture keeps typed attributes, unicode, weighted mixed multigraph and visual metadata', () => {
  const original = gexf13(), graph = parseGexf(original, 'gephi-917-dynamic-1.3.gexf');
  assert.equal(graph.nodes.length, 2);
  assert.equal(graph.edges.length, 3);
  assert.equal(graph.nodes[0]?.label, 'Árvíztűrő tükörfúrógép');
  assert.equal(graph.nodes[0]?.gephi?.attributes?.pontszám, '2.5');
  assert.equal(graph.nodes[0]?.gephi?.attributeTypes?.pontszám, 'double');
  assert.equal(graph.nodes[0]?.gephi?.attributes?.levéltár, 'Sárospatak');
  assert.deepEqual(graph.nodes[0]?.networkPosition, {x: 12.5, y: -8});
  assert.equal(graph.nodes[0]?.gephi?.visual?.['color.a'], '0.5');
  assert.equal(graph.nodes[0]?.gephi?.visual?.['shape.value'], 'diamond');
  assert.match(graph.nodes[0]?.gephi?.temporal ?? '', /spell start=/);
  assert.equal(graph.edges[0]?.from, graph.edges[0]?.to);
  assert.equal(graph.edges[0]?.directed, true);
  assert.equal(graph.edges[0]?.gephi?.attributes?.weight, '1.5');
  assert.match(graph.edges[0]?.gephi?.temporal ?? '', /spell start=/);
  assert.equal(graph.edges[0]?.gephi?.visual?.['thickness.value'], '2');
  assert.equal(graph.edges[1]?.directed, false);
  assert.equal(graph.edges[2]?.directed, true);
  assert.equal(graph.edges[1]?.from, graph.edges[2]?.from);
  assert.equal(graph.edges[1]?.to, graph.edges[2]?.to);
  assert.equal(graph.edges[1]?.gephi?.attributes?.kapcsolat, 'barátság');
  // Dynamic attvalue intervals not yet exposed by the editor; keep exact source for later recovery.
  assert.match(graph.imports[0]?.originalText ?? '', /start="2020-01-01"/);
  assert.equal(graph.imports[0]?.originalText, original);
  assert.ok(isGraphWorkspace(graph));
});

test('#917 GraphML example keeps mixed direction, parallel edges, self-loop, types and unicode', () => {
  const original = graphml(), graph = parseGraphml(original, 'gephi-917-mixed.graphml');
  assert.equal(graph.nodes.length, 3);
  assert.equal(graph.edges.length, 4);
  assert.equal(graph.nodes[0]?.label, 'Sárospatak');
  assert.equal(graph.nodes[0]?.gephi?.attributes?.population, '100');
  assert.equal(graph.nodes[0]?.gephi?.attributeTypes?.population, 'int');
  assert.equal(graph.nodes[2]?.label, 'Árvíztűrő hely');
  assert.equal(graph.edges[0]?.from, graph.edges[0]?.to);
  assert.equal(graph.edges[0]?.directed, true);
  assert.equal(graph.edges[0]?.gephi?.attributes?.weight, '2.75');
  assert.equal(graph.edges[0]?.gephi?.attributeTypes?.weight, 'double');
  assert.equal(graph.edges[1]?.directed, false);
  assert.equal(graph.edges[2]?.directed, true);
  assert.equal(graph.edges[1]?.from, graph.edges[2]?.from);
  assert.equal(graph.edges[1]?.to, graph.edges[2]?.to);
  assert.equal(graph.edges[1]?.gephi?.attributes?.note, 'kutatási kapcsolat');
  assert.equal(graph.imports[0]?.originalText, original);
  assert.ok(isGraphWorkspace(graph));
});

test('#917 editable import survives graph JSON and portable research project save/open without topology loss', () => {
  for (const [name, importGraph] of [
    ['GEXF 1.2', () => parseGexf(gexf12(), 'gephi-les-miserables.gexf')],
    ['GEXF 1.3', () => parseGexf(gexf13(), 'gephi-917-dynamic-1.3.gexf')],
    ['GraphML', () => parseGraphml(graphml(), 'gephi-917-mixed.graphml')],
  ] as const) {
    const graph = importGraph();
    graph.nodes[0]!.label += ' (edited)';
    const json = parseGraphJson(JSON.stringify(graph));
    assert.deepEqual(json, graph, name);
    const project = createResearchProjectFile(json, '2026-11-15T00:00:00.000Z');
    const reopened = researchProjectGraph(parseResearchProjectFile(JSON.stringify(project)));
    assert.deepEqual(reopened.nodes, graph.nodes, name + ' nodes');
    assert.deepEqual(reopened.edges, graph.edges, name + ' edges');
    assert.deepEqual(reopened.imports, graph.imports, name + ' provenance');
    assert.equal(reopened.nodes[0]?.label, graph.nodes[0]?.label, name + ' edit');
  }
});

test('#917 merge uses distinct internal IDs while preserving imported Gephi source IDs and parallel topology', () => {
  const original = parseGraphml(graphml(), 'first.graphml');
  let i = 0;
  const merged = mergeGraphs(original, original, () => 'imported-' + ++i);
  assert.equal(merged.nodes.length, original.nodes.length * 2);
  assert.equal(merged.edges.length, original.edges.length * 2);
  assert.equal(new Set(merged.nodes.map(n => n.id)).size, merged.nodes.length);
  assert.equal(new Set(merged.edges.map(e => e.id)).size, merged.edges.length);
  assert.equal(merged.nodes.at(-1)?.gephi?.rawId, 'c');
  assert.ok(isGraphWorkspace(merged));
});

test('#917 XXE/DTD/entity and unsupported versions are rejected in both XML formats', () => {
  for (const parse of [parseGexf, parseGraphml]) {
    assert.throws(() => parse('<!DOCTYPE graph [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><graphml/>', 'xxe.xml'), graphError('invalid'));
    assert.throws(() => parse('<!ENTITY evil "expansion"><graphml/>', 'entity.xml'), graphError('invalid'));
    assert.throws(() => parse('not an xml graph', 'bad.xml'), graphError('invalid'));
  }
  assert.throws(() => parseGexf('<gexf version="1.1"><graph/></gexf>', 'old.gexf'), graphError('version'));
  assert.throws(() => parseGexf('<gexf version="1.2"><graph><nodes><node id="a"></nodes></graph></gexf>', 'malformed.gexf'), graphError('invalid'));
  assert.throws(() => parseGraphml('<graphml><graph><node id="a"></graph></graphml>', 'malformed.graphml'), graphError('invalid'));
});

test('#917 invalid endpoints and duplicate node/edge IDs fail before import commit', () => {
  for (const parse of [parseGexf, parseGraphml]) {
    const isGexf = parse === parseGexf;
    const wrap = (nodes: string, edges = '') => isGexf
      ? `<gexf version="1.2"><graph><nodes>${nodes}</nodes><edges>${edges}</edges></graph></gexf>`
      : `<graphml><graph edgedefault="directed">${nodes}${edges}</graph></graphml>`;
    const node = (id: string) => `<node id="${id}"/>`;
    const edge = (id: string, target: string) => `<edge id="${id}" source="a" target="${target}"/>`;
    assert.throws(() => parse(wrap(node('a') + node('a')), 'duplicate.xml'), graphError('duplicate'));
    assert.throws(() => parse(wrap(node('a'), edge('e1', 'missing')), 'reference.xml'), graphError('reference'));
    assert.throws(() => parse(wrap(node('a'), edge('e1', 'a') + edge('e1', 'a')), 'duplicate-edge.xml'), graphError('duplicate'));
    assert.throws(() => parse(wrap(node('a'), '<edge id="missing-source" target="a"/>'), 'reference.xml'), graphError('reference'));
  }
});

test('#917 maximum import byte size fails closed for GEXF and GraphML', () => {
  const tooLarge = ' '.repeat(MAX_IMPORT_BYTES + 1);
  assert.throws(() => parseGexf(tooLarge, 'huge.gexf'), graphError('limit'));
  assert.throws(() => parseGraphml(tooLarge, 'huge.graphml'), graphError('limit'));
});

test('#917 a larger 1200-node 2400-edge GEXF network imports without truncating topology', () => {
  const count = 1200, edgeCount = 2400;
  const nodes = Array.from({length: count}, (_, i) => `<node id="n${i}" label="Node ${i}"/>`).join('');
  const edges = Array.from({length: edgeCount}, (_, i) => `<edge id="e${i}" source="n${i % count}" target="n${(i + 1) % count}"/>`).join('');
  const raw = `<gexf version="1.2"><graph defaultedgetype="undirected"><nodes>${nodes}</nodes><edges>${edges}</edges></graph></gexf>`;
  const graph = parseGexf(raw, 'large-example.gexf');
  assert.equal(graph.nodes.length, count);
  assert.equal(graph.edges.length, edgeCount);
  assert.ok(isGraphWorkspace(graph));
  // This is a data-integrity smoke test; it does not prove non-blocking UI processing.
});
