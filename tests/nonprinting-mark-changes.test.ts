import assert from 'node:assert/strict';
import test from 'node:test';

import { Schema } from '@tiptap/pm/model';
import { EditorState, TextSelection } from '@tiptap/pm/state';

import { transactionChangesNonPrintingContent } from '../src/editor/nonPrintingMarkChanges.ts';

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { content: 'inline*', group: 'block' },
    text: { group: 'inline' },
  },
});

function stateWithText(text: string): EditorState {
  const doc = schema.node('doc', null, [schema.node('paragraph', null, schema.text(text))]);
  return EditorState.create({
    schema,
    doc,
    selection: TextSelection.create(doc, 1),
  });
}

test('refreshes non-printing decorations when a space is deleted', () => {
  const state = stateWithText('word word');
  const transaction = state.tr.delete(5, 6);

  assert.equal(transactionChangesNonPrintingContent(transaction), true);
});

test('refreshes non-printing decorations when a non-breaking space is deleted', () => {
  const state = stateWithText('word\u00a0word');
  const transaction = state.tr.delete(5, 6);

  assert.equal(transactionChangesNonPrintingContent(transaction), true);
});

test('keeps existing decorations mapped for ordinary character deletion', () => {
  const state = stateWithText('word');
  const transaction = state.tr.delete(2, 3);

  assert.equal(transactionChangesNonPrintingContent(transaction), false);
});
