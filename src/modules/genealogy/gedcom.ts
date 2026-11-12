import {
  createGraphWorkspace,
  GraphError,
  hasParentCycle,
  isGraphWorkspace,
  MAX_GRAPH_EDGES,
  MAX_GRAPH_NODES,
  MAX_IMPORT_BYTES,
  newGraphEdge,
  newGraphNode,
  type GraphEdge,
  type GraphWorkspace,
  type Pedigree,
} from './model';

interface Line {
  tag: string;
  value: string;
  xref: string;
  children: Line[];
  line: number;
}
export interface GedcomResult {
  workspace: GraphWorkspace;
  version: string;
  warnings: Record<string, number>;
}
/** Preserve dates literally: circa/ranges/calendars must not become invented ISO dates. */
export function decodeGedcom(bytes: Uint8Array, encoding = 'auto'): string {
  if (bytes.byteLength > MAX_IMPORT_BYTES) throw new GraphError('limit');
  let selected = encoding;
  if (selected === 'auto') {
    if (bytes[0] === 255 && bytes[1] === 254) selected = 'utf-16le';
    else if (bytes[0] === 254 && bytes[1] === 255) selected = 'utf-16be';
    else {
      const header = new TextDecoder('windows-1252').decode(
        bytes.subarray(0, 8192),
      );
      const declared = /^1 CHAR (.+)$/im
        .exec(header)?.[1]
        ?.trim()
        .toUpperCase();
      if (declared === 'ANSEL' || declared === 'UNICODE')
        throw new GraphError('encoding');
      selected = 'utf-8';
    }
  }
  try {
    return new TextDecoder(selected, { fatal: true })
      .decode(bytes)
      .replace(/^\uFEFF/, '');
  } catch {
    throw new GraphError('encoding');
  }
}
function parseLines(raw: string): Line[] {
  if (raw.length > MAX_IMPORT_BYTES) throw new GraphError('limit');
  const records: Line[] = [],
    stack: Line[] = [];
  const lines = raw.replace(/^\uFEFF/, '').split(/\r\n|\n|\r/);
  if (lines.length > 250000) throw new GraphError('limit');
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i]!;
    if (!text.trim()) continue;
    const match =
      /^(\d+) (?:(@[^@\s]+@) )?([A-Za-z_][A-Za-z0-9_]*)?(?: (.*))?$/.exec(text);
    if (!match?.[3]) throw new GraphError('gedcom', i + 1);
    const level = Number(match[1]);
    if (level > 64 || level > stack.length || text.length > 100000)
      throw new GraphError('gedcom', i + 1);
    stack.length = level;
    const node: Line = {
      tag: match[3].toUpperCase(),
      value: match[4] ?? '',
      xref: match[2] ?? '',
      children: [],
      line: i + 1,
    };
    if (level === 0) records.push(node);
    else stack[level - 1]!.children.push(node);
    stack.push(node);
  }
  if (
    records[0]?.tag !== 'HEAD' ||
    records.at(-1)?.tag !== 'TRLR' ||
    records.filter((n) => n.tag === 'HEAD').length !== 1 ||
    records.filter((n) => n.tag === 'TRLR').length !== 1
  )
    throw new GraphError('gedcom');
  return records;
}
const all = (line: Line | undefined, tag: string): Line[] =>
  line?.children.filter((n) => n.tag === tag) ?? [];
