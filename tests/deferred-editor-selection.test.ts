import assert from 'node:assert/strict';
import test from 'node:test';
import { Schema } from '@tiptap/pm/model';
import { AllSelection, NodeSelection, TextSelection } from '@tiptap/pm/state';
import { remapDeferredEditorSelection } from '../src/editor/deferredEditorSelection.ts';

const schema = new Schema({ nodes: {
  doc: { content: 'block+' },
  text: { group: 'inline' },
  paragraph: { group: 'block', content: 'text*', attrs: { omiBlockId: { default: null } } },
  figure: { group: 'block', atom: true, attrs: { omiBlockId: { default: null } } },
}, marks: { strong: {} } });
const paragraph = (id: string, text: string) => schema.node('paragraph', { omiBlockId: id }, text ? schema.text(text) : undefined);
const doc = (...nodes: ReturnType<typeof paragraph>[]) => schema.node('doc', null, nodes);

test('deferred selection follows its block through preceding insertion and local prefix edits', () => {
  const before = doc(paragraph('a', 'First'), paragraph('b', 'Beta text'));
  const start = before.child(0).nodeSize + 1;
  const selection = TextSelection.create(before, start + 2, start + 4);
  const after = doc(paragraph('new', 'Inserted'), paragraph('a', 'First changed'), paragraph('b', 'NEW Beta text'));
  const restored = remapDeferredEditorSelection(before, selection, after);
  assert.equal(restored.$anchor.node(1).attrs.omiBlockId, 'b');
  assert.equal(after.textBetween(restored.from, restored.to), 'ta');
});

test('deferred backward selection keeps its direction and clamps shortened text', () => {
  const before = doc(paragraph('a', 'First'), paragraph('b', 'Second'));
  const start = before.child(0).nodeSize + 1;
  const selection = TextSelection.create(before, start + 4, 2);
  const after = doc(paragraph('a', 'First'), paragraph('b', 'Sec'));
  const restored = remapDeferredEditorSelection(before, selection, after);
  assert.ok(restored.anchor > restored.head);
  assert.equal(restored.$anchor.node(1).attrs.omiBlockId, 'b');
  assert.ok(restored.$anchor.parentOffset <= after.child(1).content.size);
});

test('deferred node selection follows its identity and removed destinations remain valid', () => {
  const figure = schema.node('figure', { omiBlockId: 'image' });
  const before = doc(paragraph('a', 'First'), figure, paragraph('b', 'End'));
  const selection = NodeSelection.create(before, before.child(0).nodeSize);
  const after = doc(paragraph('new', 'New'), paragraph('a', 'First'), figure, paragraph('b', 'End'));
  const restored = remapDeferredEditorSelection(before, selection, after);
  assert.ok(restored instanceof NodeSelection);
  assert.equal(restored.node.attrs.omiBlockId, 'image');
  const removed = doc(paragraph('new', 'New'));
  const fallback = remapDeferredEditorSelection(before, selection, removed);
  assert.ok(fallback.from >= 0 && fallback.to <= removed.content.size);
  assert.ok(fallback.$from.parent.isTextblock);
});

test('deferred select-all covers the complete refreshed document', () => {
  const before = doc(paragraph('a', 'First'));
  const after = doc(paragraph('new', 'New'), paragraph('a', 'First'));
  const restored = remapDeferredEditorSelection(before, new AllSelection(before), after);
  assert.ok(restored instanceof AllSelection);
  assert.equal(restored.to, after.content.size);
});

test('formatting-only changes preserve the original text range', () => {
  const before = doc(paragraph('a', 'Selected text'));
  const after = doc(schema.node('paragraph', { omiBlockId: 'a' }, schema.text('Selected text', [schema.mark('strong')])));
  const selection = TextSelection.create(before, 2, 6);
  const restored = remapDeferredEditorSelection(before, selection, after);
  assert.equal(restored.anchor, 2);
  assert.equal(restored.head, 6);
});
