import assert from 'node:assert/strict';
import test from 'node:test';

import { buildLatexExport } from '../src/services/exportLatex.ts';
import { buildMifExport } from '../src/services/exportMif.ts';
import { buildSlaExport } from '../src/services/exportSla.ts';
import { buildXtgExport } from '../src/services/exportXtg.ts';
import { createVersionedTestManuscript } from './testManuscriptFixture.ts';

test('exports QuarkXPress XPress Tags with UTF-8 header and OMI styles', () => {
  const result = buildXtgExport(createVersionedTestManuscript());
  assert.match(result.text, /^<v21\.00><e9>/);
  assert.match(result.text, /@OMI Body=/);
  assert.match(result.text, /<@OMI Title>/);
  assert.match(result.fileName, /\.xtg$/);
});

test('exports FrameMaker MIF with paragraph catalog and text flow', () => {
  const result = buildMifExport(createVersionedTestManuscript());
  assert.match(result.text, /^<MIFFile /);
  assert.match(result.text, /<PgfCatalog/);
  assert.match(result.text, /<TextFlow/);
  assert.match(result.text, /OMI Heading 1/);
  assert.match(result.fileName, /\.mif$/);
});

test('exports Scribus SLA with styles, page and text frame', () => {
  const result = buildSlaExport(createVersionedTestManuscript());
  assert.match(result.text, /<SCRIBUSUTF8NEW/);
  assert.match(result.text, /<PAGE /);
  assert.match(result.text, /<PAGEOBJECT /);
  assert.match(result.text, /NAME="OMI Body"/);
  assert.match(result.fileName, /\.sla$/);
});

test('exports compilable-shape LaTeX source with document structure', () => {
  const result = buildLatexExport(createVersionedTestManuscript());
  assert.match(result.text, /\\documentclass/);
  assert.match(result.text, /\\begin\{document\}/);
  assert.match(result.text, /\\end\{document\}/);
  assert.match(result.fileName, /\.tex$/);
});
