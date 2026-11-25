import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { DOMParser } from '@xmldom/xmldom';
import { parseDocxForStudio } from '../src/services/docxImportStrategy.ts';
import { renderHtmlArticle } from '../src/services/exportHtml.ts';
import { renderJatsArticle } from '../src/services/exportJats.ts';
import { buildPdfPrintDocument } from '../src/services/exportPdf.ts';
import { buildOdtExport } from '../src/services/exportOdt.ts';
import { parseOdtForStudio } from '../src/services/odtImport.ts';
import { buildIdmlExport } from '../src/services/exportIdml.ts';
import { createTestManuscript } from './testManuscriptFixture.ts';

type Mark = { type: string; attrs?: Record<string, unknown> };
type RichNode = { type?: string; text?: string; marks?: Mark[]; content?: RichNode[] };
const cases = [
  { id: 'C01', mark: 'bold', html: 'strong', jats: 'bold', idml: 'Strong', odt: 'OMIStrong', odtProperty: ['font-weight', 'bold'], idmlProperty: ['FontStyle', 'Bold'] },
  { id: 'C02', mark: 'italic', html: 'em', jats: 'italic', idml: 'Emphasis', odt: 'OMIEmphasis', odtProperty: ['font-style', 'italic'], idmlProperty: ['FontStyle', 'Italic'] },
  { id: 'C03', mark: 'omiUnderline', html: 'u', jats: 'underline', idml: 'Underline', odt: 'OMIUnderline', odtProperty: ['text-underline-style', 'solid'], idmlProperty: ['Underline', 'true'] },
  { id: 'C07', mark: 'strike', html: 'del', jats: 'strike', idml: 'Strike', odt: 'OMIStrike', odtProperty: ['text-line-through-style', 'solid'], idmlProperty: ['StrikeThru', 'true'] },
  { id: 'C09', mark: 'omiSmallCaps', html: 'span', jats: 'sc', idml: 'Small Caps', odt: null, odtProperty: ['font-variant', 'small-caps'], idmlProperty: ['Capitalization', 'SmallCaps'] },
  { id: 'C11', mark: 'omiSuperscript', html: 'sup', jats: 'sup', idml: 'Superscript', odt: null, odtProperty: ['text-position', 'super'], idmlProperty: ['Position', 'Superscript'] },
  { id: 'C12', mark: 'omiSubscript', html: 'sub', jats: 'sub', idml: 'Subscript', odt: null, odtProperty: ['text-position', 'sub'], idmlProperty: ['Position', 'Subscript'] },
];
const sample = 'Árvíztűrő tükörfúrógép – Manuscript 123';

// These two exporters use stored ZIP entries (no compression/data descriptors).
// Read their actual emitted XML rather than searching for XML in binary bytes.
function storedParts(bytes: Uint8Array): Map<string, string> {
  const buffer = Buffer.from(bytes);
  const parts = new Map<string, string>();
  let offset = 0;
  while (offset + 30 <= buffer.length && buffer.readUInt32LE(offset) === 0x04034b50) {
    assert.equal(buffer.readUInt16LE(offset + 8), 0, 'Expected stored ZIP entry');
    assert.equal(buffer.readUInt16LE(offset + 6) & 8, 0, 'Unexpected descriptor');
    const size = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const name = buffer.toString('utf8', offset + 30, offset + 30 + nameLength);
    const start = offset + 30 + nameLength + extraLength;
    assert.ok(start + size <= buffer.length, 'Truncated ZIP part');
    parts.set(name, buffer.toString('utf8', start, start + size));
    offset = start + size;
  }
  assert.ok(parts.size > 0);
  return parts;
}
function xml(source: string): Document {
  return new DOMParser().parseFromString(source, 'application/xml') as unknown as Document;
}
function elements(root: Document | Element, local: string): Element[] {
  return Array.from(root.getElementsByTagName('*')).filter(el => el.localName === local);
}
function attr(el: Element, local: string): string | undefined {
  return Array.from(el.attributes).find(a => a.localName === local)?.value;
}
function part(parts: Map<string, string>, name: string): string {
  const result = parts.get(name);
  assert.ok(result, 'Missing ' + name);
  return result;
}
function nodes(node: RichNode): RichNode[] { return [node, ...(node.content ?? []).flatMap(nodes)]; }
function textContent(node: RichNode): string {
  return node.type === 'hardBreak' ? '\n' : (node.text ?? '') + (node.content ?? []).map(textContent).join('');
}
function hasProperty(el: Element, name: string, value: string): boolean {
  return [el, ...Array.from(el.getElementsByTagName('*'))].some(child => {
    const actual = attr(child, name);
    return actual === value || (name === 'text-position' && actual?.startsWith(value + ' '))
      || (child.localName === name && child.textContent === value);
  });
}
function assertIdmlStyle(parts: Map<string, string>, text: string, style: string, property: string[]): void {
  const stories = [...parts].filter(([name]) => /^Stories\/.*\.xml$/.test(name)).map(([, source]) => xml(source));
  const ranges = stories.flatMap(story => elements(story, 'CharacterStyleRange')).filter(el =>
    attr(el, 'AppliedCharacterStyle') === 'CharacterStyle/OMI ' + style);
  assert.ok(ranges.some(range => range.textContent?.includes(text)), 'Sample does not use the required IDML style');
  const styles = xml(part(parts, 'Resources/Styles.xml'));
  const definition = elements(styles, 'CharacterStyle').find(el => attr(el, 'Name') === 'OMI ' + style);
  assert.ok(definition && hasProperty(definition, property[0]!, property[1]!), 'Missing actual IDML style property');
}
function assertOdtStyle(parts: Map<string, string>, text: string, property: string[], expectedStyle?: string): void {
  const content = xml(part(parts, 'content.xml'));
  const styles = [content, xml(part(parts, 'styles.xml'))].flatMap(doc => elements(doc, 'style'));
  // Adjacent runs with identical formatting may be merged, including the bold case label.
  const spans = elements(content, 'span').filter(el => el.textContent?.includes(text));
  assert.ok(spans.some(span => {
    const name = attr(span, 'style-name');
    if (expectedStyle && name !== expectedStyle) return false;
    return styles.some(style => attr(style, 'name') === name && hasProperty(style, property[0]!, property[1]!));
  }), 'Sample does not have the required ODT text property');
}