const first = (line: Line | undefined, tag: string) => all(line, tag)[0];
function content(line: Line | undefined): string {
  return line
    ? line.value.replace(/@@/g, '@') +
        line.children
          .filter((n) => n.tag === 'CONT' || n.tag === 'CONC')
          .map((n) => (n.tag === 'CONT' ? '\n' : '') + content(n))
          .join('')
    : '';
}
function walk(line: Line, tag: string): Line[] {
  const out: Line[] = [];
  const queue = [line];
  for (let i = 0; i < queue.length; i++) {
    const item = queue[i]!;
    if (item.tag === tag) out.push(item);
    for (const child of item.children) queue.push(child);
  }
  return out;
}
const pointer = (s: string) => /^@[^@\s]+@$/.test(s);
export function parseGedcom(
  raw: string,
  fileName = 'family.ged',
): GedcomResult {
  const records = parseLines(raw);
  const version = content(first(first(records[0], 'GEDC'), 'VERS'));
  if (!/^5\.5(?:\.1)?$|^7\.\d+(?:\.\d+)?$/.test(version))
    throw new GraphError('version');
  const warnings: Record<string, number> = {};
  const warn = (code: string) => {
    warnings[code] = (warnings[code] ?? 0) + 1;
  };
  const byId = new Map<string, Line>();
  for (const item of records)
    if (item.xref) {
      if (byId.has(item.xref)) throw new GraphError('duplicate', item.line);
      byId.set(item.xref, item);
    }
  const workspace = createGraphWorkspace();
  workspace.title = fileName.replace(/\.(ged|gedcom)$/i, '');
  const notes = (line: Line): string =>
    [...all(line, 'NOTE'), ...all(line, 'SNOTE')]
      .map((n) => {
        if (!pointer(n.value)) return content(n);
        const shared = byId.get(n.value);
        if (!shared) {
          warn('missingReference');
          return n.value;
        }
        return content(shared);
      })
      .join('\n');
  const citations = (line: Line): string =>
    [
      ...new Set(
        walk(line, 'SOUR').map((n) => {
          const source = byId.get(n.value);
          if (pointer(n.value) && !source) warn('missingReference');
          return [
            source
              ? [
                  content(first(source, 'AUTH')),
                  content(first(source, 'TITL')),
                  content(first(source, 'PUBL')),
                ]
                  .filter(Boolean)
                  .join(' · ') || n.value
              : content(n),
            content(first(n, 'PAGE')),
          ]
            .filter(Boolean)
            .join(', ');
        }),
      ),
    ].join('\n');
  const people = records.filter((n) => n.tag === 'INDI');
  if (people.length > MAX_GRAPH_NODES) throw new GraphError('limit');
  for (const item of people) {
    if (!item.xref) throw new GraphError('gedcom', item.line);
    const node = newGraphNode(item.xref);
    const names = all(item, 'NAME');
    const name = names[0];
    const full = content(name);
    const surname = /\/([^/]*)\//.exec(full);
    node.givenName =
      content(first(name, 'GIVN')) ||
      (surname ? full.slice(0, surname.index).trim() : full);
    node.familyName = content(first(name, 'SURN')) || surname?.[1] || '';
    node.label =
      full.replace(/\//g, '').trim() ||
      [node.givenName, node.familyName].filter(Boolean).join(' ') ||
      item.xref;
    node.alternateNames = names
      .slice(1)
      .map(content)
      .map((s) => s.replace(/\//g, '').trim());
    const sex = content(first(item, 'SEX'));
    node.sex = ['M', 'F', 'X', 'U'].includes(sex)
      ? (sex as typeof node.sex)
      : 'U';
    const birth = first(item, 'BIRT'),
      death = first(item, 'DEAT');
    node.birthDate = content(first(birth, 'DATE'));
    node.birthPlace = content(first(birth, 'PLAC'));
    node.deathDate = content(first(death, 'DATE'));
    node.deathPlace = content(first(death, 'PLAC'));
    node.notes = notes(item);
    node.source = citations(item);
    node.externalId = item.xref;
    workspace.nodes.push(node);
  }
  if (!workspace.nodes.length) throw new GraphError('gedcom');
  const nodeIds = new Set(workspace.nodes.map((n) => n.id));
  const familyIds = new Set(
    records.filter((n) => n.tag === 'FAM').map((n) => n.xref),
  );
  const childRefs = new Map<string, Map<string, Line>>(),
    partnerRefs = new Map<string, Set<string>>();
  for (const person of people) {
    for (const ref of all(person, 'FAMC')) {
      if (!familyIds.has(ref.value)) {
        warn('missingReference');
        continue;
      }
      const map = childRefs.get(ref.value) ?? new Map();
      map.set(person.xref, ref);
      childRefs.set(ref.value, map);
    }
    for (const ref of all(person, 'FAMS')) {
      if (!familyIds.has(ref.value)) {
        warn('missingReference');
        continue;
      }
      const set = partnerRefs.get(ref.value) ?? new Set();
      set.add(person.xref);
      partnerRefs.set(ref.value, set);
    }
  }
  let edgeId = 0;
  const add = (edge: GraphEdge) => {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      warn('missingReference');
      return;
    }
    if (edge.from === edge.to) {
      warn('invalidRelation');
      return;
    }
    if (workspace.edges.length >= MAX_GRAPH_EDGES)
      throw new GraphError('limit');
    workspace.edges.push(edge);
  };
  const pedigree = (raw: string): Pedigree =>
    (
      ({ BIRTH: 'birth', ADOPTED: 'adopted', FOSTER: 'foster' }) as Record<
        string,
        Pedigree
      >
    )[raw.toUpperCase()] ?? (raw ? 'other' : 'unspecified');
  for (const family of records.filter((n) => n.tag === 'FAM')) {
    if (!family.xref) throw new GraphError('gedcom', family.line);
    const partnerCandidates = [
      ...new Set(
        [...all(family, 'HUSB'), ...all(family, 'WIFE')]
          .map((n) => n.value)
          .concat([...(partnerRefs.get(family.xref) ?? [])]),
      ),
    ];
    const childCandidates = [
      ...new Set(
        all(family, 'CHIL')
          .map((n) => n.value)
          .concat([...(childRefs.get(family.xref)?.keys() ?? [])]),
      ),
    ];
    const partners = partnerCandidates.filter((id) => {
      if (nodeIds.has(id)) return true;
      warn('missingReference');
      return false;
    });
    const children = childCandidates.filter((id) => {
      if (nodeIds.has(id)) return true;
      warn('missingReference');
      return false;
    });
    if (partners.length > 2) warn('multiplePartners');
    for (let a = 0; a < partners.length; a++)
      for (let b = a + 1; b < partners.length; b++) {
        const e = newGraphEdge(
          `ged-edge-${++edgeId}`,
          partners[a]!,
          partners[b]!,
          'partner',
        );
        e.familyId = family.xref;
        e.source = citations(family);
        e.notes = notes(family);
        const marriage = first(family, 'MARR');
        e.startDate = content(first(marriage, 'DATE'));
        e.place = content(first(marriage, 'PLAC'));
        e.endDate = content(first(first(family, 'DIV'), 'DATE'));
        add(e);
      }
    for (const childId of children) {
      const reference = childRefs.get(family.xref)?.get(childId);
      const status = content(first(reference, 'STAT')).toUpperCase();
      if (status === 'DISPROVEN') {
        warn('disproven');
        continue;
      }
      const kind = pedigree(content(first(reference, 'PEDI')));
      const childRecord = byId.get(childId);
      for (const parent of partners) {
        const e = newGraphEdge(
          `ged-edge-${++edgeId}`,
          parent,
          childId,
          'parent',
        );
        e.familyId = family.xref;
        e.pedigree = kind;
        e.certainty = status === 'CHALLENGED' ? 'uncertain' : 'documented';
        e.source = citations(family);
        e.notes = [notes(family), reference ? notes(reference) : '']
          .filter(Boolean)
          .join('\n');
        // Adoption events may identify only one of the family's two partners.
        for (const adoption of all(childRecord, 'ADOP')) {
          const ref = first(adoption, 'FAMC');
          if (ref?.value !== family.xref) continue;
          const role = content(first(ref, 'ADOP')).toUpperCase();
          if (
            !role ||
            role === 'BOTH' ||
            all(family, role).some((n) => n.value === parent)
          ) {
            e.pedigree = 'adopted';
            e.source = [e.source, citations(adoption)]
              .filter(Boolean)
              .join('\n');
          }
        }
        add(e);
      }
    }
  }
  for (const person of people)
    for (const ref of all(person, 'ASSO')) {
      const e = newGraphEdge(
        `ged-edge-${++edgeId}`,
        person.xref,
        ref.value,
        'other',
      );
      e.label =
        content(first(ref, 'RELA')) ||
        content(first(first(ref, 'ROLE'), 'PHRASE')) ||
        content(first(ref, 'ROLE'));
      e.source = citations(ref);
      e.notes = notes(ref);
      add(e);
    }
  if (hasParentCycle(workspace.nodes, workspace.edges))
    throw new GraphError('cycle');
  // Original, unmodified data travels in JSON backups; unsupported events,
  // media, repositories and program extensions are not silently claimed as edited.
  workspace.imports.push({
    id: 'gedcom-source',
    fileName,
    format: `GEDCOM ${version}`,
    originalText: raw,
  });
  if (
    records.some((n) => n.tag === 'OBJE') ||
    records.some((n) => walk(n, 'OBJE').length)
  )
    warn('media');
  const understood = new Set([
    'HEAD',
    'TRLR',
    'INDI',
    'FAM',
    'SOUR',
    'NOTE',
    'SNOTE',
    'REPO',
    'SUBM',
    'OBJE',
  ]);
  for (const item of records) if (!understood.has(item.tag)) warn('extensions');
  warnings.archive = 1;
  if (!isGraphWorkspace(workspace)) throw new GraphError('limit');
  return { workspace, version, warnings };
}
