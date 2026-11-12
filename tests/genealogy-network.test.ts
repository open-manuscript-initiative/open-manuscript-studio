import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { decodeGedcom, parseGedcom } from '../src/modules/genealogy/gedcom.ts';
import {
  createGraphWorkspace,
  GraphError,
  hasParentCycle,
  isGraphWorkspace,
  mergeGraphs,
  newGraphEdge,
  newGraphNode,
  parseGraphJson,
  putEdge,
  relationshipCsv,
  removeNode,
} from '../src/modules/genealogy/model.ts';
import {
  connectionPoints,
  edgeLabelPoint,
  graphLayout,
  graphSvg,
  MAX_VISIBLE_NODES,
  NODE_HEIGHT,
  graphNameLines,
} from '../src/modules/genealogy/layout.ts';
import { createGraphStore } from '../src/modules/genealogy/workspaceStore.ts';
import { graphCopy, relationLabels } from '../src/modules/genealogy/copy.ts';

const wrap = (body: string, version = '5.5.1') =>
  `0 HEAD\n1 GEDC\n2 VERS ${version}\n1 CHAR UTF-8\n${body}\n0 TRLR\n`;
const person = (id: string, name = id) => `0 @${id}@ INDI\n1 NAME ${name}`;
const example = wrap(
  [
    person('I1', 'János /Varga/'),
    '1 SEX M',
    '1 BIRT',
    '2 DATE ABT 1620',
    '2 PLAC Sárospatak',
    '1 NOTE @N1@',
    '1 SOUR @S1@',
    '2 PAGE fol. 12r',
    person('I2', 'Judit /Balogh/'),
    '1 SEX F',
    person('I3', 'Anna /Varga/'),
    '1 FAMC @F1@',
    '2 PEDI birth',
    '0 @F1@ FAM',
    '1 HUSB @I1@',
    '1 WIFE @I2@',
    '1 CHIL @I3@',
    '1 MARR',
    '2 DATE BEF 1650',
    '2 PLAC Miskolc',
    '0 @N1@ NOTE Árvíztűrő',
    '1 CONC tükörfúrógép',
    '1 CONT Második sor',
    '0 @S1@ SOUR',
    '1 TITL Anyakönyv',
    '1 AUTH Levéltár',
  ].join('\n'),
);
const graphWithPeople = () => ({
  ...createGraphWorkspace(),
  nodes: ['a', 'b', 'c', 'd'].map((id) => ({ ...newGraphNode(id), label: id })),
});
const code = (expected: string) => (e: unknown) =>
  e instanceof GraphError && e.code === expected;

