import assert from 'node:assert/strict';
import test from 'node:test';
import * as Y from 'yjs';
import { applySampleDocument, seedSampleDocument } from '../sample-document.mjs';

function textContent(node) {
  if (node instanceof Y.XmlText) return node.toString();
  if (node instanceof Y.XmlElement || node instanceof Y.XmlFragment) return node.toArray().map(textContent).join('');
  return '';
}

test('sample document update is idempotent when concurrent clients load an empty room', () => {
  const document = new Y.Doc();

  applySampleDocument(document, null);
  applySampleDocument(document, null);

  const fragment = document.getXmlFragment('default');
  assert.equal(fragment.length, 2);
  assert.equal(textContent(fragment.get(0)), 'A shared manuscript, written together');
  assert.equal(textContent(fragment.get(1)), 'This synthetic sample is shared in real time. Edit this text from two browser windows to see Yjs collaboration in action.');
  document.destroy();
});

test('saved rooms are repaired when earlier concurrent loads duplicated the synthetic sample', () => {
  const saved = new Y.Doc();
  const duplicate = new Y.Doc();
  seedSampleDocument(saved);
  seedSampleDocument(duplicate);
  Y.applyUpdate(saved, Y.encodeStateAsUpdate(duplicate));

  const restored = new Y.Doc();
  applySampleDocument(restored, Y.encodeStateAsUpdate(saved));

  const fragment = restored.getXmlFragment('default');
  assert.equal(fragment.length, 2);
  assert.equal(textContent(fragment.get(0)), 'A shared manuscript, written together');
  assert.equal(textContent(fragment.get(1)), 'This synthetic sample is shared in real time. Edit this text from two browser windows to see Yjs collaboration in action.');

  saved.destroy();
  duplicate.destroy();
  restored.destroy();
});
