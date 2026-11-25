import assert from 'node:assert/strict';
import test from 'node:test';
import { pruneTableCellFormats, resizeTableColumn, tableCellFormat, tableCellTextStyle, tableColumnWidths } from '../src/model/tableLayout.ts';
import { createTableBlock } from '../src/model/visualBlocks.ts';
import { renderHtmlArticle } from '../src/services/exportHtml.ts';
import { serializeOmiJson } from '../src/services/exportOmi.ts';
import { parseOmiJson } from '../src/services/omiPortableFormat.ts';
import { buildPdfPrintDocument } from '../src/services/exportPdf.ts';
import { createVersionedTestManuscript } from './testManuscriptFixture.ts';

test('relative widths survive viewport changes and malformed widths fall back safely', () => {
  const cells = [['A', 'B', 'C']];
  assert.deepEqual(tableColumnWidths(cells, [20, 30, 50]), [20, 30, 50]);
  for (const widths of [undefined, [100], [NaN, 1, 1], [-1, 2, 3]]) {
    const result = tableColumnWidths(cells, widths);
    assert.equal(result.length, 3);
    assert.ok(Math.abs(result.reduce((sum, width) => sum + width, 0) - 100) < 0.0001);
    assert.ok(result.every((width) => width > 0));
  }
  assert.deepEqual(tableColumnWidths([], []), []);
  assert.ok(tableColumnWidths(cells, [Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE]).every(Number.isFinite));
});

test('resizing a boundary preserves total width and both neighboring cells', () => {
  assert.deepEqual(resizeTableColumn([20, 30, 50], 0, 35), [35, 15, 50]);
  assert.deepEqual(resizeTableColumn([20, 30, 50], 0, 100), [47, 3, 50]);
  assert.deepEqual(resizeTableColumn([20, 30, 50], 0, -20), [3, 47, 50]);
  assert.deepEqual(resizeTableColumn([20, 30, 50], 2, 5), [20, 30, 50]);
});

