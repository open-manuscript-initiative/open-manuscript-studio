import assert from 'node:assert/strict';
import test from 'node:test';

import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/components/UndoRedoControls.tsx', import.meta.url), 'utf8');
const styles = fs.readFileSync(new URL('../src/styles/header-insert-menu.css', import.meta.url), 'utf8');

test('undo and redo controls use clearly visible standard icons', () => {
  assert.match(source, /<Undo2 size=\{21\} strokeWidth=\{2\.5\}/);
  assert.match(source, /<Redo2 size=\{21\} strokeWidth=\{2\.5\}/);
  assert.match(styles, /\.focus-history-button:disabled[\s\S]*opacity: 0\.72/);
  assert.match(styles, /\.focus-history-button:disabled[\s\S]*color: #6b7280/);
});
