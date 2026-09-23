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
import {
  fallbackSystemFontFamilies,
  groupSystemFontFaces,
  inferSystemFontFaceStyle,
  preferredSystemFontFace,
} from '../src/services/systemFonts.ts';

const styleEditor = readFileSync(
  new URL('../src/components/PublicationStyleEditor.tsx', import.meta.url),
  'utf8',
);
const documentCanvas = readFileSync(
  new URL('../src/components/PublicationDocumentCanvas.tsx', import.meta.url),
  'utf8',
);
const sectionRuler = readFileSync(
  new URL('../src/components/PublicationSectionRuler.tsx', import.meta.url),
  'utf8',
);
const htmlSectionsEditor = readFileSync(
  new URL('../src/components/PublicationHtmlSectionsEditor.tsx', import.meta.url),
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
const systemFonts = readFileSync(
  new URL('../src/services/systemFonts.ts', import.meta.url),
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
const citationSystemStyles = readFileSync(
  new URL('../src/styles/citation-system.css', import.meta.url),
  'utf8',
);
const cslRenderingStyles = readFileSync(
  new URL('../src/styles/csl-rendering.css', import.meta.url),
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

test('Studio navigation collapses without leaving the active workspace and Home is explicit', () => {
  assert.match(studioMenu, /const \[navigationOpen, setNavigationOpen\] = useState\(true\)/);
  assert.match(studioMenu, /useState<StudioMenuView \| null>\(null\)/);
  assert.match(studioMenu, /externalContentActive = false/);
  assert.match(studioMenu, /const hasActiveContent = activeView !== null \|\| externalContentActive/);
  assert.match(studioMenu, /studio-menu-drawer--navigation-only/);
  assert.match(studioMenu, /hidden=\{!navigationOpen\}/);
  assert.match(studioMenu, /aria-expanded=\{navigationOpen\}/);
  assert.match(studioMenu, /setNavigationOpen\(false\)/);
  assert.match(studioMenu, /data-home-navigation="true"/);
  assert.match(studioMenu, /supplementalCopy\.home/);
  assert.match(studioMenu, /if \(event\.key !== 'Escape'\) return;[\s\S]*setNavigationOpen\(false\)/);
  assert.doesNotMatch(studioMenu, /onClick=\{onClose\}><X/);
  assert.match(studioShellStyles, /\.studio-menu-navigation\[hidden\] \{\s*display: none/);
  assert.match(studioShellStyles, /\.studio-menu-body\.studio-menu-body--navigation-collapsed \{\s*grid-template-columns: minmax\(0, 1fr\)/);
});

test('mobile manuscript menu uses a full-window grid with vertical-only scrolling', () => {
  assert.match(
    studioShellStyles,
    /@media \(max-width: 760px\)[\s\S]*\.studio-menu-body \{[\s\S]*position: relative;[\s\S]*display: block;[\s\S]*overflow: hidden;/,
  );
  assert.match(
    studioShellStyles,
    /@media \(max-width: 760px\)[\s\S]*\.studio-menu-navigation \{[\s\S]*position: absolute;[\s\S]*inset: 0;[\s\S]*z-index: 120;[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);[\s\S]*overflow-x: hidden;[\s\S]*overflow-y: auto;/,
  );
  assert.match(
    studioShellStyles,
    /\.studio-menu-body--navigation-open > \.studio-menu-content \{\s*display: none;/,
  );
  assert.doesNotMatch(
    studioShellStyles,
    /@media \(max-width: 760px\)[\s\S]*\.studio-menu-navigation \{[\s\S]*overflow-x: auto;/,
  );
  assert.match(
    studioShellStyles,
    /@media \(max-width: 760px\)[\s\S]*\.studio-menu-navigation \{[\s\S]*touch-action: pan-y;/,
  );
  assert.match(
    studioShellStyles,
    /\.studio-menu-content \{[\s\S]*max-width: 100%;[\s\S]*overflow-x: hidden;/,
  );
  assert.match(
    studioShellStyles,
    /@media \(max-width: 760px\)[\s\S]*padding: \.85rem \.85rem calc\(1\.25rem \+ env\(safe-area-inset-bottom\)\)/,
  );
  assert.match(
    citationSystemStyles,
    /@media \(max-width: 720px\)[\s\S]*\.omi-reference-item-actions \{[\s\S]*flex-wrap: wrap;[\s\S]*\.omi-reference-item-actions > \.studio-menu-primary-action,[\s\S]*width: 100%;/,
  );
  assert.match(
    cslRenderingStyles,
    /\.omi-csl-style-panel \{[\s\S]*max-width: 100%;[\s\S]*min-width: 0;/,
  );
  assert.match(
    cslRenderingStyles,
    /\.omi-csl-style-panel input,[\s\S]*\.omi-csl-style-panel select \{[\s\S]*max-width: 100%;[\s\S]*min-width: 0;/,
  );
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

test('live publication editor switches between print and semantic HTML5 visual editing', () => {
  assert.match(styleEditor, /useState<PublicationDocumentViewMode>\('print'\)/);
  assert.match(styleEditor, /documentViewMode === 'print'/);
  assert.match(styleEditor, /viewMode=\{documentViewMode\}/);
  assert.match(styleEditor, /onViewModeChange=\{changeDocumentViewMode\}/);
  assert.match(documentCanvas, /export type PublicationDocumentViewMode = 'print' \| 'html'/);
  assert.match(documentCanvas, /className="publication-document-view-switch"/);
  assert.match(documentCanvas, /data-publication-view=\{viewMode\}/);
  assert.match(documentCanvas, /<PublicationHtmlSectionsEditor/);
  assert.match(documentCanvas, /proofingMode="publication"/);
  assert.match(htmlSectionsEditor, /proofingMode="editor"/);
  assert.match(htmlSectionsEditor, /projectContinuousManuscriptDocument/);
  assert.match(documentCanvas, /viewMode === 'html' && semanticNotes\.length/);
  assert.match(documentCanvas, /window\.addEventListener\(EDITOR_ZOOM_EVENT, handleEditorZoom\)/);
  assert.match(documentCanvas, /printLayoutScale \* editorZoomScale\(editorZoomPercent\)/);
  assert.match(editorStyles, /\.publication-document-paper--html \{[\s\S]*width: min\(100%, 56rem\)/);
  assert.match(editorStyles, /\.publication-document-paper--html \{[\s\S]*zoom: var\(--omi-editor-zoom, 1\)/);
  assert.match(editorStyles, /\.publication-document-content--html \{[\s\S]*position: relative/);
  assert.match(editorStyles, /\.publication-html-section-editor \.omi-continuous-tiptap-editor \{[\s\S]*column-count: var\(--omi-section-columns, 1\)/);
  assert.match(editorStyles, /\.publication-document-view-switch button\[aria-pressed='true'\]/);
});

test('font families come from a dropdown with permission-gated system discovery', () => {
  assert.match(styleEditor, /<FontFamilySelect/);
  assert.match(styleEditor, /<SystemFontCatalogControls/);
  assert.match(styleEditor, /queryInstalledSystemFonts/);
  assert.match(styleEditor, /copy\.loadSystemFonts/);
  assert.match(styleEditor, /publication-font-option-sample/);
  assert.match(styleEditor, /sampleText=\{copy\.fontSample\}/);
  assert.match(styleEditor, /type="search"/);
  assert.match(systemFonts, /queryLocalFonts/);
  assert.match(systemFonts, /supportsLocalFontAccess/);
  assert.doesNotMatch(
    styleEditor,
    /<input value=\{style\.fonts\.body\.family\}/,
  );
  assert.doesNotMatch(
    styleEditor,
    /<input value=\{resolvedParagraphStyle\.fontFamily\}/,
  );
});

test('InDesign-like font faces infer weight and italic combinations', () => {
  assert.deepEqual(inferSystemFontFaceStyle('Thin'), { weight: 100, fontStyle: 'normal' });
  assert.deepEqual(inferSystemFontFaceStyle('ExtraLight Italic'), { weight: 200, fontStyle: 'italic' });
  assert.deepEqual(inferSystemFontFaceStyle('Demi Bold Oblique'), { weight: 600, fontStyle: 'italic' });
  assert.deepEqual(inferSystemFontFaceStyle('Ultra-Bold'), { weight: 800, fontStyle: 'normal' });
  assert.deepEqual(inferSystemFontFaceStyle('Heavy Kursiv'), { weight: 900, fontStyle: 'italic' });

  const fallback = fallbackSystemFontFamilies(['Publisher Serif']);
  const publisher = fallback.find((family) => family.family === 'Publisher Serif');
  assert.ok(publisher);
  assert.ok(publisher.faces.some((face) => face.style === 'Light Italic'));
  assert.ok(publisher.faces.some((face) => face.style === 'Semi Bold'));
  assert.ok(publisher.faces.some((face) => face.style === 'Black Italic'));
});

test('system font catalog groups actual faces and keeps the closest valid face', () => {
  const catalog = groupSystemFontFaces([
    { family: 'Example Serif', fullName: 'Example Serif Regular', style: 'Regular' },
    { family: 'Example Serif', fullName: 'Example Serif Medium', style: 'Medium' },
    { family: 'Example Serif', fullName: 'Example Serif Semibold Italic', style: 'Semibold Italic' },
    { family: 'Example Serif', fullName: 'Example Serif Bold', style: 'Bold' },
    { family: 'Example Serif', fullName: 'Duplicate Bold', style: 'Bold' },
  ]);

  assert.equal(catalog.length, 1);
  assert.deepEqual(
    catalog[0]?.faces.map((face) => [face.weight, face.fontStyle]),
    [[400, 'normal'], [500, 'normal'], [600, 'italic'], [700, 'normal']],
  );
  assert.equal(
    preferredSystemFontFace(catalog, 'Example Serif', 600, 'italic').style,
    'Semibold Italic',
  );
  assert.equal(
    preferredSystemFontFace(catalog, 'Example Serif', 650, 'normal').style,
    'Bold',
  );
  assert.match(styleEditor, /label=\{copy\.fontVariant\}/);
  assert.doesNotMatch(styleEditor, /<option value="300">300<\/option>/);
  assert.match(editorStyles, /\.publication-font-dropdown-list > button[\s\S]*grid-template-columns/);
  assert.match(editorStyles, /\.publication-font-option-sample[\s\S]*font-size/);
  assert.match(documentCanvas, /fontWeight: body\.fontWeight/);
  assert.match(exportRenderer, /font-weight: \$\{body\.fontWeight\}/);
});

test('author given and family names have independent publication typography', () => {
  assert.match(styleEditor, /style\.styles\.authorGivenName/);
  assert.match(styleEditor, /style\.styles\.authorFamilyName/);
  assert.match(styleEditor, /authorGivenName', 'fontVariantCaps'/);
  assert.match(styleEditor, /authorFamilyName', 'fontVariantCaps'/);
  assert.match(styleEditor, /authorGivenName', 'textTransform'/);
  assert.match(styleEditor, /authorFamilyName', 'textTransform'/);
  assert.match(documentCanvas, /publication-document-author-given-name/);
  assert.match(documentCanvas, /publication-document-author-family-name/);
  assert.match(editorStyles, /--omi-publication-author-given-weight/);
  assert.match(editorStyles, /--omi-publication-author-family-weight/);
  assert.match(exportRenderer, /\.article-front \.author-given-name/);
  assert.match(exportRenderer, /\.article-front \.author-family-name/);
});

test('publication view edits the complete structured manuscript instead of a sample paragraph', () => {
  assert.match(styleEditor, /<PublicationDocumentCanvas[\s\S]*style=\{style\}/);
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
  assert.match(documentCanvas, /<PublicationSectionRuler/);
  assert.match(sectionRuler, /publication-document-ruler/);
  assert.match(sectionRuler, /stageSectionLayoutChange/);
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

test('footnotes reserve space and travel with the reference line across a split paragraph', () => {
  const layout = paginatePublicationBlocks([{
    top: 0, height: 100, splittable: true,
    lines: Array.from({ length: 10 }, (_, index) => ({
      top: index * 10, height: 10, textOffset: index * 8,
      noteIds: index === 7 ? ['note-1'] : [],
    })),
  }, { top: 100, height: 10 }], 100, 40, {
    heights: new Map([['note-1', 30]]), lineHeight: 10, separatorHeight: 10,
  });
  assert.equal(layout.pageCount, 2);
  assert.deepEqual(layout.pageNotes?.[1], [{ id: 'note-1', offset: 0, height: 30 }]);
  assert.deepEqual(layout.flowBreaks, [{ blockIndex: 0, textOffset: 56, height: 70 }]);
  // The inline spacer already shifts the next block: do not shift it twice.
  assert.deepEqual(layout.placements[1], { pageIndex: 1, translateY: 0 });
});

test('multiple notes retain their reference order and repeated anchors do not duplicate notes', () => {
  const layout = paginatePublicationBlocks([
    { top: 0, height: 10, noteIds: ['b', 'a'] },
    { top: 10, height: 10, noteIds: ['a'] },
    { top: 20, height: 10, forcePageBreakBefore: true, noteIds: ['c'] },
  ], 100, 40, {
    heights: new Map([['a', 10], ['b', 10], ['c', 10]]), lineHeight: 10, separatorHeight: 10,
  });
  assert.deepEqual(layout.pageNotes?.map((notes) => notes.map((note) => note.id)), [['b', 'a'], ['c']]);
  assert.equal(layout.placements[2]?.pageIndex, 1);
});

test('long footnotes continue in complete lines without dropping any content', () => {
  const layout = paginatePublicationBlocks([{ top: 0, height: 10, noteIds: ['long'] }], 100, 40, {
    heights: new Map([['long', 130]]), lineHeight: 10, separatorHeight: 10,
  });
  assert.equal(layout.pageCount, 4);
  assert.deepEqual(layout.pageNotes?.flat(), [
    { id: 'long', offset: 0, height: 40 },
    { id: 'long', offset: 40, height: 40 },
    { id: 'long', offset: 80, height: 40 },
    { id: 'long', offset: 120, height: 10 },
  ]);
});

test('a heading follows its first text line when that line introduces a footnote', () => {
  const layout = paginatePublicationBlocks([
    { top: 0, height: 50 },
    { top: 50, height: 10, keepWithNext: true },
    { top: 60, height: 10, noteIds: ['note'] },
  ], 100, 40, { heights: new Map([['note', 30]]), lineHeight: 10, separatorHeight: 10 });
  assert.equal(layout.placements[1]?.pageIndex, 1);
  assert.equal(layout.placements[2]?.pageIndex, 1);
  assert.equal(layout.pageNotes?.[1]?.[0]?.id, 'note');
});

test('a new reference waits for a page with room to start its note beside a carried note', () => {
  const layout = paginatePublicationBlocks([
    { top: 0, height: 10, noteIds: ['long'] },
    { top: 10, height: 10, noteIds: ['next'] },
  ], 100, 40, {
    heights: new Map([['long', 80], ['next', 10]]), lineHeight: 10, separatorHeight: 10,
  });
  assert.equal(layout.placements[1]?.pageIndex, 2);
  assert.deepEqual(layout.pageNotes?.[2], [{ id: 'next', offset: 0, height: 10 }]);
});
