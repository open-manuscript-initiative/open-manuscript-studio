import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { paginatePublicationBlocks } from '../src/components/publicationPageLayout.ts';

const styleEditor = readFileSync(
  new URL('../src/components/PublicationStyleEditor.tsx', import.meta.url),
  'utf8',
);
const documentCanvas = readFileSync(
  new URL('../src/components/PublicationDocumentCanvas.tsx', import.meta.url),
  'utf8',
);
const editorStyles = readFileSync(
  new URL('../src/components/PublicationStyleEditor.css', import.meta.url),
  'utf8',
);
const exportRenderer = readFileSync(
  new URL('../src/services/publicationStyleExport.ts', import.meta.url),
  'utf8',
);

test('publication view edits the complete structured manuscript instead of a sample paragraph', () => {
  assert.match(styleEditor, /<PublicationDocumentCanvas style=\{style\}/);
  assert.match(documentCanvas, /buildContinuousManuscriptDocument\(manuscript\.sections/);
  assert.match(documentCanvas, /projectContinuousManuscriptDocument\(parsed, currentSections\)/);
  assert.match(documentCanvas, /stageContinuousDocumentChange/);
  assert.match(documentCanvas, /<BlockEditor[\s\S]*continuous/);
  assert.match(documentCanvas, /const setAbstract = useStudioStore/);
});

test('print-page controls cover trim size, binding, bleed and pagination', () => {
  assert.match(styleEditor, /156 × 224 mm/);
  assert.match(styleEditor, /setPage\('gutter'/);
  assert.match(styleEditor, /setPage\('bleed'/);
  assert.match(styleEditor, /setPage\('cropMarks'/);
  assert.match(styleEditor, /setPage\('pageNumberStart'/);
  assert.match(styleEditor, /setPage\('mirroredMargins'/);
  assert.match(documentCanvas, /publication-document-running-header/);
  assert.match(documentCanvas, /publication-document-page-guide--crop-marks/);
  assert.match(documentCanvas, /publication-document-page-guide--bleed/);
  assert.match(documentCanvas, /const mirroredEvenPage = style\.page\.mirroredMargins && evenPage/);
});

test('the same print-page values feed generated export CSS', () => {
  assert.match(exportRenderer, /const gutter = nonNegative\(style\.page\.gutter/);
  assert.match(exportRenderer, /const bleed = nonNegative\(style\.page\.bleed/);
  assert.match(exportRenderer, /cropMarks \? 'marks: crop;'/);
  assert.match(exportRenderer, /margin-left: \$\{innerMargin\}mm/);
  assert.match(exportRenderer, /counter-reset: page/);
  assert.match(exportRenderer, /@page:left \{[\s\S]*@top-left \{ content:/);
  assert.match(exportRenderer, /@page:right \{[\s\S]*@top-right \{ content:/);
  assert.match(exportRenderer, /@page:first \{[\s\S]*content: none/);
  assert.match(exportRenderer, /runningHeaderCssContent/);
});

test('publication workspace remains usable on narrow screens', () => {
  assert.match(editorStyles, /@media \(max-width: 860px\)[\s\S]*grid-template-columns: 1fr/);
  assert.match(editorStyles, /@media \(max-width: 560px\)[\s\S]*flex-direction: column/);
  assert.match(editorStyles, /overflow: auto/);
});

test('screen pagination presents separate Word-like sheets without storing page breaks', () => {
  const layout = paginatePublicationBlocks(
    [
      { top: 0, height: 60 },
      { top: 60, height: 50 },
      { top: 110, height: 20 },
    ],
    100,
    50,
  );

  assert.equal(layout.pageCount, 2);
  assert.deepEqual(layout.placements, [
    { pageIndex: 0, translateY: 0 },
    { pageIndex: 1, translateY: 90 },
    { pageIndex: 1, translateY: 90 },
  ]);
  assert.match(documentCanvas, /paginatePublicationBlocks/);
  assert.match(documentCanvas, /publication-document-ruler/);
  assert.match(documentCanvas, /pageHeight \* pageCount \+ pageGap/);
  assert.match(editorStyles, /\.publication-document-page-guide[\s\S]*background: #fff/);
  assert.match(editorStyles, /\.publication-document-page-guide[\s\S]*box-shadow:/);
});

test('screen pagination keeps a heading with the following text block', () => {
  const layout = paginatePublicationBlocks(
    [
      { top: 75, height: 10, keepWithNext: true },
      { top: 85, height: 30 },
    ],
    100,
    50,
  );

  assert.deepEqual(layout.placements, [
    { pageIndex: 1, translateY: 75 },
    { pageIndex: 1, translateY: 75 },
  ]);
});
