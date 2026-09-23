import assert from 'node:assert/strict';
import test from 'node:test';

import {
  latexToMathMl,
  sanitizeMathMlForPreview,
} from '../src/model/equationRendering.ts';
import {
  addTableColumn,
  addTableRow,
  createChartBlock,
  createEquationBlock,
  createImageBlock,
  createTableBlock,
  parseDelimitedTable,
  tableRowsToParagraphBlocks,
  tableToChartDataset,
  tableToDelimitedText,
  updateTableCell,
} from '../src/model/visualBlocks.ts';

test('creates portable visual blocks without embedding presentation HTML', () => {
  const image = createImageBlock(
    {
      src: 'data:image/png;base64,AA==',
      mediaType: 'image/png',
      alt: 'Microscope',
    },
    'image-1',
  );
  const table = createTableBlock([['Year', 'Count'], ['2026', '7']], {}, 'table-1');
  const chart = createChartBlock([['Year', 'Count'], ['2026', '7']], {}, 'chart-1');
  const equation = createEquationBlock('E=mc^2', {}, 'equation-1');

  assert.equal(image.visual?.kind, 'image');
  assert.equal(table.visual?.kind, 'table');
  assert.equal(chart.visual?.kind, 'chart');
  assert.equal(equation.visual?.kind, 'equation');
  assert.equal(table.content, '');
});

test('parses quoted CSV and tab-separated Excel clipboard data', () => {
  assert.deepEqual(
    parseDelimitedTable('Name,Value\n"Alpha, beta",12', ','),
    [['Name', 'Value'], ['Alpha, beta', '12']],
  );
  assert.deepEqual(
    parseDelimitedTable('Name\tValue\nAlpha\t12'),
    [['Name', 'Value'], ['Alpha', '12']],
  );
});

test('converts table data to tab-separated text blocks without losing cell order', () => {
  const cells = [['Name', 'Value'], ['Alpha', '12']];
  assert.equal(tableToDelimitedText(cells), 'Name\tValue\nAlpha\t12');

  const blocks = tableRowsToParagraphBlocks(
    cells,
    'table-1',
    (() => {
      let index = 0;
      return () => `generated-${++index}`;
    })(),
  );
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0]?.id, 'table-1');
  assert.equal(blocks[1]?.id, 'generated-1');
  assert.match(blocks[0]?.content ?? '', /Name\\tValue/);
  assert.match(blocks[1]?.content ?? '', /Alpha\\t12/);
});

test('keeps table data rectangular while editing rows and columns', () => {
  let cells = [['A', 'B'], ['1', '2']];
  cells = addTableRow(cells);
  cells = addTableColumn(cells);
  cells = updateTableCell(cells, 2, 2, '3');

  assert.equal(cells.length, 3);
  assert.equal(cells[0]?.length, 3);
  assert.equal(cells[2]?.[2], '3');
});

test('derives editable chart series from spreadsheet-shaped source data', () => {
  const dataset = tableToChartDataset([
    ['Year', 'Articles', 'Reviews'],
    ['2024', '12', '4'],
    ['2025', '18', '6'],
  ]);

  assert.deepEqual(dataset.labels, ['2024', '2025']);
  assert.deepEqual(dataset.series, [
    { name: 'Articles', values: [12, 18] },
    { name: 'Reviews', values: [4, 6] },
  ]);
});

test('renders common LaTeX structures as browser-native MathML', () => {
  const mathml = latexToMathMl('\\frac{a_1+b^2}{\\sqrt{x}}');

  assert.match(mathml, /<mfrac>/);
  assert.match(mathml, /<msqrt>/);
  assert.match(mathml, /<msub>/);
  assert.match(mathml, /<msup>/);
  assert.ok(!mathml.includes('<script'));
});

test('never returns active markup when MathML sanitization runs without a browser DOM', () => {
  const sanitized = sanitizeMathMlForPreview(
    '<math onclick="alert(1)"><mrow><mi>x</mi><script>alert(1)</script></mrow></math>',
  );

  assert.match(sanitized, /^<math /);
  assert.ok(!sanitized.includes('<script'));
  assert.ok(!sanitized.includes('onclick='));
});