test('GEDCOM imports Unicode names, literal dates, notes and verifiable source pages', () => {
  const { workspace, version } = parseGedcom(example, 'kutatás.ged');
  assert.equal(version, '5.5.1');
  assert.equal(workspace.nodes.length, 3);
  assert.equal(workspace.edges.length, 3);
  const father = workspace.nodes[0]!;
  assert.equal(father.label, 'János Varga');
  assert.equal(father.familyName, 'Varga');
  assert.equal(father.birthDate, 'ABT 1620');
  assert.equal(father.birthPlace, 'Sárospatak');
  assert.equal(father.notes, 'Árvíztűrőtükörfúrógép\nMásodik sor');
  assert.match(father.source, /Anyakönyv, fol\. 12r/);
  assert.equal(
    workspace.edges
      .filter((e) => e.kind === 'parent')
      .every((e) => e.pedigree === 'birth'),
    true,
  );
  assert.equal(
    workspace.edges.find((e) => e.kind === 'partner')?.startDate,
    'BEF 1650',
  );
  assert.equal(workspace.imports[0]?.originalText, example);
  assert.ok(isGraphWorkspace(workspace));
});
test('GEDCOM 7 accepts same-sex partners without inventing sex from HUSB and WIFE roles', () => {
  const raw = wrap(
    `${person('A', 'A /One/')}\n1 SEX F\n${person('B', 'B /Two/')}\n1 SEX F\n${person('C')}\n0 @F@ FAM\n1 HUSB @A@\n1 WIFE @B@\n1 CHIL @C@`,
    '7.0.18',
  );
  const { workspace } = parseGedcom(raw);
  assert.deepEqual(
    workspace.nodes.slice(0, 2).map((n) => n.sex),
    ['F', 'F'],
  );
  assert.equal(
    workspace.edges
      .filter((e) => e.kind === 'parent')
      .every((e) => e.pedigree === 'unspecified'),
    true,
  );
});
test('single-parent families and remarriages never infer an unknown spouse or unrelated children', () => {
  const { workspace, warnings } = parseGedcom(
    wrap(
      `${person('A')}\n${person('B')}\n${person('C')}\n${person('D')}\n0 @F1@ FAM\n1 HUSB @A@\n1 CHIL @C@\n0 @F2@ FAM\n1 HUSB @A@\n1 WIFE @B@\n1 CHIL @D@\n1 CHIL @MISSING@`,
    ),
  );
  assert.equal(workspace.nodes.length, 4);
  assert.equal(
    workspace.edges.some((e) => e.from === '@B@' && e.to === '@C@'),
    false,
  );
  assert.equal(warnings.missingReference, 1);
  assert.equal(workspace.edges.filter((e) => e.kind === 'parent').length, 3);
});
test('adoptive, foster, challenged and disproven pedigree assertions stay distinct', () => {
  const { workspace, warnings } = parseGedcom(
    wrap(
      `${person('A')}\n${person('B')}\n1 FAMC @FA@\n2 PEDI adopted\n${person('C')}\n1 FAMC @FF@\n2 PEDI foster\n2 STAT challenged\n${person('D')}\n1 FAMC @FX@\n2 STAT disproven\n0 @FA@ FAM\n1 HUSB @A@\n1 CHIL @B@\n0 @FF@ FAM\n1 HUSB @A@\n1 CHIL @C@\n0 @FX@ FAM\n1 HUSB @A@\n1 CHIL @D@`,
    ),
  );
  assert.equal(
    workspace.edges.find((e) => e.to === '@B@')?.pedigree,
    'adopted',
  );
  assert.equal(workspace.edges.find((e) => e.to === '@C@')?.pedigree, 'foster');
  assert.equal(
    workspace.edges.find((e) => e.to === '@C@')?.certainty,
    'uncertain',
  );
  assert.equal(
    workspace.edges.some((e) => e.to === '@D@'),
    false,
  );
  assert.equal(warnings.disproven, 1);
});
test('adoption event can name only one adoptive parent', () => {
  const { workspace } = parseGedcom(
    wrap(
      `${person('A')}\n${person('B')}\n${person('C')}\n1 ADOP\n2 FAMC @F@\n3 ADOP HUSB\n0 @F@ FAM\n1 HUSB @A@\n1 WIFE @B@\n1 CHIL @C@`,
    ),
  );
  assert.equal(
    workspace.edges.find((e) => e.kind === 'parent' && e.from === '@A@')
      ?.pedigree,
    'adopted',
  );
  assert.equal(
    workspace.edges.find((e) => e.kind === 'parent' && e.from === '@B@')
      ?.pedigree,
    'unspecified',
  );
});
test('individual family pointers recover incomplete reciprocal family links', () => {
  const { workspace } = parseGedcom(
    wrap(`${person('A')}\n1 FAMS @F@\n${person('C')}\n1 FAMC @F@\n0 @F@ FAM`),
  );
  assert.equal(workspace.edges.length, 1);
  assert.equal(workspace.edges[0]?.from, '@A@');
  assert.equal(workspace.edges[0]?.to, '@C@');
});
test('GEDCOM associations and unrecognized material remain available without external media fetches', () => {
  const raw = wrap(
    `${person('A')}\n1 ASSO @B@\n2 RELA patron\n1 OBJE @M@\n${person('B')}\n0 @M@ OBJE\n1 FILE https://example.test/photo.jpg\n0 @X@ _CUSTOM\n1 VALUE special`,
  );
  const { workspace, warnings } = parseGedcom(raw);
  assert.equal(workspace.edges[0]?.label, 'patron');
  assert.equal(workspace.edges[0]?.kind, 'other');
  assert.equal(warnings.media, 1);
  assert.equal(warnings.extensions, 1);
  assert.equal(workspace.imports[0]?.originalText, raw);
});
test('invalid GEDCOM is rejected before replacing an existing workspace', () => {
  assert.throws(
    () => parseGedcom(wrap(`${person('A')}\n${person('A')}`)),
    code('duplicate'),
  );
  assert.throws(
    () => parseGedcom(wrap('0 @A@ INDI\n3 NAME bad')),
    code('gedcom'),
  );
  assert.throws(() => parseGedcom('0 HEAD\n0 @A@ INDI'), code('gedcom'));
  assert.throws(() => parseGedcom(wrap(person('A'), '4.0')), code('version'));
  assert.throws(
    () =>
      parseGedcom(
        wrap(
          `${person('A')}\n${person('B')}\n0 @F1@ FAM\n1 HUSB @A@\n1 CHIL @B@\n0 @F2@ FAM\n1 HUSB @B@\n1 CHIL @A@`,
        ),
      ),
    code('cycle'),
  );
});
test('Unicode encodings and explicit Windows-1250 preserve Hungarian names; ANSEL is not guessed', () => {
  const utf8 = new TextEncoder().encode(example);
  assert.equal(decodeGedcom(utf8), example);
  const unicode = new Uint8Array(
    Buffer.concat([Buffer.from([255, 254]), Buffer.from(example, 'utf16le')]),
  );
  assert.equal(decodeGedcom(unicode), example);
  assert.equal(
    decodeGedcom(
      new Uint8Array([0xc1, 0x72, 0x76, 0xed, 0x7a]),
      'windows-1250',
    ),
    'Árvíz',
  );
  assert.throws(
    () => decodeGedcom(new TextEncoder().encode('0 HEAD\n1 CHAR ANSEL')),
    code('encoding'),
  );
  assert.throws(
    () => decodeGedcom(new Uint8Array([0xff, 0xff, 0xff])),
    code('encoding'),
  );
});
test('JSON restoration validates identities, references, positions and ancestry', () => {
  const graph = graphWithPeople();
  assert.ok(isGraphWorkspace(graph));
  assert.deepEqual(parseGraphJson(JSON.stringify(graph)), graph);
  assert.equal(
    isGraphWorkspace({ ...graph, nodes: [...graph.nodes, graph.nodes[0]] }),
    false,
  );
  assert.equal(
    isGraphWorkspace({ ...graph, edges: [newGraphEdge('e', 'a', 'missing')] }),
    false,
  );
  assert.equal(
    isGraphWorkspace({
      ...graph,
      nodes: [{ ...graph.nodes[0], treePosition: { x: Infinity, y: 0 } }],
    }),
    false,
  );
  assert.equal(isGraphWorkspace({ ...graph, schema: 'unknown' }), false);
  const org = { ...newGraphNode('org', 'organization'), label: 'Institution' };
  assert.equal(
    isGraphWorkspace({
      ...graph,
      nodes: [...graph.nodes, org],
      edges: [newGraphEdge('e', 'org', 'a')],
    }),
    false,
  );
});
test('relation editing rejects self-links, duplicate partners and parent cycles while allowing pedigree collapse', () => {
  let graph = putEdge(graphWithPeople(), newGraphEdge('e1', 'a', 'b'));
  graph = putEdge(graph, newGraphEdge('e2', 'a', 'c'));
  graph = putEdge(graph, newGraphEdge('e3', 'b', 'd'));
  graph = putEdge(graph, newGraphEdge('e4', 'c', 'd'));
  assert.equal(hasParentCycle(graph.nodes, graph.edges), false);
  assert.throws(
    () => putEdge(graph, newGraphEdge('cycle', 'd', 'a')),
    code('cycle'),
  );
  assert.throws(
    () => putEdge(graph, newGraphEdge('self', 'a', 'a')),
    code('self'),
  );
  graph = putEdge(graph, newGraphEdge('partner', 'b', 'c', 'partner'));
  assert.throws(
    () => putEdge(graph, newGraphEdge('reverse', 'c', 'b', 'partner')),
    code('duplicate'),
  );
  assert.ok(
    isGraphWorkspace(
      putEdge(graph, { ...graph.edges[0]!, source: 'Updated citation' }),
    ),
  );
});
test('merging files with reused program-local IDs never silently conflates people or families', () => {
  const incoming = parseGedcom(example).workspace;
  let seq = 0;
  const merged = mergeGraphs(incoming, incoming, () => `new-${++seq}`);
  assert.equal(merged.nodes.length, 6);
  assert.equal(merged.edges.length, 6);
  assert.equal(merged.imports.length, 2);
  assert.ok(isGraphWorkspace(merged));
  assert.equal(
    new Set(merged.edges.filter((e) => e.familyId).map((e) => e.familyId)).size,
    2,
  );
});
test('deleting an entity cascades only its incident relationships', () => {
  let graph = putEdge(graphWithPeople(), newGraphEdge('one', 'a', 'b'));
  graph = putEdge(graph, newGraphEdge('two', 'c', 'd'));
  const next = removeNode(graph, 'a');
  assert.equal(next.nodes.length, 3);
  assert.deepEqual(
    next.edges.map((e) => e.id),
    ['two'],
  );
  assert.ok(isGraphWorkspace(next));
});
test('large pedigree validation is iterative rather than recursive', () => {
  const nodes = Array.from({ length: 10000 }, (_, i) => newGraphNode(`p${i}`));
  const edges = nodes
    .slice(1)
    .map((n, i) => newGraphEdge(`e${i}`, nodes[i]!.id, n.id));
  assert.equal(hasParentCycle(nodes, edges), false);
  assert.equal(
    hasParentCycle(nodes, [...edges, newGraphEdge('last', 'p9999', 'p0')]),
    true,
  );
});
test('layout bounds work for disconnected roots and focus includes a late record without dropping stored data', () => {
  const graph = {
    ...createGraphWorkspace(),
    nodes: Array.from({ length: 250 }, (_, i) => ({
      ...newGraphNode(`p${i}`),
      label: `Person ${i}`,
    })),
  };
  const layout = graphLayout(graph, 'tree');
  assert.equal(layout.workspace.nodes.length, MAX_VISIBLE_NODES);
  assert.equal(layout.truncated, true);
  assert.equal(graph.nodes.length, 250);
  const focused = graphLayout(graph, 'network', 'p249', 2);
  assert.equal(focused.workspace.nodes[0]?.id, 'p249');
  assert.equal(focused.workspace.nodes.length, 1);
  assert.ok(focused.width > 0 && focused.height > 0);
});
test('SVG is self-contained escaped artwork with visible relationship arrowheads', () => {
  let graph = graphWithPeople();
  graph.nodes[0]!.label = '<script>&"Ő';
  graph = putEdge(graph, {
    ...newGraphEdge('link', 'a', 'b'),
    label: '<img onerror=evil>',
  });
  const layout = graphLayout(graph, 'tree');
  const svg = graphSvg(layout, relationLabels(graphCopy('hu')), '<Title>');
  assert.doesNotMatch(svg, /<script>|<img onerror/i);
  assert.match(svg, /&lt;script&gt;&amp;&quot;Ő/);
  assert.match(svg, /marker-end/);
  const p = connectionPoints({ x: 0, y: 0 }, { x: 0, y: 145 });
  assert.equal(p.y1, NODE_HEIGHT);
  assert.equal(p.y2, 145);
});
test('CSV export quotes records and neutralizes spreadsheet formula prefixes', () => {
  const graph = graphWithPeople();
  graph.nodes[0]!.label = '=1+1';
  graph.edges = [
    {
      ...newGraphEdge('e', 'a', 'b', 'correspondence'),
      source: 'Archive "A", 12r',
    },
  ];
  const csv = relationshipCsv(graph);
  assert.match(csv, /"'=1\+1"/);
  assert.match(csv, /"Archive ""A"", 12r"/);
  assert.match(csv, /from_id/);
});
test('both module views share ordered saves, isolated keys, undo and reloadable data', async () => {
  const values = new Map<string, unknown>();
  const store = createGraphStore({
    read: async (key) => values.get(key),
    write: async (key, value) => {
      values.set(key, structuredClone(value));
    },
  });
  await store.load('user-a');
  await store.load('user-b');
  let first = 0,
    second = 0;
  const stop = store.subscribe('user-a', () => first++);
  store.subscribe('user-a', () => second++);
  store.update('user-a', graphWithPeople());
  store.update('user-a', (graph) => removeNode(graph, 'a'));
  await store.flush('user-a');
  assert.equal(store.snapshot('user-a').workspace.nodes.length, 3);
  assert.ok(first > 0 && second > 0);
  assert.equal(store.snapshot('user-b').workspace.nodes.length, 0);
  store.undo('user-a');
  await store.flush('user-a');
  assert.equal(store.snapshot('user-a').workspace.nodes.length, 4);
  stop();
  const reopened = createGraphStore({
    read: async (key) => values.get(key),
    write: async () => {},
  });
  await reopened.load('user-a');
  assert.equal(reopened.snapshot('user-a').workspace.nodes.length, 4);
});
test('failed persistence keeps edits and reports failure instead of claiming they were saved', async () => {
  const store = createGraphStore({
    read: async () => undefined,
    write: async () => {
      throw new Error('quota');
    },
  });
  await store.load('key');
  store.update('key', graphWithPeople());
  await store.flush('key');
  assert.equal(store.snapshot('key').status, 'error');
  assert.equal(store.snapshot('key').workspace.nodes.length, 4);
});
test('loading cannot overwrite an edit because updates remain blocked until initial read completes', async () => {
  let resolve: (value: unknown) => void = () => undefined;
  let writes = 0;
  const store = createGraphStore({
    read: () =>
      new Promise((r) => {
        resolve = r;
      }),
    write: async () => {
      writes++;
    },
  });
  const loading = store.load('key');
  store.update('key', graphWithPeople());
  assert.equal(writes, 0);
  resolve(graphWithPeople());
  await loading;
  assert.equal(store.snapshot('key').workspace.nodes.length, 4);
});
test('both modules are registered in UI and server with one user/workspace-scoped dataset', () => {
  const manager = readFileSync(
    new URL('../src/modules/ModuleManagerPanel.tsx', import.meta.url),
    'utf8',
  );
  assert.match(manager, /GenealogyNetworkPanel/);
  assert.match(
    manager,
    /getDisciplineWorkspaceStorageKey\(userId, workspaceId, genealogyModule.id\)/,
  );
  const routes = readFileSync(
    new URL('../server/src/routes/studioModuleRoutes.ts', import.meta.url),
    'utf8',
  );
  assert.match(routes, /org\.omi\.genealogy/);
  assert.match(routes, /org\.omi\.relationship-networks/);
  assert.equal(graphCopy('hu').tree, 'Családfa');
  assert.equal(graphCopy('de').network, 'Beziehungsnetz');
  assert.equal(graphCopy('en').network, 'Relationship network');
});

test('historical names wrap across lines rather than losing a surname after 24 characters', () => {
  const label = 'Szentlászlói Kamuthy Farkas';
  assert.equal(graphNameLines(label).join(' '), label);
  const node = { ...newGraphNode('historic'), label };
  const artwork = graphSvg(
    graphLayout({ ...createGraphWorkspace(), nodes: [node] }, 'tree'),
    relationLabels(graphCopy('hu')),
    'Családfa',
  );
  assert.match(artwork, /Kamuthy/);
  assert.match(artwork, /Farkas/);
  assert.doesNotMatch(artwork, /…/);
});

test('partner labels sit above the cards instead of disappearing behind them', () => {
  const a = { x: 100, y: 65 },
    b = { x: 320, y: 80 };
  const label = edgeLabelPoint(a, b);
  assert.ok(label.y < Math.min(a.y, b.y));
});