export function registerFormattingExportContracts(): void {
  test('canonical imported marks have explicit cross-format rendering contracts', async t => {
    const bytes = readFileSync(new URL('./fixtures/omi-formatting-master-test.docx', import.meta.url));
    const plan = await parseDocxForStudio(new File([new Uint8Array(bytes)], 'omi-formatting-master-test.docx'));
    const blocks = plan.sections.flatMap(section => section.blocks);
    const specimen = (id: string) => {
      const block = blocks.find(b => b.content.includes(id + ' |'));
      assert.ok(block, 'Missing imported case ' + id);
      const manuscript = createTestManuscript();
      manuscript.sections = [{ id: 'case-section', title: 'Case ' + id, blocks: [structuredClone(block)] }];
      return manuscript;
    };
    for (const item of cases) {
      const manuscript = specimen(item.id);
      const html = renderHtmlArticle(manuscript).html;
      const jats = renderJatsArticle(manuscript).xml;
      const print = buildPdfPrintDocument(manuscript);
      const odtResult = buildOdtExport(manuscript);
      const odt = storedParts(odtResult.bytes);
      const idml = storedParts(buildIdmlExport(manuscript).bytes);
      // In C01 the fixture label and sample are both bold. An exporter may
      // combine their adjacent identical runs. Accept either boundary, but
      // still require the entire sample to be inside the exact semantic tag.
      const markedSample = (tag: string, attributes = '') => [sample, ...(item.id === 'C01' ? ['C01 | Félkövér – ' + sample] : [])]
        .map(text => '<' + tag + attributes + '>' + text + '</' + tag + '>');
      const htmlSamples = markedSample(item.html, item.id === 'C09' ? ' style="font-variant:small-caps"' : '');
      const jatsSamples = markedSample(item.jats);
      await t.test(item.id + ' HTML5 exact sample markup', () => assert.ok(htmlSamples.some(value => html.includes(value))));
      await t.test(item.id + ' JATS exact sample markup', () => assert.ok(jatsSamples.some(value => jats.includes(value))));
      await t.test(item.id + ' PDF print HTML exact sample markup', () => assert.ok(htmlSamples.some(value => print.includes(value))));
      await t.test(item.id + ' IDML applied style and definition', () => assertIdmlStyle(idml, sample, item.idml, item.idmlProperty));
      await t.test(item.id + ' ODT applied style and reimport', async () => {
        assertOdtStyle(odt, sample, item.odtProperty, item.odt ?? undefined);
        const reimport = await parseOdtForStudio(new File([new Uint8Array(odtResult.bytes)], 'case.odt'));
        const candidates = reimport.sections.flatMap(section => section.blocks).flatMap(block => {
          try { return nodes(JSON.parse(block.content) as RichNode); } catch { return []; }
        });
        assert.ok(candidates.some(n => n.text?.includes(sample) && n.marks?.some(m => m.type === item.mark)), 'ODT roundtrip lost the mark');
      });
    }

    const languages = [
      ['N01', 'hu-HU', 'Árvíztűrő tükörfúrógép'],
      ['N02', 'de-DE', 'Überlieferung und Quellenkritik'],
      ['N03', 'en-GB', 'Scholarly publishing'],
      ['N04', 'el-GR', 'Ελληνικά'],
      ['N05', 'he-IL', 'שלום עולם'],
      ['N06', 'ar-SA', 'مرحبا بالعالم'],
    ];
    for (const [id, lang, text] of languages) {
      const manuscript = specimen(id!);
      await t.test(id + ' HTML, JATS and PDF source language annotation', () => {
        const assertLanguage = (source: string) => {
          const document = new DOMParser().parseFromString(source, 'text/html') as unknown as Document;
          assert.ok(elements(document, 'span').some(span => attr(span, 'lang') === lang && span.textContent === text), 'Missing language annotation on exact sample: ' + lang);
        };
        assertLanguage(renderHtmlArticle(manuscript).html);
        assert.ok(renderJatsArticle(manuscript).xml.includes('<named-content xml:lang="' + lang + '">' + text + '</named-content>'));
        assertLanguage(buildPdfPrintDocument(manuscript));
      });
      await t.test(id + ' IDML applied language on the sample', () => {
        const parts = storedParts(buildIdmlExport(manuscript).bytes);
        const ranges = [...parts].filter(([name]) => /^Stories\/.*\.xml$/.test(name)).flatMap(([, source]) => elements(xml(source), 'CharacterStyleRange'));
        assert.equal(ranges.filter(el => attr(el, 'AppliedLanguage') === lang).map(el => el.textContent).join('').includes(text!), true);
      });
      await t.test(id + ' ODT language reimport', async () => {
        const result = buildOdtExport(manuscript);
        const plan = await parseOdtForStudio(new File([new Uint8Array(result.bytes)], 'language.odt'));
        const candidates = plan.sections.flatMap(s => s.blocks).flatMap(b => {
          try { return nodes(JSON.parse(b.content) as RichNode); } catch { return []; }
        });
        assert.ok(candidates.some(n => n.text?.includes(text!) && n.marks?.some(m => m.type === 'omiLanguage' && m.attrs?.lang === lang)));
      });
    }

    await t.test('N09 native line-break mapping in HTML, PDF source and ODT', async () => {
      const manuscript = specimen('N09');
      const html = renderHtmlArticle(manuscript).html;
      assert.match(html, /Első sor<br>Második sor/);
      assert.match(buildPdfPrintDocument(manuscript), /Első sor<br>Második sor/);
      const odt = buildOdtExport(manuscript);
      assert.match(part(storedParts(odt.bytes), 'content.xml'), /Első sor<text:line-break\/>Második sor/);
      const plan = await parseOdtForStudio(new File([new Uint8Array(odt.bytes)], 'break.odt'));
      assert.ok(plan.sections.flatMap(s => s.blocks).some(b => {
        try { return textContent(JSON.parse(b.content) as RichNode).includes('Első sor\nMásodik sor'); } catch { return false; }
      }));
    });
    await t.test('N09 JATS keeps the line-break character without inventing a visual layout', () => {
      const source = renderJatsArticle(specimen('N09')).xml;
      assert.ok(elements(xml(source), 'p').some(p => p.textContent?.includes('Első sor\nMásodik sor')), 'Decoded XML paragraph must preserve the exact line break');
    });
  });
}

