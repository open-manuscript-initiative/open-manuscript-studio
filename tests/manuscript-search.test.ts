import assert from 'node:assert/strict';
import test from 'node:test';

import {
  countMatchesInBlockContent,
  replaceInBlockContent,
} from '../src/model/manuscriptSearch.ts';

test('counts matches in legacy plain-text block content', () => {
  assert.equal(countMatchesInBlockContent('alma Alma körte', 'alma'), 2);
  assert.equal(
    countMatchesInBlockContent('alma Alma körte', 'alma', { caseSensitive: true }),
    1,
  );
});

test('searches only Tiptap text nodes and preserves attributes', () => {
  const content = JSON.stringify({
    type: 'doc',
    attrs: { label: 'alma must not match here' },
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'alma ', marks: [{ type: 'italic' }] },
          { type: 'text', text: 'körte alma' },
        ],
      },
    ],
  });

  assert.equal(countMatchesInBlockContent(content, 'alma'), 2);

  const result = replaceInBlockContent(content, 'alma', 'szilva');
  assert.equal(result.replacements, 2);

  const parsed = JSON.parse(result.content);
  assert.equal(parsed.attrs.label, 'alma must not match here');
  assert.equal(parsed.content[0].content[0].text, 'szilva ');
  assert.deepEqual(parsed.content[0].content[0].marks, [{ type: 'italic' }]);
  assert.equal(parsed.content[0].content[1].text, 'körte szilva');
});

test('whole-word matching uses Unicode letter and number boundaries', () => {
  const text = 'ár árvíz kör-ár ár2 2ár';
  assert.equal(
    countMatchesInBlockContent(text, 'ár', { wholeWord: true }),
    2,
  );
});

test('empty query never changes content', () => {
  const content = 'unchanged';
  assert.deepEqual(replaceInBlockContent(content, '', 'x'), {
    content,
    replacements: 0,
  });
});
