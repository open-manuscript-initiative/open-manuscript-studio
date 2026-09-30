import assert from 'node:assert/strict';
import test from 'node:test';

import { applyOjsStructuredContent } from '../src/integrations/ojs/applyOjsStructuredContent.ts';
import { parseDocxSource } from '../server/src/integrations/ojs/docxSource.ts';
import { applyStructuredContent } from '../server/src/integrations/ojs/docxStructuredContent.ts';
import { createStoreZip, textZipEntry } from '../src/services/simpleZip.ts';
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

test('OJS and OMP source parsing keeps tables after self-closing Word paragraphs', () => {
  const documentXml = `<?xml version="1.0" encoding="UTF-8"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        <w:p><w:r><w:t>Before table</w:t></w:r></w:p>
        <w:p/>
        <w:tbl>
          <w:tblPr><w:tblLook w:firstRow="1"/></w:tblPr>
          <w:tr>
            <w:tc><w:p><w:r><w:t>Column heading</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Source</w:t></w:r></w:p></w:tc>
          </w:tr>
          <w:tr>
            <w:tc><w:p><w:r><w:t>1234</w:t></w:r></w:p></w:tc>
            <w:tc>
              <w:p><w:r><w:t>Primary record</w:t></w:r></w:p>
              <w:p><w:r><w:t>Additional note</w:t></w:r></w:p>
            </w:tc>
          </w:tr>
        </w:tbl>
        <w:p><w:r><w:t>After table</w:t></w:r></w:p>
      </w:body>
    </w:document>`;
  const docx = Buffer.from(createStoreZip([
    textZipEntry('word/document.xml', documentXml),
  ]));

  const source = parseDocxSource(
    docx,
    'fixture-file',
    'content-control-table.docx',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  );
  const enriched = applyStructuredContent(docx, source);

  assert.deepEqual(enriched.paragraphs.map((item) => item.text), ['Before table', 'After table']);
  assert.deepEqual(enriched.structuredBlocks?.map((item) => item.kind), [
    'paragraph', 'table', 'paragraph',
  ]);
  const table = enriched.structuredBlocks?.find((item) => item.kind === 'table');
  assert.equal(table?.kind, 'table');
  if (table?.kind !== 'table') return;
  assert.equal(table.headerRows, 1);
  assert.deepEqual(table.cells, [
    ['Column heading', 'Source'],
    ['1234', 'Primary record\nAdditional note'],
  ]);
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
