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
const studioShell = readFileSync(
  new URL('../src/styles/studio-shell.css', import.meta.url),
  'utf8',
);
const academicShell = readFileSync(
  new URL('../src/styles/academic-shell.css', import.meta.url),
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

test('native mobile keeps menu, OMI brand and personal account in the permanent top row', () => {
  assert.match(
    mobileLayout,
    /<header className="mobile-header">[\s\S]*?onClick=\{onOpenMenu\}[\s\S]*?mobile-header-title mobile-header-home[\s\S]*?mobile-account-button[\s\S]*?setView\('account'\)/,
  );
  assert.match(mobileLayout, /className="mobile-icon-button mobile-secondary-logout"/);
  assert.equal(
    mobileLayout.match(/mobile-nav-item--active/g)?.length,
    3,
  );
});

test('the desktop OMI brand is an explicit Home control', () => {
  assert.match(header, /className="focus-brand-lockup focus-brand-home"/);
  assert.match(header, /data-app-home-navigation="true"/);
  assert.match(header, /aria-label=\{menuCopy\.home\}/);
  assert.match(header, /onHome\(\);/);
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

test('responsive application header reserves the first row for menu, brand and personal account', () => {
  assert.match(
    header,
    /<div className="focus-header-top-row">[\s\S]*?focus-primary-menu-button[\s\S]*?focus-brand-lockup focus-brand-home[\s\S]*?focus-account-button/,
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
    /@media \(max-width: 760px\)[\s\S]*?\.focus-header-top-row\s*\{[\s\S]*?grid-template-columns:\s*44px minmax\(0, 1fr\) 44px;/,
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
