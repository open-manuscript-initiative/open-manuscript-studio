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

test('prefers manuscript tabs over punctuation during automatic delimiter detection', () => {
  assert.deepEqual(
    parseDelimitedTable('Name\tNote\nAlpha\tContains, commas, and punctuation\nBeta\tAnother, note'),
    [
      ['Name', 'Note'],
      ['Alpha', 'Contains, commas, and punctuation'],
      ['Beta', 'Another, note'],
    ],
  );
});

test('detects semicolon-delimited rows even when values contain decimal commas', () => {
  assert.deepEqual(
    parseDelimitedTable('Name;Value\nAlpha;1,5\nBeta;2,5'),
    [['Name', 'Value'], ['Alpha', '1,5'], ['Beta', '2,5']],
  );
});

test('preserves a trailing empty cell in tab-delimited selections', () => {
  assert.deepEqual(
    parseDelimitedTable('A\tB\t\n1\t2\t'),
    [['A', 'B', ''], ['1', '2', '']],
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
  const first = JSON.parse(blocks[0]?.content ?? '{}');
  const second = JSON.parse(blocks[1]?.content ?? '{}');
  assert.deepEqual(
    first.content?.[0]?.content?.map((node: { type?: string; text?: string }) => [node.type, node.text]),
    [['text', 'Name'], ['omiTab', undefined], ['text', 'Value']],
  );
  assert.deepEqual(
    second.content?.[0]?.content?.map((node: { type?: string; text?: string }) => [node.type, node.text]),
    [['text', 'Alpha'], ['omiTab', undefined], ['text', '12']],
  );
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
