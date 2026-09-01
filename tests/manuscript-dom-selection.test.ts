import assert from 'node:assert/strict';
import test from 'node:test';

import { getEntireManuscriptSelection } from '../src/editor/manuscriptDomSelection.ts';
import type { OmiSection } from '../src/types/omi.ts';

function paragraph(id: string, text: string) {
  return {
    id,
    type: 'paragraph',
    content: JSON.stringify({
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: text ? [{ type: 'text', text }] : undefined,
      }],
    }),
  };
}

test('Ctrl+A manuscript range spans the first through last text block across sections', () => {
  const sections: OmiSection[] = [
    {
      id: 'a',
      title: 'A',
      blocks: [paragraph('a1', 'Alpha')],
    },
    {
      id: 'empty',
      title: 'Empty',
      blocks: [],
    },
    {
      id: 'b',
      title: 'B',
      blocks: [
        {
          id: 'figure-1',
          type: 'figure',
          content: '',
          visual: {
            kind: 'image',
            src: 'data:image/png;base64,AA==',
            mediaType: 'image/png',
            alt: '',
          },
        },
        paragraph('b1', 'Omega'),
      ],
    },
  ];

  assert.deepEqual(getEntireManuscriptSelection(sections), {
    start: { blockId: 'a1', offset: 0 },
    end: { blockId: 'b1', offset: 5 },
  });
});

test('Ctrl+A manuscript range is empty when there are no textual blocks', () => {
  const sections: OmiSection[] = [{ id: 'empty', title: 'Empty', blocks: [] }];
  assert.equal(getEntireManuscriptSelection(sections), null);
});
