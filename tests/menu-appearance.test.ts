import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  DEFAULT_INTERFACE_FONT_SCALE,
  DEFAULT_MENU_FONT_SCALE,
  INTERFACE_FONT_SCALE_MAX,
  INTERFACE_FONT_SCALE_MIN,
  MENU_FONT_SCALE_MAX,
  MENU_FONT_SCALE_MIN,
  getInterfaceMetrics,
  getMenuFontSizeRem,
  normalizeInterfaceFontScale,
  normalizeMenuFontScale,
} from '../src/services/menuAppearancePreferences.ts';

test('menu font scale is bounded and snapped to supported steps', () => {
  assert.equal(normalizeMenuFontScale(Number.NaN), DEFAULT_MENU_FONT_SCALE);
  assert.equal(normalizeMenuFontScale(60), MENU_FONT_SCALE_MIN);
  assert.equal(normalizeMenuFontScale(143), MENU_FONT_SCALE_MAX);
  assert.equal(normalizeMenuFontScale(112), 110);
  assert.equal(normalizeMenuFontScale(113), 115);
});

test('interface font scale is bounded and scales typography and control metrics together', () => {
  assert.equal(
    normalizeInterfaceFontScale(Number.NaN),
    DEFAULT_INTERFACE_FONT_SCALE,
  );
  assert.equal(normalizeInterfaceFontScale(60), INTERFACE_FONT_SCALE_MIN);
  assert.equal(normalizeInterfaceFontScale(143), INTERFACE_FONT_SCALE_MAX);

  const normal = getInterfaceMetrics(100);
  const larger = getInterfaceMetrics(130);

  assert.equal(normal.fonts.md, 0.76);
  assert.equal(normal.controlHeight, 1.9);
  assert.ok(larger.fonts.md > normal.fonts.md);
  assert.ok(larger.fonts.title > normal.fonts.title);
  assert.ok(larger.controlHeight > normal.controlHeight);
  assert.ok(larger.controlPaddingX > normal.controlPaddingX);
  assert.ok(larger.textareaMinHeight > normal.textareaMinHeight);
});

test('menu font preference scales desktop and mobile typography together', () => {
  const normal = getMenuFontSizeRem(100);
  const larger = getMenuFontSizeRem(130);

  assert.equal(normal.desktop, 0.76);
  assert.equal(normal.mobile, 0.72);
  assert.ok(larger.desktop > normal.desktop);
  assert.ok(larger.mobile > normal.mobile);
});

test('settings exposes independent menu and interface controls before first render', () => {
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
  const formCss = readFileSync(
    new URL('../src/styles/desktop-form-layout.css', import.meta.url),
    'utf8',
  );

  assert.match(component, /id="studio-menu-font-size"/);
  assert.match(component, /id="studio-interface-font-size"/);
  assert.match(component, /saveMenuFontScale/);
  assert.match(component, /saveInterfaceFontScale/);
  assert.match(menu, /<MenuAppearanceSettings \/>/);
  assert.match(main, /initializeMenuAppearancePreferences\(\)/);
  assert.match(css, /--omi-menu-nav-font-size-desktop/);
  assert.match(css, /--omi-interface-font-md/);
  assert.match(css, /--omi-interface-control-height/);
  assert.match(css, /publication-style-ribbon/);
  assert.match(css, /publication-document-canvas-toolbar/);
  assert.match(
    css,
    /Do not target \.publication-document-canvas-stage or its document content/,
  );
  assert.match(formCss, /--omi-form-field-md: 28ch/);
  assert.match(
    formCss,
    /--omi-form-control-height: var\(--omi-interface-control-height, 1\.9rem\)/,
  );
});