test('native ODT baseline shift and kerning, and IDML ligature flags are applied to actual runs', async () => {
  const manuscript = createTestManuscript();
  const run = (text: string, values: Record<string, string | number>): RichNode => ({
    type: 'text', text, marks: Object.entries(values).map(([type,value]) => ({type,attrs:{value}})),
  });
  manuscript.sections[0]!.blocks[0]!.content = JSON.stringify({ type:'doc', content:[{type:'paragraph',content:[
    run('Raised specimen', {omiFontSize:12,omiBaseline:3,omiKerning:0,omiLigatures:'standardDiscretional'}),
    run('Lowered specimen', {omiFontSize:12,omiBaseline:-2,omiKerning:12,omiLigatures:'none'}),
    run('Context specimen', {omiLigatures:'standardContextual'}),
    run('Unformatted specimen', {}),
  ]}]});
  const odt = buildOdtExport(manuscript);
  const odtParts = storedParts(odt.bytes);
  assertOdtStyle(odtParts,'Raised specimen',['text-position','25% 100%']);
  assertOdtStyle(odtParts,'Raised specimen',['letter-kerning','false']);
  assertOdtStyle(odtParts,'Lowered specimen',['text-position','-16.6667% 100%']);
  assertOdtStyle(odtParts,'Lowered specimen',['letter-kerning','true']);
  assert.ok(odt.warnings.some(w=>w.includes('no exact ODT mapping')));
  const reopened = await parseOdtForStudio(new File([new Uint8Array(odt.bytes)],'advanced.odt'));
  const texts = reopened.sections.flatMap(s=>s.blocks).flatMap(b=>{
    try { return nodes(JSON.parse(b.content) as RichNode); } catch { return []; }
  });
  for (const [text,shift] of [['Raised specimen',3],['Lowered specimen',-2]] as const) {
    const actual = texts.find(n=>n.text?.includes(text));
    assert.ok(actual);
    assert.equal(actual.marks?.find(m=>m.type==='omiBaseline')?.attrs?.value,shift);
    assert.ok(!actual.marks?.some(m=>['omiSuperscript','omiSubscript'].includes(m.type)));
  }
  assert.equal(texts.find(n=>n.text?.includes('Raised specimen'))?.marks?.find(m=>m.type==='omiKerning')?.attrs?.value,0);
  assert.ok(!texts.find(n=>n.text?.includes('Lowered specimen'))?.marks?.some(m=>m.type==='omiKerning'));
  const idml = buildIdmlExport(manuscript);
  const ranges = [...storedParts(idml.bytes)].filter(([name])=>/^Stories\/.*\.xml$/.test(name)).flatMap(([,source])=>elements(xml(source),'CharacterStyleRange'));
  const range = (text:string) => {
    const actual = ranges.find(el=>el.textContent?.includes(text));
    assert.ok(actual, text); return actual;
  };
  assert.equal(attr(range('Raised specimen'),'Ligatures'),'true');
  assert.equal(attr(range('Raised specimen'),'OTFDiscretionaryLigature'),'true');
  assert.equal(attr(range('Raised specimen'),'KerningMethod'),'$ID/None');
  assert.equal(attr(range('Lowered specimen'),'Ligatures'),'false');
  assert.equal(attr(range('Lowered specimen'),'OTFDiscretionaryLigature'),'false');
  assert.equal(attr(range('Lowered specimen'),'KerningMethod'),'$ID/Metrics');
  assert.equal(attr(range('Context specimen'),'Ligatures'),'true');
  assert.equal(attr(range('Context specimen'),'OTFDiscretionaryLigature'),'false');
  assert.equal(attr(range('Context specimen'),'OTFContextualAlternate'),undefined);
  assert.equal(attr(range('Unformatted specimen'),'Ligatures'),undefined);
  assert.ok(idml.warnings.some(w=>w.includes('no exact IDML mapping')));
});

