import { sourceStyleBundle } from '../src/model/sourceWordStyles.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { DOMParser } from '@xmldom/xmldom';
import { advancedCases, createAdvancedDocx, type AdvancedCase, type NativeExpectation } from './generate-advanced-formatting-fixtures.ts';
import { readWordPackage, readZipParts } from './docx-master-formatting-contract.ts';
import { parseDocxForStudio } from '../src/services/docxImportStrategy.ts';
import { applyDocxImportPlan } from '../src/app/docxImportActions.ts';
import { useStudioStore } from '../src/app/useStudioStore.ts';
import { buildContinuousManuscriptDocument, projectContinuousManuscriptDocument } from '../src/editor/continuousManuscriptDocument.ts';
import { parseOmiJson } from '../src/services/omiPortableFormat.ts';
import { serializeOmiJson } from '../src/services/exportOmi.ts';
import { buildDocxExport } from '../src/services/exportDocx.ts';
import { buildOdtExport } from '../src/services/exportOdt.ts';
import { buildIdmlExport } from '../src/services/exportIdml.ts';
import { renderHtmlArticle } from '../src/services/exportHtml.ts';
import { renderJatsArticle } from '../src/services/exportJats.ts';
import { buildPdfPrintDocument } from '../src/services/exportPdf.ts';
import type { OmiManuscript } from '../src/types/omi.ts';
import { createPersonAgent, createContribution } from '../src/model/identity.ts';

const strict = process.env.OMI_FORMATTING_STRICT === '1';
function todo(reason: string): string | false { return strict ? false : reason; }
const expectedIds = 'C24 C25 C26 C27 C28 P15 P16 P17 P18 P19 P20 P21 S03 S04 S05 L06 L07 L08 L09 F03 F04 F05 F06 F07 T02 T03 T04 T05 T06 I02 I03 X05 X06 X07 X08 X09 X10 X11 X12 R03 R04 E02'.split(' ');

function assertNative(parts: Map<string, Buffer>, expected: NativeExpectation): void {
  const bytes = parts.get(expected.part);
  assert.ok(bytes, 'Missing package part ' + expected.part);
  const doc = new DOMParser().parseFromString(bytes.toString('utf8'), 'application/xml');
  const path = expected.path.split('/');
  const elements = [doc.documentElement, ...Array.from(doc.getElementsByTagName('*'))].filter(Boolean);
  const matches = elements.filter(element => {
    if (element.localName !== path.at(-1)) return false;
    let current = element.parentNode;
    for (let index = path.length - 2; index >= 0; index--) {
      if (!current || (current as unknown as Element).localName !== path[index]) return false;
      current = current.parentNode;
    }
    return Object.entries(expected.attrs).every(([name, value]) =>
      Array.from(element.attributes).some(attribute => attribute.localName === name && attribute.value === value))
      && (expected.text === undefined || element.textContent === expected.text);
  });
  assert.ok(matches.length > 0, expected.part + ': ' + expected.path + ' ' + JSON.stringify(expected.attrs) + ' ' + (expected.text ?? ''));
}

function verifyRelationships(parts: Map<string, Buffer>): void {
  const bytes = parts.get('word/_rels/document.xml.rels');
  assert.ok(bytes);
  const doc = new DOMParser().parseFromString(bytes.toString('utf8'), 'application/xml');
  for (const rel of Array.from(doc.getElementsByTagName('Relationship'))) {
    assert.ok(parts.has('word/' + rel.getAttribute('Target')), 'Missing related package part');
  }
}

