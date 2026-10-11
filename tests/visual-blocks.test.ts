import { renderHtmlArticle } from '../src/services/exportHtml.ts';
import { renderJatsArticle } from '../src/services/exportJats.ts';
import { createVersionedTestManuscript } from './testManuscriptFixture.ts';
import assert from 'node:assert/strict';
import test from 'node:test';

import { buildAttributedVisualImport, buildSourcedVisualBlocks, prefillExternalSource } from '../src/model/externalObjectSources.ts';
import {
  latexToMathMl,
  renderLatexMath,
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

test('LaTeX keeps simultaneous scripts, operators and multi-digit numbers mathematically structured', () => {
  for (const source of ['x_i^2', 'x^2_i']) {
    const result = renderLatexMath(source);
    assert.equal(result.error, undefined);
    assert.match(result.mathml, /<msubsup><mi>x<\/mi><mi>i<\/mi><mn>2<\/mn><\/msubsup>/);
  }
  const result = renderLatexMath('12.5 + \\sin(x) + \\sqrt[3]{x} + \\sum_{i=1}^{n} x_i');
  assert.equal(result.error, undefined);
  assert.match(result.mathml, /<mn>12\.5<\/mn>/);
  assert.match(result.mathml, /<mi[^>]*>sin<\/mi>/);
  assert.match(result.mathml, /<mroot>/);
  assert.match(result.mathml, /<munderover>/);
});

test('LaTeX supports matrices, cases and aligned equations without losing cells', () => {
  for (const source of [
    '\\begin{pmatrix}a & b \\\\ c & d\\end{pmatrix}',
    '\\begin{cases}x^2 & x\\ge 0 \\\\ -x & x<0\\end{cases}',
    '\\begin{aligned}a+b &= c \\\\ a &= c-b\\end{aligned}',
  ]) {
    const result = renderLatexMath(source);
    assert.equal(result.error, undefined);
    assert.match(result.mathml, /<mtable/);
    assert.equal((result.mathml.match(/<mtr>/g) ?? []).length, 2);
  }
});

test('invalid, unknown, untrusted and runaway LaTeX is diagnosed rather than silently approximated', () => {
  for (const source of [
    'x_{', '\\unknowncommand{x}', '\\href{javascript:alert(1)}{x}',
    '\\includegraphics{https://example.test/private.png}',
    '\\def\\loop{\\loop}\\loop', 'x'.repeat(8193),
  ]) {
    const result = renderLatexMath(source);
    assert.ok(result.error, source.slice(0, 60));
    assert.doesNotMatch(result.mathml, /<(?:script|img|a)\b|href=/);
  }
  assert.doesNotMatch(latexToMathMl('<script>'), /<script>/);
  assert.doesNotMatch(latexToMathMl('\\unknowncommand{<img src=x onerror=alert(1)>}'), /<img/);
});

test('never returns active markup when MathML sanitization runs without a browser DOM', () => {
  const sanitized = sanitizeMathMlForPreview(
    '<math onclick="alert(1)"><mrow><mi>x</mi><script>alert(1)</script></mrow></math>',
  );

  assert.match(sanitized, /^<math /);
  assert.ok(!sanitized.includes('<script'));
  assert.ok(!sanitized.includes('onclick='));
});

test('external objects retain a visible source after each object and reject missing attribution', () => {
  const first = createTableBlock([['Synthetic', '1']], {}, 'table-1');
  const second = createChartBlock([['Synthetic', '2']], {}, 'chart-1');
  const blocks = buildSourcedVisualBlocks([
    { block: first, source: prefillExternalSource('public-data.xlsx', 'Sheet 1') },
    { block: second, source: 'Public data, figure 2' },
  ], 'Source', (() => {
    let id = 0;
    return () => `source-${++id}`;
  })());
  assert.deepEqual(blocks.map((block) => block.id), ['table-1', 'source-1', 'chart-1', 'source-2']);
  assert.match(blocks[1]!.content, /Source: public-data.xlsx · Sheet 1/);
  assert.match(blocks[3]!.content, /Source: Public data, figure 2/);
  assert.throws(() => buildSourcedVisualBlocks([{ block: first, source: '   ' }], 'Source'), /requires a source/);
  assert.throws(() => buildSourcedVisualBlocks([{ block: { id: 'text', type: 'paragraph', content: '' }, source: 'X' }], 'Source'), /requires a source/);
});

test('mixed import carries own-work origin privately while requiring third-party source', () => {
  const own = createTableBlock([['Self', '1']], {}, 'table-own');
  const external = createChartBlock([['Public', '2']], {}, 'chart-public');
  if (own.visual) own.visual.provenance = { sourceFormat: 'xlsx', fileName: 'private-draft.xlsx', importedAt: '2026-10-09T00:00:00.000Z' };
  const result = buildAttributedVisualImport([
    { block: own, source: 'private-draft.xlsx', selfAuthoredExternal: true },
    { block: external, source: 'Public dataset', selfAuthoredExternal: false },
  ], 'Source', '2026-10-09T00:00:00.000Z', () => 'origin-or-source');
  assert.deepEqual(result.blocks.map((block) => block.id), ['table-own', 'chart-public', 'origin-or-source']);
  assert.equal(result.annotations.length, 1);
  assert.equal(result.annotations[0]?.targetBlockId, 'table-own');
  assert.equal(result.annotations[0]?.renderingHint, 'hidden');
  assert.equal(JSON.stringify(result).includes('private-draft.xlsx'), false);
  assert.throws(() => buildAttributedVisualImport([
    { block: external, source: '', selfAuthoredExternal: false },
  ], 'Source', '2026-10-09T00:00:00.000Z'), /requires a source/);
});


test('invalid equations block HTML and JATS publication while preserving manuscript source', () => {
  const manuscript = createVersionedTestManuscript();
  manuscript.sections[0].blocks.push(createEquationBlock('\\unknowncommand{x}'));
  const before = JSON.stringify(manuscript);
  for (const result of [renderHtmlArticle(manuscript), renderJatsArticle(manuscript)]) {
    assert.equal(result.validForExport, false);
    assert.ok(result.diagnostics.some((item) => item.code === 'invalid-equation-latex' && item.severity === 'error'));
  }
  assert.equal(JSON.stringify(manuscript), before);
});

test('LaTeX macro definitions cannot contaminate another manuscript equation', () => {
  assert.equal(renderLatexMath('\\gdef\\custom{a}\\custom').error, undefined);
  assert.ok(renderLatexMath('\\custom').error);
});
