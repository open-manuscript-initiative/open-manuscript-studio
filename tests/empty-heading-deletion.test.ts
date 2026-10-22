import assert from 'node:assert/strict';
import test from 'node:test';

import { Schema } from '@tiptap/pm/model';
import { EditorState, TextSelection } from '@tiptap/pm/state';

import { removeEmptyHeadingTransaction } from '../src/editor/emptyHeadingDeletion.ts';

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { content: 'inline*', group: 'block' },
    heading: { content: 'inline*', group: 'block', attrs: { level: { default: 1 } } },
    text: { group: 'inline' },
  },
});

test('removes an empty heading without removing the following paragraph', () => {
  const doc = schema.node('doc', null, [
    schema.node('heading'),
    schema.node('paragraph', null, schema.text('Following text')),
  ]);
  const state = EditorState.create({
    schema,
    doc,
    selection: TextSelection.create(doc, 1),
  });

  const transaction = removeEmptyHeadingTransaction(state, 'Backspace');

  assert.ok(transaction);
  assert.deepEqual(transaction.doc.toJSON(), {
    type: 'doc',
    content: [{
      type: 'paragraph',
      content: [{ type: 'text', text: 'Following text' }],
    }],
  });
});

test('converts the only empty heading to a paragraph so the editor remains usable', () => {
  const doc = schema.node('doc', null, [schema.node('heading')]);
  const state = EditorState.create({
    schema,
    doc,
    selection: TextSelection.create(doc, 1),
  });

  const transaction = removeEmptyHeadingTransaction(state, 'Delete');

  assert.ok(transaction);
  assert.equal(transaction.doc.firstChild?.type.name, 'paragraph');
  assert.equal(transaction.doc.childCount, 1);
});

test('leaves non-empty headings and unrelated keys unchanged', () => {
  const doc = schema.node('doc', null, [
    schema.node('heading', null, schema.text('Heading')),
    schema.node('paragraph', null, schema.text('Following text')),
  ]);
  const state = EditorState.create({
    schema,
    doc,
    selection: TextSelection.create(doc, 2),
  });

  assert.equal(removeEmptyHeadingTransaction(state, 'Backspace'), null);
  const emptyDoc = schema.node('doc', null, [schema.node('heading')]);
  const emptyState = EditorState.create({
    schema,
    doc: emptyDoc,
    selection: TextSelection.create(emptyDoc, 1),
  });
  assert.equal(removeEmptyHeadingTransaction(emptyState, 'Enter'), null);
});
