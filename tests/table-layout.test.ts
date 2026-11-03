import assert from 'node:assert/strict';
import test from 'node:test';
import { resizeTableColumn, tableColumnWidths } from '../src/model/tableLayout.ts';
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
