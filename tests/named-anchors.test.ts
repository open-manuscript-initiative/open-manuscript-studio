import assert from 'node:assert/strict';
import test from 'node:test';

import {
  collectNamedAnchorTargets,
  createNamedAnchor,
  renameNamedAnchor,
  toPortableBookmarkName,
  validateNamedAnchors,
} from '../src/model/namedAnchors.ts';

const sections = [
  {
    id: 's1',
    title: 'Introduction',
    blocks: [
      {
        id: 'b1',
        type: 'paragraph',
        content: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Bethlen Gábor and Transylvania' }] }] }),
      },
    ],
  },
];

test('creates stable semantic bookmarks independently from Word export names', () => {
  const anchor = createNamedAnchor({ name: 'Bethlen Gábor – politikai háttér', targetId: 'b1', targetKind: 'block', id: 'bookmark-1' }, '2026-08-26T00:00:00.000Z');
  assert.equal(anchor.name, 'Bethlen Gábor – politikai háttér');
  assert.equal(anchor.targetId, 'b1');
  assert.equal(anchor.exportName, 'Bethlen_Gabor_politikai_hatter');
});

test('portable bookmark names obey conservative Word-style token rules', () => {
  assert.equal(toPortableBookmarkName('17. század / első rész'), 'b_17_szazad_elso_resz');
  assert.ok(toPortableBookmarkName('a'.repeat(80)).length <= 40);
});

test('collects section and block destinations in document order', () => {
  const targets = collectNamedAnchorTargets(sections as never);
  assert.deepEqual(targets.map((target) => [target.kind, target.id]), [['section', 's1'], ['block', 'b1']]);
  assert.match(targets[1]?.label ?? '', /Bethlen Gábor/);
});

test('renaming preserves stable identity and target', () => {
  const anchor = createNamedAnchor({ name: 'Old name', targetId: 'b1', targetKind: 'block', id: 'bookmark-1' });
  const renamed = renameNamedAnchor(anchor, 'New name');
  assert.equal(renamed.id, anchor.id);
  assert.equal(renamed.targetId, anchor.targetId);
  assert.equal(renamed.name, 'New name');
  assert.equal(renamed.exportName, 'New_name');
});

test('validation detects duplicate names and missing targets', () => {
  const first = createNamedAnchor({ name: 'Same', targetId: 'b1', targetKind: 'block', id: 'a1' });
  const second = createNamedAnchor({ name: 'same', targetId: 'missing', targetKind: 'block', id: 'a2' });
  const issues = validateNamedAnchors({ sections: sections as never, namedAnchors: [first, second] });
  assert.ok(issues.some((issue) => issue.anchorId === 'a1' && issue.type === 'duplicate-name'));
  assert.ok(issues.some((issue) => issue.anchorId === 'a2' && issue.type === 'duplicate-name'));
  assert.ok(issues.some((issue) => issue.anchorId === 'a2' && issue.type === 'missing-target'));
});
