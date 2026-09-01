import assert from 'node:assert/strict';
import test from 'node:test';

import { cutManuscriptRange } from '../src/editor/manuscriptClipboard.ts';
import {
  getManuscriptSelectionSegments,
  normalizeManuscriptSelectionRange,
} from '../src/editor/manuscriptDomSelection.ts';
import { getParentSectionId } from '../src/model/sectionStructure.ts';
import type { OmiSection } from '../src/types/omi.ts';

function section(
  id: string,
  blocks: Array<{ id: string; type?: string; content: string }>,
  parentSectionId?: string,
): OmiSection {
  return {
    id,
    title: id,
    ...(parentSectionId ? { parentSectionId } : {}),
    blocks: blocks.map((block) => ({
      id: block.id,
      type: block.type ?? 'paragraph',
      content: block.content,
    })),
  };
}

test('normalizes a backward drag across independent section editors', () => {
  const sections = [
    section('first', [{ id: 'a', content: 'Alpha' }]),
    section('second', [{ id: 'b', content: 'Beta' }]),
  ];

  assert.deepEqual(
    normalizeManuscriptSelectionRange(
      sections,
      { blockId: 'b', offset: 3 },
      { blockId: 'a', offset: 2 },
    ),
    {
      start: { blockId: 'a', offset: 2 },
      end: { blockId: 'b', offset: 3 },
    },
  );
});

test('projects a selection across an adjacent paragraph boundary', () => {
  const sections = [section('only', [
    { id: 'a', content: 'Alpha' },
    { id: 'b', content: 'Beta' },
  ])];

  assert.deepEqual(
    getManuscriptSelectionSegments(sections, {
      start: { blockId: 'a', offset: 2 },
      end: { blockId: 'b', offset: 3 },
    }),
    [
      { blockId: 'a', from: 2, to: 5 },
      { blockId: 'b', from: 0, to: 3 },
    ],
  );
});

test('deleting a multi-block selection joins compatible paragraph boundaries', () => {
  const sections = [section('only', [
    { id: 'a', content: 'Alpha middle' },
    { id: 'b', content: 'removed' },
    { id: 'c', content: 'prefix Omega' },
  ])];

  const next = cutManuscriptRange(sections, 'a', 6, 'c', 7);

  assert.deepEqual(next[0]?.blocks.map((block) => [block.id, plainText(block.content)]), [
    ['a', 'Alpha Omega'],
  ]);
});

test('deleting across sections removes the crossed boundary and keeps later content', () => {
  const sections = [
    section('first', [{ id: 'a', content: 'Alpha middle' }]),
    section('second', [
      { id: 'heading', type: 'heading', content: 'Second heading' },
      { id: 'b', content: 'prefix Omega' },
      { id: 'tail', content: 'Tail paragraph' },
    ]),
    section('child', [{ id: 'child-block', content: 'Child paragraph' }], 'second'),
  ];

  const next = cutManuscriptRange(sections, 'a', 6, 'b', 7);

  assert.deepEqual(next.map((item) => item.id), ['first', 'child']);
  assert.deepEqual(next[0]?.blocks.map((block) => [block.id, plainText(block.content)]), [
    ['a', 'Alpha Omega'],
    ['tail', 'Tail paragraph'],
  ]);
  assert.equal(getParentSectionId(next[1]!), 'first');
});

function plainText(content: string): string {
  try {
    return collectText(JSON.parse(content) as unknown);
  } catch {
    return content;
  }
}

function collectText(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const node = value as { text?: unknown; content?: unknown[] };
  if (typeof node.text === 'string') return node.text;
  return (node.content ?? []).map(collectText).join('');
}