test('OMI round trip retains column widths, font choice and multiline scholarly text', () => {
  const manuscript = createVersionedTestManuscript();
  const table = createTableBlock([['Name', 'Description'], ['A', 'First line\nSecond <line>']], {}, 'table-layout');
  if (table.visual?.kind !== 'table') throw new Error('Expected table');
  table.visual.columnWidths = [30, 70];
  table.visual.fontSizeReduction = 0;
  manuscript.sections[0]!.blocks.push(table);
  const reopened = parseOmiJson(serializeOmiJson(manuscript));
  assert.deepEqual(reopened.sections[0]!.blocks.at(-1)!.visual, JSON.parse(JSON.stringify(table.visual)));
  const result = renderHtmlArticle(reopened);
  assert.ok(result.validForExport);
  assert.match(result.html, /<col style="width:30%"><col style="width:70%">/);
  assert.match(result.html, /--omi-table-font-reduction:0/);
  assert.match(result.html, /First line&#10;Second &lt;line&gt;/);
  assert.match(result.html, /<thead><tr><th scope="col">Name/);
  assert.match(result.html, /overflow-wrap: anywhere; white-space: pre-wrap/);
  for (const contentMode of ['editorial', 'publication'] as const) {
    const pdf = buildPdfPrintDocument(reopened, undefined, 'print', contentMode);
    assert.match(pdf, /figure\.scholarly-table, \.scholarly-table table/);
    assert.match(pdf, /display: table-header-group/);
  }
});

test('cell rotation and bidi direction survive OMI exchange and reach the matching exported cell', () => {
  const manuscript = createVersionedTestManuscript();
  const block = createTableBlock([['Header', 'Other'], ['שלום', 'Unchanged']], {}, 'direction-table');
  if (block.visual?.kind !== 'table') throw new Error('Expected table');
  block.visual.cellFormats = { '0:0': { textRotation: 90, textDirection: 'ltr' }, '1:0': { textRotation: -90, textDirection: 'rtl' } };
  manuscript.sections[0]!.blocks.push(block);
  const reopened = parseOmiJson(serializeOmiJson(manuscript));
  assert.deepEqual(reopened.sections[0]!.blocks.at(-1)!.visual, JSON.parse(JSON.stringify(block.visual)));
  for (const html of [renderHtmlArticle(reopened).html, buildPdfPrintDocument(reopened)]) {
    assert.match(html, /<th scope="col"><span class="omi-table-cell-text" dir="ltr" data-text-rotation="90"/);
    assert.match(html, /<td><span class="omi-table-cell-text" dir="rtl" data-text-rotation="-90"/);
    assert.match(html, /writing-mode:vertical-rl;text-orientation:sideways;transform:rotate\(180deg\)/);
    assert.match(html, /שלום<\/span>/);
    assert.match(html, /<td>Unchanged<\/td>/);
  }
});

test('cell formats sanitize unknown values and drop deleted row/column coordinates', () => {
  assert.deepEqual(tableCellFormat(undefined, 0, 0), { textRotation: 0, textDirection: 'auto' });
  assert.deepEqual(tableCellFormat(JSON.parse('{"0:0":{"textRotation":45,"textDirection":"invalid"}}'), 0, 0), { textRotation: 0, textDirection: 'auto' });
  assert.deepEqual(pruneTableCellFormats([['A']], { '0:0': { textRotation: 180 }, '0:1': { textDirection: 'rtl' }, '1:0': { textRotation: 90 } }), { '0:0': { textRotation: 180 } });
  assert.equal(tableCellTextStyle(180).transform, 'rotate(180deg)');
  assert.equal(tableCellTextStyle(90).writingMode, 'vertical-rl');
});


test('native table header counts are bounded and do not mutate cells', async () => {
  const {tableHeaderRows}=await import('../src/model/tableLayout.ts');
  const cells=[['H'],['A']];
  for(const value of [undefined,NaN,Infinity,-1,'2']) assert.equal(tableHeaderRows(cells,value),0);
  assert.equal(tableHeaderRows(cells,1.9),1);
  assert.equal(tableHeaderRows(cells,8),2);
  assert.deepEqual(cells,[['H'],['A']]);
});

test('cell merges retain the matrix and reject overlap, nonempty cells and header crossing', async () => {
  const {extendTableMerge,splitTableMerge,tableMergeLayout}=await import('../src/model/tableLayout.ts');
  const cells=[['Header',''],['Anchor',''],['','']];
  const horizontal=extendTableMerge(cells,undefined,0,0,'right',1);
  assert.deepEqual(horizontal,[{row:0,column:0,rowSpan:1,colSpan:2}]);
  assert.equal(extendTableMerge(cells,horizontal,0,0,'down',1),undefined);
  const vertical=extendTableMerge(cells,horizontal,1,0,'down',1);
  assert.ok(vertical);
  const rectangle=extendTableMerge(cells,vertical,1,0,'right',1);
  assert.ok(rectangle);
  assert.equal(tableMergeLayout(cells,rectangle,1).covered(2,1),true);
  assert.deepEqual(splitTableMerge(cells,rectangle,2,1,1),horizontal);
  assert.equal(extendTableMerge([['A','B']],undefined,0,0,'right'),undefined);
  assert.equal(tableMergeLayout([['A','B']],[{row:0,column:0,rowSpan:1,colSpan:2}]).merges.length,0);
  assert.equal(tableMergeLayout(cells,[{row:0,column:0,rowSpan:Infinity,colSpan:2}]).merges.length,0);
  const manuscript=createVersionedTestManuscript();
  const block=createTableBlock(cells,{headerRows:1,cellMerges:rectangle},'merged-test');
  manuscript.sections[0]!.blocks.push(block);
  const reopened=parseOmiJson(serializeOmiJson(manuscript));
  const visual=reopened.sections[0]!.blocks.at(-1)?.visual;
  assert.ok(visual?.kind==='table');
  assert.deepEqual(visual.cellMerges,rectangle);
  for(const html of [renderHtmlArticle(reopened).html,buildPdfPrintDocument(reopened)]){
    assert.match(html,/<th scope="colgroup" colspan="2">Header<\/th>/);
    assert.match(html,/<td rowspan="2" colspan="2">Anchor<\/td>/);
  }
  assert.deepEqual(cells,[['Header',''],['Anchor',''],['','']]);
});

test('row pagination defaults, overrides, resets and deletion are non-destructive', async () => {
  const {tableRowSplitPolicy,setTableRowSplitOverride,pruneTableRowSplitOverrides}=await import('../src/model/tableLayout.ts');
  const cells=[['H'],['A'],['B']];
  const block=createTableBlock(cells,{headerRows:1},'pagination-table');
  const table=block.visual;
  assert.ok(table?.kind==='table');
  assert.equal(tableRowSplitPolicy(table,1),'keep');
  table.rowSplitDefault='allow';
  table.rowSplitOverrides=setTableRowSplitOverride(table,1,'keep');
  assert.equal(tableRowSplitPolicy(table,1),'keep');
  assert.equal(tableRowSplitPolicy(table,2),'allow');
  assert.deepEqual(setTableRowSplitOverride(table,1,'inherit'),{});
  assert.deepEqual(pruneTableRowSplitOverrides(cells.slice(0,2),{'1':'keep','2':'allow','01':'keep'}),{'1':'keep'});
  assert.deepEqual(setTableRowSplitOverride(table,Infinity,'allow'),{'1':'keep'});
  const manuscript=createVersionedTestManuscript();
  manuscript.sections[0]!.blocks.push(block);
  const reopened=parseOmiJson(serializeOmiJson(manuscript));
  const v=reopened.sections[0]!.blocks.at(-1)?.visual;
  assert.ok(v?.kind==='table');
  assert.equal(v.rowSplitDefault,'allow');
  assert.deepEqual(v.rowSplitOverrides,{'1':'keep'});
  for(const html of [renderHtmlArticle(reopened).html,buildPdfPrintDocument(reopened)]){
    assert.match(html,/<tr><td>A<\/td><\/tr>/);
    assert.match(html,/<tr data-omi-row-split="allow"><td>B<\/td><\/tr>/);
    assert.match(html,/tbody tr\[data-omi-row-split="allow"\]/);
  }
});

test('cell appearance is validated, portable and rendered at the selected coordinates', async () => {
  const {normalizeTableCellAppearance}=await import('../src/model/tableLayout.ts');
  assert.deepEqual(normalizeTableCellAppearance({backgroundColor:'#aabbcc',horizontalAlign:'justify',verticalAlign:'middle'}),{backgroundColor:'#AABBCC',horizontalAlign:'justify',verticalAlign:'middle'});
  assert.deepEqual(normalizeTableCellAppearance({backgroundColor:'red;position:fixed',horizontalAlign:'bogus',verticalAlign:'bad'} as never),{});
  const manuscript=createVersionedTestManuscript();
  const block=createTableBlock([['Heading','Other'],['Value','Untouched']],{headerRows:1,cellFormats:{'1:0':{horizontalAlign:'right',verticalAlign:'bottom',backgroundColor:'#DCE6F1'}}},'cell-appearance');
  manuscript.sections[0]!.blocks.push(block);
  const reopened=parseOmiJson(serializeOmiJson(manuscript));
  const v=reopened.sections[0]!.blocks.at(-1)?.visual;
  assert.ok(v?.kind==='table');
  assert.deepEqual(v.cellFormats,{'1:0':{horizontalAlign:'right',verticalAlign:'bottom',backgroundColor:'#DCE6F1'}});
  for(const html of [renderHtmlArticle(reopened).html,buildPdfPrintDocument(reopened)]){
    assert.match(html,/<td style="text-align:right;vertical-align:bottom;background-color:#DCE6F1">/);
    assert.match(html,/<td>Untouched<\/td>/);
  }
});

test('cell edges preserve explicit none, zero padding and safe physical dimensions', async () => {
  const {normalizeTableCellEdges,tableCellEdgeStyle,tableLengthPt,odtTableCellBorder}=await import('../src/model/tableLayout.ts');
  const input={borders:{top:{style:'solid',widthPt:0.51,color:'#aabbcc'},right:{style:'none'},bottom:{style:'dotted',widthPt:1,color:'#112233'}},paddingPt:{left:3.17,right:0}} as const;
  const normalized=normalizeTableCellEdges(input);
  assert.deepEqual(normalized,{borders:{top:{style:'solid',widthPt:0.5,color:'#AABBCC'},right:{style:'none'},bottom:{style:'dotted',widthPt:1,color:'#112233'}},paddingPt:{right:0,left:3.15}});
  assert.deepEqual(tableCellEdgeStyle(input),{borderTop:'0.5pt solid #AABBCC',borderRight:'none',paddingRight:'0pt',borderBottom:'1pt dotted #112233',paddingLeft:'3.15pt'});
  assert.equal(tableLengthPt('25.4mm'),72);
  assert.equal(tableLengthPt('2pc'),24);
  assert.equal(tableLengthPt('calc(1pt)'),undefined);
  assert.deepEqual(odtTableCellBorder('0.5pt dashed #AABBCC'),{style:'dashed',widthPt:0.5,color:'#AABBCC'});
  assert.deepEqual(normalizeTableCellEdges({paddingPt:{top:-5,left:NaN},borders:{top:{style:'solid',color:'red;position:fixed',widthPt:Infinity}}}),{borders:{top:{style:'solid',color:'#000000',widthPt:0.5}}});
  const manuscript=createVersionedTestManuscript();
  manuscript.sections[0]!.blocks.push(createTableBlock([['A','B']],{headerRows:0,cellFormats:{'0:0':normalized}},'edge-cell'));
  const reopened=parseOmiJson(serializeOmiJson(manuscript));
  for(const html of [renderHtmlArticle(reopened).html,buildPdfPrintDocument(reopened)]){
    assert.match(html,/border-top:0.5pt solid #AABBCC/);
    assert.match(html,/padding-right:0pt/);
    assert.match(html,/<td>B<\/td>/);
  }
});

test('row heights retain native semantics and keep browser content visible', async () => {
  const {normalizeTableRowHeight,tableRowHeight,setTableRowHeight,pruneTableRowHeights,tableRowHeightStyle}=await import('../src/model/tableLayout.ts');
  assert.deepEqual(normalizeTableRowHeight({mode:'exact',heightPt:20.126}),{mode:'exact',heightPt:20.15});
  for(const height of [undefined,{mode:'exact',heightPt:0},{mode:'minimum',heightPt:Infinity},{mode:'invalid',heightPt:12}]) assert.deepEqual(normalizeTableRowHeight(height),{mode:'auto'});
  const manuscript=createVersionedTestManuscript();
  const block=createTableBlock([['A'],['Long text that must remain visible'],['C']],{headerRows:0,rowHeights:{'0':{mode:'minimum',heightPt:24},'1':{mode:'exact',heightPt:6}}},'row-height');
  const table=block.visual;
  assert.ok(table?.kind==='table');
  assert.deepEqual(tableRowHeight(table,2),{mode:'auto'});
  assert.deepEqual(tableRowHeightStyle(tableRowHeight(table,1)),{height:'6pt'});
  assert.deepEqual(setTableRowHeight(table,0,{mode:'auto'}),{'1':{mode:'exact',heightPt:6}});
  assert.deepEqual(pruneTableRowHeights(table.cells.slice(0,1),table.rowHeights),{'0':{mode:'minimum',heightPt:24}});
  manuscript.sections[0]!.blocks.push(block);
  const reopened=parseOmiJson(serializeOmiJson(manuscript));
  const v=reopened.sections[0]!.blocks.at(-1)?.visual;
  assert.ok(v?.kind==='table');
  assert.deepEqual(v.rowHeights,table.rowHeights);
  for(const html of [renderHtmlArticle(reopened).html,buildPdfPrintDocument(reopened)]){
    assert.match(html,/<tr data-omi-row-height="minimum" style="height:24pt">/);
    assert.match(html,/<tr data-omi-row-height="exact" style="height:6pt"><td>Long text that must remain visible<\/td>/);
  }
});

test('rich cell documents remain compatible with the plain matrix and public hidden text projection', async () => {
  const {tableCellDocument,tableCellPlainText,pruneTableCellContent}=await import('../src/model/tableLayout.ts');
  const {publicPublicationManuscript}=await import('../src/model/publicationAnnotations.ts');
  const doc={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Bold',marks:[{type:'bold'}]},{type:'text',text:' private',marks:[{type:'omiHiddenText',attrs:{value:true}}]}]},{type:'paragraph',content:[{type:'text',text:'Second',marks:[{type:'italic'}]}]}]};
  const plain=tableCellPlainText(doc);
  assert.equal(plain,'Bold private\nSecond');
  const manuscript=createVersionedTestManuscript();
  manuscript.sections[0]!.blocks.push(createTableBlock([[plain,'Other']],{headerRows:0,cellContent:{'0:0':JSON.stringify(doc)}},'rich-cell'));
  const reopened=parseOmiJson(serializeOmiJson(manuscript));
  const table=reopened.sections[0]!.blocks.at(-1)?.visual;
  assert.ok(table?.kind==='table');
  assert.deepEqual(tableCellDocument(table,0,0),doc);
  assert.deepEqual(pruneTableCellContent([['Changed']],table.cellContent),{});
  const projected=publicPublicationManuscript(reopened).sections[0]!.blocks.at(-1)?.visual;
  assert.ok(projected?.kind==='table');
  assert.equal(projected.cells[0]?.[0],'Bold\nSecond');
  assert.equal(table.cells[0]?.[0],plain);
  for(const html of [renderHtmlArticle(reopened).html,buildPdfPrintDocument(reopened)]){
    assert.match(html,/<strong>Bold<\/strong>/);
    assert.match(html,/<em>Second<\/em>/);
    assert.ok(!html.includes('Bold private'));
  }
});

test('cell paragraphs retain independent validated formatting and inherit cell alignment', async () => {
  const {normalizeCellParagraphAttrs,effectiveCellParagraphAttrs,tableCellDocument}=await import('../src/model/tableLayout.ts');
  const {paragraphFormattingCss}=await import('../src/model/directParagraphFormatting.ts');
  const attrs={omiAlign:'right',omiLeftIndent:12,omiFirstLineIndent:-6,omiSpaceBefore:3,omiSpaceAfter:5,omiLineRule:'exact',omiLineSpacing:14};
  assert.deepEqual(normalizeCellParagraphAttrs({...attrs,omiPageBreakBefore:true,omiWordParagraphStyle:'invalid'}),attrs);
  assert.deepEqual(normalizeCellParagraphAttrs({omiAlign:'bad',omiLeftIndent:-1,omiLineSpacing:Infinity,omiLineRule:'exact'}),{});
  assert.deepEqual(effectiveCellParagraphAttrs(undefined,'center'),{omiAlign:'center'});
  assert.equal(effectiveCellParagraphAttrs(attrs,'center').omiAlign,'right');
  assert.equal(paragraphFormattingCss({omiAlign:'justify'},'html'),'text-align:left');
  assert.equal(paragraphFormattingCss({omiAlign:'justify'},'print'),'text-align:justify');
  const doc={type:'doc',content:[{type:'paragraph',attrs,content:[{type:'text',text:'First'}]},{type:'paragraph',attrs:{omiAlign:'left',omiSpaceAfter:0},content:[{type:'text',text:'Second'}]}]};
  const manuscript=createVersionedTestManuscript();
  manuscript.sections[0]!.blocks.push(createTableBlock([['First\nSecond']],{headerRows:0,cellContent:{'0:0':JSON.stringify(doc)},cellFormats:{'0:0':{horizontalAlign:'center'}}},'cell-paragraphs'));
  const reopened=parseOmiJson(serializeOmiJson(manuscript));
  const table=reopened.sections[0]!.blocks.at(-1)?.visual;
  assert.ok(table?.kind==='table');
  assert.deepEqual(tableCellDocument(table,0,0),doc);
  for(const html of [renderHtmlArticle(reopened).html,buildPdfPrintDocument(reopened)]){
    assert.match(html,/<p style="text-align:right;margin-left:12pt;text-indent:-6pt;margin-top:3pt;margin-bottom:5pt;line-height:14pt">First<\/p>/);
    assert.match(html,/<p style="text-align:left;margin-bottom:0pt">Second<\/p>/);
  }
});

test('rich cell font family rejects control characters and unsafe punctuation', async () => {
  const {parseTableCellContent}=await import('../src/model/tableLayout.ts');
  const parse=(family:string)=>parseTableCellContent(JSON.stringify({type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'A',marks:[{type:'omiSourceFont',attrs:{family}}]}]}]}))?.content?.[0]?.content?.[0]?.marks;
  assert.deepEqual(parse('Noto Serif'),[{type:'omiSourceFont',attrs:{family:'Noto Serif'}}]);
  for(const family of ['',String.fromCharCode(0)+'Serif','A'+String.fromCharCode(31),'A'+String.fromCharCode(127),'A;B','A{B','A}B','A<B','A>B','A'.repeat(129)]) assert.equal(parse(family),undefined);
});

