import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const menu = readFileSync(
  new URL('../src/components/StudioMenu.tsx', import.meta.url),
  'utf8',
);
const keywordEditor = readFileSync(
  new URL('../src/components/KeywordEditor.tsx', import.meta.url),
  'utf8',
);
const menuWithHelp = readFileSync(
  new URL('../src/components/StudioMenuWithHelp.tsx', import.meta.url),
  'utf8',
);
const assignmentMenu = readFileSync(
  new URL('../src/components/AssignmentStudioMenu.tsx', import.meta.url),
  'utf8',
);
const registerPage = readFileSync(
  new URL('../src/auth/RegisterPage.tsx', import.meta.url),
  'utf8',
);
const searchOverlay = readFileSync(
  new URL('../src/components/SearchReplaceOverlayBase.tsx', import.meta.url),
  'utf8',
);
const mobileLayout = readFileSync(
  new URL('../src/mobile/navigation/MobileLayout.tsx', import.meta.url),
  'utf8',
);
const mobileStyles = readFileSync(
  new URL('../src/mobile/styles/mobile.css', import.meta.url),
  'utf8',
);
const editorZoom = readFileSync(
  new URL('../src/components/EditorZoomControl.tsx', import.meta.url),
  'utf8',
);
const editorZoomStyles = readFileSync(
  new URL('../src/components/EditorZoomControl.css', import.meta.url),
  'utf8',
);
const editorZoomModel = readFileSync(
  new URL('../src/editor/editorZoom.ts', import.meta.url),
  'utf8',
);
const nonPrintingModel = readFileSync(
  new URL('../src/editor/nonPrintingMarks.ts', import.meta.url),
  'utf8',
);
const nonPrintingExtension = readFileSync(
  new URL('../src/editor/extensions/OmiNonPrintingMarksExtension.ts', import.meta.url),
  'utf8',
);
const nonPrintingStyles = readFileSync(
  new URL('../src/editor/extensions/OmiNonPrintingMarks.css', import.meta.url),
  'utf8',
);
const richTextExtensions = readFileSync(
  new URL('../src/editor/extensions/OmiRichTextExtensions.ts', import.meta.url),
  'utf8',
);
const studioShell = readFileSync(
  new URL('../src/styles/studio-shell.css', import.meta.url),
  'utf8',
);
const academicShell = readFileSync(
  new URL('../src/styles/academic-shell.css', import.meta.url),
  'utf8',
);
const accountStyles = readFileSync(
  new URL('../src/styles/account.css', import.meta.url),
  'utf8',
);
const footer = readFileSync(
  new URL('../src/components/Footer.tsx', import.meta.url),
  'utf8',
);
const header = readFileSync(
  new URL('../src/components/Header.tsx', import.meta.url),
  'utf8',
);

