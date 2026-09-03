import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { paginatePublicationBlocks } from '../src/components/publicationPageLayout.ts';
import {
  resolvePublicationParagraphStyle,
  type PublicationParagraphStyleCollection,
  type ResolvedPublicationParagraphStyle,
} from '../src/model/publicationParagraphStyles.ts';
import { cssStringLiteral } from '../src/services/embeddedCss.ts';
import {
  hyphenatePrintText,
  resolvePrintHyphenationModule,
} from '../src/services/printHyphenation.ts';

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
const hyphenationRenderer = readFileSync(
  new URL('../src/services/printHyphenation.ts', import.meta.url),
  'utf8',
);
const studioMenu = readFileSync(
  new URL('../src/components/StudioMenu.tsx', import.meta.url),
  'utf8',
);
const publicationProfile = readFileSync(
  new URL('../src/components/PublicationProfilePanel.tsx', import.meta.url),
  'utf8',
);
const fullscreenPanels = readFileSync(
  new URL('../src/styles/desktop-fullscreen-panels.css', import.meta.url),
  'utf8',
);
const studioShellStyles = readFileSync(
  new URL('../src/styles/studio-shell.css', import.meta.url),
  'utf8',
);

test('live publication editor opens as its own full-screen menu workspace', () => {
  assert.match(studioMenu, /'publication-editor'/);
  assert.match(studioMenu, /supplementalCopy\.publicationEditor/);
  assert.match(studioMenu, /activeView === 'publication-editor' \? <PublicationStyleEditor \/>/);
  assert.doesNotMatch(publicationProfile, /<PublicationStyleEditor/);
  assert.match(fullscreenPanels, /\.studio-menu-content--publication-editor[\s\S]*overflow: hidden/);
  assert.match(fullscreenPanels, /\.studio-menu-content--publication-editor \.publication-style-editor[\s\S]*height: 100%/);
});