type RichNode = { type?: string; text?: string; content?: RichNode[] };
function textNodes(node: RichNode): string {
  return (node.text ?? '') + (node.content ?? []).map(textNodes).join('');
}
function modelText(manuscript: OmiManuscript): string {
  return manuscript.sections.flatMap(section => section.blocks.map(block => {
    try { return textNodes(JSON.parse(block.content) as RichNode); } catch { return block.content; }
  })).join('\n');
}
function modelBlocks(manuscript: OmiManuscript) { return manuscript.sections.flatMap(section => section.blocks); }
function listDepth(node: RichNode, depth = 0): number {
  const next = depth + (node.type === 'orderedList' || node.type === 'bulletList' ? 1 : 0);
  return Math.max(next, ...(node.content ?? []).map(child => listDepth(child, next)));
}
const nativeParagraphContracts: Record<string, Record<string, unknown>> = {
  P15: { omiWidowControl: true }, P16: { omiKeepNext: true },
  P17: { omiKeepLines: true }, P18: { omiPageBreakBefore: true },
  P20: { omiLineSpacing: 14, omiLineRule: 'exact' },
  P21: { omiLineSpacing: 14, omiLineRule: 'atLeast' },
};
function assertSupportedModel(item: AdvancedCase, manuscript: OmiManuscript): void {
  const paragraph = nativeParagraphContracts[item.id];
  if (paragraph) {
    const block = modelBlocks(manuscript).find(candidate => candidate.content.includes('Typographic paragraph ' + item.id));
    assert.ok(block, 'Missing paragraph specimen ' + item.id);
    const root = JSON.parse(block.content) as { content?: Array<{ attrs?: Record<string, unknown> }> };
    for (const [name, value] of Object.entries(paragraph)) assert.equal(root.content?.[0]?.attrs?.[name], value, item.id + ' ' + name);
  }

  if (['S03','S04','S05'].includes(item.id)) {
    const sample = item.id === 'S03' ? 'Inherited bold and italic' : item.id === 'S04' ? 'Heading-like paragraph' : 'Not bold; still italic';
    const block = modelBlocks(manuscript).find(candidate => candidate.content.includes(sample));
    assert.ok(block);
    const root = JSON.parse(block.content) as {content?: Array<{attrs?: Record<string,unknown>; content?: Array<{text?:string; marks?:Array<{type:string}>}>}>};
    const p = root.content?.[0];
    const bundle = sourceStyleBundle(p?.attrs?.omiWordParagraphStyle);
    assert.equal(bundle?.selected,'Derived');
    assert.equal(bundle?.styles.find(style=>style.id==='Derived')?.basedOn,'Base');
    assert.equal(bundle?.styles.find(style=>style.id==='Derived')?.next,'Body');
    const run = p?.content?.find(node=>node.text===sample);
    assert.ok(run);
    assert.equal(run.marks?.some(mark=>mark.type==='bold') ?? false,item.id!=='S05');
    assert.ok(run.marks?.some(mark=>mark.type==='italic'));
  }
  if (item.id === 'C28') assert.ok(modelText(manuscript).includes(item.sample!));
  if (item.id === 'L06') {
    assert.ok(modelBlocks(manuscript).some(block => {
      try { return listDepth(JSON.parse(block.content) as RichNode) >= 3; } catch { return false; }
    }), 'Three real list levels must remain nested');
  }
  if (item.id === 'F03' || item.id === 'F04' || item.id === 'F05') {
    const notes = manuscript.annotations.filter(note => note.noteKind === 'footnote');
    assert.equal(notes.length, item.id === 'F05' ? 2 : 1);
    if (item.id === 'F03') {
      const rich = JSON.parse(notes[0]!.bodyContent ?? '{}') as RichNode;
      assert.deepEqual(rich.content?.filter(n => n.type === 'paragraph').map(textNodes), ['First note paragraph', 'Second note paragraph']);
    }
    if (item.id === 'F04') {
      assert.match(notes[0]!.body, /FOOTNOTE-START/);
      assert.match(notes[0]!.body, /FOOTNOTE-END/);
    }
  }
  if (item.id === 'T03' || item.id === 'T04') {
    const table = modelBlocks(manuscript).map(block => block.visual).find(visual => visual?.kind === 'table');
    assert.ok(table?.kind === 'table');
    assert.equal(table.headerRows, 1);
    if (item.id === 'T04') {
      assert.equal(table.cells.length, 86);
      assert.equal(table.cells.at(-1)?.[0], 'Row 85');
    }
  }
  if (item.id === 'E02') {
    const equation = modelBlocks(manuscript).map(block => block.visual).find(visual => visual?.kind === 'equation');
    assert.ok(equation?.kind === 'equation');
    assert.equal(equation.latex, '\\frac{\\sqrt{x}}{y^{2}}');
  }
}
function assertPrivateReviewModel(item: AdvancedCase, manuscript: OmiManuscript): void {
  if (item.id === 'R03') {
    assert.ok(manuscript.annotations.some(a => a.type === 'comment' && a.body === 'Review root'));
    assert.ok(manuscript.annotations.some(a => a.type === 'comment' && a.body === 'Review reply'));
  } else {
    assert.ok(manuscript.proofing?.changes.some(c => c.before.includes('italic') && c.after.includes('bold')), 'Formatting revision not retained');
  }
}
function importManuscript(item: AdvancedCase, bytes: Uint8Array): Promise<OmiManuscript> {
  return parseDocxForStudio(new File([new Uint8Array(bytes)], item.id + '.docx')).then(plan => {
    const previous = useStudioStore.getState();
    try {
      applyDocxImportPlan(plan, { importDetectedAuthors: false, source: '', importMode: 'editorial' });
      return useStudioStore.getState().manuscript;
    } finally { useStudioStore.setState(previous); }
  });
}
function assertMarker(parts: Map<string, Buffer>, marker: string): void {
  assert.ok([...parts].some(([name, bytes]) => name.endsWith('.xml') && bytes.toString('utf8').includes(marker)), 'Missing exported case marker ' + marker);
}
function assertPublicReview(item: AdvancedCase, parts: Map<string, Buffer>, outputs: string[]): void {
  assert.ok(!parts.has('word/comments.xml') && !parts.has('word/commentsExtended.xml'));
  const word = parts.get('word/document.xml')?.toString('utf8') ?? '';
  assert.doesNotMatch(word, /<w:(?:commentRangeStart|commentReference|rPrChange)\b/);
  if (item.id === 'R03') for (const output of [...outputs, word]) assert.doesNotMatch(output, /Review root|Review reply/);
}
function docxGap(item: AdvancedCase): string {
  if (item.manual) return 'Native Word interchange or rendered-page fidelity not yet confirmed: ' + item.manual;
  return 'Advanced exact native Word fidelity is an open acceptance contract: ' + item.feature;
}