test('IDML native table geometry, rich cell text, resources and nested table order',async()=>{
  const {createTableBlock}=await import('../src/model/visualBlocks.ts');
  const {tableCellPlainText}=await import('../src/model/tableLayout.ts');
  const {createNoteAnnotation}=await import('../src/model/notes.ts');
  const manuscript=createTestManuscript();
  const paragraph=(text:string)=>({type:'paragraph',content:[{type:'text',text}]});
  const doc={type:'doc',content:[
    {type:'paragraph',attrs:{omiAlign:'justify',omiSpaceAfter:5},content:[{type:'text',text:'Before nested',marks:[{type:'bold'},{type:'omiSourceFont',attrs:{family:'Noto Serif'}},{type:'omiFontSize',attrs:{value:13}}]},{type:'omiNote',attrs:{noteId:'cell-note',anchorId:'cell-anchor',label:'1',noteType:'footnote'}},{type:'text',text:' PRIVATE SPECIMEN',marks:[{type:'omiHiddenText',attrs:{value:true}}]}]},
    {type:'omiCellTable',attrs:{table:{kind:'table',headerRows:0,cells:[['Inner A','Inner B']]}}},
    paragraph('After nested'),
    {type:'orderedList',attrs:{start:4},content:[{type:'listItem',content:[paragraph('List item')]}]}
  ]};
  const block=createTableBlock([['Header',''],[tableCellPlainText(doc),''],['','Last']],{
    headerRows:1,cellMerges:[{row:0,column:0,rowSpan:1,colSpan:2},{row:1,column:0,rowSpan:2,colSpan:1}],
    cellContent:{'1:0':JSON.stringify(doc)},cellFormats:{'0:0':{backgroundColor:'#AABBCC',verticalAlign:'middle',textRotation:90,paddingPt:{top:3,left:5},borders:{bottom:{style:'dotted',widthPt:1,color:'#112233'},right:{style:'none'}}}},
    rowHeights:{'0':{mode:'minimum',heightPt:24},'2':{mode:'exact',heightPt:30}},
    rowSplitOverrides:{'1':'allow'}
  },'native-idml-table');
  assert.ok(block.visual?.kind==='table');
  block.visual.columnWidths=[30,70];
  manuscript.sections[0]!.blocks.push(block);
  manuscript.annotations.push(createNoteAnnotation({id:'cell-note',anchorId:'cell-anchor',targetBlockId:block.id,kind:'footnote',body:'Cell note body'}));
  const result=buildIdmlExport(manuscript);
  const parts=storedParts(result.bytes);
  const story=xml([...parts].find(([name])=>/^Stories\/.*\.xml$/.test(name))![1]);
  const tables=elements(story,'Table');
  assert.equal(tables.length,2);
  const outer=tables[0]!,inner=tables[1]!;
  assert.equal(attr(outer,'HeaderRowCount'),'1');
  assert.equal(attr(outer,'BodyRowCount'),'2');
  assert.equal(attr(outer,'ColumnCount'),'2');
  const direct=(node:Element,name:string)=>Array.from(node.childNodes).filter((child):child is Element=>child.nodeType===1&&(child as Element).localName===name);
  const rows=direct(outer,'Row');
  assert.equal(rows.length,3);
  assert.equal(attr(rows[0]!,'MinimumHeight'),'24');
  assert.equal(attr(rows[0]!,'AutoGrow'),'true');
  assert.equal(attr(rows[2]!,'AutoGrow'),'false');
  assert.equal(attr(rows[2]!,'SingleRowHeight'),'30');
  const cols=direct(outer,'Column');
  assert.equal(cols.length,2);
  assert.ok(Math.abs(Number(attr(cols[0]!,'SingleColumnWidth'))/Number(attr(cols[1]!,'SingleColumnWidth'))-30/70)<0.00001);
  const cells=direct(outer,'Cell');
  assert.deepEqual(cells.map(c=>attr(c,'Name')),['0:0','0:1','1:1','1:2']);
  const header=cells[0]!,cell=cells[1]!;
  assert.equal(attr(header,'ColumnSpan'),'2');
  assert.equal(attr(cell,'RowSpan'),'2');
  assert.equal(attr(header,'FillColor'),'Color/OMI-AABBCC');
  assert.equal(attr(header,'VerticalJustification'),'CenterAlign');
  assert.equal(attr(header,'RotationAngle'),'270');
  assert.equal(attr(header,'TopInset'),'3');
  assert.equal(attr(header,'LeftInset'),'5');
  assert.equal(attr(header,'BottomEdgeStrokeType'),'StrokeStyle/$ID/Canned Dotted');
  assert.equal(attr(header,'RightEdgeStrokeWeight'),'0');
  assert.equal(attr(cell,'Name'),'0:1');
  assert.equal(elements(cell,'Table')[0],inner);
  const paragraphs=direct(cell,'ParagraphStyleRange');
  assert.equal(paragraphs.length,4);
  assert.ok(paragraphs[0]!.textContent?.includes('Before nested'));
  assert.equal(attr(paragraphs[0]!,'Justification'),'LeftJustified');
  assert.equal(attr(paragraphs[0]!,'SpaceAfter'),'5');
  assert.ok(paragraphs[2]!.textContent?.includes('After nested'));
  assert.equal(attr(paragraphs[3]!,'BulletsAndNumberingListType'),'NumberedList');
  assert.equal(attr(paragraphs[3]!,'NumberingStartAt'),'4');
  assert.deepEqual(elements(paragraphs[3]!,'Content').map(el=>el.textContent),['List item']);
  assert.equal(elements(paragraphs[3]!,'NumberingFormat')[0]?.textContent,'1, 2, 3, 4...');
  const marked=elements(paragraphs[0]!,'CharacterStyleRange').find(el=>el.textContent?.includes('Before nested'));
  assert.ok(marked);
  assert.equal(attr(marked,'PointSize'),'13');
  assert.ok(hasProperty(marked,'AppliedFont','Noto Serif'));
  assert.ok(hasProperty(marked,'AppliedCharacterStyle','CharacterStyle/OMI Strong'));
  assert.ok(cell.textContent?.includes('[T1]'));
  assert.ok(story.documentElement.textContent?.includes('T1. Cell note body'));
  assert.equal(elements(cell,'Footnote').length,0);
  const styles=xml(part(parts,'Resources/Styles.xml'));
  assert.ok(elements(styles,'TableStyle').some(el=>attr(el,'Self')===attr(outer,'AppliedTableStyle')));
  assert.ok(elements(styles,'CellStyle').some(el=>attr(el,'Self')===attr(cell,'AppliedCellStyle')));
  const graphics=xml(part(parts,'Resources/Graphic.xml'));
  assert.ok(elements(graphics,'Color').some(el=>attr(el,'Self')==='Color/OMI-AABBCC'));
  assert.ok(elements(graphics,'StrokeStyle').some(el=>attr(el,'Self')==='StrokeStyle/$ID/Canned Dotted'));
  assert.ok(elements(xml(part(parts,'Resources/Fonts.xml')),'FontFamily').some(el=>attr(el,'Name')==='Noto Serif'));
  assert.ok(![...parts.values()].some(value=>value.includes('PRIVATE SPECIMEN')));
  assert.ok(result.semanticLosses.some(loss=>loss.targetId===block.id&&loss.code==='table-note-projected-as-text'));
  assert.ok(!result.semanticLosses.some(loss=>loss.targetId===block.id&&loss.code==='table-list-projected-as-text'));
  assert.ok(result.semanticLosses.some(loss=>loss.targetId===block.id&&loss.code==='table-row-split-not-preserved'));
  assert.ok(!result.warnings.some(w=>w.includes('Structured table object')));
  const ids=elements(story,'Table').flatMap(t=>[attr(t,'Self'),...['Row','Column','Cell'].flatMap(name=>direct(t,name).map(el=>attr(el,'Self')))]);
  assert.equal(new Set(ids).size,ids.length);
});

