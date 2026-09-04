import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const menu = readFileSync(
  new URL('../src/components/StudioMenu.tsx', import.meta.url),
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

test('Studio menus close from the same left-side control position that opens them', () => {
  assert.match(
    menu,
    /<header className="studio-menu-header">\s*<button[^>]+className="studio-menu-close"/,
  );
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
    /@media \(max-width: 760px\)[\s\S]*?\.studio-menu-header\s*\{[\s\S]*?grid-template-columns:\s*2\.35rem minmax\(0, 1fr\) 2\.35rem;/,
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
  assert.match(
    academicShell,
    /@media \(max-width: 760px\)[\s\S]*?grid-template-areas:\s*\n\s*"identity context actions"\s*\n\s*"primary primary primary";/,
  );
});