export function registerAdvancedFormattingContracts(): void {
  test('advanced corpus extends the original 65 to 107 distinct IDs', () => {
    const original = JSON.parse(readFileSync(new URL('./fixtures/omi-formatting-test-manifest.json', import.meta.url), 'utf8')) as { cases: { id: string }[] };
    assert.deepEqual(advancedCases.map(item => item.id), expectedIds);
    assert.equal(new Set([...original.cases, ...advancedCases].map(item => item.id)).size, 107);
    assert.equal(new Set(advancedCases.map(item => item.group)).size, 8);
    assert.ok(advancedCases.every(item => item.checks.length > 0));
    const archive = readZipParts(readFileSync(new URL('./fixtures/formatting/omi-advanced-formatting-corpus.zip', import.meta.url)));
    assert.equal(archive.size, 43);
    for (const item of advancedCases) {
      const downloaded = archive.get(item.group + '/' + item.id + '.docx');
      assert.ok(downloaded, item.id + ' missing from downloadable corpus');
      const packaged = readZipParts(downloaded);
      const generated = readZipParts(createAdvancedDocx(item));
      // ZIP timestamps may differ. Every inner OPC part must be byte-identical.
      assert.deepEqual(packaged, generated, item.id + ' archive differs from its authoritative specimen');
    }
  });

  test('advanced formatting: 42 isolated Word fixtures, import and publication contracts', async t => {
    for (const item of advancedCases) {
      await t.test(item.id + ' ' + item.feature, async sub => {
        const bytes = createAdvancedDocx(item);
        await sub.test('independent native source package', () => {
          const source = readWordPackage(bytes);
          verifyRelationships(source.parts);
          for (const expected of item.checks) assertNative(source.parts, expected);
          assertMarker(source.parts, item.marker);
        });
        const imported = await importManuscript(item, bytes);
        const editor = buildContinuousManuscriptDocument(imported.sections);
        const projected = { ...imported, sections: projectContinuousManuscriptDocument(editor, imported.sections) };
        const reopened = parseOmiJson(serializeOmiJson(projected));
        await sub.test('case anchor and supported model retention through editor projection and reopening', () => {
          for (const manuscript of [imported, projected, reopened]) {
            assert.ok(modelText(manuscript).includes(item.marker));
            assertSupportedModel(item, manuscript);
          }
        });
        // The independently authored DOCX specimens intentionally have no author
        // metadata. Add a synthetic contributor only to the publication test view,
        // after import/persistence assertions; never bypass the publication gate.
        const author = createPersonAgent({ givenName: 'Fixture', familyName: 'Author' }, 'advanced-fixture-author', reopened.createdAt);
        const publication: OmiManuscript = {
          ...reopened,
          agents: [...reopened.agents, author],
          contributions: [...reopened.contributions, createContribution(author.id, reopened.id, ['author'], 1, 'advanced-fixture-contribution', reopened.createdAt)],
        };
        const word = readWordPackage(buildDocxExport(publication).bytes);
        const html = renderHtmlArticle(publication).html;
        const jats = renderJatsArticle(publication).xml;
        const print = buildPdfPrintDocument(publication);
        const odt = readZipParts(buildOdtExport(publication).bytes);
        const idml = readZipParts(buildIdmlExport(publication).bytes);
        await sub.test('six export paths retain case anchor (PDF print HTML, not rendered pages)', () => {
          assertMarker(word.parts, item.marker);
          assertMarker(odt, item.marker);
          assertMarker(idml, item.marker);
          for (const output of [html, jats, print]) assert.ok(output.includes(item.marker));
        });
        if (item.privateReview) {
          await sub.test('review history retained internally', { todo: todo('Word review metadata import remains incomplete') }, () => assertPrivateReviewModel(item, reopened));
          await sub.test('public export does not expose native private review metadata', () => assertPublicReview(item, word.parts, [html, jats, print, ...[odt, idml].flatMap(parts => [...parts.values()].map(b => b.toString('utf8')))]));
        } else {
          await sub.test('exact native DOCX formatting after reopening', { todo: item.nativeSupported || nativeParagraphContracts[item.id] || ['L06','L07','L08','L09','S03','S04','S05'].includes(item.id) ? false : todo(docxGap(item)) }, () => {
            for (const expected of item.checks) assertNative(word.parts, expected);
          });
        }
        if (item.id === 'C26') {
          await sub.test('hidden text excluded from public semantic exports', { todo: todo('Hidden Word run has no established public projection yet') }, () => {
            for (const output of [html, jats, print]) assert.ok(!output.includes(item.sample!));
          });
        }
      });
    }
  });
}