test('rich table list trees preserve nested items and plain projection without numbering labels', async () => {
  const {parseTableCellContent,tableCellPlainText,tableCellDocument,cellDocumentWithDefaults}=await import('../src/model/tableLayout.ts');
  const {publicPublicationManuscript}=await import('../src/model/publicationAnnotations.ts');
  const p=(text:string)=>({type:'paragraph',content:[{type:'text',text}]});
  const doc={type:'doc',content:[p('Intro'),{type:'orderedList',attrs:{start:4},content:[
    {type:'listItem',content:[p('First'),{type:'bulletList',content:[{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'Nested'},{type:'text',text:' SECRET',marks:[{type:'omiHiddenText',attrs:{value:true}}]}]}]}]}]},
    {type:'listItem',content:[p('Second')]}
  ]}]};
  const parsed=parseTableCellContent(JSON.stringify(doc));
  assert.ok(parsed);
  assert.equal(tableCellPlainText(parsed),'Intro\nFirst\nNested SECRET\nSecond');
  assert.equal(parseTableCellContent(JSON.stringify({type:'doc',content:[{type:'orderedList',content:[{type:'paragraph'}]}]})),undefined);
  assert.equal(parseTableCellContent(JSON.stringify({type:'doc',content:[{type:'orderedList',content:[{type:'listItem',content:[{type:'paragraph'},{type:'table'}]}]}]})),undefined);
  const withDefaults=cellDocumentWithDefaults(parsed,'right');
  assert.equal(withDefaults.content?.[1]?.content?.[0]?.content?.[0]?.attrs?.omiAlign,'right');
  const manuscript=createVersionedTestManuscript();
  manuscript.sections[0]!.blocks.push(createTableBlock([[tableCellPlainText(parsed)]],{headerRows:0,cellContent:{'0:0':JSON.stringify(parsed)}},'cell-lists'));
  const reopened=parseOmiJson(serializeOmiJson(manuscript));
  const table=reopened.sections[0]!.blocks.at(-1)?.visual;
  assert.ok(table?.kind==='table');
  assert.deepEqual(tableCellDocument(table,0,0),parsed);
  const publicTable=publicPublicationManuscript(reopened).sections[0]!.blocks.at(-1)?.visual;
  assert.ok(publicTable?.kind==='table');
  assert.equal(publicTable.cells[0]?.[0],'Intro\nFirst\nNested\nSecond');
  for(const html of [renderHtmlArticle(reopened).html,buildPdfPrintDocument(reopened)]){
    assert.match(html,/<ol start="4">/);
    assert.match(html,/<ul><li><p>Nested<\/p><\/li><\/ul>/);
    assert.ok(!html.includes('SECRET'));
  }
});

