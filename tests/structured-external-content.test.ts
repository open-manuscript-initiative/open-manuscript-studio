import assert from 'node:assert/strict';
import test from 'node:test';

import { createSampleManuscript } from '../src/document/sampleManuscript.ts';
import {
  applyStructuredTranslations,
  buildStructuredTranslationPlan,
} from '../src/integrations/structuredExternalContent.ts';

test('structured translation excludes citation nodes and preserves inline marks', () => {
  const manuscript = createSampleManuscript();
  const section = manuscript.sections[0]!;
  const block = section.blocks[0]!;
  block.content = JSON.stringify({
    type: 'doc',
    content: [{
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Hello ', marks: [{ type: 'bold' }] },
        {
          type: 'omiCitation',
          attrs: {
            citationId: 'citation-1',
            citationIds: ['citation-1'],
            clusterId: 'cluster-1',
            anchorId: 'anchor-1',
            label: '(Doe, 2026)',
          },
        },
        { type: 'text', text: ' world' },
      ],
    }],
  });

  const scope = { kind: 'block' as const, id: block.id };
  const plan = buildStructuredTranslationPlan(manuscript, scope);

  assert.deepEqual(plan.segments.map((segment) => segment.text), ['Hello ', ' world']);
  assert.equal(plan.segments.some((segment) => segment.text.includes('Doe')), false);

  const translated = applyStructuredTranslations(
    manuscript,
    scope,
    plan.segments.map((segment, index) => ({
      ...segment,
      text: index === 0 ? 'Hallo ' : ' Welt',
    })),
  );
  const translatedBlock = translated.sections[0]!.blocks[0]!;
  const document = JSON.parse(translatedBlock.content) as {
    content: Array<{ content: Array<Record<string, unknown>> }>;
  };
  const content = document.content[0]!.content;

  assert.equal(content[0]!.text, 'Hallo ');
  assert.deepEqual(content[0]!.marks, [{ type: 'bold' }]);
  assert.equal(content[1]!.type, 'omiCitation');
  assert.equal((content[1]!.attrs as { label: string }).label, '(Doe, 2026)');
  assert.equal(content[2]!.text, ' Welt');
});

test('whole-manuscript translation leaves bibliography records untouched', () => {
  const manuscript = createSampleManuscript();
  manuscript.title = 'Original title';
  manuscript.abstract = 'Original abstract';
  manuscript.sections[0]!.title = 'Section title';
  manuscript.sections[0]!.blocks[0]!.content = 'Body text';
  manuscript.bibliographicRecords = [{
    id: 'record-1',
    type: 'book',
    title: 'Do not translate bibliography',
    contributors: [],
    identifiers: [],
    status: 'verified',
  }];

  const scope = { kind: 'manuscript' as const, id: manuscript.id };
  const plan = buildStructuredTranslationPlan(manuscript, scope);

  assert.equal(
    plan.segments.some((segment) => segment.text === 'Do not translate bibliography'),
    false,
  );

  const translations = plan.segments.map((segment) => ({
    ...segment,
    text: `T:${segment.text}`,
  }));
  const translated = applyStructuredTranslations(manuscript, scope, translations);

  assert.equal(translated.title, 'T:Original title');
  assert.equal(translated.abstract, 'T:Original abstract');
  assert.equal(translated.sections[0]!.title, 'T:Section title');
  assert.equal(translated.sections[0]!.blocks[0]!.content, 'T:Body text');
  assert.equal(
    translated.bibliographicRecords?.[0]?.title,
    'Do not translate bibliography',
  );
  assert.deepEqual(translated.citations, manuscript.citations);
});

test('code marks are never emitted as translation segments', () => {
  const manuscript = createSampleManuscript();
  const block = manuscript.sections[0]!.blocks[0]!;
  block.content = JSON.stringify({
    type: 'doc',
    content: [{
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Translate me' },
        { type: 'text', text: 'const secret = 1;', marks: [{ type: 'code' }] },
      ],
    }],
  });

  const plan = buildStructuredTranslationPlan(manuscript, {
    kind: 'block',
    id: block.id,
  });

  assert.deepEqual(plan.segments.map((segment) => segment.text), ['Translate me']);
});
