import assert from 'node:assert/strict';
import test from 'node:test';
import { createBlankManuscript } from '../src/document/createBlankManuscript.ts';
import { createManuscriptTranslation, editTranslationAlignment, withTranslationModel, TRANSLATION_PROFILE } from '../src/model/translation.ts';
import { isPublicTranslationProofReady, renderTranslationHtml } from '../src/services/translationExport.ts';

function fixture() {
  const m = createBlankManuscript({ kind: 'study', locale: 'en', title: 'Public title' });
  const blockId = m.sections[0]!.blocks[0]!.id;
  m.annotations = [
    { id: 'public', type: 'note', targetBlockId: blockId, body: 'PUBLIC_NOTE', renderingHint: 'footnote' },
    { id: 'hidden', type: 'note', targetBlockId: blockId, body: 'PRIVATE_HIDDEN', renderingHint: 'hidden' },
    { id: 'editor', type: 'note', targetBlockId: blockId, body: 'PRIVATE_EDITOR', renderingHint: 'footnote', visibility: 'editor_only' },
    { id: 'workflow', type: 'comment', targetBlockId: blockId, body: 'PRIVATE_WORKFLOW', renderingHint: 'popup', visibility: 'author_and_editor' },
    { id: 'semantic', type: 'semantic', targetBlockId: blockId, body: 'PRIVATE_ORIGIN', renderingHint: 'hidden' },
  ];
  let v = createManuscriptTranslation(m, { kind: 'manuscript', id: m.id }, 'hu');
  for (const item of v.alignments) {
    v = editTranslationAlignment(m, v, item.id, { targetText: `Target ${item.sourceText}`, equivalence: 'equivalent', notes: 'PRIVATE_TRANSLATOR_NOTE' });
    v = editTranslationAlignment(m, v, item.id, { status: 'reviewed' });
  }
  return { m: withTranslationModel(m, { profile: TRANSLATION_PROFILE, variants: [v] }), id: v.id };
}

test('both translation proofs exclude private bodies, anchors and translator notes without altering portable state', () => {
  const { m, id } = fixture();
  const before = structuredClone(m);
  for (const mode of ['parallel', 'target'] as const) {
    const html = renderTranslationHtml(m, id, mode);
    assert.match(html, /Target PUBLIC_NOTE/);
    assert.doesNotMatch(html, /PRIVATE_|annotation:(hidden|editor|workflow|semantic):body/);
  }
  assert.deepEqual(m, before, 'Export must not delete or rewrite private authoring/history data');
});

test('private changes and new unreviewed private notes do not block public proof export', () => {
  const { m, id } = fixture();
  m.annotations.find((item) => item.id === 'hidden')!.body = 'CHANGED_PRIVATE';
  m.annotations.push({ id: 'new-private', type: 'note', targetBlockId: m.annotations[0]!.targetBlockId, body: 'NEW_PRIVATE', renderingHint: 'hidden' });
  assert.equal(isPublicTranslationProofReady(m, id), true, 'UI gate must also ignore private workspace completeness');
  for (const mode of ['parallel', 'target'] as const) assert.doesNotMatch(renderTranslationHtml(m, id, mode), /PRIVATE/);
});

test('current visibility is authoritative and newly public or stale public notes require review', () => {
  const { m, id } = fixture();
  m.annotations.find((item) => item.id === 'public')!.visibility = 'editor_only';
  assert.doesNotMatch(renderTranslationHtml(m, id, 'parallel'), /PUBLIC_NOTE/);
  const publicAgain = fixture();
  publicAgain.m.annotations.find((item) => item.id === 'public')!.body = 'Changed public note';
  assert.equal(isPublicTranslationProofReady(publicAgain.m, publicAgain.id), false);
  assert.throws(() => renderTranslationHtml(publicAgain.m, publicAgain.id, 'parallel'), /Review/);
  const exposed = fixture();
  exposed.m.annotations.find((item) => item.id === 'hidden')!.renderingHint = 'footnote';
  assert.throws(() => renderTranslationHtml(exposed.m, exposed.id, 'target'), /Review/);
});
