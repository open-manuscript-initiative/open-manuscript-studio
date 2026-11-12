import type { GraphMode, GraphWorkspace, Point, RelationKind } from './model';
export const MAX_VISIBLE_NODES = 200;
export const NODE_WIDTH = 180,
  NODE_HEIGHT = 92;
export function graphNameLines(value: string): string[] {
  const lines: string[] = [];
  for (const word of value.split(/\s+/u).filter(Boolean)) {
    const chunks = word.match(/.{1,26}/gu) ?? [];
    for (const chunk of chunks) {
      const last = lines.at(-1);
      if (last !== undefined && [...last, ...chunk].length + 1 <= 26)
        lines[lines.length - 1] = last + ' ' + chunk;
      else lines.push(chunk);
    }
  }
  const visible = lines.slice(0, 3);
  if (lines.length > 3) visible[2] = visible[2]!.slice(0, 25) + '…';
  return visible;
}
export interface GraphLayout {
  workspace: GraphWorkspace;
  points: Map<string, Point>;
  width: number;
  height: number;
  x: number;
  y: number;
  truncated: boolean;
}
export function graphLayout(
  workspace: GraphWorkspace,
  mode: GraphMode,
  focus = '',
  depth = 3,
): GraphLayout {
  const eligible = workspace.nodes.filter(
    (n) => mode === 'network' || n.kind === 'person',
  );
  const eligibleIds = new Set(eligible.map((n) => n.id));
  const edges = workspace.edges.filter(
    (e) =>
      eligibleIds.has(e.from) &&
      eligibleIds.has(e.to) &&
      (mode === 'network' || e.kind === 'parent' || e.kind === 'partner'),
  );
  const included = new Set<string>();
  if (focus && eligibleIds.has(focus)) {
    const adjacency = new Map<string, string[]>();
    for (const edge of edges) {
      const from = adjacency.get(edge.from) ?? [];
      from.push(edge.to);
      adjacency.set(edge.from, from);
      const to = adjacency.get(edge.to) ?? [];
      to.push(edge.from);
      adjacency.set(edge.to, to);
    }
    const queue: [string, number][] = [[focus, 0]];
    included.add(focus);
    for (let i = 0; i < queue.length; i++) {
      const [id, d] = queue[i]!;
      if (d >= depth) continue;
      for (const next of adjacency.get(id) ?? [])
        if (!included.has(next)) {
          included.add(next);
          queue.push([next, d + 1]);
        }
    }
  } else for (const node of eligible) included.add(node.id);
  const candidates = eligible.filter((n) => included.has(n.id));
  // The focal record is never lost merely because its source file order is late.
  if (focus)
    candidates.sort((a, b) => Number(b.id === focus) - Number(a.id === focus));
  const nodes = candidates.slice(0, MAX_VISIBLE_NODES),
    ids = new Set(nodes.map((n) => n.id));
  const visibleEdges = edges.filter((e) => ids.has(e.from) && ids.has(e.to));
  const points = new Map<string, Point>();
  if (mode === 'network') {
    const radius = Math.max(125, nodes.length * 21);
    nodes.forEach((node, index) => {
      const angle =
        (2 * Math.PI * index) / Math.max(1, nodes.length) - Math.PI / 2;
      points.set(
        node.id,
        node.networkPosition ?? {
          x: radius + 140 + radius * Math.cos(angle),
          y: radius + 80 + radius * Math.sin(angle),
        },
      );
    });
  } else {
    const degree = new Map(nodes.map((n) => [n.id, 0])),
      children = new Map<string, string[]>(),
      generation = new Map(nodes.map((n) => [n.id, 0]));
    for (const e of visibleEdges)
      if (e.kind === 'parent') {
        degree.set(e.to, degree.get(e.to)! + 1);
        const next = children.get(e.from) ?? [];
        next.push(e.to);
        children.set(e.from, next);
      }
    const queue = [...degree].filter(([, d]) => !d).map(([id]) => id);
    for (let i = 0; i < queue.length; i++)
      for (const id of children.get(queue[i]!) ?? []) {
        generation.set(
          id,
          Math.max(generation.get(id)!, generation.get(queue[i]!)! + 1),
        );
        const d = degree.get(id)! - 1;
        degree.set(id, d);
        if (!d) queue.push(id);
      }
    const rows = new Map<number, string[]>();
    for (const node of nodes) {
      const row = generation.get(node.id) ?? 0;
      const next = rows.get(row) ?? [];
      next.push(node.id);
      rows.set(row, next);
    }
    const maxRow = Math.max(1, ...[...rows.values()].map((row) => row.length));
    for (const [level, row] of rows)
      row.forEach((id, index) =>
        points.set(
          id,
          nodes.find((n) => n.id === id)!.treePosition ?? {
            x: 80 + (maxRow - row.length) * 110 + index * 220,
            y: 65 + level * 145,
          },
        ),
      );
  }
  const positions = [...points.values()];
  const x =
    Math.min(...positions.map((p) => p.x), positions.length ? Infinity : 0) -
    35;
  const y =
    Math.min(...positions.map((p) => p.y), positions.length ? Infinity : 0) -
    35;
  const width = Math.max(
    250,
    ...positions.map((p) => p.x + NODE_WIDTH + 35 - x),
  );
  const height = Math.max(
    180,
    ...positions.map((p) => p.y + NODE_HEIGHT + 35 - y),
  );
  return {
    workspace: { ...workspace, nodes, edges: visibleEdges },
    points,
    width,
    height,
    x,
    y,
    truncated: candidates.length > MAX_VISIBLE_NODES,
  };
}
export function connectionPoints(a: Point, b: Point) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const scale = Math.min(
    dx ? NODE_WIDTH / 2 / Math.abs(dx) : Infinity,
    dy ? NODE_HEIGHT / 2 / Math.abs(dy) : Infinity,
    0.49,
  );
  return {
    x1: a.x + NODE_WIDTH / 2 + dx * scale,
    y1: a.y + NODE_HEIGHT / 2 + dy * scale,
    x2: b.x + NODE_WIDTH / 2 - dx * scale,
    y2: b.y + NODE_HEIGHT / 2 - dy * scale,
  };
}
export function edgeLabelPoint(a: Point, b: Point): Point {
  const p = connectionPoints(a, b);
  return {
    x: (p.x1 + p.x2) / 2,
    y:
      Math.abs(a.y - b.y) < NODE_HEIGHT
        ? Math.min(a.y, b.y) - 10
        : (p.y1 + p.y2) / 2 - 6,
  };
}
export const graphColors: Record<string, string> = {
  person: '#eef5ff',
  organization: '#edf8ef',
  place: '#fff4dc',
  event: '#f5edff',
};
export function graphSvg(
  layout: GraphLayout,
  relationLabels: Record<RelationKind, string>,
  title: string,
): string {
  const esc = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  const edges = layout.workspace.edges
    .map((e) => {
      const a = layout.points.get(e.from)!,
        b = layout.points.get(e.to)!;
      const { x1, y1, x2, y2 } = connectionPoints(a, b);
      const label = edgeLabelPoint(a, b);
      return `<g><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${e.kind === 'parent' ? '#516d96' : '#86909e'}" stroke-width="2" ${e.directed ? 'marker-end="url(#arrow)"' : ''} ${e.certainty !== 'documented' ? 'stroke-dasharray="6 4"' : ''}/><text x="${label.x}" y="${label.y}" text-anchor="middle" fill="#344054" font-size="11">${esc(e.label || relationLabels[e.kind])}</text></g>`;
    })
    .join('');
  const nodes = layout.workspace.nodes
    .map((n) => {
      const p = layout.points.get(n.id)!;
      const dates = [n.birthDate, n.deathDate].filter(Boolean).join(' – ');
      return `<g transform="translate(${p.x} ${p.y})"><title>${esc(n.label)}</title><rect width="${NODE_WIDTH}" height="${NODE_HEIGHT}" rx="9" fill="${graphColors[n.kind]}" stroke="#7a8fa8"/><text x="12" y="22" fill="#172b45" font-size="12" font-family="sans-serif">${graphNameLines(
        n.label,
      )
        .map(
          (line, index) =>
            `<tspan x="12" dy="${index ? 17 : 0}">${esc(line)}</tspan>`,
        )
        .join(
          '',
        )}</text><text x="12" y="80" fill="#475467" font-size="10" font-family="sans-serif">${esc(dates.length > 28 ? dates.slice(0, 27) + '…' : dates)}</text></g>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="${layout.x} ${layout.y} ${layout.width} ${layout.height}" role="img"><title>${esc(title)}</title><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10" fill="#667085"/></marker></defs><rect x="${layout.x}" y="${layout.y}" width="${layout.width}" height="${layout.height}" fill="white"/>${edges}${nodes}</svg>`;
}
