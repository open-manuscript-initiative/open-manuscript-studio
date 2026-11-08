import assert from 'node:assert/strict';
import test from 'node:test';
import { createBlankManuscript } from '../src/document/createBlankManuscript.ts';
import { getMachineTranslationCopy } from '../src/i18n/machineTranslationTranslations.ts';
import { getTranslationModel, translationProgress } from '../src/model/translation.ts';
import { createTranslationCommands, type TranslationWorkingState } from '../src/services/translationCommands.ts';
import { machineTranslationSourceChanged, requestMachineTranslationSuggestions, selectedMachineTranslationSegments } from '../src/services/machineTranslationSuggestions.ts';
import type { DeepLTranslationRequest } from '../src/services/integrationExecutionApi.ts';

function source() {
  const m = createBlankManuscript({ kind: 'study', locale: 'hu', title: 'Forrás' });
  m.sections[0]!.title = 'Szakasz';
  m.sections[0]!.blocks = [{ id: 'body', type: 'paragraph', content: 'Eredeti szöveg' }];
  return m;
}
function response(request: DeepLTranslationRequest) {
  return { providerId: 'deepl' as const, targetLanguage: request.targetLanguage, scope: request.scope,
    segments: request.segments.map((segment) => ({ ...segment, text: `Translated ${segment.text}` })) };
}

test('requesting suggestions retains a source snapshot and never writes a translation', async () => {
  const m = source(); const original = structuredClone(m);
  const proposal = await requestMachineTranslationSuggestions(m, { kind: 'manuscript', id: m.id }, 'en', undefined, async (request) => response(request));
  assert.deepEqual(m, original);
  assert.equal(getTranslationModel(m).variants.length, 0);
  assert.equal(proposal.suggestions[0]!.sourceText, 'Forrás');
  assert.equal(proposal.suggestions[0]!.text, 'Translated Forrás');
  assert.equal(machineTranslationSourceChanged(m, proposal), false);
  m.title = 'Későbbi cím';
  assert.equal(proposal.basis.title, 'Forrás');
  assert.equal(machineTranslationSourceChanged(m, proposal), true);
});

test('form/source changes during an in-flight request do not change its language or scope', async () => {
  const m = source(); const scope = { kind: 'manuscript' as const, id: m.id };
  let finish!: () => void;
  const pending = requestMachineTranslationSuggestions(m, scope, 'en', undefined, (request) => new Promise((resolve) => { finish = () => resolve(response(request)); }));
  m.title = 'Later source'; scope.id = 'other';
  finish();
  const proposal = await pending;
  assert.equal(proposal.basis.title, 'Forrás');
  assert.equal(proposal.scope.id, m.id);
  assert.equal(proposal.targetLanguage, 'en');
});

test('only explicitly selected, editable suggestions become unreviewed drafts', async () => {
  let state: TranslationWorkingState = { manuscript: source(), pendingChangeSet: null };
  const original = structuredClone(state.manuscript);
  const proposal = await requestMachineTranslationSuggestions(state.manuscript, { kind: 'manuscript', id: original.id }, 'en', undefined, async (request) => response(request));
  proposal.suggestions[0]!.text = 'Human-corrected title';
  proposal.suggestions[1]!.included = false;
  proposal.suggestions[2]!.text = '';
  const commands = createTranslationCommands({ update: (transform) => { state = transform(state); }, checkpoint: () => {}, actorAgentId: () => undefined });
  commands.addManuscriptTranslation(proposal.scope, proposal.targetLanguage, selectedMachineTranslationSegments(proposal), proposal.basis,
    { method: 'machine', provider: 'DeepL', createdAt: proposal.createdAt });
  const variant = getTranslationModel(state.manuscript).variants[0]!;
  assert.equal(state.manuscript.title, original.title);
  assert.deepEqual(state.manuscript.sections, original.sections);
  assert.equal(variant.alignments[0]!.targetText, 'Human-corrected title');
  assert.equal(variant.alignments[0]!.origin.provider, 'DeepL');
  assert.equal(variant.alignments[1]!.targetText, '');
  assert.equal(variant.alignments[1]!.origin.method, 'human');
  assert.equal(variant.alignments[2]!.targetText, '');
  assert.ok(variant.alignments.every((item) => item.status === 'draft' && item.equivalence === 'unassessed'));
  assert.equal(translationProgress(state.manuscript, variant).ready, false);
});

