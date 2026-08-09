import assert from 'node:assert/strict';
import test from 'node:test';

import { applyOjsInlineSemantics } from '../src/integrations/ojs/applyOjsInlineSemantics.ts';
import type { OjsLaunchPayload } from '../src/integrations/ojs/importOjsLaunch.ts';
import { createVersionedTestManuscript } from './testManuscriptFixture.ts';

test('applies OJS DOCX inline semantics to matching manuscript paragraphs', () => {
  const manuscript = createVersionedTestManuscript();
  const launch = {
    protocol: 'omi-integration/1',
    profile: 'omi-integration/1/ojs',
    sourceDocument: {
      kind: 'docx',
      paragraphs: [{
        text: 'Test paragraph.',
        inline: [
          { kind: 'text', text: 'Test ', semantics: ['strong'] },
          { kind: 'text', text: 'paragraph', semantics: ['emphasis', 'small-caps'] },
          { kind: 'text', text: '.' },
        ],
      }],
    },
  } as unknown as OjsLaunchPayload;

  const result = applyOjsInlineSemantics(manuscript, launch);
  const stored = result.sections[0]?.blocks[0]?.content ?? '';
  const parsed = JSON.parse(stored) as {
    content?: Array<{ content?: Array<{ marks?: Array<{ type?: string }> }> }>;
  };
  const nodes = parsed.content?.[0]?.content ?? [];
  assert.deepEqual(nodes[0]?.marks?.map((mark) => mark.type), ['bold']);
  assert.deepEqual(
    nodes[1]?.marks?.map((mark) => mark.type),
    ['italic', 'omiSmallCaps'],
  );
});