test('IDML table export/import roundtrip preserves geometry, source order and cell presentation',async()=>{
  const {createTableBlock}=await import('../src/model/visualBlocks.ts');
  const {tableCellPlainText,tableCellDocument,cellNestedTable}=await import('../src/model/tableLayout.ts');
  const {importIdmlTables}=await import('../src/services/idmlTableImport.ts');
  const doc={type:'doc',content:[
    {type:'paragraph',attrs:{omiSpaceAfter:5,omiAlign:'justify'},content:[{type:'text',text:'Before',marks:[{type:'bold'},{type:'omiFontSize',attrs:{value:13}},{type:'omiSourceFont',attrs:{family:'Noto Serif'}}]}]},
    {type:'omiCellTable',attrs:{table:{kind:'table',headerRows:0,cells:[['A','B']]}}},
    {type:'paragraph',content:[{type:'text',text:'After'}]}
  ]};
  const block=createTableBlock([['Header',''],[tableCellPlainText(doc),'Other'],['','Last']],{
    headerRows:1,cellMerges:[{row:0,column:0,rowSpan:1,colSpan:2},{row:1,column:0,rowSpan:2,colSpan:1}],
    cellContent:{'1:0':JSON.stringify(doc)},cellFormats:{'0:0':{backgroundColor:'#AABBCC',verticalAlign:'middle',textRotation:90,paddingPt:{top:3,left:5},borders:{bottom:{style:'dotted',widthPt:1,color:'#112233'},right:{style:'none'}}}},
    rowHeights:{'0':{mode:'minimum',heightPt:24},'2':{mode:'exact',heightPt:30}}
  });
  assert.ok(block.visual?.kind==='table');
  block.visual.columnWidths=[30,70];
  const manuscript=createTestManuscript();
  manuscript.sections[0]!.blocks.push(block);
  const bytes=buildIdmlExport(manuscript).bytes;
  const imported=await importIdmlTables(new File([new Uint8Array(bytes)],'roundtrip.idml'));
  assert.equal(imported.blocks.length,1);
  const table=imported.blocks[0]?.visual;
  assert.ok(table?.kind==='table');
  assert.deepEqual(table.cells,block.visual.cells);
  assert.deepEqual(table.cellMerges,block.visual.cellMerges);
  assert.equal(table.headerRows,1);
  assert.ok(Math.abs(table.columnWidths![0]!-30)<0.001);
  assert.deepEqual(table.rowHeights,block.visual.rowHeights);
  assert.equal(table.cellFormats?.['0:0']?.backgroundColor,'#AABBCC');
  assert.equal(table.cellFormats?.['0:0']?.textRotation,90);
  assert.equal(table.cellFormats?.['0:0']?.verticalAlign,'middle');
  assert.deepEqual(table.cellFormats?.['0:0']?.paddingPt,{top:3,left:5});
  assert.deepEqual(table.cellFormats?.['0:0']?.borders,{bottom:{style:'dotted',widthPt:1,color:'#112233'},right:{style:'none'}});
  const reopened=tableCellDocument(table,1,0);
  assert.ok(reopened);
  assert.deepEqual(reopened.content?.map(node=>node.type),['paragraph','omiCellTable','paragraph']);
  assert.deepEqual(cellNestedTable(reopened.content![1]!)?.cells,[['A','B']]);
  assert.equal(reopened.content?.[0]?.attrs?.omiSpaceAfter,5);
  assert.equal(reopened.content?.[0]?.attrs?.omiAlign,'justify');
  const marks=reopened.content?.[0]?.content?.[0]?.marks;
  assert.ok(marks?.some(m=>m.type==='bold'));
  assert.ok(marks?.some(m=>m.type==='omiSourceFont'&&m.attrs?.family==='Noto Serif'));
  assert.ok(marks?.some(m=>m.type==='omiFontSize'&&m.attrs?.value===13));
  assert.equal(table.provenance?.sourceFormat,'idml');
  assert.match(table.provenance?.sourcePart??'',/^Stories\//);
});
test('IDML importer resolves inherited styles and rejects malformed geometry, DTD and excessive dimensions',async()=>{
  const {importIdmlTables}=await import('../src/services/idmlTableImport.ts');
  const {createStoreZip,textZipEntry}=await import('../src/services/simpleZip.ts');
  const make=(story:string,design='<Document><Story src="Stories/Story_test.xml"/></Document>')=>new File([new Uint8Array(createStoreZip([
    textZipEntry('designmap.xml',design),
    textZipEntry('Stories/Story_test.xml',story),
    textZipEntry('Resources/Styles.xml','<Styles><CellStyle Self="base" TopInset="5"/><CellStyle Self="derived" BasedOn="base" VerticalJustification="BottomAlign"/><ParagraphStyle Self="p" Justification="RightAlign"/><CharacterStyle Self="char" FontStyle="Bold" PointSize="15"/></Styles>')
  ]))],'fixture.idml');
  const tbl=(cell:string)=>'<Story><Table HeaderRowCount="0" BodyRowCount="1" ColumnCount="1"><Row Name="0" AutoGrow="true"/><Column Name="0" SingleColumnWidth="100"/>'+cell+'</Table></Story>';
  const cell='<Cell Name="0:0" AppliedCellStyle="derived"><ParagraphStyleRange AppliedParagraphStyle="p"><CharacterStyleRange AppliedCharacterStyle="char"><Content>Hello</Content><Br/></CharacterStyleRange></ParagraphStyleRange></Cell>';
  const result=await importIdmlTables(make(tbl(cell)));
  const table=result.blocks[0]?.visual;
  assert.ok(table?.kind==='table');
  assert.deepEqual(table.cells,[['Hello']]);
  assert.equal(table.cellFormats?.['0:0']?.verticalAlign,'bottom');
  assert.equal(table.cellFormats?.['0:0']?.paddingPt?.top,5);
  const rich=JSON.parse(table.cellContent!['0:0']!);
  assert.equal(rich.content[0].attrs.omiAlign,'right');
  assert.ok(rich.content[0].content[0].marks.some((m:{type:string})=>m.type==='bold'));
  await assert.rejects(importIdmlTables(make(tbl(cell+cell))),/Overlapping/);
  await assert.rejects(importIdmlTables(make(tbl(''))),/Incomplete/);
  await assert.rejects(importIdmlTables(make(tbl(cell).replace('ColumnCount="1"','ColumnCount="10001"'))),/quota/);
  await assert.rejects(importIdmlTables(make(tbl(cell),'<!DOCTYPE Document [<!ENTITY e "bad">]><Document>&e;</Document>')),/declarations/);
  await assert.rejects(importIdmlTables(make(tbl(cell),'<Document><Story src="../external.xml"/></Document>')),/story reference/);
});

test('IDML native cell lists keep independent numbering, list levels, restarts and continuation paragraphs',async()=>{
  const {createTableBlock}=await import('../src/model/visualBlocks.ts');
  const {tableCellPlainText}=await import('../src/model/tableLayout.ts');
  const p=(text:string)=>({type:'paragraph',content:[{type:'text',text}]});
  const item=(...content:unknown[])=>({type:'listItem',content});
  const list={type:'orderedList',attrs:{start:4,omiListFormat:'upperRoman',omiListLabel:'(%1)',omiListLeft:720,omiListHanging:360},content:[
    item(p('First'),p('Continuation'),{type:'orderedList',attrs:{start:2,omiListFormat:'lowerLetter',omiListLevel:1,omiListLabel:'%2)'},content:[item(p('Nested first')),item(p('Nested second'))]}),
    item(p('Second'))
  ]};
  const doc={type:'doc',content:[list,{type:'bulletList',attrs:{omiListLabel:'▪'},content:[item(p('Bullet'))]},{type:'orderedList',attrs:{start:7,omiListOverrideStart:9,omiListFormat:'decimalZero'},content:[item(p('Restart'))]},{type:'orderedList',attrs:{omiListFormat:'none'},content:[item(p('Unnumbered'))]}]};
  const other={type:'doc',content:[{type:'orderedList',attrs:{start:1,omiListLabel:'%1.%2.'},content:[item(p('Other cell'))]}]};
  const block=createTableBlock([['','']],{headerRows:0,cellContent:{'0:0':JSON.stringify(doc),'0:1':JSON.stringify(other)}},'native-cell-lists');
  assert.ok(block.visual?.kind==='table');
  // The block model stores literal cell text without generated list labels.
  const {parseTableCellContent}=await import('../src/model/tableLayout.ts');
  block.visual.cells=[[tableCellPlainText(parseTableCellContent(JSON.stringify(doc))!),tableCellPlainText(parseTableCellContent(JSON.stringify(other))!)]];
  block.visual.cellContent={'0:0':JSON.stringify(doc),'0:1':JSON.stringify(other)};
  const manuscript=createTestManuscript();
  manuscript.sections[0]!.blocks.push(block);
  const exported=buildIdmlExport(manuscript);
  const parts=storedParts(exported.bytes);
  const story=xml([...parts].find(([name])=>/^Stories\/.*\.xml$/.test(name))![1]);
  const cells=elements(story,'Cell');
  const paragraphs=elements(cells[0]!,'ParagraphStyleRange');
  const byText=(text:string)=>paragraphs.find(el=>elements(el,'Content').map(n=>n.textContent).join('')===text)!;
  const first=byText('First'),second=byText('Second'),nested=byText('Nested first'),nestedSecond=byText('Nested second');
  const listId=(el:Element)=>elements(el,'AppliedNumberingList')[0]?.textContent;
  assert.equal(attr(first,'NumberingExpression'),'(^#)^t');
  assert.equal(attr(first,'NumberingStartAt'),'4');
  assert.equal(attr(first,'NumberingContinue'),'false');
  assert.equal(attr(second,'NumberingContinue'),'true');
  assert.equal(attr(first,'NumberingLevel'),'1');
  assert.equal(attr(first,'LeftIndent'),'36');
  assert.equal(attr(first,'FirstLineIndent'),'-18');
  assert.equal(elements(first,'NumberingFormat')[0]?.textContent,'I, II, III, IV...');
  assert.equal(listId(first),listId(second));
  assert.equal(attr(nested,'NumberingLevel'),'2');
  assert.equal(attr(nested,'NumberingStartAt'),'2');
  assert.equal(attr(nested,'NumberingExpression'),'^#)^t');
  assert.equal(attr(nestedSecond,'NumberingContinue'),'true');
  assert.notEqual(listId(first),listId(nested));
  assert.equal(attr(byText('Continuation'),'BulletsAndNumberingListType'),'NoList');
  assert.equal(attr(byText('Bullet'),'BulletsAndNumberingListType'),'BulletList');
  assert.equal(attr(elements(byText('Bullet'),'BulletChar')[0]!,'BulletCharacterValue'),'9642');
  assert.equal(attr(byText('Restart'),'NumberingStartAt'),'9');
  assert.equal(elements(byText('Restart'),'NumberingFormat')[0]?.textContent,'01, 02, 03, 04...');
  assert.equal(attr(byText('Unnumbered'),'BulletsAndNumberingListType'),'NoList');
  const otherParagraph=elements(cells[1]!,'ParagraphStyleRange')[0]!;
  assert.notEqual(listId(first),listId(otherParagraph));
  assert.equal(attr(otherParagraph,'NumberingExpression'),'^#.^t');
  assert.ok(exported.semanticLosses.some(loss=>loss.targetId===block.id&&loss.code==='table-list-pattern-partial'));
  const definitions=elements(xml(part(parts,'designmap.xml')),'NumberingList').map(el=>attr(el,'Self'));
  assert.equal(new Set(definitions).size,definitions.length);
  for(const el of elements(story,'AppliedNumberingList'))assert.ok(definitions.includes(el.textContent??''));
  assert.deepEqual(elements(cells[0]!,'Content').map(el=>el.textContent),['First','Continuation','Nested first','Nested second','Second','Bullet','Restart','Unnumbered']);
  const {importIdmlTables}=await import('../src/services/idmlTableImport.ts');
  const imported=await importIdmlTables(new File([new Uint8Array(exported.bytes)],'native-lists.idml'));
  const importedTable=imported.blocks[0]?.visual;
  assert.ok(importedTable?.kind==='table');
  assert.deepEqual(importedTable.cells,block.visual.cells);
  const {tableCellDocument}=await import('../src/model/tableLayout.ts');
  const restored=tableCellDocument(importedTable,0,0);
  assert.ok(restored);
  assert.deepEqual(restored.content?.map(n=>n.type),['orderedList','bulletList','orderedList','paragraph']);
  const root=restored.content![0]!;
  assert.equal(root.attrs?.start,4);
  assert.equal(root.attrs?.omiListFormat,'upperRoman');
  assert.equal(root.attrs?.omiListLabel,'(%1)');
  assert.equal(root.attrs?.omiListLeft,720);
  assert.equal(root.attrs?.omiListHanging,360);
  assert.equal(root.content?.length,2);
  const firstItem=root.content![0]!;
  assert.deepEqual(firstItem.content?.map(n=>n.type),['paragraph','paragraph','orderedList']);
  const sublist=firstItem.content![2]!;
  assert.equal(sublist.attrs?.start,2);
  assert.equal(sublist.attrs?.omiListLevel,1);
  assert.equal(sublist.attrs?.omiListFormat,'lowerLetter');
  assert.equal(sublist.attrs?.omiListLabel,'%2)');
  assert.equal(sublist.content?.length,2);
  assert.equal(restored.content![1]!.attrs?.omiListLabel,'▪');
  assert.equal(restored.content![2]!.attrs?.start,9);
  assert.equal(restored.content![2]!.attrs?.omiListOverrideStart,9);
  assert.equal(restored.content![2]!.attrs?.omiListFormat,'decimalZero');
  assert.equal(restored.content![3]!.content?.[0]?.text,'Unnumbered');
  assert.ok(!imported.warnings.includes('native-list-structure-not-imported'));
});

test('IDML import reconstructs inherited native list properties, explicit restart and safe partial mappings',async()=>{
  const {importIdmlTables}=await import('../src/services/idmlTableImport.ts');
  const {createStoreZip,textZipEntry}=await import('../src/services/simpleZip.ts');
  const {tableCellDocument}=await import('../src/model/tableLayout.ts');
  const para=(text:string,attrs='',properties='')=>'<ParagraphStyleRange '+attrs+'>'+properties+'<CharacterStyleRange AppliedCharacterStyle="CharacterStyle/$ID/[None]"><Content>'+text+'</Content><Br/></CharacterStyleRange></ParagraphStyleRange>';
  const props=(id:string)=>'<Properties><AppliedNumberingList type="object">'+id+'</AppliedNumberingList></Properties>';
  const source='<Story><Table HeaderRowCount="0" BodyRowCount="1" ColumnCount="2"><Row Name="0" AutoGrow="true"/><Column Name="0" SingleColumnWidth="100"/><Column Name="1" SingleColumnWidth="100"/><Cell Name="0:0">'+
    para('One','AppliedParagraphStyle="derived" NumberingContinue="false" NumberingStartAt="3"')+
    para('Plain paragraph','BulletsAndNumberingListType="NoList" LeftIndent="36"')+
    para('Continued sequence','AppliedParagraphStyle="derived" NumberingContinue="true"')+
    para('Restart','AppliedParagraphStyle="derived" NumberingContinue="false" NumberingStartAt="8"')+
    para('Continuation body','BulletsAndNumberingListType="NoList"',props('NumberingList/Shared'))+
    para('Sub bullet','BulletsAndNumberingListType="BulletList" NumberingLevel="2"','<Properties><BulletChar BulletCharacterType="UnicodeOnly" BulletCharacterValue="8226"/></Properties>')+
    para('Another bullet','BulletsAndNumberingListType="BulletList" NumberingLevel="2"','<Properties><BulletChar BulletCharacterType="UnicodeOnly" BulletCharacterValue="8226"/></Properties>')+
    para('Parent resumes','AppliedParagraphStyle="derived" NumberingContinue="true"')+
    '</Cell><Cell Name="1:0">'+para('Cross cell','AppliedParagraphStyle="derived" NumberingContinue="true"')+
    para('Unknown pattern','BulletsAndNumberingListType="NumberedList" NumberingContinue="false" NumberingExpression="^1.^#.^t" NumberingLevel="1"','<Properties><NumberingFormat type="string">Unknown</NumberingFormat></Properties>')+
    '</Cell></Table></Story>';
  const styles='<Styles><ParagraphStyle Self="base" BulletsAndNumberingListType="NumberedList" NumberingLevel="1" LeftIndent="36" FirstLineIndent="-18" NumberingExpression="^#)^t"><Properties><NumberingFormat type="string">I, II, III, IV...</NumberingFormat><AppliedNumberingList type="object">NumberingList/Shared</AppliedNumberingList></Properties></ParagraphStyle><ParagraphStyle Self="derived" BasedOn="base"/></Styles>';
  const bytes=createStoreZip([textZipEntry('designmap.xml','<Document><NumberingList Self="NumberingList/Shared"/><Story src="Stories/Story_test.xml"/></Document>'),textZipEntry('Stories/Story_test.xml',source),textZipEntry('Resources/Styles.xml',styles)]);
  const imported=await importIdmlTables(new File([new Uint8Array(bytes)],'external-list.idml'));
  const table=imported.blocks[0]?.visual;
  assert.ok(table?.kind==='table');
  assert.deepEqual(table.cells,[['One\nPlain paragraph\nContinued sequence\nRestart\nContinuation body\nSub bullet\nAnother bullet\nParent resumes','Cross cell\nUnknown pattern']]);
  const doc=tableCellDocument(table,0,0)!;
  assert.deepEqual(doc.content?.map(n=>n.type),['orderedList','paragraph','orderedList','orderedList']);
  const [initial,plain,continued,restarted]=doc.content!;
  assert.equal(initial!.attrs?.start,3);
  assert.equal(initial!.attrs?.omiListFormat,'upperRoman');
  assert.equal(initial!.attrs?.omiListLabel,'%1)');
  assert.equal(plain!.content?.[0]?.text,'Plain paragraph');
  assert.equal(continued!.attrs?.start,4);
  assert.equal(restarted!.attrs?.start,8);
  assert.equal(restarted!.content?.length,2);
  assert.equal(initial!.attrs?.omiListId,restarted!.attrs?.omiListId);
  assert.deepEqual(restarted!.content![0]!.content?.map(n=>n.type),['paragraph','paragraph','bulletList']);
  assert.equal(restarted!.content![0]!.content![2]!.content?.length,2);
  assert.ok(imported.warnings.includes('native-list-cross-cell-continuation'));
  assert.ok(imported.warnings.includes('native-list-pattern-partial'));
  assert.ok(imported.warnings.includes('native-list-format-partial'));
});
