import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ensureSemanticCaption,
  resolveSemanticCaptions,
  updateCaptionSemantics,
} from '../src/model/captions.ts';
import { buildCaptionListEntries } from '../src/model/generatedLists.ts';
import type { OmiSection, OmiVisualBlockData } from '../src/types/omi.ts';

function image(caption: string, id: string): OmiSection['blocks'][number] {
  return {
    id,
    type: 'image',
    content: '',
    visual: {
      kind: 'image',
      src: 'data:image/png;base64,AA==',
      mediaType: 'image/png',
      alt: '',
      caption,
    },
  };
}

function table(caption: string, id: string): OmiSection['blocks'][number] {
  return {
    id,
    type: 'table',
    content: '',
    visual: {
      kind: 'table',
      cells: [['A']],
      caption,
    },
  };
}

test('semantic captions use independent sequences by label', () => {
  const first = ensureSemanticCaption(image('First image', 'img-1').visual!);
  const custom = updateCaptionSemantics(
    ensureSemanticCaption(image('First map', 'img-2').visual!),
    { label: 'Map' },
  );
  const second = ensureSemanticCaption(image('Second image', 'img-3').visual!);

  const sections: OmiSection[] = [{
    id: 'section-1',
    title: 'Section',
    blocks: [
      { ...image('First image', 'img-1'), visual: first },
      { ...image('First map', 'img-2'), visual: custom },
      { ...image('Second image', 'img-3'), visual: second },
    ],
  }];

  const captions = resolveSemanticCaptions(sections);
  assert.deepEqual(
    captions.map((caption) => caption.renderedLabel),
    ['Figure 1. First image', 'Map 1. First map', 'Figure 2. Second image'],
  );
});

test('section scoped caption sequences restart for every section', () => {
  const make = (title: string): OmiVisualBlockData => updateCaptionSemantics(
    ensureSemanticCaption(image(title, crypto.randomUUID()).visual!),
    { label: 'Plate', scope: 'section' },
  );

  const sections: OmiSection[] = [
    { id: 's1', title: 'One', blocks: [{ ...image('A', 'a'), visual: make('A') }] },
    { id: 's2', title: 'Two', blocks: [{ ...image('B', 'b'), visual: make('B') }] },
  ];

  assert.deepEqual(
    resolveSemanticCaptions(sections).map((caption) => caption.renderedLabel),
    ['Plate 1. A', 'Plate 1. B'],
  );
});

test('generated figure and table lists consume visual captions', () => {
  const sections: OmiSection[] = [{
    id: 's1',
    title: 'Section',
    blocks: [image('A figure', 'figure-1'), table('A table', 'table-1')],
  }];

  assert.deepEqual(
    buildCaptionListEntries(sections, 'figures').map((entry) => entry.label),
    ['Figure 1. A figure'],
  );
  assert.deepEqual(
    buildCaptionListEntries(sections, 'tables').map((entry) => entry.label),
    ['Table 1. A table'],
  );
});

test('removing caption text removes semantic caption metadata', () => {
  const withCaption = ensureSemanticCaption(image('Caption', 'img').visual!);
  assert.ok(withCaption.semanticCaption);

  const withoutCaption = ensureSemanticCaption(
    { ...withCaption, caption: '' } as OmiVisualBlockData,
    withCaption,
  );
  assert.equal(withoutCaption.semanticCaption, undefined);
});