test('desktop Studio navigation opens from a compact top dropdown', () => {
  assert.match(studioMenu, /const \[navigationOpen, setNavigationOpen\]/);
  assert.match(studioMenu, /className="studio-menu-navigation-trigger"/);
  assert.match(studioMenu, /aria-haspopup="menu"/);
  assert.match(studioMenu, /hidden=\{!navigationOpen\}/);
  assert.match(studioShellStyles, /\.studio-menu-body \{[\s\S]*display: block/);
  assert.match(studioShellStyles, /\.studio-menu-navigation \{[\s\S]*position: absolute/);
});

test('publication settings use a Word-like top ribbon instead of a permanent sidebar', () => {
  assert.match(styleEditor, /const \[openPanel, setOpenPanel\]/);
  assert.match(styleEditor, /className="publication-style-ribbon"/);
  assert.match(styleEditor, /panelId="styles"/);
  assert.match(styleEditor, /panelId="page"/);
  assert.match(styleEditor, /panelId="margins"/);
  assert.match(styleEditor, /panelId="typography"/);
  assert.match(styleEditor, /active=\{body\.alignment === 'justify'\}/);
  assert.match(styleEditor, /aria-pressed=\{active\}/);
  assert.doesNotMatch(styleEditor, /<aside className="publication-style-controls"/);
  assert.match(editorStyles, /\.publication-style-ribbon-panel \{[\s\S]*position: absolute/);
  assert.match(editorStyles, /\.publication-style-editor-layout \{[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
});

test('publication view edits the complete structured manuscript instead of a sample paragraph', () => {
  assert.match(styleEditor, /<PublicationDocumentCanvas style=\{style\}/);
  assert.match(documentCanvas, /buildContinuousManuscriptDocument\([\s\S]*manuscript\.sections/);
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
  assert.match(editorStyles, /\.publication-style-ribbon-actions \{[\s\S]*overflow-x: auto/);
  assert.match(editorStyles, /@media \(max-width: 560px\)[\s\S]*\.publication-style-ribbon-menu-button > span/);
  assert.match(editorStyles, /@media \(max-width: 560px\)[\s\S]*max-height: calc\(100dvh - 9rem\)/);
  assert.match(editorStyles, /\.publication-style-ribbon-panel \{[\s\S]*overflow: auto/);
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

test('a heading keeps only the opening line, not the entire following paragraph', () => {
  const layout = paginatePublicationBlocks(
    [
      { top: 75, height: 10, keepWithNext: true },
      {
        top: 85,
        height: 40,
        leadingHeight: 10,
        splittable: true,
        lines: [
          { textOffset: 0, top: 0, height: 10 },
          { textOffset: 8, top: 10, height: 10 },
          { textOffset: 16, top: 20, height: 10 },
          { textOffset: 24, top: 30, height: 10 },
        ],
      },
    ],
    100,
    50,
  );

  assert.equal(layout.placements[0]?.pageIndex, 0);
  assert.equal(layout.placements[1]?.pageIndex, 0);
  assert.deepEqual(layout.flowBreaks, [
    { blockIndex: 1, textOffset: 8, height: 55 },
  ]);
});

test('normal paragraphs continue line by line instead of moving as one block', () => {
  const layout = paginatePublicationBlocks(
    [
      {
        top: 60,
        height: 60,
        splittable: true,
        lines: [
          { textOffset: 0, top: 0, height: 20 },
          { textOffset: 10, top: 20, height: 20 },
          { textOffset: 20, top: 40, height: 20 },
        ],
      },
      { top: 120, height: 20 },
    ],
    100,
    50,
  );

  assert.deepEqual(layout.placements, [
    { pageIndex: 0, translateY: 0 },
    { pageIndex: 1, translateY: 0 },
  ]);
  assert.deepEqual(layout.flowBreaks, [
    { blockIndex: 0, textOffset: 20, height: 50 },
  ]);
  assert.equal(layout.pageCount, 2);
  assert.match(documentCanvas, /measurePublicationLines/);
  assert.match(documentCanvas, /publicationFlowBreaks/);
  assert.match(editorStyles, /\.omi-publication-flow-break \{/);
});

test('a line that would cross the footer resumes at the next page body', () => {
  const layout = paginatePublicationBlocks(
    [
      {
        top: 70,
        height: 60,
        splittable: true,
        lines: [
          { textOffset: 0, top: 0, height: 20 },
          { textOffset: 10, top: 20, height: 20 },
          { textOffset: 20, top: 40, height: 20 },
        ],
      },
      { top: 130, height: 10 },
    ],
    100,
    50,
  );

  assert.deepEqual(layout.flowBreaks, [
    { blockIndex: 0, textOffset: 10, height: 60 },
  ]);
  assert.deepEqual(layout.placements, [
    { pageIndex: 0, translateY: 0 },
    { pageIndex: 1, translateY: 0 },
  ]);
});

test('an explicit keep-together rule still moves a complete paragraph', () => {
  const layout = paginatePublicationBlocks(
    [{
      top: 70,
      height: 60,
      splittable: true,
      keepTogether: true,
      lines: [
        { textOffset: 0, top: 0, height: 20 },
        { textOffset: 10, top: 20, height: 20 },
        { textOffset: 20, top: 40, height: 20 },
      ],
    }],
    100,
    50,
  );

  assert.deepEqual(layout.placements, [{ pageIndex: 1, translateY: 80 }]);
  assert.deepEqual(layout.flowBreaks, []);
});

test('InDesign-like paragraph styles inherit, assign, and feed print CSS', () => {
  const collection: PublicationParagraphStyleCollection = {
    defaultStyleId: 'body',
    items: [
      { id: 'body', name: 'Body', basedOnId: null, nextStyleId: 'body', properties: {} },
      { id: 'first-paragraph', name: 'First', basedOnId: 'body', nextStyleId: 'body', properties: { firstLineIndent: 0 } },
    ],
  };
  const defaults: ResolvedPublicationParagraphStyle = {
    fontFamily: 'EB Garamond', fontSize: 10.5, lineHeight: 12.5,
    fontWeight: 400, fontStyle: 'normal', alignment: 'justify',
    firstLineIndent: 5, leftIndent: 0, rightIndent: 0,
    spaceBefore: 0, spaceAfter: 0, hyphenation: true,
    keepTogether: false, keepWithNext: false, widows: 2, orphans: 2,
  };
  const firstParagraph = resolvePublicationParagraphStyle(
    collection,
    'first-paragraph',
    defaults,
  );

  assert.equal(firstParagraph.firstLineIndent, 0);
  assert.equal(firstParagraph.fontSize, defaults.fontSize);
  assert.equal(firstParagraph.keepTogether, false);
  assert.match(exportRenderer, /buildPublicationParagraphStyleRules/);
  assert.match(exportRenderer, /data-omi-paragraph-style-id/);
  assert.match(exportRenderer, /text-block:not\(\[data-omi-paragraph-style-id\]\)/);
  assert.match(styleEditor, /panelId="paragraphStyles"/);
  assert.match(styleEditor, /paragraphStyleWouldCreateCycle/);
  assert.match(styleEditor, /setBlockParagraphStyle/);
  assert.match(styleEditor, /copy\.basedOn/);
  assert.match(styleEditor, /copy\.nextStyle/);
  assert.match(documentCanvas, /:not\(\[data-paragraph-style-id\]\)/);
});

test('print hyphenation selects lazy language modules from BCP 47 tags', () => {
  assert.equal(resolvePrintHyphenationModule('hu-HU'), 'hu');
  assert.equal(resolvePrintHyphenationModule('en-GB'), 'en-gb');
  assert.equal(resolvePrintHyphenationModule('de-CH'), 'de');
  assert.equal(resolvePrintHyphenationModule('sr-Latn'), 'sh-latn');
  assert.equal(resolvePrintHyphenationModule('zh-Hant'), null);
  assert.equal(resolvePrintHyphenationModule('und'), null);
  assert.match(hyphenationRenderer, /const MODULE_LOADERS = \{/);
  assert.match(hyphenationRenderer, /element\.closest\('\[lang\]'\)/);
});

test('Hungarian print module adds discretionary breaks without changing source text', async () => {
  const source = 'megszentségteleníthetetlenségeskedéseitekért';
  const hyphenated = await hyphenatePrintText(source, 'hu-HU');

  assert.match(hyphenated, /\u00ad/);
  assert.equal(hyphenated.replaceAll('\u00ad', ''), source);
  assert.equal(await hyphenatePrintText(source, 'und'), source);
});

test('print hyphenation is optional and stays outside canonical manuscript state', () => {
  assert.match(styleEditor, /checked=\{body\.hyphenation\}/);
  assert.match(styleEditor, /setStyleValue\('body', 'hyphenation'/);
  assert.match(documentCanvas, /lang=\{manuscript\.locale\}/);
  assert.match(editorStyles, /--omi-publication-hyphens/);
  assert.match(exportRenderer, /target === 'print' && publicationHyphenationEnabled\(style\)/);
  assert.match(exportRenderer, /await hyphenatePrintHtml\(html, manuscript\.locale\)/);
  assert.match(exportRenderer, /\[data-omi-hyphenation-module\][\s\S]*hyphens: manual/);
});

test('print hyphenation parses only renderer-owned HTML before imported style data is embedded', () => {
  const hyphenation = exportRenderer.indexOf('html = await hyphenatePrintHtml(html, manuscript.locale)');
  const styleEmbedding = exportRenderer.indexOf('html = withPublicationStyleCss(html, style, target)');

  assert.ok(hyphenation >= 0);
  assert.ok(styleEmbedding > hyphenation);
});

test('publication CSS safely encodes imported values inside style elements', () => {
  const payload = '</style><script>globalThis.compromised = true</script>';
  const result = cssStringLiteral(payload);

  assert.doesNotMatch(result, /<script\b/i);
  assert.doesNotMatch(result, /<\/style><script/i);
  assert.match(result, /\\3c \/style\\3e \\3c script\\3e /);
  assert.match(exportRenderer, /cssFontFamily[\s\S]*cssStringLiteral\(family\)/);
  assert.match(exportRenderer, /cssContentString[\s\S]*return cssStringLiteral\(value\)/);
});
