import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { screenImageBudget, screenImageRendition, screenRenditionSize } from '../src/services/screenImageRendition.ts';

import { coalescePublicationTextLines, paginatePublicationBlocks } from '../src/components/publicationPageLayout.ts';
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
const inDesignParagraphStyles = readFileSync(
  new URL('../src/components/InDesignParagraphStyleSettings.tsx', import.meta.url),
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
const viewOptionsModule = readFileSync(
  new URL('../src/components/publicationViewOptions.ts', import.meta.url),
  'utf8',
);
const assetBackedImage = readFileSync(
  new URL('../src/components/AssetBackedImage.tsx', import.meta.url),
  'utf8',
);
const visualBlockEditor = readFileSync(
  new URL('../src/components/VisualBlockEditor.tsx', import.meta.url),
  'utf8',
);
const frameEditor = readFileSync(
  new URL('../src/components/PublicationFrameEditor.tsx', import.meta.url),
  'utf8',
);
const nonPrintingMarks = readFileSync(
  new URL('../src/editor/nonPrintingMarks.ts', import.meta.url),
  'utf8',
);
const zoomControl = readFileSync(
  new URL('../src/components/EditorZoomControl.tsx', import.meta.url),
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
const newDocumentActions = readFileSync(
  new URL('../src/components/NewDocumentActions.tsx', import.meta.url),
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
const academicShellStyles = readFileSync(
  new URL('../src/styles/academic-shell.css', import.meta.url),
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

test('mobile manuscript menu keeps section grids in normal vertical flow', () => {
  assert.match(
    studioShellStyles,
    /@media \(max-width: 760px\)[\s\S]*\.studio-menu-body \{[\s\S]*position: relative;[\s\S]*display: block;[\s\S]*overflow: hidden;/,
  );
  assert.match(
    studioShellStyles,
    /@media \(max-width: 760px\)[\s\S]*\.studio-menu-navigation \{[\s\S]*position: absolute;[\s\S]*inset: 0;[\s\S]*z-index: 120;[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);[\s\S]*overflow-x: hidden;[\s\S]*overflow-y: auto;/,
  );
  assert.match(
    academicShellStyles,
    /@media \(max-width: 760px\)[\s\S]*\.studio-menu-navigation \{[\s\S]*display: flex;[\s\S]*flex-direction: column;[\s\S]*overflow-x: hidden;[\s\S]*overflow-y: auto;/,
  );
  assert.match(
    academicShellStyles,
    /@media \(max-width: 760px\)[\s\S]*\.studio-menu-nav-group \{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/,
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

test('paragraph style editor exposes the complete InDesign-compatible category set', () => {
  assert.match(styleEditor, /<InDesignParagraphStyleSettings/);
  for (const category of [
    'general',
    'basic',
    'advanced',
    'indents',
    'tabs',
    'rules',
    'border',
    'shading',
    'keep',
    'hyphenation',
    'justification',
    'columns',
    'nested',
    'grep',
    'bullets',
    'color',
    'opentype',
    'underline',
    'strikethrough',
    'export',
  ]) {
    assert.match(inDesignParagraphStyles, new RegExp("id: '" + category + "'"));
  }
  assert.match(inDesignParagraphStyles, /paragraphStyleWouldCreateCycle/);
  assert.match(inDesignParagraphStyles, /onSetProperty\('tabStops'/);
  assert.match(inDesignParagraphStyles, /onSetProperty\('grepStyles'/);
  assert.match(inDesignParagraphStyles, /onSetProperty\('openType'/);
  assert.match(inDesignParagraphStyles, /onSetProperty\('exportTagging'/);
  assert.match(inDesignParagraphStyles, /baselineGridAlignment/);
  assert.match(inDesignParagraphStyles, /decimalCharacter/);
  assert.match(inDesignParagraphStyles, /gapOverprint/);
  assert.match(inDesignParagraphStyles, /keepInFrame/);
  assert.match(inDesignParagraphStyles, /CornerFields/);
  assert.match(inDesignParagraphStyles, /OffsetFields/);
  assert.match(inDesignParagraphStyles, /alignLeftEdge/);
  assert.match(inDesignParagraphStyles, /scaleForDescenders/);
  assert.match(inDesignParagraphStyles, /restartAfterLevel/);
  assert.match(inDesignParagraphStyles, /miterLimit/);
  assert.match(inDesignParagraphStyles, /figureStyle/);
  assert.match(inDesignParagraphStyles, /positionalForm/);
  assert.match(inDesignParagraphStyles, /emitTag/);
  assert.match(editorStyles, /\.indesign-paragraph-style-settings \{[\s\S]*grid-template-columns:/);
  assert.match(editorStyles, /@media \(max-width: 900px\)[\s\S]*\.indesign-paragraph-style-settings \{[\s\S]*grid-template-columns: 1fr/);
});

test('InDesign paragraph style rendering covers extended native and approximate properties', () => {
  assert.match(exportRenderer, /keepWithPrevious/);
  assert.match(exportRenderer, /::first-letter/);
  assert.match(exportRenderer, /spaceBetweenSameStyle/);
  assert.match(exportRenderer, /font-variant-position: super/);
  assert.match(exportRenderer, /-webkit-text-stroke-width/);
  assert.match(exportRenderer, /text-decoration-style/);
  assert.match(exportRenderer, /box-decoration-break: clone/);
  assert.match(exportRenderer, /font-variant-numeric/);
  assert.match(exportRenderer, /lining-nums proportional-nums/);
  assert.match(exportRenderer, /oldstyle-nums tabular-nums/);
});

test('live publication editor switches between print and semantic HTML5 visual editing', () => {
  assert.match(styleEditor, /useState<PublicationDocumentViewMode>\(\s*'print'/);
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

test('publication editor has no generic word processor mode', () => {
  assert.doesNotMatch(styleEditor, /simpleMode|simple-word-processor/);
  assert.doesNotMatch(documentCanvas, /simpleMode|simple-word-processor/);
  assert.doesNotMatch(htmlSectionsEditor, /simpleMode|word-processing/);
  assert.doesNotMatch(studioMenu, /simple-editor|simpleWordProcessor/);
  assert.doesNotMatch(newDocumentActions, /simpleTextDocument|createSimpleTextDocument|editorMode/);
  assert.doesNotMatch(newDocumentActions, /EuroOffice|euroOffice|OfficeArchive|requestPlainDocumentWorkspace/);
  assert.match(newDocumentActions, /createAndOpenBlankOmiDocument/);
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
  assert.match(documentCanvas, /stageContinuousDocumentChange\(\s*projectContinuousManuscriptDocument\(parsed,\s*currentSections,\s*\{\s*textContentCache:\s*snapshot\s*\?\s*projectionCache\s*:\s*undefined,\s*\}\)/);
  assert.match(documentCanvas, /const \[projectionCache\] = useState\(\(\) => createTextProjectionCache<JSONContent>\(\)\);/);
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
    { pageIndex: 1, blockIndex: 1, textOffset: 8, height: 55 },
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
    { pageIndex: 1, blockIndex: 0, textOffset: 20, height: 50 },
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
    { pageIndex: 1, blockIndex: 0, textOffset: 10, height: 60 },
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
  assert.match(inDesignParagraphStyles, /paragraphStyleWouldCreateCycle/);
  assert.match(styleEditor, /setBlockParagraphStyle/);
  assert.match(inDesignParagraphStyles, /copy\.basedOn/);
  assert.match(inDesignParagraphStyles, /copy\.nextStyle/);
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
  assert.match(exportRenderer, /await hyphenatePrintHtml\(html, manuscript\.locale, /);
  assert.match(exportRenderer, /\[data-omi-hyphenation-module\][\s\S]*hyphens: manual/);
});

test('print hyphenation parses only renderer-owned HTML before imported style data is embedded', () => {
  const hyphenation = exportRenderer.indexOf('html = await hyphenatePrintHtml(html, manuscript.locale,');
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
  assert.deepEqual(layout.flowBreaks, [{ pageIndex: 1, blockIndex: 0, textOffset: 56, height: 70 }]);
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

test('note style can keep a footnote together by moving its reference to the next page', () => {
  const blocks = [
    { top: 0, height: 10, noteIds: ['first'] },
    { top: 10, height: 10, noteIds: ['second'] },
  ];
  const base = {
    heights: new Map([['first', 30], ['second', 30]]),
    lineHeight: 10,
    separatorHeight: 10,
  };
  // Exercise both the simple and variable page-master pagination paths.
  const layouts = [undefined, (index: number) => ({ bodyHeight: 100, bodyTop: index * 140 })];
  for (const metrics of layouts) {
    const continued = paginatePublicationBlocks(blocks, 100, 40, { ...base, allowPageContinuation: true }, metrics);
    assert.deepEqual(continued.pageNotes?.[0]?.map((fragment) => fragment.id), ['first', 'second']);
    assert.equal(continued.pageNotes?.[0]?.[1]?.height, 10);
    assert.equal(continued.pageNotes?.[1]?.[0]?.offset, 10);

    const kept = paginatePublicationBlocks(blocks, 100, 40, { ...base, allowPageContinuation: false }, metrics);
    assert.equal(kept.placements[1]?.pageIndex, 1);
    assert.deepEqual(kept.pageNotes?.[0], [{ id: 'first', offset: 0, height: 30 }]);
    assert.deepEqual(kept.pageNotes?.[1], [{ id: 'second', offset: 0, height: 30 }]);
  }
});

test('a note too long for a page still continues without truncation when keep-together is set', () => {
  const base = { heights: new Map([['long', 130]]), lineHeight: 10, separatorHeight: 10, allowPageContinuation: false };
  for (const metrics of [undefined, (index: number) => ({ bodyHeight: 100, bodyTop: index * 140 })]) {
    const result = paginatePublicationBlocks([{ top: 0, height: 10, noteIds: ['long'] }], 100, 40, base, metrics);
    assert.equal(result.pageCount, 4);
    assert.equal(result.pageNotes?.flat().reduce((height, note) => height + note.height, 0), 130);
    assert.deepEqual(result.pageNotes?.flat().map((note) => note.offset), [0, 40, 80, 120]);
  }
});

test('note continuation preference is exposed in the style editor and passed to the paged PDF exporter', () => {
  assert.match(inDesignParagraphStyles, /footnoteStyle=\{definition\.role === 'note'\}/);
  assert.match(inDesignParagraphStyles, /onSetProperty\('footnoteContinueOnNextPage'/);
  assert.match(documentCanvas, /allowPageContinuation: noteStyle\.footnoteContinueOnNextPage !== false/);
  assert.match(exportRenderer, /\.omi-page-footnote \{ break-inside: avoid-page; page-break-inside: avoid; \}/);
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


test('publication icon rail docks thumbnails, retains panels until toggled and allows resizing', () => {
  assert.match(styleEditor, /panelId="thumbnails"/);
  assert.match(styleEditor, /toggleSidebarPanel\('thumbnails'\)/);
  assert.match(styleEditor, /current === panel \? null : panel/);
  assert.doesNotMatch(styleEditor.slice(styleEditor.indexOf('if (!openPanel) return;'), styleEditor.indexOf('function patchStyle')), /addEventListener\('pointerdown'/);
  assert.match(styleEditor, /publication-style-side-resizer/);
  assert.match(styleEditor, /onPointerMove=\{\(event\) =>/);
  assert.match(styleEditor, /showRuler=\{rulerVisible\}/);
  assert.match(documentCanvas, /createPortal\(pageNavigator, pageNavigatorTarget\)/);
  assert.match(documentCanvas, /!previewOnly && !presentation && showRuler \? <PublicationSectionRuler/);
  assert.match(editorStyles, /publication-page-thumbnails \{[\s\S]*?flex-direction: column/);
});


test('publication editor view settings are local and provide fast or outlines-only graphics', () => {
  assert.match(viewOptionsModule, /graphicsMode: 'simplified'/);
  assert.match(viewOptionsModule, /createContext<PublicationGraphicsMode>\('full'\)/);
  assert.match(viewOptionsModule, /window\.localStorage\.setItem\(PUBLICATION_VIEW_OPTIONS_KEY/);
  assert.match(styleEditor, /PublicationGraphicsContext\.Provider value=\{presentation \? 'screen' : previewOnly \? 'full' : viewOptions\.graphicsMode\}/);
  assert.match(styleEditor, /panelId="view"/);
  assert.match(styleEditor, /'full', 'simplified', 'outlines'/);
  assert.match(visualBlockEditor, /\(graphicsMode === 'simplified' \|\| graphicsMode === 'outlines'\) && visual\.kind !== 'table'/);
  assert.match(visualBlockEditor, /lightweight \/>/);
  assert.match(visualBlockEditor, /omi-visual-block--lightweight/);
  assert.match(frameEditor, /<VisualBlockEditor/);
  assert.match(editorStyles, /\.omi-visual-block--outlines/);
});

test('publication ruler controls local editing aids without adding them to exports', () => {
  assert.match(sectionRuler, /onDisplayOptionChange\('nonPrintingMarks'/);
  assert.match(sectionRuler, /onDisplayOptionChange\('showMarginBoundaries'/);
  assert.match(sectionRuler, /onDisplayOptionChange\('showAlignmentGuides'/);
  assert.match(documentCanvas, /displayOptions\?\.showMarginBoundaries/);
  assert.match(documentCanvas, /displayOptions\?\.showAlignmentGuides/);
  assert.match(frameEditor, /showMarginBoundaries = false, showAlignmentGuides = false/);
  assert.match(nonPrintingMarks, /NON_PRINTING_MARKS_EVENT/);
  assert.match(zoomControl, /window\.addEventListener\(NON_PRINTING_MARKS_EVENT, sync\)/);
  assert.match(editorStyles, /@media print \{[\s\S]*\.publication-document-margin-boundary/);
});

test('fullscreen presentation uses screen graphics and disables manuscript edits', () => {
  assert.match(styleEditor, /requestFullscreen\(\)/);
  assert.match(styleEditor, /exitFullscreen\(\)/);
  assert.match(styleEditor, /className="publication-presentation-exit"/);
  assert.match(documentCanvas, /<PublicationPreviewContext\.Provider value=\{previewOnly \|\| presentation\}>/);
  assert.match(documentCanvas, /editable=\{!previewOnly && !presentation\}/);
  assert.match(editorStyles, /\.publication-style-editor--presentation/);
});

test('presentation loads screen-sized raster renditions without affecting the print sources', async () => {
  assert.match(viewOptionsModule, /'full' \| 'simplified' \| 'outlines' \| 'screen'/);
  assert.match(styleEditor, /data-graphics-mode=\{presentation \? 'screen' : viewOptions\.graphicsMode\}/);
  assert.match(visualBlockEditor, /screenResolution=\{graphicsMode === 'screen'\}/);
  assert.match(assetBackedImage, /screenImageRendition\(/);
  assert.match(assetBackedImage, /new IntersectionObserver/);
  assert.match(assetBackedImage, /if \(deferScreenImage\) return/);
  assert.match(assetBackedImage, /sourceDimensions\.current/);
  assert.match(assetBackedImage, /decodeEmbeddedRaster\(visual\.src\)/);
  assert.match(assetBackedImage, /loading=\{lightweight \|\| screenResolution/);
  assert.match(frameEditor, /captureFullGraphics \? 'full' : graphicsMode/);
  assert.match(frameEditor, /captureFrameGraphicSnapshots/);
  assert.match(frameEditor, /buildFrameExport\(manuscript, snapshot, graphics\)/);

  assert.equal(screenImageBudget(1920, 1080, 1), 1920);
  assert.equal(screenImageBudget(1920, 1080, 2), 3840);
  assert.equal(screenImageBudget(6000, 4000, 3), 4096);
  assert.deepEqual(screenRenditionSize({ width: 900, height: 500 }, 1920), { width: 900, height: 500 });
  const sized = screenRenditionSize({ width: 8000, height: 4000 }, 1920);
  assert.deepEqual(sized, { width: 1920, height: 960 });
  assert.ok(sized.width * sized.height <= 8_500_000);

  // The decoder keeps original pixel metadata for precise image annotations.
  const png = new Uint8Array(24);
  png.set([137, 80, 78, 71, 13, 10, 26, 10], 0);
  png.set([73, 72, 68, 82], 12);
  new DataView(png.buffer).setUint32(16, 400);
  new DataView(png.buffer).setUint32(20, 200);
  const original = await screenImageRendition(png, 'image/png', 640);
  assert.deepEqual(original.originalDimensions, { width: 400, height: 200 });
  assert.equal(original.blob.size, png.length);

  // Vectors stay vectors, even if they have intrinsic dimensions.
  const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
  const vector = await screenImageRendition(svg, 'image/svg+xml', 640, { width: 3000, height: 2000 });
  assert.equal(vector.blob.type, 'image/svg+xml');
  assert.equal(vector.blob.size, svg.length);
});

test('print pagination coalesces different inline glyph boxes into a single full line', () => {
  const lines = coalescePublicationTextLines([
    { top: 2, height: 14, textOffset: 0 },
    { top: 0, height: 10, textOffset: 4 },
    { top: 22, height: 14, textOffset: 8 },
  ], 'First a second', 20);
  assert.equal(lines.length, 2);
  assert.equal(lines[0]!.textOffset, 0);
  assert.equal(lines[1]!.textOffset, 8);
  assert.ok(lines.every((line) => line.height >= 20));
});

test('automatic hyphenation does not produce a bare mid-word page break', () => {
  const lines = coalescePublicationTextLines([
    { top: 0, height: 16, textOffset: 0 },
    { top: 20, height: 16, textOffset: 3 },
    { top: 40, height: 16, textOffset: 6 },
  ], 'révén további', 20);
  assert.deepEqual(lines.map((line) => line.textOffset), [0, 6]);
  assert.ok(lines[0]!.height >= 40 - 2);
  const layout = paginatePublicationBlocks([
    { top: 0, height: 30 },
    { top: 30, height: 60, splittable: true, lines },
  ], 65, 20);
  assert.equal(layout.flowBreaks.some((point) => point.textOffset === 3), false);
});

test('literal hyphens remain legal line boundaries', () => {
  const lines = coalescePublicationTextLines([
    { top: 0, height: 16, textOffset: 0 },
    { top: 20, height: 16, textOffset: 4 },
  ], 'well-known', 20);
  assert.deepEqual(lines.map((line) => line.textOffset), [0, 4]);
});

test('full line geometry leaves space for a footnote at a page boundary', () => {
  const lines = coalescePublicationTextLines([
    { top: 2, height: 12, textOffset: 0 },
    { top: 22, height: 12, textOffset: 6 },
  ], 'First second', 20);
  lines[1]!.noteIds = ['note'];
  const layout = paginatePublicationBlocks([
    { top: 0, height: 40, splittable: true, lines },
  ], 60, 20, { heights: new Map([['note', 20]]), lineHeight: 10, separatorHeight: 5 });
  assert.equal(layout.flowBreaks[0]?.textOffset, 6);
  assert.equal(layout.pageNotes?.[1]?.[0]?.id, 'note');
});

test('live facing-page pagination retains stable block projections and coalesces updates', () => {
  assert.ok(documentCanvas.includes('publicationEditorBlockSelector(child, index)'));
  assert.ok(documentCanvas.includes('element.dataset.blockId'));
  assert.ok(documentCanvas.includes('if (measuring) { pending = true; return; }'));
  assert.ok(documentCanvas.includes('if (queued) return;'));
  assert.ok(documentCanvas.includes('if (structureChanged) updateProvisionalProjection();'));
  assert.ok(documentCanvas.includes('!facingPages && (document.content?.length ?? 0)'));
  assert.ok(documentCanvas.includes('measuredNotes.delete(measuredNote)'));
});
