import assert from 'node:assert/strict';
import { DOMParser as XmlParser } from '@xmldom/xmldom';
import { collectNoteAnchors, createNoteAnnotation } from '../src/model/notes.ts';
import { collectCitationAnchors } from '../src/model/citationClusters.ts';
import { createCrossReference } from '../src/model/crossReferences.ts';
import { createInitialVersioningEnvelope, extractManuscriptState } from '../src/model/versioning.ts';
import { serializeOmiJson } from '../src/services/exportOmi.ts';
import { parseOmiJson } from '../src/services/omiPortableFormat.ts';
import { renderJatsArticle } from '../src/services/exportJats.ts';
import { renderHtmlArticle } from '../src/services/exportHtml.ts';
import { buildDocxExport } from '../src/services/exportDocx.ts';
import { buildOdtExport } from '../src/services/exportOdt.ts';
import { buildIdmlExport } from '../src/services/exportIdml.ts';
import { buildXtgExport } from '../src/services/exportXtg.ts';
import { buildMifExport } from '../src/services/exportMif.ts';
import { buildSlaExport } from '../src/services/exportSla.ts';
import { buildLatexExport } from '../src/services/exportLatex.ts';
import { buildEpubExport } from '../src/services/exportEpub.ts';
import { ExportExchangeSession } from '../src/services/exchangeSession.ts';
import type { OmiManuscript } from '../src/types/omi.ts';
import { createVersionedTestManuscript } from './testManuscriptFixture.ts';

