import type {OmiRoot} from './omi-ast.js';
import {
  convertOmiToHast,
  convertOmiToHtml,
} from './converter.js';

const document: OmiRoot = {
  type: 'root',
  id: 'omi-document-001',
  version: '0.1',

  children: [
    {
      type: 'paragraph',
      children: [
        {
          type: 'text',
          value:
            'Ez egy OMI dokumentumból generált bekezdés, amelyhez ',
        },
        {
          type: 'omi-note',
          noteId: 'note-1',
          label: '1',
          content:
            'Ez a jegyzet egy kijelölt szövegrészhez kapcsolódik.',
          metadata: {
            kind: 'annotation',
            author: 'OMI Editor',
            createdAt: '2026-07-19T08:00:00Z',
            visibility: 'public',
            importance: 2,
          },
        },
        {
          type: 'text',
          value: ' szövegközi jegyzet tartozik.',
        },
      ],
    },
  ],
};

async function main(): Promise<void> {
  const hast = await convertOmiToHast(document, {
    noteElement: 'button',
    includeMetadata: true,
    includeNoteContent: true,
  });

  const html = await convertOmiToHtml(document, {
    noteElement: 'button',
    includeMetadata: true,
    includeNoteContent: true,
  });

  console.log('--- HAST ---');
  console.dir(hast, {
    depth: null,
  });

  console.log('\n--- HTML ---');
  console.log(html);
}

main().catch((error: unknown) => {
  console.error('Az OMI-konverzió sikertelen.');

  if (error instanceof Error) {
    console.error(error.message);
    console.error(error.stack);
  } else {
    console.error(error);
  }

  process.exitCode = 1;
});
