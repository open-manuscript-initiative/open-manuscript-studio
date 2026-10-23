import assert from 'node:assert/strict';
import test from 'node:test';

import { Schema } from '@tiptap/pm/model';
import { EditorState, TextSelection } from '@tiptap/pm/state';

import { applyContinuousDeletionInput } from '../src/editor/continuousDeletion.ts';

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { content: 'inline*', group: 'block' },
    heading: { content: 'inline*', group: 'block', attrs: { level: { default: 1 } } },
    text: { group: 'inline' },
  },
});

function applyDeletion(
  state: EditorState,
  direction: 'backward' | 'forward',
): { handled: boolean; state: EditorState } {
  let nextState = state;
  const handled = applyContinuousDeletionInput(state, direction, (transaction) => {
    nextState = state.apply(transaction);
  });
  return { handled, state: nextState };
}

test('deletes one grapheme backward from a collapsed caret', () => {
  const doc = schema.node('doc', null, [
    schema.node('paragraph', null, schema.text('A😀e\u0301')),
  ]);
  const state = EditorState.create({
    schema,
    doc,
    selection: TextSelection.create(doc, 6),
  });

  const result = applyDeletion(state, 'backward');

  assert.equal(result.handled, true);
  assert.equal(result.state.doc.textContent, 'A😀');
});

test('deletes one grapheme forward from a collapsed caret', () => {
  const doc = schema.node('doc', null, [
    schema.node('paragraph', null, schema.text('A😀e\u0301')),
  ]);
  const state = EditorState.create({
    schema,
    doc,
    selection: TextSelection.create(doc, 2),
  });

  const result = applyDeletion(state, 'forward');

  assert.equal(result.handled, true);
  assert.equal(result.state.doc.textContent, 'Ae\u0301');
});

test('deletes selected text as a single operation', () => {
  const doc = schema.node('doc', null, [
    schema.node('paragraph', null, schema.text('fresh text')),
  ]);
  const state = EditorState.create({
    schema,
    doc,
    selection: TextSelection.create(doc, 2, 7),
  });

  const result = applyDeletion(state, 'backward');

  assert.equal(result.handled, true);
  assert.equal(result.state.doc.textContent, 'text');
});

test('joins adjacent paragraphs when deletion starts at a paragraph boundary', () => {
  const doc = schema.node('doc', null, [
    schema.node('paragraph', null, schema.text('First')),
    schema.node('paragraph', null, schema.text('Second')),
  ]);
  const state = EditorState.create({
    schema,
    doc,
    selection: TextSelection.create(doc, 8),
  });

  const result = applyDeletion(state, 'backward');

  assert.equal(result.handled, true);
  assert.equal(result.state.doc.textContent, 'FirstSecond');
  assert.equal(result.state.doc.childCount, 1);
});