test('Studio menu views never embed the application footer', () => {
  assert.doesNotMatch(menu, /from ['"]\.\/Footer['"]/);
  assert.doesNotMatch(menu, /<Footer\s*\/>/);
  assert.doesNotMatch(menuWithHelp, /from ['"]\.\/Footer['"]/);
  assert.doesNotMatch(menuWithHelp, /<Footer\s*\/>/);
  assert.doesNotMatch(menuWithHelp, /studio-menu-mobile-footer/);
});

test('the mobile application keeps exactly one footer outside menu content', () => {
  assert.match(mobileLayout, /from ['"]\.\.\/\.\.\/components\/Footer['"]/);
  assert.equal(mobileLayout.match(/<Footer\s*\/>/g)?.length, 1);
});

test('the native mobile OMI brand is an explicit Home control', () => {
  assert.match(mobileLayout, /className="mobile-header-title mobile-header-home"/);
  assert.match(mobileLayout, /data-app-home-navigation="true"/);
  assert.match(mobileLayout, /aria-label=\{menuCopy\.home\}/);
  assert.match(mobileLayout, /setView\('editor'\);[\s\S]*?onHome\(\);/);
});

test('native mobile keeps menu, OMI brand, language, personal account and logout in the permanent top row without a redundant bottom bar', () => {
  assert.match(
    mobileLayout,
    /<header className="mobile-header">[\s\S]*?onClick=\{onOpenMenu\}[\s\S]*?mobile-header-title mobile-header-home[\s\S]*?mobile-header-actions[\s\S]*?<LanguageSwitcher \/>[\s\S]*?mobile-account-button[\s\S]*?setView\('account'\)[\s\S]*?mobile-top-logout/,
  );
  assert.doesNotMatch(mobileLayout, /mobile-secondary-logout/);
  assert.doesNotMatch(mobileLayout, /mobile-bottom-nav/);
  assert.doesNotMatch(mobileLayout, /mobile-nav-item/);
});

test('native mobile removes the obsolete bottom navigation and reserves only the system safe-area inset', () => {
  assert.doesNotMatch(mobileLayout, /mobile-bottom-nav|mobile-nav-item/);
  assert.doesNotMatch(mobileStyles, /\.mobile-bottom-nav|\.mobile-nav-item/);
  assert.match(
    mobileStyles,
    /\.mobile-shell\s*\{[\s\S]*?grid-template-rows:\s*auto auto minmax\(0, 1fr\);/,
  );
  assert.match(
    mobileStyles,
    /\.mobile-workspace\s*\{[\s\S]*?padding-bottom:\s*env\(safe-area-inset-bottom, 0px\);/,
  );
});

test('normal manuscript editing exposes a Word-style document zoom without changing manuscript data', () => {
  assert.match(editorZoomModel, /MIN_EDITOR_ZOOM = 50/);
  assert.match(editorZoomModel, /MAX_EDITOR_ZOOM = 200/);
  assert.match(editorZoomModel, /EDITOR_ZOOM_EVENT = 'omi:editor-zoom-change'/);
  assert.match(editorZoom, /type="range"/);
  assert.match(editorZoom, /setZoom\(100\)/);
  assert.match(editorZoom, /localStorage\.setItem\(EDITOR_ZOOM_STORAGE_KEY/);
  assert.match(editorZoom, /dispatchEditorZoomChange\(zoom\)/);
  assert.match(editorZoomStyles, /\.omi-manuscript-page\s*\{\s*zoom:\s*var\(--omi-editor-zoom, 1\);/);
  assert.match(
    editorZoomStyles,
    /@media \(max-width: 760px\)[\s\S]*?\.omi-editor-zoom__toggle\s*\{[\s\S]*?display:\s*inline-flex;/,
  );
});

test('non-printing manuscript marks are display-only, persistent and available in every rich-text editor', () => {
  assert.match(nonPrintingModel, /NON_PRINTING_MARKS_STORAGE_KEY = 'omi\.show-nonprinting-marks'/);
  assert.match(editorZoom, /aria-pressed=\{showNonPrintingMarks\}/);
  assert.match(editorZoom, /NON_PRINTING_MARKS_CLASS/);
  assert.match(editorZoom, /NON_PRINTING_MARKS_STORAGE_KEY/);
  assert.match(editorZoom, /<Pilcrow size=\{18\}/);
  assert.match(nonPrintingExtension, /Decoration\.widget[\s\S]*?'↵'/);
  assert.match(nonPrintingExtension, /Decoration\.widget[\s\S]*?'¶'/);
  assert.match(nonPrintingExtension, /decorations\.map\(transaction\.mapping, transaction\.doc\)/);
  assert.match(nonPrintingExtension, /transactionAddsNonPrintingStructure/);
  assert.match(nonPrintingStyles, /\.omi-show-nonprinting-marks \.omi-tab-node::after[\s\S]*?content: '→'/);
  assert.match(richTextExtensions, /OMI_RICH_TEXT_EXTENSIONS[\s\S]*OmiNonPrintingMarksExtension/);
  assert.match(richTextExtensions, /OMI_CONTINUOUS_RICH_TEXT_EXTENSIONS[\s\S]*OmiNonPrintingMarksExtension/);
});

test('the desktop OMI brand is an explicit Home control', () => {
  assert.match(header, /className="focus-brand-lockup focus-brand-home"/);
  assert.match(header, /data-app-home-navigation="true"/);
  assert.match(header, /aria-label=\{menuCopy\.home\}/);
  assert.match(header, /onHome\(\);/);
});

test('mobile account overlay fills the viewport width and uses only the persistent top close control', () => {
  assert.match(
    accountStyles,
    /@media\(max-width:720px\)\{[\s\S]*?\.app-header\.focus-header\.focus-header--account-open\{z-index:1100\}[\s\S]*?\.account-overlay\{display:block\}[\s\S]*?\.account-overlay-backdrop\{display:none\}[\s\S]*?\.account-drawer\{width:100vw;max-width:none;height:100dvh;[\s\S]*?overflow-x:hidden;box-shadow:none\}/,
  );
  assert.match(
    accountStyles,
    /@media\(max-width:720px\)\{[\s\S]*?\.account-close\{display:none\}/,
  );
  assert.match(
    header,
    /focus-account-button\$\{accountOpen \? ' is-open' : ''\}[\s\S]*?setAccountOpen\(\(current\) => !current\)[\s\S]*?accountOpen \? \(\s*<X size=\{18\}/,
  );
  assert.match(
    accountStyles,
    /@media\(max-width:720px\)\{[\s\S]*?\.account-page\{width:100%;max-width:none;margin:0;/,
  );
  assert.match(
    accountStyles,
    /@media\(max-width:720px\)\{[\s\S]*?\.account-card\{width:100%;max-width:none;box-sizing:border-box;/,
  );
});

test('Account no longer contains its own logout action', () => {
  const accountPanel = readFileSync(
    new URL('../src/components/AccountPanel.tsx', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(accountPanel, /className="account-logout"/);
  assert.doesNotMatch(accountPanel, /<LogOut/);
});

test('the application footer links to the Studio wiki', () => {
  assert.equal(
    footer.match(/https:\/\/github\.com\/open-manuscript-initiative\/open-manuscript-studio\/wiki/g)?.length,
    1,
  );
});

test('Studio menu header controls keep the established left-side trigger position', () => {
  assert.match(
    menu,
    /<header className="studio-menu-header">\s*<button[^>]+className="studio-menu-close studio-menu-navigation-toggle"/,
  );
  assert.match(menu, /aria-expanded=\{navigationOpen\}/);
  assert.match(
    assignmentMenu,
    /<header className="studio-menu-header">\s*<button[^>]+className="studio-menu-close"/,
  );
  assert.match(
    studioShell,
    /\.studio-menu-header\s*\{[\s\S]*?grid-template-columns:\s*auto minmax\(0, 1fr\) auto;/,
  );
  assert.match(
    academicShell,
    /@media \(max-width: 760px\)[\s\S]*?\.studio-menu-header\s*\{[\s\S]*?grid-template-columns:\s*2\.35rem minmax\(0, 1fr\) 2\.35rem;[\s\S]*?align-items:\s*start;/,
  );
  assert.match(
    academicShell,
    /\.studio-menu-backdrop--native-mobile \.studio-menu-header\s*\{[\s\S]*?grid-template-columns:\s*44px minmax\(0, 1fr\) 44px;/,
  );
  assert.match(
    academicShell,
    /\.studio-menu-header\s*\{[\s\S]*?padding:\s*\.65rem clamp\(\.8rem, 2vw, 1\.5rem\);/,
  );
  assert.match(
    studioShell,
    /@media \(max-width: 760px\)[\s\S]*?\.studio-menu-drawer\s*\{[\s\S]*?animation:\s*none;/,
  );
});

test('the registration page does not show the obsolete alpha notice', () => {
  assert.doesNotMatch(registerPage, /auth\.alphaNotice|auth-alpha-notice/);
});

test('search opens and closes through the same persistent trigger', () => {
  assert.match(mobileLayout, /onClick=\{toggleSearchOverlay\}/);
  assert.match(mobileLayout, /searchOpen \? \(\s*<X/);
  assert.match(searchOverlay, /SEARCH_OVERLAY_TOGGLE_EVENT/);
  assert.doesNotMatch(searchOverlay, /aria-label=\{copy\.close\}/);
});

test('responsive application header reserves the first row for menu, brand, language, account and logout', () => {
  assert.match(
    header,
    /<div className="focus-header-top-row">[\s\S]*?focus-primary-menu-button[\s\S]*?focus-brand-lockup focus-brand-home[\s\S]*?focus-header-top-actions[\s\S]*?<LanguageSwitcher \/>[\s\S]*?focus-account-button[\s\S]*?focus-logout-button/,
  );
  assert.match(
    header,
    /<div className="focus-header-secondary-row">[\s\S]*?focus-header-tools[\s\S]*?focus-header-primary-action[\s\S]*?focus-header-actions/,
  );
  assert.match(
    academicShell,
    /\.app-header\.focus-header\s*\{[\s\S]*?position:\s*sticky;[\s\S]*?flex-direction:\s*column;/,
  );
  assert.match(
    academicShell,
    /@media \(max-width: 760px\)[\s\S]*?\.focus-header-top-row\s*\{[\s\S]*?grid-template-columns:\s*44px minmax\(0, 1fr\) auto;/,
  );
  assert.match(
    academicShell,
    /@media \(max-width: 760px\)[\s\S]*?\.focus-header-secondary-row\s*\{[\s\S]*?display:\s*flex;[\s\S]*?overflow-x:\s*auto;/,
  );
});

test('manuscript data renders extended scholarly metadata exactly once', () => {
  assert.equal(menu.match(/<ScholarlyMetadataPanel \/>/g)?.length, 1);
  assert.doesNotMatch(keywordEditor, /ScholarlyMetadataPanel/);
});

test('the application header leaves document titles to the document tabs', () => {
  assert.doesNotMatch(header, /focus-header-context/);
  assert.doesNotMatch(header, /focus-header-manuscript-title/);
  assert.doesNotMatch(header, /\{manuscript\.title\}/);
  assert.doesNotMatch(academicShell, /\.focus-header-context/);
  assert.doesNotMatch(academicShell, /\.focus-header-manuscript-title/);
});
