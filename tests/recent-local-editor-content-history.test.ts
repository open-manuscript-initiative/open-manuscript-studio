import assert from 'node:assert/strict';
import test from 'node:test';

import { RecentLocalEditorContentHistory } from '../src/editor/recentLocalEditorContentHistory.ts';

test('recognizes a delayed older local snapshot without acknowledging over the latest one', () => {
  const history = new RecentLocalEditorContentHistory();
  history.record('before delete');
  history.record('after delete');

  assert.equal(history.has('before delete'), true);
  history.acknowledge('before delete');
  assert.equal(history.has('after delete'), true);
});

test('acknowledges the latest local snapshot and forgets earlier snapshots', () => {
  const history = new RecentLocalEditorContentHistory();
  history.record('first edit');
  history.record('second edit');
  history.acknowledge('second edit');

  assert.equal(history.has('first edit'), false);
  assert.equal(history.has('second edit'), true);
});

test('clears local history when incoming content is external', () => {
  const history = new RecentLocalEditorContentHistory();
  history.record('local edit');
  history.clear();

  assert.equal(history.has('local edit'), false);
});
