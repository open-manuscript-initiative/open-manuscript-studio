import assert from 'node:assert/strict';
import test from 'node:test';
import { useStudioStore } from '../src/app/useStudioStore.ts';
import { addManuscriptTranslation, saveTranslationAlignment, removeManuscriptTranslation, synchronizeManuscriptTranslation } from '../src/app/translationActions.ts';
import { createBlankManuscript } from '../src/document/createBlankManuscript.ts';
import { getTranslationModel, translationProgress } from '../src/model/translation.ts';
import { parseOmiJson, toPortableOmiManuscript } from '../src/services/omiPortableFormat.ts';

test('translation actions share checkpoints, survive reopen, and can be reverted', () => {
  const m = createBlankManuscript({ kind: 'study', locale: 'hu', title: 'Original' });
  useStudioStore.getState().loadManuscript(m);
  useStudioStore.getState().setTitle('Working source');
  const id = addManuscriptTranslation({ kind: 'manuscript', id: m.id }, 'en');
  let state = useStudioStore.getState();
  const variant = getTranslationModel(state.manuscript).variants[0]!;
  assert.equal(state.pendingChangeSet, null);
  assert.equal(variant.sourceRevisionId, state.manuscript.revisionHistory.revisions.at(-2)!.id);
  assert.equal(variant.alignments[0]!.sourceText, 'Working source');
  saveTranslationAlignment(id, variant.alignments[0]!.id, { targetText: 'English target', equivalence: 'equivalent', notes: 'Translator note' });
  saveTranslationAlignment(id, variant.alignments[0]!.id, { status: 'reviewed' });
  state = useStudioStore.getState();
  const previousHead = state.manuscript.headRevisionId;
  const reopened = parseOmiJson(JSON.stringify(toPortableOmiManuscript(state.manuscript)));
  useStudioStore.getState().loadManuscript(reopened);
  assert.equal(getTranslationModel(useStudioStore.getState().manuscript).variants[0]!.alignments[0]!.notes, 'Translator note');
  useStudioStore.getState().setTitle('Changed source');
  assert.equal(translationProgress(useStudioStore.getState().manuscript, getTranslationModel(useStudioStore.getState().manuscript).variants[0]!).ready, false);
  synchronizeManuscriptTranslation(id);
  assert.equal(getTranslationModel(useStudioStore.getState().manuscript).variants[0]!.alignments[0]!.targetText, 'English target');
  removeManuscriptTranslation(id);
  assert.equal(getTranslationModel(useStudioStore.getState().manuscript).variants.length, 0);
  useStudioStore.getState().revertRevision(previousHead);
  assert.equal(getTranslationModel(useStudioStore.getState().manuscript).variants[0]!.alignments[0]!.status, 'reviewed');
});

test('machine previews cannot write into a different active document', () => {
  const original = createBlankManuscript({ kind: 'study', locale: 'hu', title: 'One' });
  const other = createBlankManuscript({ kind: 'study', locale: 'hu', title: 'Two' });
  useStudioStore.getState().loadManuscript(other);
  assert.throws(() => addManuscriptTranslation({ kind: 'manuscript', id: original.id }, 'en', [], original));
  assert.equal(getTranslationModel(useStudioStore.getState().manuscript).variants.length, 0);
  assert.equal(useStudioStore.getState().pendingChangeSet, null);
});
