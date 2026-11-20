import assert from 'node:assert/strict';
import test from 'node:test';
import { arrangePublicationSheets, publicationFirstPageNumber } from '../src/model/publicationSpreads.ts';
import { clonePublicationStyleTemplate, normalizePublicationStyle, buildPublicationStyleCss } from '../src/services/publicationStyleExport.ts';
import { resolvePublicationPageStyle } from '../src/model/publicationPageStyles.ts';

test('facing pages start on the next odd recto, while single-page numbering is unchanged', () => {
  for (const [input, expected] of [[0, 1], [1, 1], [2, 3], [42, 43], [43, 43], [NaN, 1]]) {
    assert.equal(publicationFirstPageNumber({ pageNumberStart: input, facingPages: true }), expected);
  }
  assert.equal(publicationFirstPageNumber({ pageNumberStart: 42 }), 42);
});

test('first recto is alone; subsequent even-left and odd-right sheets share a spine and row', () => {
  const result = arrangePublicationSheets(Array.from({ length: 5 }, () => ({ width: 150, height: 240 })), true, 20);
  assert.deepEqual(result.pages.map(({ x, top, side, spread }) => ({ x, top, side, spread })), [
    { x: 150, top: 0, side: 'right', spread: 0 },
    { x: 0, top: 260, side: 'left', spread: 1 },
    { x: 150, top: 260, side: 'right', spread: 1 },
    { x: 0, top: 520, side: 'left', spread: 2 },
    { x: 150, top: 520, side: 'right', spread: 2 },
  ]);
  assert.equal(result.width, 300); assert.equal(result.height, 760);
  assert.deepEqual(result.pages.map((page) => page.flowTop), [0, 260, 520, 780, 1040]);
});

test('mixed page masters align to spine and taller sheet, including a final unpaired verso', () => {
  const result = arrangePublicationSheets([
    { width: 100, height: 200 }, { width: 180, height: 300 },
    { width: 120, height: 250 }, { width: 140, height: 150 },
  ], true, 20);
  assert.deepEqual(result.pages.map((page) => [page.x, page.top]), [[180, 0], [0, 220], [180, 220], [40, 540]]);
  assert.equal(result.height, 690);
  const single = arrangePublicationSheets([{ width: 100, height: 200 }, { width: 180, height: 300 }], false, 20);
  assert.equal(single.height, 520); assert.equal(single.width, 180);
  assert.deepEqual(single.pages.map((page) => [page.x, page.top]), [[0, 0], [0, 220]]);
  assert.equal(arrangePublicationSheets([], true, 20).height, 0);
});

test('saved facing-page styles normalize odd numbering consistently for masters and print counters', () => {
  const style = clonePublicationStyleTemplate();
  assert.equal(normalizePublicationStyle(style).page.facingPages, false);
  style.page.facingPages = true; style.page.pageNumberStart = 42;
  const restored = normalizePublicationStyle(JSON.parse(JSON.stringify(style)));
  assert.equal(restored.page.facingPages, true); assert.equal(restored.page.pageNumberStart, 43);
  assert.equal(resolvePublicationPageStyle(style, [], 0).pageNumber, 43);
  assert.equal(resolvePublicationPageStyle(style, [], 1).pageNumber, 44);
  assert.match(buildPublicationStyleCss(style, 'print'), /counter-reset: page 42/);
});
