import assert from 'node:assert/strict';
import test from 'node:test';
import './translation-public-export.test.ts';
import { createBlankManuscript } from '../src/document/createBlankManuscript.ts';
import { applyStructuredTranslations, buildStructuredTranslationPlan } from '../src/integrations/structuredExternalContent.ts';
import { archiveMissingTranslation, collectTranslationUnits, createManuscriptTranslation, currentUnits, editTranslationAlignment, getTranslationModel, synchronizeTranslation, translationFreshness, translationProgress, validateTranslationModel, withTranslationModel, TRANSLATION_EXTENSION, TRANSLATION_PROFILE, type ManuscriptTranslation } from '../src/model/translation.ts';
import { commitManuscriptRevision, extractManuscriptState, revertManuscriptToRevision } from '../src/model/versioning.ts';
import { calculateManuscriptStateDigestValue } from '../src/model/stateDigest.ts';
import { parseOmiJson, toPortableOmiManuscript } from '../src/services/omiPortableFormat.ts';
import { renderTranslationHtml } from '../src/services/translationExport.ts';

function source() {
  const manuscript = createBlankManuscript({ kind: 'study', locale: 'hu', title: 'Forrás' });
  manuscript.sections[0]!.title = 'Első szakasz';
  manuscript.sections[0]!.blocks = [{ id: 'block:one', type: 'paragraph', content: 'Eredeti szöveg' }];
  return manuscript;
}
function scope(manuscript: ReturnType<typeof source>) { return { kind: 'manuscript' as const, id: manuscript.id }; }
function reviewed(manuscript: ReturnType<typeof source>): ManuscriptTranslation {
  let variant = createManuscriptTranslation(manuscript, scope(manuscript), 'en', buildStructuredTranslationPlan(manuscript, scope(manuscript)).segments.map((segment) => ({ ...segment, text: `Translated ${segment.text}` })));
  for (const alignment of variant.alignments) {
    variant = editTranslationAlignment(manuscript, variant, alignment.id, { equivalence: 'equivalent' });
    variant = editTranslationAlignment(manuscript, variant, alignment.id, { status: 'reviewed' });
  }
  return variant;
}
function attach(manuscript: ReturnType<typeof source>, variant: ManuscriptTranslation) {
  return withTranslationModel(manuscript, { profile: TRANSLATION_PROFILE, variants: [variant] });
}

test('language variants normalize BCP47 independently of UI and reject same/unknown languages', () => {
  const m = source();
  assert.equal(createManuscriptTranslation(m, scope(m), 'EN_us').targetLanguage, 'en-US');
  for (const tag of ['hu', 'HU', 'mul', 'und', 'zxx', '!!']) assert.throws(() => createManuscriptTranslation(m, scope(m), tag));
  assert.throws(() => createManuscriptTranslation(m, { kind: 'manuscript', id: 'other' }, 'en'));
});

test('multiple languages and partial section/block translations preserve source without aliasing', () => {
  const m = source(); const before = structuredClone(m);
  const en = createManuscriptTranslation(m, scope(m), 'en');
  const de = createManuscriptTranslation(m, { kind: 'section', id: m.sections[0]!.id }, 'de');
  const fr = createManuscriptTranslation(m, { kind: 'block', id: 'block:one' }, 'fr');
  assert.equal(en.alignments.length, 3); assert.equal(de.alignments.length, 2); assert.equal(fr.alignments.length, 1);
  assert.notEqual(en.id, de.id); assert.deepEqual(m, before);
  assert.equal(en.alignments.every((item) => item.status === 'draft' && !item.targetText), true);
});

test('machine drafts reject duplicate/foreign anchors and preserve provider provenance', () => {
  const m = source(); const segment = buildStructuredTranslationPlan(m, scope(m)).segments[0]!;
  assert.throws(() => createManuscriptTranslation(m, scope(m), 'en', [segment, segment]));
  assert.throws(() => createManuscriptTranslation(m, scope(m), 'en', [{ id: 'other', text: 'bad' }]));
  const variant = createManuscriptTranslation(m, scope(m), 'en', [{ ...segment, text: 'Source' }], { method: 'machine', provider: 'DeepL', createdAt: new Date().toISOString() });
  assert.equal(variant.alignments[0]!.status, 'draft');
  assert.equal(variant.alignments[0]!.origin.provider, 'DeepL');
  assert.equal(variant.alignments[1]!.targetText, '');
});

test('unrelated source edits do not invalidate aligned text; addressed content changes do', () => {
  const m = source(); const v = reviewed(m); const block = v.alignments.find((item) => item.sourceObjectId === 'block:one')!;
  m.title = 'Új cím';
  assert.equal(translationFreshness(m, v, block), 'current');
  assert.equal(translationProgress(m, v).stale, 1);
  m.sections[0]!.blocks[0]!.content = 'Új szöveg';
  assert.equal(translationFreshness(m, v, block), 'stale');
  assert.throws(() => editTranslationAlignment(m, v, block.id, { status: 'reviewed' }));
  const annotated = editTranslationAlignment(m, v, block.id, { notes: 'Check the source change' });
  assert.equal(annotated.alignments.find((item) => item.id === block.id)!.status, 'draft');
});

