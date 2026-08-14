import assert from 'node:assert/strict';
import test from 'node:test';

import { applyOjsStructuredContent } from '../src/integrations/ojs/applyOjsStructuredContent.ts';
import { createTestManuscript } from './testManuscriptFixture.ts';

function paragraph(id: string, text: string) {
  return {
    id,
    type: 'paragraph' as const,
    content: JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text }],
        },
      ],
    }),
  };
}

test('OJS structured tables replace flattened DOCX cell paragraphs', () => {
  const manuscript = createTestManuscript();
  manuscript.sections[0]!.blocks = [
    paragraph('anchor', 'Before table'),
    paragraph('cell-1', 'Elem'),
    paragraph('cell-2', 'Érték'),
    paragraph('cell-3', 'Megjegyzés'),
    paragraph('cell-4', 'Alfa'),
    paragraph('cell-5', '10'),
    paragraph('cell-6', 'Normál'),
    paragraph('cell-7', 'Béta'),
    paragraph('cell-8', '20'),
    paragraph('cell-9', 'Dőlt'),
    paragraph('cell-10', 'Gamma'),
    paragraph('cell-11', '30'),
    paragraph('cell-12', 'Félkövér'),
    paragraph('after', 'After table'),
  ];

  const launch = {
    sourceDocument: {
      structuredBlocks: [
        {
          kind: 'table',
          cells: [
            ['Elem', 'Érték', 'Megjegyzés'],
            ['Alfa', '10', 'Normál'],
            ['Béta', '20', 'Dőlt'],
            ['Gamma', '30', 'Félkövér'],
          ],
          headerRows: 1,
          afterText: 'Before table',
        },
      ],
    },
  } as never;

  const result = applyOjsStructuredContent(manuscript, launch);
  const blocks = result.sections[0]!.blocks;

  assert.equal(blocks.length, 3);
  assert.equal(blocks[0]!.id, 'anchor');
  assert.equal(blocks[1]!.type, 'table');
  assert.equal(blocks[1]!.visual?.kind, 'table');
  if (blocks[1]!.visual?.kind === 'table') {
    assert.deepEqual(blocks[1]!.visual.cells, [
      ['Elem', 'Érték', 'Megjegyzés'],
      ['Alfa', '10', 'Normál'],
      ['Béta', '20', 'Dőlt'],
      ['Gamma', '30', 'Félkövér'],
    ]);
    assert.equal(blocks[1]!.visual.headerRows, 1);
  }
  assert.equal(blocks[2]!.id, 'after');
});

test('OJS structured table cleanup is conservative when flattened cells do not match', () => {
  const manuscript = createTestManuscript();
  manuscript.sections[0]!.blocks = [
    paragraph('anchor', 'Before table'),
    paragraph('ordinary', 'This is ordinary manuscript text'),
  ];

  const launch = {
    sourceDocument: {
      structuredBlocks: [
        {
          kind: 'table',
          cells: [['Elem', 'Érték']],
          headerRows: 1,
          afterText: 'Before table',
        },
      ],
    },
  } as never;

  const result = applyOjsStructuredContent(manuscript, launch);
  const blocks = result.sections[0]!.blocks;

  assert.equal(blocks.length, 3);
  assert.equal(blocks[0]!.id, 'anchor');
  assert.equal(blocks[1]!.type, 'table');
  assert.equal(blocks[2]!.id, 'ordinary');
});