test('nested table documents retain source order and redact nested hidden runs in public output',async()=>{
  const {parseTableCellContent,tableCellPlainText,tableCellDocument,cellNestedTable}=await import('../src/model/tableLayout.ts');
  const {publicPublicationManuscript}=await import('../src/model/publicationAnnotations.ts');
  const para=(text:string)=>({type:'paragraph',content:[{type:'text',text}]});
  const secret={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Visible'},{type:'text',text:' SECRET',marks:[{type:'omiHiddenText',attrs:{value:true}}]}]}]};
  const doc={type:'doc',content:[para('Before'),{type:'omiCellTable',attrs:{table:{kind:'table',headerRows:0,cells:[['Visible SECRET','B']],cellContent:{'0:0':JSON.stringify(secret)}}}},para('After')]};
  const valid=parseTableCellContent(JSON.stringify(doc));
  assert.ok(valid);
  assert.equal(tableCellPlainText(valid),'Before\nVisible SECRET\tB\nAfter');
  const manuscript=createVersionedTestManuscript();
  manuscript.sections[0]!.blocks.push(createTableBlock([[tableCellPlainText(valid)]],{headerRows:0,cellContent:{'0:0':JSON.stringify(valid)}},'nested-table'));
  const reopened=parseOmiJson(serializeOmiJson(manuscript));
  const outer=reopened.sections[0]!.blocks.at(-1)?.visual;
  assert.ok(outer?.kind==='table');
  assert.deepEqual(tableCellDocument(outer,0,0),valid);
  const projected=publicPublicationManuscript(reopened).sections[0]!.blocks.at(-1)?.visual;
  assert.ok(projected?.kind==='table');
  assert.equal(projected.cells[0]?.[0],'Before\nVisible\tB\nAfter');
  const node=tableCellDocument(projected,0,0)?.content?.[1];
  assert.ok(node);
  assert.deepEqual(cellNestedTable(node)?.cells,[['Visible','B']]);
  for(const html of [renderHtmlArticle(reopened).html,buildPdfPrintDocument(reopened)]){
    assert.match(html,/<p>Before<\/p><table[\s\S]*?<td><p>Visible<\/p><\/td><td>B<\/td>[\s\S]*?<\/table><p>After<\/p>/);
    assert.ok(!html.includes('SECRET'));
  }
  assert.equal(parseTableCellContent(JSON.stringify({type:'doc',content:[{type:'omiCellTable',attrs:{table:{kind:'table',cells:[['a'],['b','c']]}}}]})),undefined);
});

test('row resize is zoom-aware, preserves explicit native modes and clamps to valid dimensions',async()=>{
  const {resizeTableRowHeight,setTableRowHeight}=await import('../src/model/tableLayout.ts');
  assert.deepEqual(resizeTableRowHeight({mode:'auto'},40,20),{mode:'minimum',heightPt:45});
  assert.deepEqual(resizeTableRowHeight({mode:'auto'},80,40,2),{mode:'minimum',heightPt:45});
  assert.deepEqual(resizeTableRowHeight({mode:'exact',heightPt:24},80,16,2),{mode:'exact',heightPt:30});
  assert.deepEqual(resizeTableRowHeight({mode:'minimum',heightPt:30},40,-100),{mode:'minimum',heightPt:0.05});
  assert.deepEqual(resizeTableRowHeight({mode:'auto'},40,0),{mode:'auto'});
  assert.deepEqual(resizeTableRowHeight({mode:'auto'},0,20),{mode:'auto'});
  assert.deepEqual(resizeTableRowHeight({mode:'exact',heightPt:24},40,20,NaN),{mode:'exact',heightPt:24});
  const table=createTableBlock([['A'],['B']],{rowHeights:{'1':{mode:'exact',heightPt:24}}}).visual;
  assert.ok(table?.kind==='table');
  assert.deepEqual(setTableRowHeight(table,0,resizeTableRowHeight({mode:'auto'},40,20)),{'0':{mode:'minimum',heightPt:45},'1':{mode:'exact',heightPt:24}});
});

test('rectangular range resolves merged anchors once and preserves unrelated properties', async () => {
  const {tableRangeAnchors,formatTableRange}=await import('../src/model/tableLayout.ts');
  const block=createTableBlock([['A','','C'],['D','E','F'],['G','H','I']],{headerRows:0,cellMerges:[{row:0,column:0,rowSpan:1,colSpan:2}],cellFormats:{
    '0:0':{horizontalAlign:'left',paddingPt:{top:3,left:5}},
    '1:1':{horizontalAlign:'right',backgroundColor:'#FFFFFF',paddingPt:{top:6,bottom:4}},
    '2:2':{backgroundColor:'#123456'}
  }},'range-format');
  const table=block.visual;
  assert.ok(table?.kind==='table');
  const start={row:1,column:1},end={row:0,column:0};
  assert.deepEqual(tableRangeAnchors(table.cells,start,end,table.cellMerges,table.headerRows),[{row:0,column:0},{row:1,column:0},{row:1,column:1}]);
  assert.deepEqual(tableRangeAnchors(table.cells,{row:0,column:1},{row:0,column:1},table.cellMerges,table.headerRows),[{row:0,column:0}]);
  assert.deepEqual(tableRangeAnchors(table.cells,{row:NaN,column:0},end),[]);
  let calls=0;
  const next=formatTableRange(table,start,end,format=>{calls++;return {horizontalAlign:'center',paddingPt:{...format.paddingPt,top:8}};});
  assert.equal(calls,3);
  assert.deepEqual(next['0:0']?.paddingPt,{top:8,left:5});
  assert.deepEqual(next['1:1']?.paddingPt,{top:8,bottom:4});
  assert.equal(next['1:1']?.backgroundColor,'#FFFFFF');
  assert.equal(next['0:0']?.horizontalAlign,'center');
  assert.deepEqual(next['2:2'],{backgroundColor:'#123456'});
  assert.equal(next['0:1'],undefined);
  assert.equal(table.cellFormats?.['0:0']?.horizontalAlign,'left');
  assert.deepEqual(table.cells,[['A','','C'],['D','E','F'],['G','H','I']]);
  const cleared=formatTableRange({...table,cellFormats:next},start,end,{backgroundColor:undefined});
  assert.equal(cleared['1:1']?.backgroundColor,undefined);
  assert.equal(cleared['2:2']?.backgroundColor,'#123456');
});