test('repeated text at a shifted Tiptap path is stale even if text still matches', () => {
  const m = source();
  const node = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
  m.sections[0]!.blocks[0]!.content = JSON.stringify({ type: 'doc', content: [node('repeat'), node('repeat')] });
  const v = createManuscriptTranslation(m, scope(m), 'en');
  m.sections[0]!.blocks[0]!.content = JSON.stringify({ type: 'doc', content: [node('repeat')] });
  const item = v.alignments.find((item) => item.sourceObjectId === 'block:one')!;
  assert.equal(translationFreshness(m, v, item), 'stale');
});

test('explicit synchronization retains translations and notes and resets equivalence/review', () => {
  const m = source(); let v = reviewed(m); const item = v.alignments[0]!;
  v = editTranslationAlignment(m, v, item.id, { notes: 'Translator note' });
  m.title = 'Új cím';
  const rebased = synchronizeTranslation(m, v); const next = rebased.alignments[0]!;
  assert.equal(next.targetText, item.targetText); assert.equal(next.notes, 'Translator note');
  assert.equal(next.sourceText, m.title); assert.equal(next.status, 'draft'); assert.equal(next.equivalence, 'unassessed');
  assert.equal(v.alignments[0]!.sourceText, 'Forrás');
  m.locale = 'de'; assert.throws(() => synchronizeTranslation(m, rebased));
});

test('new source segments block publication until aligned and reviewed', () => {
  const m = source(); const v = reviewed(m);
  m.sections[0]!.blocks.push({ id: 'new-block', type: 'paragraph', content: 'New text' });
  assert.equal(translationProgress(m, v).added, 1); assert.equal(translationProgress(m, v).ready, false);
  const rebased = synchronizeTranslation(m, v);
  assert.equal(rebased.alignments.at(-1)!.targetText, '');
  assert.equal(translationProgress(m, rebased).ready, false);
});

test('missing source remains in ledger until explicit archival; restoration gets a new alignment ID', () => {
  const m = source(); const v = reviewed(m); const original = structuredClone(m.sections[0]!.blocks[0]!);
  const item = v.alignments.find((item) => item.sourceObjectId === original.id)!;
  m.sections[0]!.blocks = [];
  const rebased = synchronizeTranslation(m, v);
  assert.equal(translationFreshness(m, rebased, item), 'missing');
  assert.equal(rebased.alignments.length, v.alignments.length);
  const archived = archiveMissingTranslation(m, rebased, item.id);
  assert.deepEqual(archived.archivedAlignments[0], item);
  assert.equal(translationProgress(m, archived).ready, true);
  m.sections[0]!.blocks.push(original);
  const restored = synchronizeTranslation(m, archived);
  assert.notEqual(restored.alignments.at(-1)!.id, item.id);
  assert.equal(restored.archivedAlignments.length, 1);
});

test('target edits always require fresh review; empty/unassessed targets cannot be reviewed', () => {
  const m = source(); const v = reviewed(m); const item = v.alignments[0]!;
  assert.equal(editTranslationAlignment(m, v, item.id, { targetText: 'New', status: 'reviewed' }).alignments[0]!.status, 'draft');
  const draft = createManuscriptTranslation(m, scope(m), 'en');
  assert.throws(() => editTranslationAlignment(m, draft, draft.alignments[0]!.id, { status: 'reviewed' }));
  assert.equal(translationProgress(m, v).ready, true);
});

test('nested sections and blocks are traversed and translated without changing IDs or citation marks', () => {
  const m = source();
  m.sections[0]!.children = [{ id: 'nested', title: 'Nested', blocks: [{ id: 'parent', type: 'paragraph', content: 'Parent', children: [{ id: 'child', type: 'paragraph', content: 'Child' }] }] }];
  const s = { kind: 'section' as const, id: 'nested' };
  const plan = buildStructuredTranslationPlan(m, s);
  assert.equal(plan.segments.length, 3);
  const next = applyStructuredTranslations(m, s, plan.segments.map((segment) => ({ ...segment, text: `T:${segment.text}` })));
  assert.equal(next.sections[0]!.children![0]!.blocks[0]!.children![0]!.content, 'T:Child');
  assert.equal(m.sections[0]!.children![0]!.blocks[0]!.children![0]!.content, 'Child');
  assert.equal(collectTranslationUnits(m, { kind: 'block', id: 'child' })[0]!.objectId, 'child');
  const childOnly = applyStructuredTranslations(m, { kind: 'block', id: 'child' }, [{ id: 'legacy:child', text: 'C' }]);
  assert.equal(childOnly.sections[0]!.children![0]!.blocks[0]!.children![0]!.content, 'C');
});

