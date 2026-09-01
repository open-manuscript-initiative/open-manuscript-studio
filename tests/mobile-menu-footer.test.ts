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
const mobileLayout = readFileSync(
  new URL('../src/mobile/navigation/MobileLayout.tsx', import.meta.url),
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
