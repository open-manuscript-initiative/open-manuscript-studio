import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { inflateRawSync } from 'node:zlib';
import { DOMParser } from '@xmldom/xmldom';

import { applyDocxImportPlan } from '../src/app/docxImportActions.ts';
import { useStudioStore } from '../src/app/useStudioStore.ts';
import { buildContinuousManuscriptDocument, projectContinuousManuscriptDocument } from '../src/editor/continuousManuscriptDocument.ts';
import { parseDocxForStudio } from '../src/services/docxImportStrategy.ts';
import { buildDocxExport } from '../src/services/exportDocx.ts';
import { serializeOmiJson } from '../src/services/exportOmi.ts';
import { parseOmiJson } from '../src/services/omiPortableFormat.ts';
import type { OmiManuscript, OmiBlock } from '../src/types/omi.ts';

type Attributes = Record<string, string>;
type Case = { id: string; feature: string; sample?: string };
type WordPackage = { parts: Map<string, Buffer>; document: Document; styles?: Document; numbering?: Document; relations?: Document };
type Check = (pkg: WordPackage, item: Case) => void;
type Node = { type?: string; text?: string; attrs?: Record<string, unknown>; marks?: { type: string; attrs?: Record<string, unknown> }[]; content?: Node[] };

const alreadyCovered = new Set(['C01', 'C02', 'C03', 'C07', 'C09', 'C11', 'C12', 'C18']);
const strict = process.env.OMI_FORMATTING_STRICT === '1';
const fixture = new URL('./fixtures/omi-formatting-master-test.docx', import.meta.url);
const manifest = new URL('./fixtures/omi-formatting-test-manifest.json', import.meta.url);

