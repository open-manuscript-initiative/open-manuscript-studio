import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  DEFAULT_MENU_FONT_SCALE,
  MENU_FONT_SCALE_MAX,
  MENU_FONT_SCALE_MIN,
  getMenuFontSizeRem,
  normalizeMenuFontScale,
} from '../src/services/menuAppearancePreferences.ts';

test('menu font scale is bounded and snapped to supported steps', () => {
  assert.equal(normalizeMenuFontScale(Number.NaN), DEFAULT_MENU_FONT_SCALE);
  assert.equal(normalizeMenuFontScale(60), MENU_FONT_SCALE_MIN);
  assert.equal(normalizeMenuFontScale(143), MENU_FONT_SCALE_MAX);
  assert.equal(normalizeMenuFontScale(112), 110);
  assert.equal(normalizeMenuFontScale(113), 115);
});

test('menu font preference scales desktop and mobile typography together', () => {
  const normal = getMenuFontSizeRem(100);
  const larger = getMenuFontSizeRem(130);

  assert.equal(normal.desktop, 0.76);
  assert.equal(normal.mobile, 0.72);
  assert.ok(larger.desktop > normal.desktop);
  assert.ok(larger.mobile > normal.mobile);
});

test('settings exposes the menu font control and applies it before first render', () => {
  const component = readFileSync(
    new URL('../src/components/MenuAppearanceSettings.tsx', import.meta.url),
    'utf8',
  );
  const menu = readFileSync(
    new URL('../src/components/StudioMenu.tsx', import.meta.url),
    'utf8',
  );
  const main = readFileSync(
    new URL('../src/main.tsx', import.meta.url),
    'utf8',
  );
  const css = readFileSync(
    new URL('../src/styles/menu-appearance.css', import.meta.url),
    'utf8',
  );

  assert.match(component, /type="range"/);
  assert.match(component, /saveMenuFontScale/);
  assert.match(menu, /<MenuAppearanceSettings \/>/);
  assert.match(main, /initializeMenuAppearancePreferences\(\)/);
  assert.match(css, /--omi-menu-nav-font-size-desktop/);
  assert.match(css, /--omi-menu-nav-font-size-mobile/);
});
