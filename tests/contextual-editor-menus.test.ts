import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const richTextToolbar = readFileSync(
  new URL('../src/components/RichTextToolbar.tsx', import.meta.url),
  'utf8',
);
const selectionActions = readFileSync(
  new URL('../src/components/SelectionActionToolbar.tsx', import.meta.url),
  'utf8',
);
const blockTypeExtension = readFileSync(
  new URL('../src/editor/extensions/OmiRichTextExtensions.ts', import.meta.url),
  'utf8',
);
const blockTypeStyles = readFileSync(
  new URL('../src/editor/extensions/OmiBlockTypeMenu.css', import.meta.url),
  'utf8',
);
const richTextStyles = readFileSync(
  new URL('../src/styles/rich-text.css', import.meta.url),
  'utf8',
);
const selectionStyles = readFileSync(
  new URL('../src/styles/selection-toolbar.css', import.meta.url),
  'utf8',
);

test('rich-text actions open only after an explicit context-menu gesture', () => {
  assert.match(richTextToolbar, /addEventListener\('contextmenu', handleContextMenu\)/);
  assert.match(richTextToolbar, /event\.key === 'ContextMenu'/);
  assert.match(richTextToolbar, /event\.shiftKey && event\.key === 'F10'/);
  assert.match(richTextToolbar, /event\.pointerType !== 'touch'/);
  assert.match(richTextToolbar, /TOUCH_LONG_PRESS_DELAY = 650/);
  assert.doesNotMatch(richTextToolbar, /editor\.on\('focus'/);
  assert.doesNotMatch(richTextToolbar, /editor\.on\('selectionUpdate'/);
});

test('selection actions share the explicit contextual toolbar', () => {
  assert.doesNotMatch(selectionActions, /position:\s*fixed/);
  assert.doesNotMatch(selectionActions, /addEventListener\('contextmenu'/);
  assert.doesNotMatch(selectionActions, /editor\.on\('selectionUpdate'/);
  assert.match(selectionActions, /if \(from === to\) return null/);
});

test('paragraph types stay behind the pilcrow button until requested', () => {
  assert.match(blockTypeExtension, /trigger\.textContent = '¶'/);
  assert.match(blockTypeExtension, /trigger\.setAttribute\('aria-haspopup', 'menu'\)/);
  assert.match(blockTypeExtension, /menu\.hidden = true/);
  assert.match(blockTypeExtension, /omi-block-type-menu--open/);
  assert.match(blockTypeStyles, /\.omi-block-type-menu__popover\[hidden\]/);
  assert.doesNotMatch(blockTypeStyles, /\.omi-block-editor:focus-within \.omi-block-type-menu,[\s\S]*pointer-events: auto/);
});

test('contextual menus stay inside narrow mobile viewports', () => {
  assert.match(richTextStyles, /width: min\(32rem, calc\(100vw - 1rem\)\)/);
  assert.match(richTextStyles, /\.omi-rich-text-toolbar-row[\s\S]*overflow-x: auto/);
  assert.match(selectionStyles, /\.omi-selection-action-toolbar[\s\S]*width: 100%;[\s\S]*max-width: 100%/);
  assert.match(blockTypeStyles, /right: 0\.5rem;\s*left: 0\.5rem/);
  assert.match(blockTypeStyles, /@media \(max-width: 400px\)[\s\S]*grid-template-columns: 1fr/);
});