export const relationshipSpecifications = { 'OMI-SPEC-000': '0.2.0', 'OMI-SPEC-100': '0.2.0', 'OMI-SPEC-120': '0.3.0' };
const T0 = '2026-11-05T00:00:00Z';
function fixture(): OmiManuscript {
  const m = createVersionedTestManuscript(), section = m.sections[0]!, block = section.blocks[0]!;
  m.annotations = [createNoteAnnotation({ id: 'foot', anchorId: 'a-foot', targetBlockId: block.id, body: 'FOOT_BODY', kind: 'footnote', timestamp: T0 }),
    createNoteAnnotation({ id: 'end', anchorId: 'a-end', targetBlockId: block.id, body: 'END_BODY', kind: 'endnote', timestamp: T0 })];
  m.bibliographicRecords = [{ id: 'record', type: 'book', title: 'Synthetic source title', contributors: [], identifiers: [], status: 'provisional' }];
  m.citations = [{ id: 'citation', target: 'record', anchorId: 'a-citation', targetBlockId: block.id, locator: { type: 'page', value: '12' } }];
  m.sourceAttributions = [{ id: 'derivation', sourceObjectId: block.id, targetBibliographicRecordId: 'record', predicate: 'prov:wasDerivedFrom', role: 'import-source', assertionStatus: 'author-declared' }];
  m.crossReferences = [createCrossReference({ id: 'xref', anchorId: 'a-xref', sourceBlockId: block.id, targetId: section.id, targetKind: 'section' }, T0)];
  block.content = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [
    { type: 'text', text: 'Author text ' },
    { type: 'omiNote', attrs: { noteId: 'foot', anchorId: 'a-foot', label: '1', noteType: 'footnote' } },
    { type: 'text', text: ' then ' }, { type: 'omiNote', attrs: { noteId: 'end', anchorId: 'a-end', label: '2', noteType: 'endnote' } },
    { type: 'omiCitation', attrs: { citationId: 'citation', anchorId: 'a-citation', label: '[1]' } },
    { type: 'omiCrossReference', attrs: { crossReferenceId: 'xref', anchorId: 'a-xref', label: 'Section 1' } },
  ] }] });
  section.blocks.push({ id: 'table', type: 'table', content: '', visual: { kind: 'table', cells: [['A', 'B'], ['1', '2']], headerRow: true, caption: 'DATA_TABLE_CAPTION' } });
  const state = extractManuscriptState(m);
  return { ...state, ...createInitialVersioningEnvelope(state, { summary: 'Semantic relationship fixture', timestamp: T0, completeness: 'complete' }) };
}
function xml(text: string) { return new XmlParser().parseFromString(text, 'application/xml'); }
function zipText(bytes: Uint8Array, name: string): string {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); let offset = 0;
  while (view.getUint32(offset, true) === 0x04034b50) {
    const size = view.getUint32(offset + 18, true), length = view.getUint16(offset + 26, true), extra = view.getUint16(offset + 28, true);
    const file = new TextDecoder().decode(bytes.subarray(offset + 30, offset + 30 + length)); const start = offset + 30 + length + extra;
    if (file === name) return new TextDecoder().decode(bytes.subarray(start, start + size)); offset = start + size;
  }
  throw new Error(`ZIP entry missing: ${name}`);
}
const simple = [
  { format: 'XTG', build: buildXtgExport }, { format: 'MIF', build: buildMifExport }, { format: 'SLA', build: buildSlaExport },
  { format: 'LaTeX', build: buildLatexExport }, { format: 'EPUB', build: buildEpubExport },
] as const;
function warnings(output: unknown): string[] {
  return (output as { warnings?: string[] }).warnings ?? [];
}
export const coreRelationshipCases = [
  { id: 'portable-exchange-keeps-typed-predicates-and-target-roles', requirements: ['REQ-PRI-005', 'REQ-OBJ-007', 'REQ-DOC-015'], run() {
    const source = fixture(), before = structuredClone(source), result = parseOmiJson(serializeOmiJson(source));
    assert.deepEqual(result.sourceAttributions, source.sourceAttributions); assert.deepEqual(result.citations, source.citations);
    assert.deepEqual(result.annotations, source.annotations); assert.deepEqual(result.crossReferences, source.crossReferences);
    assert.equal(result.sourceAttributions?.[0]?.predicate, 'prov:wasDerivedFrom');
    assert.equal(result.sourceAttributions?.[0]?.sourceObjectId, result.citations[0]?.targetBlockId);
    assert.equal(result.citations[0]?.target, result.bibliographicRecords?.[0]?.id); assert.deepEqual(source, before);
  } },
  { id: 'visual-superscripts-and-proximity-do-not-invent-relations', requirements: ['REQ-PRI-005', 'REQ-OBJ-007'], run() {
    const source = fixture(); source.annotations = []; source.citations = []; source.sourceAttributions = []; source.crossReferences = [];
    source.sections[0]!.blocks[0]!.content = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [
      { type: 'text', text: '1', marks: [{ type: 'omiSuperscript' }] }, { type: 'text', text: ' A visually adjacent source title.' },
    ] }] });
    const result = parseOmiJson(serializeOmiJson(source)); assert.equal(collectNoteAnchors(result).length, 0);
    assert.equal(collectCitationAnchors(result.sections).length, 0); assert.deepEqual(result.sourceAttributions, []);
  } },
  { id: 'jats-xrefs-resolve-to-distinct-note-reference-and-table-roles', requirements: ['REQ-PRI-005', 'REQ-OBJ-007', 'REQ-DOC-015'], run() {
    const source = fixture(), before = structuredClone(source), document = xml(renderJatsArticle(source).xml);
    const elements = Array.from(document.getElementsByTagName('*'));
    const ids = new Set(elements.map(item => item.getAttribute('id')).filter(Boolean));
    const xrefs = Array.from(document.getElementsByTagName('xref'));
    assert.ok(xrefs.some(item => item.getAttribute('ref-type') === 'fn')); assert.ok(xrefs.some(item => item.getAttribute('ref-type') === 'bibr'));
    for (const item of xrefs) for (const id of (item.getAttribute('rid') ?? '').split(/\s+/).filter(Boolean)) assert.ok(ids.has(id), id);
    assert.ok(document.getElementsByTagName('fn').length >= 2); assert.ok(document.getElementsByTagName('table-wrap').length > 0);
    assert.deepEqual(source, before);
  } },
  { id: 'html-note-and-citation-links-are-more-than-visible-superscripts', requirements: ['REQ-PRI-005', 'REQ-OBJ-007', 'REQ-DOC-015'], run() {
    const source = fixture(), before = structuredClone(source), output = renderHtmlArticle(source);
    assert.match(output.html, /role="doc-noteref"/); assert.match(output.html, /role="doc-biblioref"/);
    assert.match(output.html, /id="note-foot"/); assert.match(output.html, /href="#note-foot"/);
    assert.match(output.html, /<table/); assert.deepEqual(source, before);
  } },
  { id: 'docx-retains-native-footnote-and-endnote-roles', requirements: ['REQ-DOC-015', 'REQ-PRI-005'], run() {
    const source = fixture(), before = structuredClone(source), output = buildDocxExport(source);
    const main = xml(zipText(output.bytes, 'word/document.xml'));
    assert.ok(main.getElementsByTagName('w:footnoteReference').length > 0); assert.ok(main.getElementsByTagName('w:endnoteReference').length > 0);
    assert.ok(zipText(output.bytes, 'word/footnotes.xml').includes('FOOT_BODY'));
    assert.ok(zipText(output.bytes, 'word/endnotes.xml').includes('END_BODY')); assert.deepEqual(source, before);
  } },
  { id: 'unsupported-source-predicate-is-disclosed-across-tested-public-adapters', requirements: ['REQ-OBJ-007', 'REQ-PRI-008', 'REQ-DOC-015'], run() {
    const source = fixture(), before = structuredClone(source);
    for (const render of [renderHtmlArticle, renderJatsArticle]) assert.ok(render(source).diagnostics.some(item => item.code === 'source-attribution-not-preserved'));
    assert.ok(buildOdtExport(source).diagnostics.some(item => item.code === 'source-attribution-not-preserved'));
    for (const build of [buildDocxExport, buildIdmlExport, ...simple.map(item => item.build)]) {
      assert.ok(warnings(build(source)).some(item => item.includes('source-attribution')), build.name);
    }
    const idml = buildIdmlExport(source);
    assert.ok(warnings(idml).some(item => item.includes('note-role-projected-as-text')));
    assert.ok(zipText(idml.bytes, 'Stories/Story_u3.xml').includes('<Footnote '));
    assert.deepEqual(source, before);
  } },
  ...simple.map(({ format, build }) => ({
    id: `${format.toLowerCase()}-non-equivalent-note-and-object-projection-is-disclosed`, requirements: ['REQ-DOC-015', 'REQ-PRI-008'], run() {
      const source = fixture(), before = structuredClone(source), output = build(source), notices = warnings(output);
      assert.ok(notices.some(item => item.includes('note-role') || item.includes('note-not-preserved')), format);
      assert.ok(notices.some(item => item.includes('citation-relationship-not-preserved')), format);
      assert.ok(notices.some(item => item.includes('cross-reference-relationship-not-preserved')), format);
      assert.ok(notices.some(item => item.includes('visual-object-projected-as-text')), format);
      const raw = 'text' in output ? output.text : zipText(output.bytes, 'EPUB/article.xhtml');
      const text = format === 'LaTeX' ? raw.replace(/\\_/g, '_') : raw;
      assert.ok(text.includes('DATA_TABLE_CAPTION')); assert.ok(!/\\footnote\s*\{/.test(text));
      if (format === 'EPUB') { assert.ok(!text.includes('FOOT_BODY')); assert.ok(!text.includes('END_BODY')); }
      else { assert.ok(text.includes('FOOT_BODY')); assert.ok(text.includes('END_BODY')); }
      assert.deepEqual(source, before);
    },
  })),
  { id: 'fallback-warnings-reach-receipt-without-leaking-private-note-bodies', requirements: ['REQ-DOC-015', 'REQ-PRI-008'], async run() {
    const source = fixture(); source.annotations.push({ id: 'private', type: 'note', targetBlockId: source.sections[0]!.blocks[0]!.id,
      noteKind: 'footnote', body: 'PRIVATE_REVIEW_BODY', renderingHint: 'footnote', visibility: 'editor_only' });
    const output = buildLatexExport(source), session = await ExportExchangeSession.begin('latex', serializeOmiJson(source));
    session.recordAdapterDiagnostics(output); await session.inspectArtifact(output.blob);
    const report = session.finishDelivery(true);
    assert.ok(report.events.some(item => item.code === 'ADAPTER_WARNING' && item.consequence.includes('note-role')));
    assert.equal(report.lossless, false); assert.equal(report.coverage, 'incomplete');
    assert.ok(!JSON.stringify(report).includes('PRIVATE_REVIEW_BODY')); assert.ok(!output.text.includes('PRIVATE_REVIEW_BODY'));
  } },
];
export async function runCoreRelationshipCases() {
  const results = [];
  for (const item of coreRelationshipCases) { await item.run(); results.push({ id: item.id, requirements: [...item.requirements], status: 'pass' as const }); }
  return results;
}