test('portable roundtrip retains variants, unknown extensions, and historical snapshots; reversion restores prior translation', () => {
  const m = source(); const v = reviewed(m); const state = attach(m, v);
  state.extensions!['urn:example:future'] = { opaque: ['keep'] };
  const committed = commitManuscriptRevision(m, extractManuscriptState(state), { summary: 'Added translation', events: [{ operation: 'translation.model.set', targetId: m.id }] });
  const reopened = parseOmiJson(JSON.stringify(toPortableOmiManuscript(committed)));
  assert.deepEqual(getTranslationModel(reopened).variants, [v]);
  assert.deepEqual(reopened.extensions!['urn:example:future'], { opaque: ['keep'] });
  assert.ok(reopened.revisionHistory.revisions.at(-1)!.snapshot.state.extensions![TRANSLATION_EXTENSION]);
  const reverted = revertManuscriptToRevision(reopened, m.headRevisionId, { summary: 'Revert translation' });
  assert.equal(getTranslationModel(reverted).variants.length, 0);
  assert.notEqual(calculateManuscriptStateDigestValue(extractManuscriptState(m)), calculateManuscriptStateDigestValue(extractManuscriptState(committed)));
});

test('profile validation rejects duplicate IDs, malformed timestamps, and false reviewed claims', () => {
  const m = source(); const v = reviewed(m); const model = { profile: TRANSLATION_PROFILE, variants: [v] };
  validateTranslationModel(model, m.id);
  for (const mutate of [
    (v: ManuscriptTranslation) => { v.targetLanguage = 'HU'; },
    (v: ManuscriptTranslation) => { v.modifiedAt = 'bad'; },
    (v: ManuscriptTranslation) => { v.alignments[0]!.targetText = ''; },
    (v: ManuscriptTranslation) => { v.alignments[1]!.id = v.alignments[0]!.id; },
    (v: ManuscriptTranslation) => { v.alignments[0]!.origin = { method: 'machine', createdAt: new Date().toISOString() }; },
  ]) { const copy = structuredClone(v); mutate(copy); assert.throws(() => validateTranslationModel({ ...model, variants: [copy] }, m.id)); }
});

test('HTML release gates block stale/incomplete variants and escape all target/source markup', () => {
  const m = source(); let v = reviewed(m);
  v = editTranslationAlignment(m, v, v.alignments[0]!.id, { targetText: '<img src=x onerror="alert(1)">' });
  assert.throws(() => renderTranslationHtml(attach(m, v), v.id, 'parallel'));
  v = editTranslationAlignment(m, v, v.alignments[0]!.id, { status: 'reviewed' });
  const html = renderTranslationHtml(attach(m, v), v.id, 'parallel');
  assert.ok(html.includes('lang="hu"')); assert.ok(html.includes('lang="en"'));
  assert.ok(html.includes('&lt;img')); assert.equal(html.includes('<img'), false);
  const targetHtml = renderTranslationHtml(attach(m, v), v.id, 'target');
  assert.equal(targetHtml.includes('lang="hu"'), false);
  m.sections[0]!.blocks[0]!.content = 'Source edit';
  assert.throws(() => renderTranslationHtml(attach(m, v), v.id, 'target'));
});

test('deleted scopes stay inspectable and target-language changes cannot bypass stale detection', () => {
  const m = source(); const v = createManuscriptTranslation(m, { kind: 'section', id: m.sections[0]!.id }, 'en');
  m.sections = [];
  assert.equal(currentUnits(m, v).size, 0); assert.equal(translationProgress(m, v).stale, v.alignments.length);
});

test('ephemeral image previews do not stale translations backed by the same asset', () => {
  const m = source();
  const block = m.sections[0]!.blocks[0]!;
  block.type = 'image'; block.content = '';
  block.visual = { kind: 'image', src: 'blob:before', assetId: 'image-asset', mediaType: 'image/png', alt: 'Image description' };
  const variant = createManuscriptTranslation(m, scope(m), 'en');
  const item = variant.alignments.find((item) => item.sourceObjectId === block.id)!;
  block.visual.src = 'blob:after';
  assert.equal(translationFreshness(m, variant, item), 'current');
  block.visual.assetId = 'replacement-asset';
  assert.equal(translationFreshness(m, variant, item), 'stale');
});

test('unsupported future translation profiles roundtrip opaquely while damaged known profiles are rejected', () => {
  const m = source();
  m.extensions = { [TRANSLATION_EXTENSION]: { profile: 'future-profile', opaque: [42] } };
  const reopened = parseOmiJson(JSON.stringify(toPortableOmiManuscript(m)));
  assert.deepEqual(reopened.extensions, m.extensions);
  assert.throws(() => getTranslationModel(reopened));
  m.extensions = { [TRANSLATION_EXTENSION]: { profile: TRANSLATION_PROFILE, variants: 'damaged' } };
  assert.throws(() => toPortableOmiManuscript(m));
});
