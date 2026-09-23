import assert from 'node:assert/strict';
import test from 'node:test';
import { Schema } from '@tiptap/pm/model';
import { EditorState } from '@tiptap/pm/state';
import { collectChangedWorkspaceReferences } from '../src/editor/changedWorkspaceReferences.ts';

const schema = new Schema({ nodes: {
  doc: { content: 'paragraph+' },
  paragraph: { content: 'inline*', group: 'block' },
  text: { group: 'inline' },
  omiNote: { inline: true, group: 'inline', atom: true, attrs: { id: { default: 'n1' } } },
  omiCitation: { inline: true, group: 'inline', atom: true },
  omiCrossReference: { inline: true, group: 'inline', atom: true },
} });
function state() {
  return EditorState.create({ schema, doc: schema.node('doc', null, [
    schema.node('paragraph', null, [schema.text('abcdefghij'), schema.node('omiNote')]),
    schema.node('paragraph', null, [schema.text('unrelated plain paragraph')]),
  ]) });
}
test('ordinary distant typing and selection-only transactions skip reference reconciliation', () => {
  assert.deepEqual([...collectChangedWorkspaceReferences([state().tr.insertText('x', 16)])], []);
  assert.deepEqual([...collectChangedWorkspaceReferences([state().tr])], []);
});
test('insertion, deletion and undo-like replacement retain reference reconciliation', () => {
  assert.deepEqual([...collectChangedWorkspaceReferences([state().tr.delete(11, 12)])], ['note']);
  assert.deepEqual([...collectChangedWorkspaceReferences([state().tr.insert(16, schema.node('omiCitation'))])], ['citation']);
  assert.deepEqual([...collectChangedWorkspaceReferences([state().tr.replaceWith(11, 12, schema.node('omiCrossReference'))])].sort(), ['cross-reference', 'note']);
});
test('multi-step transactions inspect each intermediate document before later shifts', () => {
  const tr = state().tr.insert(2, schema.node('omiCitation')).insertText('a long prefix ', 1);
  assert.ok(collectChangedWorkspaceReferences([tr]).has('citation'));
});
test('attribute-only steps with empty maps cannot bypass reference reconciliation', () => {
  const tr = state().tr.setNodeAttribute(11, 'id', 'n2');
  assert.ok(collectChangedWorkspaceReferences([tr]).has('note'));
});
test('paragraph split retargets a note in the moved fragment', () => {
  assert.ok(collectChangedWorkspaceReferences([state().tr.split(5)]).has('note'));
});
test('appended transactions contribute their reference changes', () => {
  assert.deepEqual([...collectChangedWorkspaceReferences([
    state().tr.insertText('x', 16), state().tr.insert(16, schema.node('omiCrossReference')),
  ])], ['cross-reference']);
});
