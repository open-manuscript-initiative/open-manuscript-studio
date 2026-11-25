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