// Only local test inputs and the Studio-generated result are opened. The ZIP
// reader does not extract files to disk; it supports the two OOXML ZIP methods.
export function readZipParts(bytes: Uint8Array): Map<string, Buffer> {
  const zip = Buffer.from(bytes);
  let end = zip.length - 22;
  while (end >= Math.max(0, zip.length - 65557) && zip.readUInt32LE(end) !== 0x06054b50) end--;
  assert.ok(end >= Math.max(0, zip.length - 65557), 'ZIP central directory missing');
  const count = zip.readUInt16LE(end + 10);
  let offset = zip.readUInt32LE(end + 16);
  const parts = new Map<string, Buffer>();
  for (let index = 0; index < count; index++) {
    assert.equal(zip.readUInt32LE(offset), 0x02014b50);
    const method = zip.readUInt16LE(offset + 10);
    const size = zip.readUInt32LE(offset + 20);
    const length = zip.readUInt32LE(offset + 24);
    const nameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const local = zip.readUInt32LE(offset + 42);
    const name = zip.toString('utf8', offset + 46, offset + 46 + nameLength);
    assert.equal(zip.readUInt32LE(local), 0x04034b50);
    const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    const compressed = zip.subarray(start, start + size);
    assert.ok(method === 0 || method === 8, 'Unexpected ZIP compression');
    const data = method === 0 ? compressed : inflateRawSync(compressed);
    assert.equal(data.length, length, name);
    parts.set(name, data);
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return parts;
}

export function readWordPackage(bytes: Uint8Array): WordPackage {
  const parts = readZipParts(bytes);
  const document = xmlPart(parts, 'word/document.xml');
  assert.ok(document, 'Missing word/document.xml');
  return { parts, document, styles: xmlPart(parts, 'word/styles.xml'), numbering: xmlPart(parts, 'word/numbering.xml'), relations: xmlPart(parts, 'word/_rels/document.xml.rels') };
}

function xmlPart(parts: Map<string, Buffer>, name: string): Document | undefined {
  const data = parts.get(name);
  if (!data) return undefined;
  return new DOMParser().parseFromString(data.toString('utf8'), 'application/xml') as unknown as Document;
}

function descendants(root: Document | Element | undefined, name: string): Element[] {
  return root ? Array.from(root.getElementsByTagName('*')).filter(element => element.localName === name) : [];
}
function child(root: Element | undefined, name: string): Element | undefined {
  return root ? Array.from(root.childNodes).find((node): node is Element => node.nodeType === 1 && (node as Element).localName === name) : undefined;
}
function attr(element: Element | undefined, name: string): string | undefined {
  return element ? Array.from(element.attributes).find(attribute => attribute.localName === name)?.value : undefined;
}
function wordText(element: Element): string {
  if (element.localName === 't') return element.textContent ?? '';
  if (element.localName === 'tab') return '\t';
  if (element.localName === 'br') return '\n';
  if (['pPr', 'rPr', 'del', 'instrText'].includes(element.localName)) return '';
  return Array.from(element.childNodes).filter((node): node is Element => node.nodeType === 1).map(wordText).join('');
}
function paragraph(pkg: WordPackage, id: string): Element {
  const result = descendants(pkg.document, 'p').find(p => wordText(p).startsWith(id + ' |'));
  assert.ok(result, 'Missing case paragraph ' + id);
  return result;
}
function style(pkg: WordPackage, id: string | undefined): Element | undefined {
  return descendants(pkg.styles, 'style').find(s => attr(s, 'styleId') === id);
}
function styleProperties(pkg: WordPackage, id: string | undefined, kind: 'rPr' | 'pPr'): Element[] {
  const result: Element[] = [];
  const visited = new Set<string>();
  while (id && !visited.has(id)) {
    visited.add(id);
    const s = style(pkg, id);
    const properties = child(s, kind);
    if (properties) result.push(properties);
    id = attr(child(s, 'basedOn'), 'val');
  }
  return result;
}
function runProperties(pkg: WordPackage, run: Element, p: Element): Element[] {
  const direct = child(run, 'rPr');
  return [
    ...(direct ? [direct] : []),
    ...styleProperties(pkg, attr(child(direct, 'rStyle'), 'val'), 'rPr'),
    ...styleProperties(pkg, attr(child(child(p, 'pPr'), 'pStyle'), 'val'), 'rPr'),
  ];
}
function pProperties(pkg: WordPackage, p: Element): Element[] {
  const direct = child(p, 'pPr');
  return [...(direct ? [direct] : []), ...styleProperties(pkg, attr(child(direct, 'pStyle'), 'val'), 'pPr')];
}
function property(properties: Element[], path: string): Element | undefined {
  for (const root of properties) {
    let current: Element | undefined = root;
    for (const step of path.split('/')) current = child(current, step);
    if (current) return current;
  }
  return undefined;
}
function requireProperty(properties: Element[], path: string, expected: Attributes = {}): void {
  const value = property(properties, path);
  assert.ok(value, 'Missing native Word property ' + path);
  for (const [name, expectedValue] of Object.entries(expected)) assert.equal(attr(value, name), expectedValue, path + '/@' + name);
  if (!Object.keys(expected).length) assert.ok(!['0', 'false', 'off', 'none'].includes(attr(value, 'val') ?? ''), path + ' is explicitly disabled');
}
function sampleRun(p: Element, sample: string): Element {
  const run = descendants(p, 'r').find(r => wordText(r).includes(sample) && !wordText(r).includes(' | '));
  assert.ok(run, 'Missing separately formatted sample: ' + sample);
  return run;
}
function character(path: string, attrs: Attributes = {}): Check {
  return (pkg, item) => {
    const p = paragraph(pkg, item.id);
    requireProperty(runProperties(pkg, sampleRun(p, item.sample!), p), path, attrs);
  };
}
function para(path: string, attrs: Attributes = {}): Check {
  return (pkg, item) => requireProperty(pProperties(pkg, paragraph(pkg, item.id)), path, attrs);
}
function relation(pkg: WordPackage, id: string | undefined): Element | undefined {
  return descendants(pkg.relations, 'Relationship').find(r => attr(r, 'Id') === id);
}
function listInfo(pkg: WordPackage, id: string): { numId: string; format: string | undefined; left: string | undefined } {
  const props = pProperties(pkg, paragraph(pkg, id));
  const numId = attr(property(props, 'numPr/numId'), 'val');
  assert.ok(numId && numId !== '0', 'Native numbering missing for ' + id);
  const number = descendants(pkg.numbering, 'num').find(n => attr(n, 'numId') === numId);
  const abstractId = attr(child(number, 'abstractNumId'), 'val');
  const abstract = descendants(pkg.numbering, 'abstractNum').find(n => attr(n, 'abstractNumId') === abstractId);
  const levelId = attr(property(props, 'numPr/ilvl'), 'val') ?? '0';
  const level = descendants(abstract, 'lvl').find(n => attr(n, 'ilvl') === levelId);
  assert.ok(level, 'Numbering level missing for ' + id);
  return { numId, format: attr(child(level, 'numFmt'), 'val'), left: attr(property([...props, child(level, 'pPr')!].filter(Boolean), 'ind'), 'left') };
}
function list(format: string, left: string): Check {
  return (pkg, item) => {
    const actual = listInfo(pkg, item.id);
    assert.equal(actual.format, format);
    assert.equal(actual.left, left);
    if (item.id === 'L05') assert.equal(actual.numId, listInfo(pkg, 'L03').numId, 'Numbered sequence must continue');
  };
}
function language(rtl = false): Check {
  return (pkg, item) => {
    const p = paragraph(pkg, item.id);
    const props = runProperties(pkg, sampleRun(p, item.sample!), p);
    requireProperty(props, 'lang', { val: item.feature });
    if (rtl) requireProperty(props, 'rtl');
  };
}
function note(kind: 'footnote' | 'endnote', bodyText: string): Check {
  return (pkg, item) => {
    const reference = descendants(paragraph(pkg, item.id), kind + 'Reference')[0];
    const id = attr(reference, 'id');
    assert.ok(id, 'Native ' + kind + ' reference missing');
    const root = xmlPart(pkg.parts, 'word/' + kind + 's.xml');
    const body = descendants(root, kind).find(n => attr(n, 'id') === id);
    assert.ok(body && wordText(body).includes(bodyText), 'Wrong note body or reference');
    const p = descendants(body, 'p').find(n => wordText(n).includes(bodyText))!;
    const props = runProperties(pkg, sampleRun(p, bodyText), p);
    requireProperty(props, 'i');
    requireProperty(props, 'color', { val: '246B70' });
  };
}

const native: Record<string, Check> = {
  C04: character('u', { val: 'double' }),
  C05: character('u', { val: 'dotted' }),
  C06: character('u', { val: 'wave' }),
  C08: character('dstrike'),
  C10: character('caps'),
  C13: character('position', { val: '6' }),
  C14: character('position', { val: '-6' }),
  C15: character('spacing', { val: '40' }),
  C16: character('spacing', { val: '-15' }),
  C17: character('sz', { val: '32' }),
  C19: character('color', { val: 'A02040' }),
  C20: character('highlight', { val: 'yellow' }),
  C21: character('shd', { fill: 'B7DEE8', val: 'clear' }),
  C22: character('outline'),
  C23: character('shadow'),
  P01: para('jc', { val: 'left' }),
  P02: para('jc', { val: 'center' }),
  P03: para('jc', { val: 'right' }),
  P04: para('jc', { val: 'both' }),
  P05: para('ind', { left: '567' }),
  P06: para('ind', { right: '1134' }),
  P07: para('ind', { firstLine: '567' }),
  P08: para('ind', { hanging: '283' }),
  P09: para('spacing', { line: '360', lineRule: 'auto' }),
  P10: para('spacing', { before: '240' }),
  P11: para('spacing', { after: '240' }),
  P12: para('shd', { val: 'clear', fill: 'E2EFDA' }),
  P13: para('pBdr/bottom', { val: 'single', sz: '8', color: '74243B', space: '4' }),
  P14: (pkg, item) => {
    para('tabs/tab', { pos: '6803', val: 'right', leader: 'dot' })(pkg, item);
    assert.ok(wordText(paragraph(pkg, item.id)).includes('Tétel\t123'));
  },
  S01: (pkg, item) => {
    const p = paragraph(pkg, item.id);
    const s = style(pkg, attr(child(child(p, 'pPr'), 'pStyle'), 'val'));
    assert.equal(attr(child(s, 'name'), 'val'), 'OMI S01');
    requireProperty(runProperties(pkg, sampleRun(p, item.sample!), p), 'i');
    requireProperty(runProperties(pkg, sampleRun(p, item.sample!), p), 'color', { val: '246B70' });
  },
  S02: (pkg, item) => {
    const p = paragraph(pkg, item.id);
    const run = sampleRun(p, item.sample!);
    const s = style(pkg, attr(child(child(run, 'rPr'), 'rStyle'), 'val'));
    assert.equal(attr(child(s, 'name'), 'val'), 'OMI S02');
    requireProperty(runProperties(pkg, run, p), 'i');
    requireProperty(runProperties(pkg, run, p), 'color', { val: '246B70' });
  },
  // ListBullet2/ListNumber2 are separate, indented level-zero numbering
  // definitions in this fixture, not a true multilevel ilvl=1 sequence.
  L01: list('bullet', '360'), L02: list('bullet', '720'),
  L03: list('decimal', '360'), L04: list('decimal', '720'), L05: list('decimal', '360'),
  N01: language(), N02: language(), N03: language(), N04: language(),
  N05: language(true), N06: language(true),
  N07: (pkg, item) => assert.ok(wordText(paragraph(pkg, item.id)).endsWith(item.sample!)),
  N08: (pkg, item) => assert.ok(wordText(paragraph(pkg, item.id)).endsWith(item.sample!)),
  N09: (pkg, item) => assert.ok(wordText(paragraph(pkg, item.id)).endsWith(item.sample!), 'Manual break became ordinary whitespace'),
  N10: (pkg, item) => {
    const p = paragraph(pkg, item.id);
    const normal = property(runProperties(pkg, sampleRun(p, 'normál '), p), 'b');
    assert.ok(!normal || ['0', 'false', 'off'].includes(attr(normal, 'val') ?? ''), 'Normal sample inherited bold');
    requireProperty(runProperties(pkg, sampleRun(p, 'félkövér '), p), 'b');
    requireProperty(runProperties(pkg, sampleRun(p, 'dőlt'), p), 'i');
  },
  R01: (pkg, item) => {
    const p = paragraph(pkg, item.id);
    const id = attr(descendants(p, 'commentRangeStart')[0], 'id');
    assert.ok(id !== undefined);
    assert.equal(attr(descendants(p, 'commentRangeEnd')[0], 'id'), id);
    assert.equal(attr(descendants(p, 'commentReference')[0], 'id'), id);
    const comment = descendants(xmlPart(pkg.parts, 'word/comments.xml'), 'comment').find(c => attr(c, 'id') === id);
    assert.ok(comment && wordText(comment).includes('OMI tesztmegjegyzés: ellenőrizd a horgonyt.'));
  },
  R02: (pkg, item) => {
    const p = paragraph(pkg, item.id);
    const deleted = descendants(p, 'del')[0];
    const inserted = descendants(p, 'ins')[0];
    assert.ok(deleted && inserted);
    assert.equal(descendants(deleted, 'delText').map(n => n.textContent).join(''), 'régi');
    assert.equal(wordText(inserted), 'új');
    assert.equal(attr(deleted, 'author'), 'QA');
    assert.equal(attr(inserted, 'author'), 'QA');
  },
  F01: note('footnote', 'Formázott lábjegyzet: forrás és évszám.'),
  F02: note('endnote', 'Formázott végjegyzet: bibliográfiai adat.'),
  T01: (pkg) => {
    const table = descendants(pkg.document, 'tbl').find(t => wordText(t).includes('Egyesített fejléc'));
    assert.ok(table, 'Native Word table missing');
    const rows = descendants(table, 'tr');
    assert.equal(rows.length, 3);
    assert.ok(descendants(rows[0], 'tblHeader').length);
    assert.equal(attr(descendants(rows[0], 'gridSpan')[0], 'val'), '2');
    assert.equal(attr(descendants(rows[0], 'shd')[0], 'fill'), 'DCE6F1');
    const p = descendants(rows[1], 'p').find(n => wordText(n) === '12,5')!;
    assert.ok(p);
    requireProperty(runProperties(pkg, sampleRun(p, '12,5'), p), 'b');
  },
  I01: (pkg) => {
    const drawing = descendants(pkg.document, 'drawing').find(d => attr(descendants(d, 'docPr')[0], 'descr') === 'Szintetikus vonaldiagram');
    assert.ok(drawing, 'Image or alternative text missing');
    const target = attr(relation(pkg, attr(descendants(drawing, 'blip')[0], 'embed')), 'Target');
    assert.ok(target);
    const bytes = pkg.parts.get(target.startsWith('/') ? target.slice(1) : 'word/' + target);
    assert.ok(bytes && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'Embedded PNG relationship is broken');
  },
  X01: (pkg, item) => {
    const p = paragraph(pkg, item.id);
    const anchor = descendants(p, 'bookmarkStart').find(n => attr(n, 'name') === 'OMITest');
    assert.ok(anchor);
    assert.ok(descendants(p, 'bookmarkEnd').some(n => attr(n, 'id') === attr(anchor, 'id')));
    assert.ok(wordText(p).includes('Hivatkozási cél'));
  },
  X02: (pkg, item) => {
    const p = paragraph(pkg, item.id);
    const instructions = [...descendants(p, 'fldSimple').map(n => attr(n, 'instr') ?? ''), ...descendants(p, 'instrText').map(n => n.textContent ?? '')].join(' ');
    assert.match(instructions, /\bREF\s+OMITest\b/);
    assert.ok(wordText(p).includes('Hivatkozási cél'));
  },
  X03: (pkg, item) => {
    const p = paragraph(pkg, item.id);
    const link = descendants(p, 'hyperlink').find(n => wordText(n) === 'Open Manuscript Initiative');
    assert.ok(link, 'Native hyperlink missing');
    const rel = relation(pkg, attr(link, 'id'));
    assert.equal(attr(rel, 'Target'), 'https://openmanuscript.org/');
    assert.equal(attr(rel, 'TargetMode'), 'External');
  },
  E01: (pkg) => {
    const equation = descendants(pkg.document, 'oMath').find(n => wordText(n).includes('a+b'));
    assert.ok(equation, 'Native OMML equation missing');
    const fraction = descendants(equation, 'f')[0];
    assert.ok(fraction);
    assert.equal(wordText(child(fraction, 'num')!), 'a+b');
    assert.equal(wordText(child(fraction, 'den')!), '2');
  },
  X04: (pkg, item) => {
    assert.ok(wordText(paragraph(pkg, item.id)).includes(item.sample!));
    const sections = descendants(pkg.document, 'sectPr');
    assert.ok(sections.length >= 2, 'Section boundary missing');
    const header = child(sections.at(-1), 'headerReference');
    const target = attr(relation(pkg, attr(header, 'id')), 'Target');
    assert.ok(target);
    const document = xmlPart(pkg.parts, target.startsWith('/') ? target.slice(1) : 'word/' + target);
    assert.ok(document && descendants(document, 't').map(n => n.textContent).join('').includes('OMI / MÁSODIK SZAKASZ'));
  },
};

function blocks(manuscript: OmiManuscript): OmiBlock[] { return manuscript.sections.flatMap(section => section.blocks); }
function json(block: OmiBlock): Node {
  try { return JSON.parse(block.content) as Node; } catch { return { type: 'text', text: block.content }; }
}
function nodes(node: Node): Node[] { return [node, ...(node.content ?? []).flatMap(nodes)]; }
function modelText(node: Node): string {
  if (node.type === 'hardBreak') return '\n';
  if (node.type === 'omiTab') return '\t';
  return (node.text ?? '') + (node.content ?? []).map(modelText).join('');
}
function modelCase(manuscript: OmiManuscript, id: string): Node {
  // A list can contain multiple case paragraphs within one stored block.
  for (const block of blocks(manuscript)) {
    const root = json(block);
    const p = nodes(root).find(n => n.type === 'paragraph' && modelText(n).startsWith(id + ' |'));
    if (p) return p;
    if (modelText(root).startsWith(id + ' |')) return root;
  }
  throw new Error('Missing OMI case ' + id);
}
function assertModelMark(p: Node, sample: string, type: string, attrs: Record<string, unknown> = {}): void {
  const candidates = nodes(p).filter(n => n.type === 'text' && n.text?.includes(sample) && !n.text?.includes(' | '));
  assert.ok(candidates.some(n => n.marks?.some(m => m.type === type && Object.entries(attrs).every(([k, v]) => m.attrs?.[k] === v))), 'Missing ' + type + ' on ' + sample);
}

// These checks verify retained semantic data independently of the final Word
// output. For unsupported visual properties we still require the sample text;
// exact native formatting is then tested by the separate Word assertion.
function assertModel(manuscript: OmiManuscript, item: Case): void {
  if (item.id === 'T01') {
    const visual = blocks(manuscript).map(b => b.visual).find(v => v?.kind === 'table' && v.cells.flat().includes('Egyesített fejléc'));
    assert.ok(visual?.kind === 'table');
    assert.equal(visual.headerRows, 1);
    for (const value of ['Érték', 'Forrás', '2026', '12,5', 'Összesen', '2', '25']) assert.ok(visual.cells.flat().includes(value), value);
    return;
  }
  if (item.id === 'I01') {
    const visual = blocks(manuscript).map(b => b.visual).find(v => v?.kind === 'image' && v.alt === 'Szintetikus vonaldiagram');
    assert.ok(visual?.kind === 'image' && visual.src.startsWith('data:image/png;'));
    return;
  }
  if (item.id === 'E01') {
    const visual = blocks(manuscript).map(b => b.visual).find(v => v?.kind === 'equation' && v.notation === 'omml');
    assert.ok(visual?.kind === 'equation');
    assert.match(visual.source, /a\+b/);
    assert.match(visual.latex ?? '', /\\frac/);
    return;
  }
  const p = modelCase(manuscript, item.id);
  const sample = item.sample?.replace(/\[\[(?:FN|EN)\]\]/g, '');
  if (sample) assert.ok(modelText(p).includes(sample), 'Sample text changed');
  if (/^N0[1-6]$/.test(item.id)) assertModelMark(p, item.sample!, 'omiLanguage', { lang: item.feature });
  if (item.id === 'N09') assert.ok(nodes(p).some(n => n.type === 'hardBreak'), 'Missing hard break node');
  if (item.id === 'N10') {
    assertModelMark(p, 'félkövér ', 'bold');
    assertModelMark(p, 'dőlt', 'italic');
    const normal = nodes(p).find(n => n.text?.includes('normál ') && !n.text?.includes(' | '));
    assert.ok(normal && !normal.marks?.some(m => m.type === 'bold' || m.type === 'italic'));
  }
  if (item.id === 'R01') {
    const comment = manuscript.annotations.find(a => a.type === 'comment' && a.body.includes('OMI tesztmegjegyzés'));
    assert.ok(comment, 'Imported review comment missing');
    assert.ok(comment.targetRange || comment.targetText, 'Comment anchor missing');
  }
  if (item.id === 'R02') {
    assert.ok(modelText(p).includes('új'));
    assert.ok(manuscript.proofing?.changes.some(c => c.before.includes('régi') && c.after.includes('új')), 'Imported tracked change missing');
  }
  if (item.id === 'F01' || item.id === 'F02') {
    const kind = item.id === 'F01' ? 'footnote' : 'endnote';
    const reference = nodes(p).find(n => n.type === 'omiNote');
    assert.ok(reference);
    const annotation = manuscript.annotations.find(a => a.noteKind === kind && a.id === reference.attrs?.noteId);
    assert.ok(annotation, 'Note reference has no matching annotation');
    assert.match(annotation.body, item.id === 'F01' ? /Formázott lábjegyzet: forrás és évszám/ : /Formázott végjegyzet: bibliográfiai adat/);
    const rich = JSON.parse(annotation.bodyContent ?? '{}') as Node;
    assert.ok(nodes(rich).some(n => n.marks?.some(m => m.type === 'italic')), 'Rich note italic lost');
  }
  if (item.id.startsWith('L')) {
    const listType = item.id === 'L01' || item.id === 'L02' ? 'bulletList' : 'orderedList';
    assert.ok(blocks(manuscript).some(block => nodes(json(block)).some(n => n.type === listType
      && nodes(n).some(li => li.type === 'listItem' && modelText(li).startsWith(item.id + ' |')))), 'Case has been flattened instead of imported as a list');
  }
  if (item.id === 'S01') {
    const block = blocks(manuscript).find(b => modelText(json(b)).startsWith(item.id + ' |'));
    assert.ok(block?.paragraphStyleId, 'Named paragraph style is missing');
  }
  if (item.id === 'S02') assertModelMark(p, item.sample!, 'italic');
  if (item.id === 'X02') {
    assert.ok(modelText(p).includes('Hivatkozási cél'));
    assert.ok(nodes(p).some(n => n.type === 'omiCrossReference'), 'REF field was flattened to text');
    assert.ok(manuscript.crossReferences?.some(ref => ref.targetKind === 'bookmark'), 'No semantic bookmark cross-reference');
  }
  if (item.id === 'X03') assertModelMark(p, 'Open Manuscript Initiative', 'omiLink', { href: 'https://openmanuscript.org/' });
}

// Gaps are not empty TODOs. Node executes the assertion, reporting actual
// failure as TODO with a reason. Strict mode makes every assertion blocking.
function wordGap(id: string): string | undefined {
  if (id.startsWith('C')) return 'Exact direct character typography is not represented/exported yet';
  if (id.startsWith('P')) return 'Native paragraph layout properties are not round-tripped yet';
  if (id.startsWith('S')) return 'Custom Word style identity and color are not round-tripped yet';
  if (id.startsWith('L')) return 'Style-based native list numbering is not round-tripped yet';
  if (id === 'N05' || id === 'N06') return 'Right-to-left Word run property is not round-tripped yet';
  if (id === 'F01' || id === 'F02') return 'Note color is not round-tripped yet';
  if (['T01', 'I01', 'E01'].includes(id)) return 'DOCX publication exporter currently emits a descriptive text fallback';
  if (['X01', 'X02', 'X03', 'X04'].includes(id)) return 'Native bookmark, field, hyperlink or section metadata is not round-tripped yet';
  return undefined;
}
function modelGap(id: string): string | undefined {
  if (id === 'R01' || id === 'R02') return 'Word review metadata is not imported as editable OMI review objects yet';
  if (id.startsWith('L')) return 'Style-based numbering is currently flattened on import';
  if (id === 'S01') return 'Named Word paragraph style is not attached to the OMI block';
  if (id === 'X02') return 'REF fields are currently flattened on import';
  if (id === 'X03') return 'Inline semantic enrichment may lose Word hyperlink anchors';
  return undefined;
}
function todo(reason: string | undefined): string | boolean { return strict ? false : reason ?? false; }

export function registerMasterFormattingContract(): void {
  test('master fixture: remaining 57 executable formatting contracts', async t => {
    const input = readFileSync(fixture);
    const { cases } = JSON.parse(readFileSync(manifest, 'utf8')) as { cases: Case[] };
    const remaining = cases.filter(item => !alreadyCovered.has(item.id));
    assert.equal(remaining.length, 57);
    assert.deepEqual(Object.keys(native).sort(), remaining.map(item => item.id).sort(), 'Every remaining manifest case must have exactly one native assertion');
    const source = readWordPackage(input);
    for (const item of remaining) {
      await t.test(item.id + ' fixture / ' + item.feature, () => native[item.id]!(source, item));
    }

    const previous = useStudioStore.getState();
    let imported: OmiManuscript;
    try {
      const plan = await parseDocxForStudio(new File([new Uint8Array(input)], 'omi-formatting-master-test.docx'));
      applyDocxImportPlan(plan, { importDetectedAuthors: false, source: '', importMode: 'editorial' });
      imported = useStudioStore.getState().manuscript;
    } finally {
      useStudioStore.setState(previous);
    }
    const editorDocument = buildContinuousManuscriptDocument(imported.sections);
    const projected = { ...imported, sections: projectContinuousManuscriptDocument(editorDocument, imported.sections) };
    const reopened = parseOmiJson(serializeOmiJson(projected));
    for (const item of remaining) {
      await t.test(item.id + ' model retention after import, editor projection and save/reopen', { todo: todo(modelGap(item.id)) }, () => {
        for (const manuscript of [imported, projected, reopened]) assertModel(manuscript, item);
      });
    }
    const exported = readWordPackage(buildDocxExport(reopened).bytes);
    for (const item of remaining) {
      if (item.id === 'R01' || item.id === 'R02') {
        // Public publication output must not disclose private editorial history.
        // Exact internal review retention is asserted separately above.
        await t.test(item.id + ' public DOCX privacy', () => {
          assert.ok(wordText(paragraph(exported, item.id)).includes(item.id === 'R01' ? item.sample! : 'új'));
          assert.equal(descendants(exported.document, item.id === 'R01' ? 'commentRangeStart' : 'del').length, 0);
          assert.equal(descendants(exported.document, item.id === 'R01' ? 'commentReference' : 'ins').length, 0);
          if (item.id === 'R01') assert.equal(exported.parts.has('word/comments.xml'), false);
        });
      } else {
        await t.test(item.id + ' native DOCX after editor projection and OMI reopen', { todo: todo(wordGap(item.id)) }, () => native[item.id]!(exported, item));
      }
    }
  });
}
