import assert from 'node:assert/strict';
import test from 'node:test';
import { useStudioStore } from '../src/app/useStudioStore.ts';
import { applyOjsMetadataImport } from '../src/app/ojsMetadataActions.ts';
import { createBlankManuscript } from '../src/document/createBlankManuscript.ts';
import {
  parseOmiJson,
  toPortableOmiManuscript,
} from '../src/services/omiPortableFormat.ts';
import { ojsMetadataSnapshot } from './fixtures/ojsMetadataSnapshot.mjs';
import type { OjsMetadataSnapshot } from '../src/services/ojsMetadataTypes.ts';

const snapshot = () => ojsMetadataSnapshot() as OjsMetadataSnapshot;
test('selected imports form a persistent revision and can be reverted', () => {
  useStudioStore
    .getState()
    .loadManuscript(
      createBlankManuscript({
        kind: 'study',
        locale: 'hu',
        title: 'Local title',
      }),
    );
  const before = useStudioStore.getState().manuscript;
  applyOjsMetadataImport(before, snapshot(), 'hu', ['title']);
  const after = useStudioStore.getState().manuscript;
  assert.equal(after.title, snapshot().metadata.title.hu);
  assert.notEqual(after.headRevisionId, before.headRevisionId);
  assert.equal(useStudioStore.getState().pendingChangeSet, null);
  const reopened = parseOmiJson(JSON.stringify(toPortableOmiManuscript(after)));
  assert.equal(reopened.title, after.title);
  useStudioStore.getState().revertRevision(before.headRevisionId);
  assert.equal(useStudioStore.getState().manuscript.title, before.title);
});
test('a local edit or document switch during inspection rejects the entire import', () => {
  const before = useStudioStore.getState().manuscript;
  useStudioStore.getState().setTitle('Concurrent local edit');
  const current = useStudioStore.getState();
  assert.throws(
    () => applyOjsMetadataImport(before, snapshot(), 'hu', ['title']),
    /changed/,
  );
  assert.strictEqual(useStudioStore.getState().manuscript, current.manuscript);
  assert.strictEqual(
    useStudioStore.getState().pendingChangeSet,
    current.pendingChangeSet,
  );
});
test('an identical field import does not create a revision', () => {
  const current = useStudioStore.getState().manuscript;
  const same = snapshot();
  same.metadata.title.hu = current.title;
  applyOjsMetadataImport(current, same, 'hu', ['title']);
  assert.strictEqual(useStudioStore.getState().manuscript, current);
});