test('discarded/all-empty suggestions cannot be accepted and do not mutate the document', async () => {
  const m = source(); const original = structuredClone(m);
  const proposal = await requestMachineTranslationSuggestions(m, { kind: 'manuscript', id: m.id }, 'en', undefined, async (request) => response(request));
  proposal.suggestions.forEach((item) => { item.included = false; });
  assert.throws(() => selectedMachineTranslationSegments(proposal), /nonempty/);
  proposal.suggestions.forEach((item) => { item.included = true; item.text = ' '; });
  assert.throws(() => selectedMachineTranslationSegments(proposal), /nonempty/);
  assert.deepEqual(m, original);
});

test('large requests are batched within both service limits and retain every segment', async () => {
  const m = source();
  m.sections[0]!.blocks = Array.from({ length: 310 }, (_, i) => ({ id: `block-${i}`, type: 'paragraph' as const, content: 'x'.repeat(1000) }));
  const sizes: number[] = [];
  const proposal = await requestMachineTranslationSuggestions(m, { kind: 'manuscript', id: m.id }, 'en', undefined, async (request) => {
    assert.ok(request.segments.length <= 150);
    assert.ok(request.segments.reduce((sum, item) => sum + item.text.length, 0) <= 75_000);
    sizes.push(request.segments.length); return response(request);
  });
  assert.ok(sizes.length > 1);
  assert.equal(proposal.suggestions.length, 312);
  assert.equal(new Set(proposal.suggestions.map((item) => item.id)).size, 312);
});

test('cancellation stops further batches and never returns a partial proposal', async () => {
  const m = source(); m.sections[0]!.blocks = Array.from({ length: 151 }, (_, i) => ({ id: `block-${i}`, type: 'paragraph' as const, content: 'text' }));
  const controller = new AbortController(); let calls = 0;
  await assert.rejects(requestMachineTranslationSuggestions(m, { kind: 'manuscript', id: m.id }, 'en', controller.signal, async (request) => {
    calls++; controller.abort(); return response(request);
  }), { name: 'AbortError' });
  assert.equal(calls, 1);
  assert.equal(getTranslationModel(m).variants.length, 0);
});

test('incomplete, duplicate and foreign response anchors are rejected', async () => {
  for (const mode of ['incomplete', 'duplicate', 'foreign']) {
    const m = source();
    await assert.rejects(requestMachineTranslationSuggestions(m, { kind: 'manuscript', id: m.id }, 'en', undefined, async (request) => {
      const result = response(request);
      if (mode === 'incomplete') result.segments.pop();
      if (mode === 'duplicate') result.segments[1]!.id = result.segments[0]!.id;
      if (mode === 'foreign') result.segments[0]!.id = 'other';
      return result;
    }), /translation response/);
    assert.equal(getTranslationModel(m).variants.length, 0);
  }
});

test('same-language, absent-scope and oversized requests fail before contacting DeepL', async () => {
  const m = source(); let calls = 0;
  const translator = async (request: DeepLTranslationRequest) => { calls++; return response(request); };
  await assert.rejects(requestMachineTranslationSuggestions(m, { kind: 'manuscript', id: m.id }, 'hu', undefined, translator));
  await assert.rejects(requestMachineTranslationSuggestions(m, { kind: 'section', id: 'missing' }, 'en', undefined, translator));
  m.sections[0]!.blocks[0]!.content = 'x'.repeat(75_001);
  await assert.rejects(requestMachineTranslationSuggestions(m, { kind: 'manuscript', id: m.id }, 'en', undefined, translator));
  assert.equal(calls, 0);
});

test('suggestion controls are translated for every primary interface language', () => {
  for (const locale of ['en', 'hu', 'de', 'fr', 'it', 'es', 'nl', 'pl', 'sk']) {
    const copy = getMachineTranslationCopy(locale);
    assert.ok(Object.values(copy).every((value) => value.trim().length > 0));
  }
});
